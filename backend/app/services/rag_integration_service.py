"""
RAG Integration Service
High-level service for RAG operations, database interactions, and business logic
"""
import uuid
import hashlib
import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
import structlog

from supabase import create_client
from app.config import settings
from app.services.rag_client import rag_client, RAGServiceError, RAGTimeoutError
from app.services.rag_core_service import rag_core_service
from app.models.schemas import (
    RAGDocument, RAGQueryRequestEnhanced, RAGQueryResponseEnhanced,
    RAGInitializationResponse, RAGStatusResponse, EnhancedChatResponse,
    RAGSource
)

logger = structlog.get_logger()

class RAGIntegrationService:
    def __init__(self):
        # Use service role key for backend operations
        service_key = settings.SUPABASE_SERVICE_KEY or settings.SUPABASE_KEY
        self.supabase = create_client(settings.SUPABASE_URL, service_key)
        self.confidence_threshold = settings.RAG_CONFIDENCE_THRESHOLD
        self.high_confidence_threshold = settings.RAG_HIGH_CONFIDENCE_THRESHOLD
    
    async def initialize_clone_rag(
        self,
        clone_id: str,
        user_id: str,
        force_reinitialize: bool = False
    ) -> RAGInitializationResponse:
        """Initialize RAG system for a clone"""
        
        # Check if already initializing
        if not force_reinitialize:
            existing_init = await self._get_active_initialization(clone_id)
            if existing_init:
                return RAGInitializationResponse(
                    initialization_id=existing_init["id"],
                    status="initializing",
                    message="Initialization already in progress"
                )
        
        # Get clone documents
        documents = await self._get_clone_documents(clone_id)
        if not documents:
            raise ValueError("No documents found for clone")
        
        # Create initialization record
        initialization_id = str(uuid.uuid4())
        await self._create_initialization_record(
            initialization_id, clone_id, user_id, len(documents)
        )
        
        # Start background initialization
        print(f"🚀 DEBUG: About to create background task for initialization - init_id: {initialization_id}")
        logger.info("Creating background task for RAG initialization", 
                   initialization_id=initialization_id, clone_id=clone_id, 
                   document_count=len(documents))
        
        asyncio.create_task(
            self._process_initialization(initialization_id, clone_id, documents)
        )
        print(f"✅ DEBUG: Background task created successfully")
        
        estimated_time = self._estimate_processing_time(documents)
        
        return RAGInitializationResponse(
            initialization_id=initialization_id,
            status="initializing",
            estimated_duration_seconds=estimated_time,
            document_count=len(documents),
            message="RAG initialization started"
        )
    
    async def query_clone_rag(
        self,
        clone_id: str,
        query: str,
        user_id: str,
        session_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> EnhancedChatResponse:
        """Query RAG system for a clone with fallback logic"""
        
        start_time = datetime.utcnow()
        
        # Check if RAG is available for this clone
        rag_status = await self.get_clone_rag_status(clone_id)
        
        if not rag_status.is_ready:
            # Fallback to standard chat
            return await self._fallback_response(query, context)
        
        try:
            # Prepare RAG request
            rag_request = RAGQueryRequestEnhanced(
                expert_name=clone_id,
                query=query,
                context=context or {},
                options={
                    "use_memory_layer": True,
                    "use_llm_fallback": False,
                    "max_tokens": 1500,
                    "temperature": 0.7,
                    "include_sources": True
                },
                personality_config=await self._get_personality_config(clone_id)
            )
            
            # Query RAG system using internal core service
            core_response = await rag_core_service.query_expert(
                expert_name=clone_id,
                query=query,
                context=context or {},
                options=rag_request.options
            )
            
            # Convert core response to enhanced RAG response format
            rag_response = RAGQueryResponseEnhanced(
                response=core_response["response"],
                confidence_score=core_response.get("confidence_score", 0.85),
                sources=[
                    RAGSource(
                        document_name=source.get("name", "Document"),
                        relevance_score=source.get("relevance_score", 0.9),
                        content_snippet=source.get("snippet", "")
                    ) for source in core_response.get("sources", [])
                ],
                query_type="expert_query",
                used_memory_layer=True,
                used_llm_fallback=False,
                used_personality_enhancement=False,
                expert_name=clone_id,
                processing_time_ms=core_response.get("processing_time_ms", 200),
                response_time_ms=core_response.get("processing_time_ms", 200),
                tokens_used=core_response.get("tokens_used", 0),
                thread_id=core_response.get("thread_id")
            )
            
            # Log query session
            await self._log_rag_query(clone_id, user_id, session_id, query, rag_response)
            
            # Determine response strategy based on confidence
            if rag_response.confidence_score >= self.high_confidence_threshold:
                response_type = "memory"
                final_content = rag_response.response
            elif rag_response.confidence_score >= self.confidence_threshold:
                response_type = "enhanced"
                final_content = await self._enhance_with_llm(rag_response, query, context)
            else:
                response_type = "fallback"
                return await self._fallback_response(query, context)
            
            response_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            
            return EnhancedChatResponse(
                content=final_content,
                query_type=response_type,
                rag_data=rag_response,
                confidence_score=rag_response.confidence_score,
                response_time_ms=response_time,
                tokens_used=rag_response.tokens_used
            )
            
        except RAGTimeoutError:
            logger.warning("RAG query timeout, using fallback", clone_id=clone_id)
            return await self._fallback_response(query, context, timeout=True)
            
        except RAGServiceError as e:
            logger.error("RAG service error, using fallback", clone_id=clone_id, error=str(e))
            return await self._fallback_response(query, context, error=str(e))
        
        except Exception as e:
            logger.error("Unexpected error in RAG query", clone_id=clone_id, error=str(e))
            return await self._fallback_response(query, context, error="system_error")
    
    async def update_clone_rag_documents(
        self,
        clone_id: str,
        knowledge_ids: List[str],
        operation: str = "add"
    ) -> Dict[str, Any]:
        """Update RAG system with new documents"""
        
        # Get documents by knowledge IDs
        documents = await self._get_documents_by_ids(knowledge_ids)
        if not documents:
            raise ValueError("No valid documents found")
        
        # Format documents for RAG
        rag_documents = await self._format_documents_for_rag(documents)
        
        try:
            # Update RAG system
            response = await rag_client.update_expert(
                expert_name=clone_id,
                operation=operation,
                documents=rag_documents
            )
            
            # Update database records
            await self._update_rag_document_status(knowledge_ids, "completed")
            await self._update_expert_document_count(clone_id, response["documents_added"])
            
            return response
            
        except Exception as e:
            logger.error("Failed to update RAG documents", clone_id=clone_id, error=str(e))
            await self._update_rag_document_status(knowledge_ids, "failed", str(e))
            raise
    
    async def get_clone_rag_status(self, clone_id: str) -> RAGStatusResponse:
        """Get RAG status for a clone"""
        
        try:
            # Get clone info
            clone_result = self.supabase.table("clones").select("rag_enabled, rag_status, rag_document_count, rag_last_sync").eq("id", clone_id).single().execute()
            
            if not clone_result.data or not clone_result.data.get("rag_enabled"):
                return RAGStatusResponse(
                    is_ready=False,
                    status="disabled",
                    document_count=0
                )
            
            clone_data = clone_result.data
            
            # Get expert info (use execute() instead of single() to handle 0 rows)
            expert_result = self.supabase.table("rag_experts").select("*").eq("clone_id", clone_id).execute()
            
            if expert_result.data and len(expert_result.data) > 0:
                expert_data = expert_result.data[0]  # Get first (and only) result
                is_ready = expert_data["initialization_status"] == "completed"
                
                return RAGStatusResponse(
                    is_ready=is_ready,
                    status=expert_data["initialization_status"],
                    document_count=expert_data["document_count"],
                    last_initialized=expert_data.get("initialization_time"),
                    error_message=expert_data.get("error_message")
                )
            else:
                # No expert record exists, check if there's an active initialization
                try:
                    init_result = self.supabase.table("rag_initializations").select("*").eq("clone_id", clone_id).order("created_at", desc=True).limit(1).execute()
                    
                    if init_result.data and len(init_result.data) > 0:
                        latest_init = init_result.data[0]
                        if latest_init["status"] in ["pending", "analyzing", "embedding", "storing", "finalizing"]:
                            return RAGStatusResponse(
                                is_ready=False,
                                status="initializing",
                                document_count=clone_data.get("rag_document_count", 0),
                                error_message=None
                            )
                        elif latest_init["status"] == "failed":
                            return RAGStatusResponse(
                                is_ready=False,
                                status="failed",
                                document_count=clone_data.get("rag_document_count", 0),
                                error_message=latest_init.get("error_message")
                            )
                except Exception as init_error:
                    logger.warning("Failed to check initialization status", clone_id=clone_id, error=str(init_error))
                
                # Default: not initialized
                return RAGStatusResponse(
                    is_ready=False,
                    status="not_initialized",
                    document_count=clone_data.get("rag_document_count", 0)
                )
                
        except Exception as e:
            logger.error("Failed to get RAG status", clone_id=clone_id, error=str(e))
            return RAGStatusResponse(
                is_ready=False,
                status="error",
                error_message=str(e)
            )
    
    async def get_initialization_status(self, initialization_id: str) -> Dict[str, Any]:
        """Get initialization status"""
        
        try:
            # Use service client to bypass RLS policies (use execute() instead of single() to handle 0 rows)
            result = self.supabase.table("rag_initializations").select("*").eq("id", initialization_id).execute()
            
            if not result.data or len(result.data) == 0:
                logger.warning("Initialization record not found", init_id=initialization_id)
                
                # Check if there's a recent initialization for any clone that might be related
                recent_init_result = self.supabase.table("rag_initializations").select("*").order("created_at", desc=True).limit(1).execute()
                
                if recent_init_result.data and len(recent_init_result.data) > 0:
                    recent_init = recent_init_result.data[0]
                    logger.info("Found recent initialization, returning its status", 
                               recent_init_id=recent_init["id"], 
                               requested_init_id=initialization_id)
                    
                    # Return the recent initialization status but with the requested ID
                    return {
                        "id": initialization_id,  # Keep the requested ID for frontend compatibility
                        "status": recent_init["status"],
                        "progress": recent_init.get("progress_percentage", 0),
                        "phase": recent_init.get("current_phase", ""),
                        "processedDocuments": recent_init.get("processed_documents", 0),
                        "totalDocuments": recent_init.get("total_documents", 0),
                        "failedDocuments": recent_init.get("failed_documents", []),
                        "error": recent_init.get("error_message"),
                        "completed": recent_init["status"] in ["completed", "failed"],
                        "success": recent_init["status"] == "completed",
                        "note": f"Redirected to recent initialization {recent_init['id']}"
                    }
                else:
                    # No recent initializations found
                    return {
                        "id": initialization_id,
                        "status": "expired",
                        "progress": 0,
                        "phase": "Initialization expired or not found",
                        "processedDocuments": 0,
                        "totalDocuments": 0,
                        "failedDocuments": [],
                        "error": "Initialization record not found - please restart RAG setup",
                        "completed": True,
                        "success": False
                    }
            
            data = result.data[0]  # Get first (and only) result
            return {
                "id": data["id"],
                "status": data["status"],
                "progress": data["progress_percentage"] or 0,
                "phase": data["current_phase"] or "",
                "processedDocuments": data["processed_documents"] or 0,
                "totalDocuments": data["total_documents"] or 0,
                "failedDocuments": data.get("failed_documents", []),
                "error": data.get("error_message"),
                "completed": data["status"] in ["completed", "failed"],
                "success": data["status"] == "completed"
            }
            
        except Exception as e:
            logger.error("Failed to get initialization status", init_id=initialization_id, error=str(e))
            # Return a valid response instead of error to prevent 404
            return {
                "id": initialization_id,
                "status": "error",
                "progress": 0,
                "phase": "Database error",
                "processedDocuments": 0,
                "totalDocuments": 0,
                "failedDocuments": [],
                "error": f"Database error: {str(e)}",
                "completed": True,
                "success": False
            }
    
    # Private helper methods
    async def _get_clone_documents(self, clone_id: str) -> List[Dict]:
        """Get all documents for a clone"""
        result = self.supabase.table("knowledge").select("*").eq("clone_id", clone_id).execute()
        return result.data or []
    
    async def _get_documents_by_ids(self, knowledge_ids: List[str]) -> List[Dict]:
        """Get documents by knowledge IDs"""
        result = self.supabase.table("knowledge").select("*").in_("id", knowledge_ids).execute()
        return result.data or []
    
    async def _format_documents_for_rag(self, documents: List[Dict]) -> List[RAGDocument]:
        """Format documents for RAG API"""
        rag_documents = []
        
        for doc in documents:
            try:
                # Extract content based on type
                content = await self._extract_document_content(doc)
                
                rag_doc = RAGDocument(
                    name=doc.get("file_name") or doc["title"],
                    url=doc.get("file_url"),
                    content=content,
                    metadata={
                        "knowledge_id": doc["id"],
                        "file_type": doc.get("file_type"),
                        "file_size": doc.get("file_size_bytes"),
                        "tags": doc.get("tags", [])
                    }
                )
                rag_documents.append(rag_doc)
                
            except Exception as e:
                logger.warning("Failed to format document", doc_id=doc["id"], error=str(e))
        
        return rag_documents
    
    async def _extract_document_content(self, document: Dict) -> str:
        """Extract text content from document"""
        # For now, return content preview or empty string
        # In production, you'd implement proper document parsing
        content = document.get("content_preview")
        if content is None:
            # Fallback to title and description if no content preview
            title = document.get("title", "")
            description = document.get("description", "")
            return f"{title}\n{description}".strip() or "Document content not available"
        return str(content)
    
    async def _get_active_initialization(self, clone_id: str) -> Optional[Dict]:
        """Check for active initialization"""
        result = self.supabase.table("rag_initializations").select("*").eq("clone_id", clone_id).eq("status", "pending").execute()
        return result.data[0] if result.data else None
    
    async def _create_initialization_record(self, init_id: str, clone_id: str, user_id: str, doc_count: int):
        """Create initialization tracking record"""
        self.supabase.table("rag_initializations").insert({
            "id": init_id,
            "clone_id": clone_id,
            "user_id": user_id,
            "total_documents": doc_count,
            "status": "pending"
        }).execute()
    
    async def _process_initialization(self, init_id: str, clone_id: str, documents: List[Dict]):
        """Background task to process initialization with detailed progress tracking"""
        initialization_start = datetime.utcnow()
        
        async def progress_callback(phase: str, percentage: int, description: str):
            """Callback to update initialization progress in database"""
            try:
                await self._update_initialization_status(init_id, phase, percentage, description)
                logger.info(f"📊 Initialization progress update", 
                           init_id=init_id, clone_id=clone_id, 
                           phase=phase, percentage=percentage, description=description)
            except Exception as e:
                logger.error("Failed to update initialization progress", error=str(e))
        
        try:
            print(f"🚀 DEBUG: Starting RAG initialization background task - init_id: {init_id}, clone_id: {clone_id}, documents: {len(documents)}")
            logger.info("🚀 Starting RAG initialization background task", 
                       init_id=init_id, clone_id=clone_id, document_count=len(documents))
            
            # Update status to analyzing
            await progress_callback("analyzing", 10, "Analyzing document structure and content")
            
            logger.info("🔍 Analyzing documents for RAG processing", 
                       clone_id=clone_id, total_documents=len(documents))
            
            # Log document details for debugging
            for i, doc in enumerate(documents):
                content_preview = doc.get('content_preview', '')
                content_length = len(content_preview or '')
                print(f"📄 DEBUG: Document {i+1}: {doc.get('title', 'Untitled')} - ID: {doc.get('id')}, has_url: {bool(doc.get('file_url'))}, content_length: {content_length}")
                logger.info(f"📄 Document {i+1}: {doc.get('title', 'Untitled')}", 
                           document_id=doc.get('id'), 
                           file_url=bool(doc.get('file_url')),
                           content_preview_length=content_length,
                           has_content=content_preview is not None)
            
            await progress_callback("preparing", 20, "Preparing documents for embedding")
            
            # Initialize RAG expert directly using core service (pass original documents)
            logger.info("⚙️ Initializing RAG expert memory", clone_id=clone_id)
            
            result = await rag_core_service.initialize_expert_memory(
                expert_name=clone_id,
                domain_name="general", 
                documents=documents,  # Pass original documents from knowledge table
                config={},
                user_id=None,  # Service call doesn't need user_id
                progress_callback=progress_callback  # Pass progress callback
            )
            
            logger.info("✅ RAG core initialization completed", 
                       clone_id=clone_id, result_status=result.get("status"))
            
            await progress_callback("storing", 90, "Storing expert configuration")
            
            # Create/update expert record
            logger.info("💾 Creating/updating expert record in database", clone_id=clone_id)
            await self._create_or_update_expert_record(clone_id, result, len(documents))
            
            await progress_callback("finalizing", 95, "Finalizing memory layer setup")
            
            # Update clone status
            logger.info("🔄 Updating clone RAG status", clone_id=clone_id)
            await self._update_clone_rag_status(clone_id, "ready", len(documents))
            
            # Complete initialization
            await self._complete_initialization(init_id, True)
            
            total_time = (datetime.utcnow() - initialization_start).total_seconds()
            logger.info("🎉 RAG initialization completed successfully", 
                       clone_id=clone_id, init_id=init_id,
                       total_time_seconds=total_time,
                       document_count=len(documents),
                       vector_store_id=result.get("vector_store_id"),
                       assistant_id=result.get("assistant_id"))
            
        except Exception as e:
            total_time = (datetime.utcnow() - initialization_start).total_seconds()
            print(f"❌ DEBUG: RAG initialization failed - {str(e)}")
            import traceback
            print(f"❌ DEBUG: Full traceback - {traceback.format_exc()}")
            
            logger.error("❌ RAG initialization failed", 
                        clone_id=clone_id, init_id=init_id,
                        error=str(e), elapsed_seconds=total_time,
                        error_type=type(e).__name__)
            
            try:
                error_msg = f"Initialization failed: {str(e)}"
                await progress_callback("failed", 0, error_msg[:90] + "..." if len(error_msg) > 90 else error_msg)
                await self._complete_initialization(init_id, False, str(e))
                await self._update_clone_rag_status(clone_id, "error", error_message=str(e))
            except Exception as cleanup_error:
                print(f"❌ DEBUG: Error during cleanup - {str(cleanup_error)}")
                logger.error("Error during initialization cleanup", error=str(cleanup_error))
    
    async def _update_initialization_status(self, init_id: str, status: str, progress: int, phase: str = ""):
        """Update initialization status"""
        self.supabase.table("rag_initializations").update({
            "status": status,
            "progress_percentage": progress,
            "current_phase": phase
        }).eq("id", init_id).execute()
    
    async def _complete_initialization(self, init_id: str, success: bool, error_message: str = None):
        """Complete initialization process"""
        status = "completed" if success else "failed"
        update_data = {
            "status": status,
            "progress_percentage": 100,
            "completed_at": datetime.utcnow().isoformat()
        }
        if error_message:
            update_data["error_message"] = error_message
        
        self.supabase.table("rag_initializations").update(update_data).eq("id", init_id).execute()
    
    async def _create_or_update_expert_record(self, clone_id: str, rag_result: Dict, doc_count: int):
        """Create or update RAG expert record"""
        expert_data = {
            "clone_id": clone_id,
            "expert_name": clone_id,
            "rag_system_id": rag_result.get("expert_id"),
            "initialization_status": "completed",
            "document_count": doc_count,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Try to update existing record first
        existing = self.supabase.table("rag_experts").select("id").eq("clone_id", clone_id).execute()
        
        if existing.data:
            self.supabase.table("rag_experts").update(expert_data).eq("clone_id", clone_id).execute()
        else:
            self.supabase.table("rag_experts").insert(expert_data).execute()
    
    async def _update_clone_rag_status(self, clone_id: str, status: str, doc_count: int = None, error_message: str = None):
        """Update clone RAG status"""
        update_data = {
            "rag_status": status,
            "rag_last_sync": datetime.utcnow().isoformat()
        }
        if doc_count is not None:
            update_data["rag_document_count"] = doc_count
        
        self.supabase.table("clones").update(update_data).eq("id", clone_id).execute()
    
    async def _log_rag_query(self, clone_id: str, user_id: str, session_id: Optional[str], query: str, response: RAGQueryResponseEnhanced):
        """Log RAG query session"""
        try:
            self.supabase.table("rag_query_sessions").insert({
                "clone_id": clone_id,
                "user_id": user_id,
                "session_id": session_id,
                "query_text": query,
                "rag_response": response.response,
                "confidence_score": response.confidence_score,
                "query_type": response.query_type,
                "used_memory_layer": response.used_memory_layer,
                "used_llm_fallback": response.used_llm_fallback,
                "source_documents": [source.dict() for source in response.sources],
                "tokens_used": response.tokens_used,
                "response_time_ms": response.response_time_ms
            }).execute()
        except Exception as e:
            logger.warning("Failed to log RAG query", error=str(e))
    
    async def _get_personality_config(self, clone_id: str) -> Dict[str, Any]:
        """Get personality configuration for clone"""
        result = self.supabase.table("clones").select("personality_traits, communication_style, system_prompt, temperature").eq("id", clone_id).single().execute()
        
        if result.data:
            return {
                "personality_traits": result.data.get("personality_traits", {}),
                "communication_style": result.data.get("communication_style", {}),
                "system_prompt": result.data.get("system_prompt", ""),
                "temperature": result.data.get("temperature", 0.7)
            }
        return {}
    
    async def _enhance_with_llm(self, rag_response: RAGQueryResponseEnhanced, query: str, context: Dict) -> str:
        """Enhance RAG response with LLM (placeholder for now)"""
        # For now, return RAG response as-is
        # In production, you'd combine with OpenAI
        return rag_response.response
    
    async def _fallback_response(self, query: str, context: Dict, timeout: bool = False, error: str = None) -> EnhancedChatResponse:
        """Generate fallback response when RAG fails"""
        # Placeholder fallback response
        fallback_content = "I'm having some difficulty accessing my knowledge base right now. Let me try to help you with what I know."
        
        return EnhancedChatResponse(
            content=fallback_content,
            query_type="fallback",
            rag_data=None,
            confidence_score=0.0,
            response_time_ms=100,
            tokens_used=0
        )
    
    def _estimate_processing_time(self, documents: List[Dict]) -> int:
        """Estimate processing time based on documents"""
        base_time = 10
        doc_time = len(documents) * 2
        total_size = sum(doc.get("file_size_bytes", 0) for doc in documents)
        size_time = (total_size / (1024 * 1024)) * 0.5  # 0.5 seconds per MB
        
        return int(base_time + doc_time + size_time)
    
    async def _update_rag_document_status(self, knowledge_ids: List[str], status: str, error: str = None):
        """Update RAG processing status for documents"""
        update_data = {"rag_processing_status": status}
        if error:
            update_data["rag_processing_error"] = error
        
        for knowledge_id in knowledge_ids:
            self.supabase.table("knowledge").update(update_data).eq("id", knowledge_id).execute()
    
    async def _update_expert_document_count(self, clone_id: str, added_count: int):
        """Update expert document count"""
        expert = self.supabase.table("rag_experts").select("document_count").eq("clone_id", clone_id).single().execute()
        if expert.data:
            new_count = expert.data.get("document_count", 0) + added_count
            self.supabase.table("rag_experts").update({"document_count": new_count}).eq("clone_id", clone_id).execute()


# Global service instance
rag_integration_service = RAGIntegrationService()