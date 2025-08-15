"""
RAG Workflow Orchestrator
Maps CloneAI concepts to RAG API structure and orchestrates document processing workflows
"""
import asyncio
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
import uuid
import structlog

from app.services.rag_integration import RAGIntegrationService, RAGServiceError, process_clone_knowledge_simple, query_clone_expert_simple
from app.database import get_supabase, get_service_supabase
from app.models.schemas import RAGProcessingStatus
from app.config import settings

logger = structlog.get_logger()


class RAGWorkflowError(Exception):
    """Base exception for RAG workflow errors"""
    pass


class RAGWorkflow:
    """Orchestrates RAG workflows for CloneAI clones"""
    
    def __init__(self, rag_service: RAGIntegrationService = None):
        self.rag_service = rag_service or RAGIntegrationService()
        self.supabase = get_service_supabase() or get_supabase()  # Use service client for admin operations
    
    def _get_expert_name(self, clone_name: str, clone_id: str) -> str:
        """Generate consistent expert name for RAG API"""
        # Clean clone name for use as expert name
        expert_name = clone_name.replace(" ", "_").lower()
        # Add clone ID suffix to ensure uniqueness
        expert_name = f"{expert_name}_{clone_id[:8]}"
        return expert_name
    
    def _get_memory_type_from_professional_title(self, professional_title: str) -> str:
        """Map professional title to appropriate memory type for RAG queries"""
        if not professional_title:
            return "expert"
        
        title_lower = professional_title.lower()
        
        # Map different professional titles to memory types
        # "llm" - Pure LLM without RAG (for general knowledge)
        # "domain" - Domain-specific knowledge 
        # "expert" - Expert-specific knowledge (default)
        # "client" - Client-specific knowledge
        
        if any(keyword in title_lower for keyword in [
            "researcher", "scientist", "analyst", "academic", "professor", "phd"
        ]):
            return "domain"  # Use domain knowledge for research/academic roles
        elif any(keyword in title_lower for keyword in [
            "consultant", "advisor", "coach", "mentor", "counselor"
        ]):
            return "client"  # Use client-specific knowledge for advisory roles
        elif any(keyword in title_lower for keyword in [
            "general", "generalist", "assistant", "helper"
        ]):
            return "llm"  # Use pure LLM for general assistance roles
        else:
            return "expert"  # Default to expert-specific knowledge
    
    def _get_domain_name(self, category: str) -> str:
        """Map clone category to RAG domain name"""
        domain_mapping = {
            "medical": "health_wellness",
            "business": "business_strategy", 
            "education": "education_learning",
            "finance": "finance_investment",
            "coaching": "life_coaching",
            "legal": "legal_consulting",
            "ai": "artificial_intelligence",
            "other": "general_expertise"
        }
        return domain_mapping.get(category.lower(), "general_expertise")
    
    async def initialize_clone_expert(
        self,
        clone_id: str,
        clone_name: str,
        category: str,
        qa_pairs: List[Dict[str, str]] = None,
        document_urls: Dict[str, str] = None
    ) -> Dict[str, Any]:
        """
        Initialize a new expert in RAG system for a clone
        This is called when a clone is created and ready to be published
        """
        try:
            # RAG service is always available with direct integration
            # if not self.rag_service.is_available():
            #     logger.warning("RAG service not available, skipping expert initialization")
            #     return {"status": "skipped", "reason": "RAG service unavailable"}
            
            expert_name = self._get_expert_name(clone_name, clone_id)
            domain_name = self._get_domain_name(category)
            
            logger.info("Initializing RAG expert", 
                       clone_id=clone_id,
                       expert_name=expert_name,
                       domain_name=domain_name)
            
            # Initialize expert memory with domain, persona, and documents
            result = await self.rag_service.initialize_expert_memory(
                expert_name=expert_name,
                domain_name=domain_name,
                qa_pairs=qa_pairs or [],
                document_urls=document_urls or {}
            )
            
            # Update clone record in Supabase with RAG information
            await self._update_clone_rag_info(
                clone_id=clone_id,
                expert_name=expert_name,
                domain_name=domain_name,
                rag_status="initialized"
            )
            
            logger.info("RAG expert initialized successfully",
                       clone_id=clone_id,
                       expert_name=expert_name)
            
            return {
                "status": "success",
                "expert_name": expert_name,
                "domain_name": domain_name,
                "result": result
            }
            
        except RAGServiceError as e:
            logger.error("RAG service error during expert initialization",
                        clone_id=clone_id,
                        error=str(e))
            return {"status": "failed", "error": str(e)}
        except Exception as e:
            logger.error("Unexpected error during expert initialization",
                        clone_id=clone_id,
                        error=str(e))
            return {"status": "failed", "error": str(e)}
    
    async def process_documents_for_clone(
        self,
        clone_id: str,
        document_urls: Dict[str, str],
        update_persona: bool = False,
        qa_pairs: List[Dict[str, str]] = None
    ) -> RAGProcessingStatus:
        """
        Process uploaded documents for a clone's knowledge base
        This is triggered when users upload documents and click Next/Save & Exit
        """
        try:
            # RAG service is always available with direct integration
            # if not self.rag_service.is_available():
            #     logger.warning("RAG service not available, skipping document processing")
            #     return RAGProcessingStatus(
            #         status="skipped",
            #         message="RAG service unavailable"
            #     )
            
            # Get clone info from Supabase
            clone_response = self.supabase.table("clones").select("*").eq("id", clone_id).execute()
            
            if not clone_response.data:
                raise RAGWorkflowError(f"Clone {clone_id} not found")
            
            clone = clone_response.data[0]
            expert_name = self._get_expert_name(clone["name"], clone_id)
            
            logger.info("Processing documents for clone",
                       clone_id=clone_id,
                       expert_name=expert_name,
                       document_count=len(document_urls))
            
            # Process documents for clone knowledge base using simplified function
            processing_status = await process_clone_knowledge_simple(
                clone_id=clone_id,
                clone_name=clone["name"],
                document_urls=document_urls,
                clone_category=clone.get("category", "general"),
                clone_bio=clone.get("bio", ""),
                personality_traits=clone.get("personality_traits", {}),
                communication_style=clone.get("communication_style", {})
            )
            
            # Update persona if QA pairs provided (handled within initialize_expert_memory)
            if update_persona and qa_pairs:
                logger.info("QA pairs will be processed during expert initialization",
                           expert_name=expert_name)
            
            # Update processing status in Supabase
            processing_status_str = processing_status.get("status", "completed")
            await self._update_documents_processing_status(
                clone_id=clone_id,
                document_urls=list(document_urls.keys()),
                status=processing_status_str
            )
            
            logger.info("Document processing completed",
                       clone_id=clone_id,
                       status=processing_status_str)
            
            # Return compatible RAGProcessingStatus object
            return RAGProcessingStatus(
                status=processing_status_str,
                message=f"Processing {processing_status_str}. Processed {processing_status.get('processed_documents', 0)} documents.",
                expert_name=processing_status.get("expert_name", expert_name)
            )
            
        except RAGServiceError as e:
            logger.error("RAG service error during document processing",
                        clone_id=clone_id,
                        error=str(e))
            return RAGProcessingStatus(
                status="failed",
                message=str(e)
            )
        except Exception as e:
            logger.error("Unexpected error during document processing",
                        clone_id=clone_id,
                        error=str(e))
            return RAGProcessingStatus(
                status="failed",
                message=str(e)
            )
    
    async def query_clone_expert(
        self,
        clone_id: str,
        user_query: str,
        thread_id: str = None,
        user_id: str = None
    ) -> Dict[str, Any]:
        """
        Query a clone using RAG expert system
        Used for chat interactions
        """
        try:
            # RAG service is always available with direct integration
            # if not self.rag_service.is_available():
            #     raise RAGWorkflowError("RAG service not available for queries")
            
            # Get clone info
            clone_response = self.supabase.table("clones").select("*").eq("id", clone_id).execute()
            
            if not clone_response.data:
                raise RAGWorkflowError(f"Clone {clone_id} not found")
            
            clone = clone_response.data[0]
            expert_name = self._get_expert_name(clone["name"], clone_id)
            
            # Determine memory type based on professional title or default to expert
            memory_type = self._get_memory_type_from_professional_title(
                clone.get("professional_title", "")
            )
            
            logger.info("Querying clone expert",
                       clone_id=clone_id,
                       expert_name=expert_name,
                       professional_title=clone.get("professional_title", ""),
                       memory_type=memory_type,
                       query_length=len(user_query))
            
            # Query expert using simplified direct integration
            response = await query_clone_expert_simple(
                clone_id=clone_id,
                clone_name=clone["name"],
                query=user_query,
                memory_type=memory_type,
                thread_id=thread_id
            )
            
            logger.info("Expert query completed",
                       expert_name=expert_name,
                       response_length=len(response.get("response", "")))
            
            return {
                "response": response.get("response", ""),
                "thread_id": response.get("thread_id"),
                "assistant_id": response.get("assistant_id"),
                "expert_name": expert_name
            }
            
        except RAGServiceError as e:
            logger.error("RAG service error during query",
                        clone_id=clone_id,
                        error=str(e))
            raise RAGWorkflowError(f"Query failed: {str(e)}")
        except Exception as e:
            logger.error("Unexpected error during query",
                        clone_id=clone_id,
                        error=str(e))
            raise RAGWorkflowError(f"Query failed: {str(e)}")
    
    async def get_clone_processing_status(self, clone_id: str) -> Dict[str, Any]:
        """Get processing status for clone's knowledge base"""
        try:
            # Get documents for this clone
            docs_response = self.supabase.table("knowledge").select("*").eq("clone_id", clone_id).execute()
            
            total_docs = len(docs_response.data) if docs_response.data else 0
            processing_docs = sum(1 for doc in docs_response.data if doc.get("vector_store_status") == "processing") if docs_response.data else 0
            completed_docs = sum(1 for doc in docs_response.data if doc.get("vector_store_status") == "completed") if docs_response.data else 0
            failed_docs = sum(1 for doc in docs_response.data if doc.get("vector_store_status") == "failed") if docs_response.data else 0
            
            status = "pending"
            if total_docs > 0:
                if failed_docs > 0:
                    status = "failed"
                elif completed_docs == total_docs:
                    status = "completed"
                elif processing_docs > 0:
                    status = "processing"
            
            return {
                "clone_id": clone_id,
                "status": status,
                "total_documents": total_docs,
                "processing_documents": processing_docs,
                "completed_documents": completed_docs,
                "failed_documents": failed_docs,
                "progress_percentage": (completed_docs / total_docs * 100) if total_docs > 0 else 0
            }
            
        except Exception as e:
            logger.error("Error getting processing status",
                        clone_id=clone_id,
                        error=str(e))
            return {
                "clone_id": clone_id,
                "status": "error",
                "error": str(e)
            }
    
    async def _update_clone_rag_info(
        self,
        clone_id: str,
        expert_name: str,
        domain_name: str,
        rag_status: str
    ):
        """Update clone record with RAG integration info"""
        try:
            update_data = {
                "rag_expert_name": expert_name,
                "rag_domain_name": domain_name,
                "rag_status": rag_status,
                "rag_updated_at": datetime.utcnow().isoformat()
            }
            
            self.supabase.table("clones").update(update_data).eq("id", clone_id).execute()
            
        except Exception as e:
            logger.error("Failed to update clone RAG info",
                        clone_id=clone_id,
                        error=str(e))
    
    async def _update_documents_processing_status(
        self,
        clone_id: str,
        document_names: List[str],
        status: str
    ):
        """Update processing status for documents"""
        try:
            for doc_name in document_names:
                self.supabase.table("knowledge").update({
                    "vector_store_status": status,
                    "updated_at": datetime.utcnow().isoformat()
                }).eq("clone_id", clone_id).eq("title", doc_name).execute()
                
        except Exception as e:
            logger.error("Failed to update document processing status",
                        clone_id=clone_id,
                        error=str(e))


# Global workflow instance
rag_workflow = RAGWorkflow()


# Background task functions
async def process_clone_documents_background(
    clone_id: str,
    document_urls: Dict[str, str],
    qa_pairs: List[Dict[str, str]] = None
):
    """Background task to process documents for a clone"""
    try:
        result = await rag_workflow.process_documents_for_clone(
            clone_id=clone_id,
            document_urls=document_urls,
            update_persona=bool(qa_pairs),
            qa_pairs=qa_pairs
        )
        
        logger.info("Background document processing completed",
                   clone_id=clone_id,
                   status=result.status)
        
    except Exception as e:
        logger.error("Background document processing failed",
                    clone_id=clone_id,
                    error=str(e))


async def initialize_clone_expert_background(
    clone_id: str,
    clone_name: str,
    category: str,
    qa_pairs: List[Dict[str, str]] = None
):
    """Background task to initialize RAG expert for a clone"""
    try:
        result = await rag_workflow.initialize_clone_expert(
            clone_id=clone_id,
            clone_name=clone_name,
            category=category,
            qa_pairs=qa_pairs
        )
        
        logger.info("Background expert initialization completed",
                   clone_id=clone_id,
                   status=result["status"])
        
    except Exception as e:
        logger.error("Background expert initialization failed",
                    clone_id=clone_id,
                    error=str(e))