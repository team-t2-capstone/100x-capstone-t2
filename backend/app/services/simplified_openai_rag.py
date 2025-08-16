"""
Simplified OpenAI Native RAG Service for CloneAI
Replaces complex custom RAG implementation with OpenAI's native capabilities
"""

import asyncio
import logging
import json
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path
import httpx
from openai import OpenAI
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class RAGDocument(BaseModel):
    """Document for processing"""
    title: str
    url: str
    content_type: str = "document"


class RAGResponse(BaseModel):
    """Simplified response model"""
    answer: str
    sources: List[str] = []
    confidence: float = 0.8
    thread_id: Optional[str] = None
    assistant_id: Optional[str] = None


class SimplifiedRAGService:
    """
    Simplified RAG service using OpenAI's native capabilities
    - Uses OpenAI file_search instead of custom vector search
    - Leverages OpenAI vector stores for document storage
    - Single responsibility: document processing and querying
    """
    
    def __init__(self):
        from ..config import settings
        from ..database import get_service_supabase
        
        self.settings = settings
        self.supabase = get_service_supabase()
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None
        
    async def __aenter__(self):
        """Async context manager"""
        if not self.settings.OPENAI_API_KEY:
            raise Exception("OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.")
        
        if not self.client:
            try:
                self.client = OpenAI(api_key=self.settings.OPENAI_API_KEY)
                # Test the client with a simple call
                models = self.client.models.list()
            except Exception as e:
                raise Exception(f"Failed to initialize OpenAI client: {str(e)}")
        
        if not self.supabase:
            raise Exception("Supabase client not available. Check database configuration.")
        
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Cleanup"""
        pass
    
    async def process_clone_documents(
        self, 
        clone_id: str, 
        clone_data: Dict[str, Any], 
        documents: Dict[str, str]
    ) -> Dict[str, Any]:
        """
        Process documents for a clone using OpenAI native RAG
        
        Steps:
        1. Create OpenAI vector store
        2. Upload documents to OpenAI
        3. Create Assistant with file_search
        4. Store minimal metadata in database
        """
        try:
            if not documents:
                return {"status": "failed", "error": "No documents provided"}
            
            # Step 1: Create vector store
            vector_store_name = f"clone_{clone_id}_{clone_data['name']}"
            vector_store = self.client.vector_stores.create(
                name=vector_store_name
            )
            
            # Step 2: Upload documents to OpenAI
            file_ids = []
            for doc_title, doc_url in documents.items():
                try:
                    file_id = await self._upload_document_to_openai(doc_url, doc_title)
                    file_ids.append(file_id)
                except Exception as e:
                    logger.warning(f"Failed to upload {doc_title}: {str(e)}")
                    continue
            
            if not file_ids:
                return {"status": "failed", "error": "No documents could be uploaded"}
            
            # Step 3: Add files to vector store
            self.client.vector_stores.file_batches.create(
                vector_store_id=vector_store.id,
                file_ids=file_ids
            )
            
            # Step 4: Create Assistant with file_search
            assistant_name = f"{clone_data['name']}_assistant"
            instructions = self._create_assistant_instructions(clone_data)
            
            assistant = self.client.beta.assistants.create(
                name=assistant_name,
                instructions=instructions,
                model="gpt-4o",
                tools=[{"type": "file_search"}],
                tool_resources={
                    "file_search": {
                        "vector_store_ids": [vector_store.id]
                    }
                }
            )
            
            # Step 5: Store minimal metadata
            await self._store_rag_metadata(clone_id, assistant.id, vector_store.id, file_ids)
            
            return {
                "status": "success",
                "assistant_id": assistant.id,
                "vector_store_id": vector_store.id,
                "processed_documents": len(file_ids),
                "message": f"Successfully processed {len(file_ids)} documents"
            }
            
        except Exception as e:
            logger.error(f"Document processing failed: {str(e)}")
            return {"status": "failed", "error": str(e)}
    
    async def query_clone(
        self, 
        clone_id: str, 
        query: str, 
        thread_id: Optional[str] = None
    ) -> RAGResponse:
        """
        Query clone using OpenAI Assistant with file_search
        """
        try:
            # Get assistant ID from database
            assistant_id = await self._get_assistant_id(clone_id)
            if not assistant_id:
                return RAGResponse(
                    answer="I'm not properly configured yet. Please process my knowledge base first.",
                    confidence=0.0
                )
            
            # Create or use existing thread
            if not thread_id:
                thread = self.client.beta.threads.create()
                thread_id = thread.id
            
            # Add message and run
            self.client.beta.threads.messages.create(
                thread_id=thread_id,
                role="user",
                content=query
            )
            
            run = self.client.beta.threads.runs.create(
                thread_id=thread_id,
                assistant_id=assistant_id
            )
            
            # Wait for completion
            while run.status in ["queued", "in_progress"]:
                await asyncio.sleep(1)
                run = self.client.beta.threads.runs.retrieve(
                    thread_id=thread_id,
                    run_id=run.id
                )
            
            if run.status == "completed":
                # Get response
                messages = self.client.beta.threads.messages.list(thread_id=thread_id, limit=1)
                if messages.data and messages.data[0].role == "assistant":
                    response_text = ""
                    for content in messages.data[0].content:
                        if content.type == "text":
                            response_text += content.text.value
                    
                    # Extract sources from annotations
                    sources = self._extract_sources_from_annotations(messages.data[0].content)
                    
                    return RAGResponse(
                        answer=response_text,
                        sources=sources,
                        thread_id=thread_id,
                        assistant_id=assistant_id
                    )
            
            return RAGResponse(
                answer="I'm sorry, I couldn't process your question right now.",
                confidence=0.0
            )
            
        except Exception as e:
            logger.error(f"Query failed: {str(e)}")
            return RAGResponse(
                answer="I'm experiencing technical difficulties. Please try again.",
                confidence=0.0
            )
    
    async def _upload_document_to_openai(self, url: str, title: str) -> str:
        """Upload document from URL to OpenAI"""
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            response.raise_for_status()
            
            # Create file object
            file_content = response.content
            filename = f"{title}.pdf" if not Path(url).suffix else Path(url).name
            
            # Upload to OpenAI
            file = self.client.files.create(
                file=(filename, file_content),
                purpose="assistants"
            )
            
            return file.id
    
    def _create_assistant_instructions(self, clone_data: Dict[str, Any]) -> str:
        """Create instructions for the assistant"""
        instructions = f"You are {clone_data['name']}."
        
        if bio := clone_data.get('bio'):
            instructions += f"\n\nAbout you: {bio}"
        
        if traits := clone_data.get('personality_traits'):
            trait_text = ", ".join([f"{k}: {v}" for k, v in traits.items() if v])
            instructions += f"\n\nYour personality: {trait_text}"
        
        if style := clone_data.get('communication_style', {}).get('style'):
            instructions += f"\n\nCommunication style: {style}"
        
        instructions += "\n\nUse the knowledge from uploaded documents to provide accurate, helpful responses. Always cite sources when possible."
        
        return instructions
    
    async def _store_rag_metadata(
        self, 
        clone_id: str, 
        assistant_id: str, 
        vector_store_id: str, 
        file_ids: List[str]
    ):
        """Store minimal RAG metadata in database"""
        if self.supabase:
            self.supabase.table("clones").update({
                "rag_assistant_id": assistant_id,
                "rag_status": "completed",
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", clone_id).execute()
            
            # Store processing metadata
            metadata = {
                "vector_store_id": vector_store_id,
                "file_ids": file_ids,
                "processed_at": datetime.utcnow().isoformat()
            }
            
            # Prepare update data - handle potential missing embedding_metadata column
            update_data = {
                "vector_store_status": "completed",
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Try to update with embedding_metadata, but handle gracefully if column doesn't exist
            try:
                update_data["embedding_metadata"] = metadata
                self.supabase.table("knowledge").update(update_data).eq("clone_id", clone_id).execute()
                logger.info(f"Updated knowledge entries with embedding metadata for clone {clone_id}")
            except Exception as e:
                if "embedding_metadata" in str(e) and ("not found" in str(e).lower() or "does not exist" in str(e).lower()):
                    # Column doesn't exist - update without it
                    logger.warning(f"embedding_metadata column not found, updating without it: {e}")
                    update_data.pop("embedding_metadata", None)
                    self.supabase.table("knowledge").update(update_data).eq("clone_id", clone_id).execute()
                    logger.info(f"Updated knowledge entries without embedding metadata for clone {clone_id}")
                else:
                    # Different error - re-raise
                    logger.error(f"Failed to update knowledge entries for clone {clone_id}: {e}")
                    raise
    
    async def _get_assistant_id(self, clone_id: str) -> Optional[str]:
        """Get assistant ID from database"""
        if not self.supabase:
            return None
        
        result = self.supabase.table("clones").select("rag_assistant_id").eq("id", clone_id).execute()
        
        if result.data and result.data[0].get("rag_assistant_id"):
            return result.data[0]["rag_assistant_id"]
        
        return None
    
    def _extract_sources_from_annotations(self, content_list) -> List[str]:
        """Extract source documents from OpenAI response annotations"""
        sources = []
        for content in content_list:
            if hasattr(content, 'text') and hasattr(content.text, 'annotations'):
                for annotation in content.text.annotations:
                    if hasattr(annotation, 'file_citation'):
                        sources.append(annotation.file_citation.file_id)
        return list(set(sources))  # Remove duplicates


# Convenience functions for API integration
async def process_clone_knowledge(
    clone_id: str,
    clone_data: Dict[str, Any],
    documents: Dict[str, str]
) -> Dict[str, Any]:
    """Process clone knowledge using simplified service"""
    async with SimplifiedRAGService() as service:
        return await service.process_clone_documents(clone_id, clone_data, documents)


async def query_clone(clone_id: str, query: str, thread_id: Optional[str] = None) -> RAGResponse:
    """Query clone using simplified service"""
    async with SimplifiedRAGService() as service:
        return await service.query_clone(clone_id, query, thread_id)


async def validate_rag_configuration() -> Dict[str, Any]:
    """Validate RAG configuration"""
    from ..config import settings
    from ..database import get_service_supabase
    
    validation_result = {
        "valid": False,
        "openai_configured": False,
        "supabase_configured": False,
        "errors": [],
        "suggestions": []
    }
    
    # Check OpenAI configuration
    if not settings.OPENAI_API_KEY:
        validation_result["errors"].append("OPENAI_API_KEY not configured")
        validation_result["suggestions"].append("Set OPENAI_API_KEY environment variable")
    else:
        try:
            # Test OpenAI client
            test_client = OpenAI(api_key=settings.OPENAI_API_KEY)
            models = test_client.models.list()
            validation_result["openai_configured"] = True
        except Exception as e:
            validation_result["errors"].append(f"OpenAI API validation failed: {str(e)}")
            validation_result["suggestions"].append("Verify OpenAI API key is valid")
    
    # Check Supabase configuration
    try:
        supabase = get_service_supabase()
        if supabase:
            # Test with a simple query
            test_result = supabase.table("clones").select("id").limit(1).execute()
            validation_result["supabase_configured"] = True
        else:
            validation_result["errors"].append("Supabase client not available")
            validation_result["suggestions"].append("Check Supabase configuration")
    except Exception as e:
        validation_result["errors"].append(f"Supabase connection failed: {str(e)}")
        validation_result["suggestions"].append("Verify Supabase credentials")
    
    validation_result["valid"] = (
        validation_result["openai_configured"] and 
        validation_result["supabase_configured"]
    )
    
    return validation_result