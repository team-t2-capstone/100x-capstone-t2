"""
RAG Direct Integration Layer

This module provides direct integration with RAG functionality,
using the extracted RAG core functions instead of HTTP service calls
for better performance and simplified architecture.
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel, Field

# Import our RAG core functions and models
from .rag_core import (
    get_openai_client,
    create_vector_store,
    create_files_for_vector_store,
    add_documents_to_vector_store,
    check_batch_status,
    query_expert_with_assistant,
    create_assistant,
    get_or_create_assistant,
    generate_persona_from_qa
)
from .rag_models import (
    InitializeExpertMemoryRequest,
    QueryRequest,
    QueryResponse,
    CreateAssistantRequest
)
from ..database import get_supabase

logger = logging.getLogger(__name__)


class RAGServiceError(Exception):
    """Custom exception for RAG service errors"""
    pass


class RAGDocumentStatus(BaseModel):
    """Status of a document being processed"""
    name: str
    url: str
    status: str  # 'pending', 'processing', 'completed', 'failed'
    file_id: Optional[str] = None
    error: Optional[str] = None


class RAGProcessingStatus(BaseModel):
    """Overall processing status for a clone's documents"""
    clone_id: str
    expert_name: str
    domain_name: str
    overall_status: str  # 'pending', 'processing', 'completed', 'failed', 'partial'
    documents: List[RAGDocumentStatus] = Field(default_factory=list)
    rag_assistant_id: Optional[str] = None
    processing_started: Optional[str] = None
    processing_completed: Optional[str] = None
    error_message: Optional[str] = None


class RAGIntegrationService:
    """Service for direct RAG integration using core functions"""
    
    def __init__(self):
        self.client = None
        self.supabase = None
    
    async def __aenter__(self):
        """Async context manager entry"""
        self.client = get_openai_client()
        self.supabase = get_supabase()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        # Nothing to cleanup for direct integration
        pass
    
    async def health_check(self) -> bool:
        """Check if RAG service components are available"""
        try:
            # Test OpenAI client
            if not self.client:
                return False
            
            # Test Supabase connection
            if not self.supabase:
                return False
                
            # Simple query to test database connectivity
            result = self.supabase.table("domains").select("id").limit(1).execute()
            return True
        except Exception as e:
            logger.warning(f"RAG service health check failed: {str(e)}")
            return False
    
    async def create_domain(self, domain_name: str) -> Dict[str, Any]:
        """Create or get existing domain in RAG service"""
        try:
            # Check if domain already exists
            existing = self.supabase.table("domains").select("*").eq("domain_name", domain_name).execute()
            
            if existing.data and len(existing.data) > 0:
                return existing.data[0]
            
            # Create new domain
            result = self.supabase.table("domains").insert({
                "domain_name": domain_name,
                "expert_names": []
            }).execute()
            
            return result.data[0] if result.data else {}
        except Exception as e:
            logger.error(f"Failed to create domain {domain_name}: {str(e)}")
            raise RAGServiceError(f"Failed to create domain: {str(e)}")
    
    async def get_domains(self) -> List[Dict[str, Any]]:
        """Get all domains from RAG service"""
        try:
            result = self.supabase.table("domains").select("*").execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Failed to get domains: {str(e)}")
            raise RAGServiceError(f"Failed to get domains: {str(e)}")
    
    async def create_expert(self, expert_name: str, domain_name: str, context: str) -> Dict[str, Any]:
        """Create an expert in RAG service"""
        try:
            # Ensure domain exists
            await self.create_domain(domain_name)
            
            # Check if expert already exists
            existing = self.supabase.table("experts").select("*").eq("name", expert_name).execute()
            
            if existing.data and len(existing.data) > 0:
                return existing.data[0]
            
            # Create new expert
            result = self.supabase.table("experts").insert({
                "name": expert_name,
                "domain": domain_name,
                "context": context
            }).execute()
            
            return result.data[0] if result.data else {}
        except Exception as e:
            logger.error(f"Failed to create expert {expert_name}: {str(e)}")
            raise RAGServiceError(f"Failed to create expert: {str(e)}")
    
    async def get_expert(self, expert_name: str) -> Optional[Dict[str, Any]]:
        """Get expert information from RAG service"""
        try:
            result = self.supabase.table("experts").select("*").eq("name", expert_name).execute()
            return result.data[0] if result.data and len(result.data) > 0 else None
        except Exception as e:
            logger.error(f"Failed to get expert {expert_name}: {str(e)}")
            return None
    
    async def initialize_expert_memory(
        self, 
        expert_name: str, 
        domain_name: str, 
        qa_pairs: List[Dict[str, str]], 
        document_urls: Dict[str, str]
    ) -> Dict[str, Any]:
        """Initialize an expert's memory with documents and persona using direct RAG functions"""
        try:
            logger.info(f"Initializing expert memory for {expert_name} in domain {domain_name}")
            
            # Step 1: Create domain if it doesn't exist
            await self.create_domain(domain_name)
            
            # Step 2: Generate persona from QA pairs
            persona_context = ""
            if qa_pairs:
                try:
                    persona_context = await generate_persona_from_qa(self.client, qa_pairs)
                    logger.info(f"Generated persona context for {expert_name}")
                except Exception as e:
                    logger.warning(f"Failed to generate persona for {expert_name}: {str(e)}")
                    # Use fallback context
                    persona_context = f"I am {expert_name}, an expert in {domain_name}."
            
            # Step 3: Create expert with generated context
            expert_data = await self.create_expert(expert_name, domain_name, persona_context)
            
            # Step 4: Create vector store for expert
            vector_store_name = f"{expert_name}_{domain_name}_vector_store"
            vector_store = await create_vector_store(self.client, vector_store_name)
            vector_store_id = vector_store.id
            
            # Step 5: Process documents and add to vector store
            file_ids = []
            batch_id = None
            status = "completed"
            
            if document_urls:
                try:
                    # Add documents to vector store
                    result = await add_documents_to_vector_store(
                        self.client,
                        vector_store_id,
                        document_urls,
                        domain_name,
                        expert_name
                    )
                    
                    file_ids = result.get("file_ids", [])
                    batch_id = result.get("batch_id")
                    status = result.get("status", "completed")
                    
                    logger.info(f"Added {len(file_ids)} documents to vector store {vector_store_id}")
                    
                    # Wait for batch processing to complete if needed
                    if batch_id and status not in ["completed", "failed"]:
                        max_attempts = 30  # 30 seconds timeout
                        for attempt in range(max_attempts):
                            try:
                                batch_status = await check_batch_status(self.client, vector_store_id, batch_id)
                                if batch_status.status in ["completed", "failed"]:
                                    status = batch_status.status
                                    break
                                await asyncio.sleep(1)
                            except Exception as e:
                                logger.warning(f"Error checking batch status: {str(e)}")
                                break
                    
                except Exception as e:
                    logger.error(f"Failed to process documents for {expert_name}: {str(e)}")
                    status = "partial_failure"
            
            # Step 6: Store vector store information in database
            try:
                vector_store_data = {
                    "vector_id": vector_store_id,
                    "domain_name": domain_name,
                    "expert_name": expert_name,
                    "file_ids": file_ids,
                    "owner": "expert"
                }
                
                if batch_id:
                    vector_store_data["batch_ids"] = [batch_id]
                    vector_store_data["latest_batch_id"] = batch_id
                
                self.supabase.table("vector_stores").insert(vector_store_data).execute()
                
            except Exception as e:
                logger.error(f"Failed to store vector store data: {str(e)}")
                # Continue execution as this is not critical
            
            # Step 7: Create assistant
            assistant_id = None
            try:
                assistant = await create_assistant(expert_name, "expert")
                assistant_id = assistant.id
                logger.info(f"Created assistant {assistant_id} for expert {expert_name}")
            except Exception as e:
                logger.error(f"Failed to create assistant for {expert_name}: {str(e)}")
            
            return {
                "status": status,
                "expert_name": expert_name,
                "domain_name": domain_name,
                "vector_store_id": vector_store_id,
                "file_ids": file_ids,
                "batch_id": batch_id,
                "assistant_id": assistant_id,
                "processed_documents": len(file_ids),
                "message": f"Successfully initialized expert memory with {len(file_ids)} documents"
            }
            
        except Exception as e:
            logger.error(f"Failed to initialize expert memory for {expert_name}: {str(e)}")
            raise RAGServiceError(f"Failed to initialize expert memory: {str(e)}")
    
    async def query_expert(
        self, 
        expert_name: str, 
        query: str, 
        memory_type: str = "expert",
        client_name: Optional[str] = None,
        thread_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Query an expert using direct RAG functions"""
        try:
            logger.info(f"Querying expert {expert_name} with query: {query}")
            
            result = await query_expert_with_assistant(
                expert_name=expert_name,
                query=query,
                memory_type=memory_type,
                client_name=client_name,
                thread_id=thread_id
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to query expert {expert_name}: {str(e)}")
            raise RAGServiceError(f"Failed to query expert: {str(e)}")
    
    async def create_assistant_for_expert(
        self, 
        expert_name: str, 
        memory_type: str = "expert",
        client_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create an OpenAI assistant for the expert using direct functions"""
        try:
            assistant = await get_or_create_assistant(expert_name, memory_type, client_name)
            
            return {
                "assistant_id": assistant.id,
                "expert_name": expert_name,
                "memory_type": memory_type,
                "client_name": client_name
            }
            
        except Exception as e:
            logger.error(f"Failed to create assistant for {expert_name}: {str(e)}")
            raise RAGServiceError(f"Failed to create assistant: {str(e)}")


# Utility functions for clone processing
async def process_clone_knowledge(
    clone_id: str,
    clone_name: str,
    clone_expertise: str,
    clone_background: str,
    personality_traits: str,
    documents: List[Dict[str, str]],
    links: List[Dict[str, str]]
) -> RAGProcessingStatus:
    """
    Process knowledge documents for a clone using direct RAG functions
    
    Args:
        clone_id: Unique identifier for the clone
        clone_name: Name of the clone
        clone_expertise: Expertise area of the clone
        clone_background: Background description
        personality_traits: Personality characteristics
        documents: List of uploaded documents
        links: List of web links
    
    Returns:
        RAGProcessingStatus object with processing results
    """
    
    # Map clone data to RAG service format
    expert_name = f"clone_{clone_id}_{clone_name.replace(' ', '_')}"
    domain_name = clone_expertise or "General Knowledge"
    
    # Create QA pairs from clone data for persona generation
    qa_pairs = [
        {"question": "What is your background?", "answer": clone_background or "No specific background provided"},
        {"question": "What is your area of expertise?", "answer": clone_expertise or "General knowledge"},
        {"question": "How would you describe your personality?", "answer": personality_traits or "Helpful and knowledgeable"}
    ]
    
    # Combine documents and links into document URLs
    document_urls = {}
    doc_statuses = []
    
    # Process uploaded documents
    for doc in documents:
        doc_name = doc.get('name', doc.get('title', 'Unknown Document'))
        doc_url = doc.get('url', doc.get('uploadedUrl', doc.get('file_path', '')))
        
        if doc_url:
            document_urls[doc_name] = doc_url
            doc_statuses.append(RAGDocumentStatus(
                name=doc_name,
                url=doc_url,
                status='pending'
            ))
    
    # Process web links
    for link in links:
        link_name = link.get('title', link.get('name', 'Web Link'))
        link_url = link.get('url', '')
        
        if link_url:
            document_urls[link_name] = link_url
            doc_statuses.append(RAGDocumentStatus(
                name=link_name,
                url=link_url,
                status='pending'
            ))
    
    processing_status = RAGProcessingStatus(
        clone_id=clone_id,
        expert_name=expert_name,
        domain_name=domain_name,
        overall_status='pending',
        documents=doc_statuses,
        processing_started=datetime.now().isoformat()
    )
    
    try:
        async with RAGIntegrationService() as rag_service:
            # Check if RAG service is available
            if not await rag_service.health_check():
                raise RAGServiceError("RAG service components are not available")
            
            processing_status.overall_status = 'processing'
            
            # Initialize expert memory using direct functions
            logger.info(f"Initializing expert memory for clone {clone_id}")
            result = await rag_service.initialize_expert_memory(
                expert_name=expert_name,
                domain_name=domain_name,
                qa_pairs=qa_pairs,
                document_urls=document_urls
            )
            
            # Update processing status based on result
            processing_status.overall_status = result.get('status', 'completed')
            processing_status.processing_completed = datetime.now().isoformat()
            processing_status.rag_assistant_id = result.get('assistant_id')
            
            # Update individual document statuses based on file processing
            processed_file_count = result.get('processed_documents', 0)
            if processed_file_count == len(doc_statuses):
                # All documents processed successfully
                for doc_status in processing_status.documents:
                    doc_status.status = 'completed'
                processing_status.overall_status = 'completed'
            elif processed_file_count > 0:
                # Some documents processed
                for i, doc_status in enumerate(processing_status.documents):
                    if i < processed_file_count:
                        doc_status.status = 'completed'
                    else:
                        doc_status.status = 'failed'
                processing_status.overall_status = 'partial'
            else:
                # No documents processed
                for doc_status in processing_status.documents:
                    doc_status.status = 'failed'
                processing_status.overall_status = 'failed'
            
    except Exception as e:
        logger.error(f"Failed to process clone knowledge for {clone_id}: {str(e)}")
        processing_status.overall_status = 'failed'
        processing_status.error_message = str(e)
        processing_status.processing_completed = datetime.now().isoformat()
        
        # Mark all documents as failed
        for doc_status in processing_status.documents:
            doc_status.status = 'failed'
            doc_status.error = str(e)
    
    return processing_status


async def query_clone_expert(
    clone_id: str,
    clone_name: str,
    query: str,
    memory_type: str = "expert"
) -> Dict[str, Any]:
    """
    Query a clone's expert using direct RAG functions
    
    Args:
        clone_id: Clone identifier
        clone_name: Clone name (to construct expert name)
        query: Question to ask the expert
        memory_type: Type of memory to use ("llm", "domain", "expert", "client")
    
    Returns:
        Query response from RAG service
    """
    try:
        # Construct expert name from clone data
        expert_name = f"clone_{clone_id}_{clone_name.replace(' ', '_')}"
        
        async with RAGIntegrationService() as rag_service:
            if not await rag_service.health_check():
                raise RAGServiceError("RAG service components are not available")
            
            return await rag_service.query_expert(
                expert_name=expert_name,
                query=query,
                memory_type=memory_type
            )
            
    except Exception as e:
        logger.error(f"Failed to query clone expert for {clone_id}: {str(e)}")
        return {
            "response": {
                "text": f"I'm sorry, I'm currently unable to process your question. Error: {str(e)}",
                "citations": None
            },
            "thread_id": None,
            "run_id": None,
            "status": "failed",
            "error": str(e)
        }


# Export the service and utility functions
__all__ = [
    "RAGIntegrationService",
    "RAGProcessingStatus", 
    "RAGDocumentStatus",
    "RAGServiceError",
    "process_clone_knowledge",
    "query_clone_expert"
]