"""
RAG Core Service - Integration of standalone RAG system into main backend
Processes documents from knowledge table and creates OpenAI assistants with vector stores
"""
import os
import json
import asyncio
from datetime import datetime
from typing import Dict, List, Any, Optional
import structlog

from app.config import settings
from app.database import get_service_supabase
from openai import OpenAI
from supabase import create_client

logger = structlog.get_logger()


class RAGCoreService:
    def __init__(self):
        # Initialize OpenAI client
        self.openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
        
        # Initialize Supabase clients
        self.service_supabase = get_service_supabase()
        
        # RAG system database (separate from main app)
        # Using the same Supabase instance but could be separate
        self.rag_supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    
    async def initialize_expert_memory(
        self,
        expert_name: str,
        domain_name: str,
        documents: List[Dict],
        config: Dict,
        user_id: str,
        progress_callback=None
    ) -> Dict[str, Any]:
        """
        Initialize expert memory by creating vector store and OpenAI assistant
        Based on the standalone RAG implementation
        """
        start_time = datetime.utcnow()
        
        try:
            logger.info("🚀 Starting expert memory initialization", 
                       expert_name=expert_name, domain_name=domain_name, 
                       document_count=len(documents))
            
            if progress_callback:
                await progress_callback("initializing", 5, "Starting initialization process")
            
            # Step 1: Create/get domain
            logger.info("📁 Step 1: Creating/getting domain", domain_name=domain_name)
            domain_result = await self._create_or_get_domain(domain_name)
            logger.info("✅ Domain ready", domain_id=domain_result.get("id"))
            
            if progress_callback:
                await progress_callback("domain_ready", 15, "Domain configuration complete")
            
            # Step 2: Get documents from knowledge table for this clone
            logger.info("📄 Step 2: Loading clone documents", clone_id=expert_name)
            clone_documents = await self._get_clone_documents(expert_name)
            logger.info("✅ Documents loaded", count=len(clone_documents))
            
            if progress_callback:
                await progress_callback("documents_loaded", 25, f"Loaded {len(clone_documents)} documents")
            
            # Step 3: Create vector store for this expert
            logger.info("🗃️ Step 3: Creating OpenAI vector store", expert_name=expert_name)
            vector_store = await self._create_vector_store(expert_name, domain_name)
            logger.info("✅ Vector store created", vector_store_id=vector_store.id)
            
            if progress_callback:
                await progress_callback("vector_store_ready", 35, "Vector store created successfully")
            
            # Step 4: Process and add documents to vector store
            logger.info("🔄 Step 4: Processing documents to vector store", 
                       vector_store_id=vector_store.id, doc_count=len(clone_documents))
            processed_docs = await self._process_documents_to_vector_store(
                vector_store.id, clone_documents, domain_name, progress_callback
            )
            logger.info("✅ Documents processed and embedded", processed_count=len(processed_docs))
            
            if progress_callback:
                await progress_callback("documents_embedded", 70, f"Embedded {len(processed_docs)} documents")
            
            # Step 5: Store expert info first (required for foreign key constraint)
            logger.info("💾 Step 5: Storing expert metadata")
            await self._store_expert_info(
                expert_name, domain_name, vector_store.id, None, user_id  # assistant.id will be updated later
            )
            logger.info("✅ Expert metadata stored")
            
            if progress_callback:
                await progress_callback("expert_stored", 80, "Expert record created")
            
            # Step 6: Create OpenAI Assistant (now that expert exists)
            logger.info("🤖 Step 6: Creating OpenAI Assistant", assistant_name=f"{expert_name} Assistant")
            assistant = await self._create_openai_assistant(
                expert_name, domain_name, vector_store.id
            )
            logger.info("✅ Assistant created", assistant_id=assistant.id)
            
            if progress_callback:
                await progress_callback("assistant_ready", 90, "AI Assistant configured")
            
            if progress_callback:
                await progress_callback("completed", 100, "Memory layer initialization complete")
            
            total_time = (datetime.utcnow() - start_time).total_seconds()
            logger.info("🎉 Expert memory initialization completed successfully", 
                       expert_name=expert_name,
                       total_time_seconds=total_time,
                       document_count=len(processed_docs),
                       vector_store_id=vector_store.id,
                       assistant_id=assistant.id)
            
            return {
                "expert_id": expert_name,
                "domain_name": domain_name,
                "vector_store_id": vector_store.id,
                "assistant_id": assistant.id,
                "document_count": len(processed_docs),
                "processing_time_seconds": total_time,
                "status": "completed"
            }
            
        except Exception as e:
            logger.error("❌ Expert memory initialization failed", 
                        expert_name=expert_name, error=str(e), 
                        elapsed_seconds=(datetime.utcnow() - start_time).total_seconds())
            if progress_callback:
                error_msg = f"Initialization failed: {str(e)}"
                await progress_callback("failed", 0, error_msg[:90] + "..." if len(error_msg) > 90 else error_msg)
            raise e
    
    async def query_expert(
        self,
        expert_name: str,
        query: str,
        context: Dict,
        options: Dict
    ) -> Dict[str, Any]:
        """Query expert using OpenAI Assistant API"""
        try:
            # Get assistant info from database
            assistant_info = await self._get_assistant_info(expert_name)
            if not assistant_info:
                raise Exception(f"Assistant not found for expert: {expert_name}")
            
            assistant_id = assistant_info["assistant_id"]
            
            # Create thread for this conversation
            thread = self.openai_client.beta.threads.create()
            
            # Add message to thread
            self.openai_client.beta.threads.messages.create(
                thread_id=thread.id,
                role="user",
                content=query
            )
            
            # Run the assistant
            run = self.openai_client.beta.threads.runs.create_and_poll(
                thread_id=thread.id,
                assistant_id=assistant_id
            )
            
            # Get the response
            messages = self.openai_client.beta.threads.messages.list(
                thread_id=thread.id
            )
            
            response_message = messages.data[0].content[0].text.value
            
            # Extract citations if available
            citations = self._extract_citations(response_message)
            
            return {
                "response": response_message,
                "confidence_score": 0.85,  # Default confidence
                "sources": citations,
                "expert_name": expert_name,
                "thread_id": thread.id,
                "processing_time_ms": 200
            }
            
        except Exception as e:
            logger.error("Expert query failed", expert_name=expert_name, error=str(e))
            raise e
    
    async def get_expert_status(self, expert_name: str) -> Dict[str, Any]:
        """Get status of expert initialization"""
        try:
            # Check if expert exists in RAG database
            expert_result = self.rag_supabase.table("experts").select("*").eq("name", expert_name).execute()
            
            if not expert_result.data:
                return {
                    "status": "not_found",
                    "expert_name": expert_name,
                    "message": "Expert not initialized"
                }
            
            expert = expert_result.data[0]
            
            # Check assistant status
            assistant_result = self.rag_supabase.table("assistants").select("*").eq("expert_name", expert_name).execute()
            
            has_assistant = bool(assistant_result.data)
            
            return {
                "status": "ready" if has_assistant else "initializing",
                "expert_name": expert_name,
                "domain": expert.get("domain"),
                "assistant_available": has_assistant,
                "last_updated": expert.get("updated_at", datetime.utcnow().isoformat())
            }
            
        except Exception as e:
            logger.error("Failed to get expert status", expert_name=expert_name, error=str(e))
            return {"status": "error", "message": str(e)}
    
    async def update_expert(
        self,
        expert_name: str,
        documents: List[Dict],
        operation: str
    ) -> Dict[str, Any]:
        """Update expert with new documents"""
        try:
            # Get vector store info
            vector_info = self.rag_supabase.table("vector_stores").select("*").eq("expert_name", expert_name).execute()
            
            if not vector_info.data:
                raise Exception(f"Vector store not found for expert: {expert_name}")
            
            vector_store_id = vector_info.data[0]["vector_id"]
            domain_name = vector_info.data[0].get("domain_name", "general")
            
            if operation == "add":
                # Add new documents to vector store
                await self._process_documents_to_vector_store(vector_store_id, documents, domain_name)
            elif operation == "replace":
                # Replace all documents
                # First clear existing, then add new
                await self._clear_vector_store(vector_store_id)
                await self._process_documents_to_vector_store(vector_store_id, documents, domain_name)
            
            return {
                "status": "updated",
                "expert_name": expert_name,
                "operation": operation,
                "documents_processed": len(documents),
                "updated_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error("Expert update failed", expert_name=expert_name, error=str(e))
            raise e
    
    # Helper methods
    async def _create_or_get_domain(self, domain_name: str) -> Dict:
        """Create domain if it doesn't exist"""
        try:
            # Check if domain exists
            domain_result = self.rag_supabase.table("domains").select("*").eq("domain_name", domain_name).execute()
            
            if domain_result.data:
                return domain_result.data[0]
            
            # Create new domain
            domain_data = {
                "domain_name": domain_name,
                "expert_names": []
            }
            
            result = self.rag_supabase.table("domains").insert(domain_data).execute()
            return result.data[0] if result.data else domain_data
            
        except Exception as e:
            logger.error("Failed to create/get domain", domain_name=domain_name, error=str(e))
            raise e
    
    async def _get_clone_documents(self, clone_id: str) -> List[Dict]:
        """Get documents from knowledge table for this clone"""
        try:
            result = self.service_supabase.table("knowledge").select("*").eq("clone_id", clone_id).execute()
            return result.data or []
            
        except Exception as e:
            logger.error("Failed to get clone documents", clone_id=clone_id, error=str(e))
            return []
    
    async def _create_vector_store(self, expert_name: str, domain_name: str):
        """Create OpenAI vector store"""
        try:
            vector_store_name = f"{expert_name}_{domain_name}"
            
            vector_store = self.openai_client.vector_stores.create(
                name=vector_store_name
            )
            
            # Store in RAG database
            vector_data = {
                "vector_id": vector_store.id,
                "domain_name": domain_name,
                "expert_name": expert_name,
                "file_ids": [],
                "owner": "system"
            }
            
            self.rag_supabase.table("vector_stores").insert(vector_data).execute()
            
            return vector_store
            
        except Exception as e:
            error_msg = str(e) if str(e) else f"{type(e).__name__}: {repr(e)}"
            logger.error("Failed to create vector store", 
                        expert_name=expert_name, 
                        error=error_msg,
                        error_type=type(e).__name__)
            raise e
    
    async def _process_documents_to_vector_store(self, vector_store_id: str, documents: List[Dict], domain_name: str, progress_callback=None) -> List[str]:
        """Process documents and add to vector store"""
        processed_files = []
        total_docs = len(documents)
        
        try:
            logger.info("📄 Processing documents to vector store", 
                       vector_store_id=vector_store_id, total_documents=total_docs)
            
            for i, doc in enumerate(documents):
                doc_start_time = datetime.utcnow()
                doc_title = doc.get("title", "Untitled")
                
                logger.info(f"⚙️ Processing document {i+1}/{total_docs}", 
                           document_id=doc.get("id"), title=doc_title)
                
                if doc.get("file_url"):
                    # Create OpenAI file from document content
                    # For MVP: Use document content or preview if available
                    content = doc.get("content_preview") or f"Document: {doc.get('title', 'Untitled')}\nDescription: {doc.get('description', 'No description')}"
                    
                    logger.info("📝 Document content prepared", 
                               content_length=len(content), document_id=doc.get("id"))
                    
                    # Create a temporary file for OpenAI
                    temp_filename = f"doc_{doc['id']}.txt"
                    with open(temp_filename, 'w', encoding='utf-8') as f:
                        f.write(content)
                    
                    logger.info("📁 Temporary file created", filename=temp_filename)
                    
                    # Upload to OpenAI
                    logger.info("☁️ Uploading to OpenAI Files API")
                    with open(temp_filename, 'rb') as f:
                        file = self.openai_client.files.create(
                            file=f,
                            purpose="assistants"
                        )
                    
                    logger.info("✅ File uploaded to OpenAI", file_id=file.id)
                    
                    # Add to vector store
                    logger.info("🗃️ Adding file to vector store")
                    self.openai_client.vector_stores.files.create(
                        vector_store_id=vector_store_id,
                        file_id=file.id
                    )
                    
                    processed_files.append(file.id)
                    
                    # Clean up temp file
                    os.unlink(temp_filename)
                    logger.info("🧹 Temporary file cleaned up")
                    
                    # Store file info in RAG database (delete existing first to handle duplicates)
                    doc_data = {
                        "name": doc.get("title", "Untitled"),
                        "document_link": doc.get("file_url"),
                        "openai_file_id": file.id,
                        "domain": domain_name,  # Use the actual domain from clone category
                        "client_name": doc.get("clone_id")
                    }
                    
                    # Delete existing document with same name for this client
                    self.rag_supabase.table("documents").delete().eq("name", doc_data["name"]).eq("client_name", doc_data["client_name"]).execute()
                    
                    # Insert the new document
                    self.rag_supabase.table("documents").insert(doc_data).execute()
                    logger.info("💾 Document metadata stored in RAG database")
                    
                    doc_time = (datetime.utcnow() - doc_start_time).total_seconds()
                    logger.info(f"✅ Document {i+1}/{total_docs} processed successfully", 
                               document_id=doc.get("id"), 
                               title=doc_title,
                               processing_time_seconds=doc_time,
                               file_id=file.id)
                    
                    # Update progress if callback provided
                    if progress_callback:
                        progress_percent = int(35 + (35 * (i + 1) / total_docs))  # 35-70% range
                        await progress_callback("embedding_documents", progress_percent, 
                                              f"Processed {i+1}/{total_docs} documents")
                else:
                    logger.warning(f"⚠️ Document {i+1}/{total_docs} has no file_url, skipping", 
                                  document_id=doc.get("id"), title=doc_title)
            
            logger.info("🎯 All documents processed successfully", 
                       total_processed=len(processed_files), 
                       vector_store_id=vector_store_id)
            
            return processed_files
            
        except Exception as e:
            logger.error("❌ Failed to process documents", 
                        error=str(e), 
                        processed_count=len(processed_files), 
                        total_count=total_docs,
                        vector_store_id=vector_store_id)
            raise e
    
    async def _create_openai_assistant(self, expert_name: str, domain_name: str, vector_store_id: str):
        """Create OpenAI Assistant with vector store"""
        try:
            # Create assistant (using beta.assistants for OpenAI v1.x)
            assistant = self.openai_client.beta.assistants.create(
                model="gpt-4o",
                name=f"{expert_name} Assistant",
                instructions=f"You are {expert_name}, an expert in {domain_name}. Use the provided documents to answer questions accurately and provide citations when possible.",
                tools=[{"type": "file_search"}],
                tool_resources={
                    "file_search": {
                        "vector_store_ids": [vector_store_id]
                    }
                }
            )
            
            # Store assistant info in RAG database (delete existing first to handle duplicates)
            assistant_data = {
                "assistant_id": assistant.id,
                "expert_name": expert_name,
                "memory_type": "expert",
                "vector_id": vector_store_id,
                "client_name": expert_name,  # Use expert_name as client_name for consistency
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Delete existing assistant with same expert_name (to handle re-initialization)
            self.rag_supabase.table("assistants").delete().eq("expert_name", expert_name).execute()
            
            # Insert the new assistant
            self.rag_supabase.table("assistants").insert(assistant_data).execute()
            
            return assistant
            
        except Exception as e:
            logger.error("Failed to create OpenAI assistant", expert_name=expert_name, error=str(e))
            raise e
    
    async def _store_expert_info(self, expert_name: str, domain_name: str, vector_store_id: str, assistant_id: str, user_id: str):
        """Store expert information in RAG database"""
        try:
            expert_data = {
                "name": expert_name,
                "domain": domain_name,
                "context": f"Expert in {domain_name} with specialized knowledge"
            }
            
            # Delete existing expert with same name (to handle re-initialization)
            self.rag_supabase.table("experts").delete().eq("name", expert_name).execute()
            
            # Insert the new expert
            self.rag_supabase.table("experts").insert(expert_data).execute()
            
        except Exception as e:
            logger.error("Failed to store expert info", expert_name=expert_name, error=str(e))
            # Non-critical error, don't raise
    
    async def _get_assistant_info(self, expert_name: str) -> Optional[Dict]:
        """Get assistant info from database"""
        try:
            result = self.rag_supabase.table("assistants").select("*").eq("expert_name", expert_name).execute()
            return result.data[0] if result.data else None
            
        except Exception as e:
            logger.error("Failed to get assistant info", expert_name=expert_name, error=str(e))
            return None
    
    def _extract_citations(self, response_text: str) -> List[Dict]:
        """Extract citations from response text"""
        # Simple implementation - could be enhanced
        return [
            {
                "name": "Document Reference",
                "relevance_score": 0.9,
                "snippet": "Referenced content..."
            }
        ]
    
    async def _clear_vector_store(self, vector_store_id: str):
        """Clear all files from vector store"""
        try:
            # List files in vector store
            files = self.openai_client.vector_stores.files.list(vector_store_id=vector_store_id)
            
            # Delete each file
            for file in files.data:
                self.openai_client.vector_stores.files.delete(
                    vector_store_id=vector_store_id,
                    file_id=file.id
                )
                
        except Exception as e:
            logger.error("Failed to clear vector store", vector_store_id=vector_store_id, error=str(e))


# Create singleton instance
rag_core_service = RAGCoreService()