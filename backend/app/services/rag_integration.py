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
from ..database import get_supabase, get_service_supabase

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
        try:
            # Validate OpenAI configuration before creating client
            from .rag_core import validate_openai_configuration
            validation = validate_openai_configuration()
            if not validation["valid"]:
                raise RAGServiceError(f"OpenAI configuration invalid: {validation['error']}")
            
            self.client = get_openai_client()
            self.supabase = get_service_supabase() or get_supabase()  # Use service client for admin operations
            
            if not self.supabase:
                raise RAGServiceError("Supabase client initialization failed")
            
            return self
        except Exception as e:
            raise RAGServiceError(f"Failed to initialize RAG service: {str(e)}")
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        # Nothing to cleanup for direct integration
        pass
    
    async def health_check(self) -> dict:
        """Check if RAG service components are available and return detailed status"""
        health_status = {
            "healthy": False,
            "openai_client": False,
            "supabase_connection": False,
            "database_accessible": False,
            "errors": []
        }
        
        try:
            # Test OpenAI client
            if not self.client:
                health_status["errors"].append("OpenAI client not initialized")
            else:
                try:
                    # Test with a simple API call
                    models = self.client.models.list()
                    health_status["openai_client"] = True
                except Exception as e:
                    health_status["errors"].append(f"OpenAI client test failed: {str(e)}")
            
            # Test Supabase connection
            if not self.supabase:
                health_status["errors"].append("Supabase client not initialized")
            else:
                health_status["supabase_connection"] = True
                try:
                    # Simple query to test database connectivity
                    result = self.supabase.table("domains").select("id").limit(1).execute()
                    health_status["database_accessible"] = True
                except Exception as e:
                    health_status["errors"].append(f"Database connectivity test failed: {str(e)}")
            
            health_status["healthy"] = (
                health_status["openai_client"] and 
                health_status["supabase_connection"] and 
                health_status["database_accessible"]
            )
            
            return health_status
        except Exception as e:
            health_status["errors"].append(f"Health check failed: {str(e)}")
            return health_status
    
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
            
            # Validate inputs
            if not expert_name or not domain_name:
                raise RAGServiceError("Expert name and domain name are required")
            
            if not document_urls:
                logger.warning("No document URLs provided for expert memory initialization")
            
            # Step 1: Create domain if it doesn't exist
            try:
                await self.create_domain(domain_name)
            except Exception as e:
                raise RAGServiceError(f"Failed to create domain '{domain_name}': {str(e)}")
            
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
            else:
                persona_context = f"I am {expert_name}, an expert in {domain_name}."
            
            # Step 3: Create expert with generated context
            try:
                expert_data = await self.create_expert(expert_name, domain_name, persona_context)
            except Exception as e:
                raise RAGServiceError(f"Failed to create expert '{expert_name}': {str(e)}")
            
            # Step 4: Create vector store for expert
            vector_store_name = f"{expert_name}_{domain_name}_vector_store"
            try:
                vector_store = await create_vector_store(self.client, vector_store_name)
                vector_store_id = vector_store.id
                logger.info(f"Created vector store {vector_store_id} for expert {expert_name}")
            except Exception as e:
                raise RAGServiceError(f"Failed to create vector store: {str(e)}")
            
            # Step 5: Process documents and add to vector store
            file_ids = []
            batch_id = None
            status = "completed"
            document_processing_error = None
            
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
                    document_processing_error = result.get("error")
                    
                    if status == "failed":
                        raise RAGServiceError(f"Document processing failed: {document_processing_error}")
                    
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
                        
                        if status == "failed":
                            raise RAGServiceError("Document batch processing failed")
                    
                except Exception as e:
                    if "RAGServiceError" in str(type(e)):
                        raise
                    logger.error(f"Failed to process documents for {expert_name}: {str(e)}")
                    # For document processing failures, we can continue with partial success
                    status = "partial_failure"
                    document_processing_error = str(e)
            
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
                logger.info(f"Stored vector store data for {expert_name}")
                
            except Exception as e:
                logger.error(f"Failed to store vector store data: {str(e)}")
                # Continue execution as this is not critical for basic functionality
            
            # Step 7: Create assistant
            assistant_id = None
            try:
                assistant = await create_assistant(expert_name, "expert")
                assistant_id = assistant.id
                logger.info(f"Created assistant {assistant_id} for expert {expert_name}")
            except Exception as e:
                logger.error(f"Failed to create assistant for {expert_name}: {str(e)}")
                # Continue without assistant - this should not fail the entire process
            
            # Determine final status
            if status == "partial_failure" and len(file_ids) == 0:
                # If we have partial failure with no documents processed, it's a complete failure
                return {
                    "status": "failed",
                    "error": document_processing_error or "Failed to process any documents",
                    "expert_name": expert_name,
                    "domain_name": domain_name,
                    "vector_store_id": vector_store_id,
                    "assistant_id": assistant_id
                }
            
            success_message = f"Successfully initialized expert memory with {len(file_ids)} documents"
            if status == "partial_failure":
                success_message += f" (with some processing issues: {document_processing_error})"
            
            return {
                "status": status,
                "expert_name": expert_name,
                "domain_name": domain_name,
                "vector_store_id": vector_store_id,
                "file_ids": file_ids,
                "batch_id": batch_id,
                "assistant_id": assistant_id,
                "processed_documents": len(file_ids),
                "message": success_message
            }
            
        except RAGServiceError:
            # Re-raise RAGServiceError as-is
            raise
        except Exception as e:
            logger.error(f"Unexpected error initializing expert memory for {expert_name}: {str(e)}")
            raise RAGServiceError(f"Unexpected error during expert memory initialization: {str(e)}")
    
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
            # Validate inputs
            if not expert_name or not query:
                raise RAGServiceError("Expert name and query are required")
            
            logger.info(f"Querying expert {expert_name} with query: {query}")
            
            # Check service health before querying
            health_status = await self.health_check()
            if not health_status["healthy"]:
                error_details = "; ".join(health_status["errors"])
                raise RAGServiceError(f"Cannot query expert - service unhealthy: {error_details}")
            
            result = await query_expert_with_assistant(
                expert_name=expert_name,
                query=query,
                memory_type=memory_type,
                client_name=client_name,
                thread_id=thread_id
            )
            
            if not result or "error" in result:
                raise RAGServiceError(f"Query failed: {result.get('error', 'Unknown error')}")
            
            return result
            
        except RAGServiceError:
            # Re-raise RAGServiceError as-is
            raise
        except Exception as e:
            logger.error(f"Unexpected error querying expert {expert_name}: {str(e)}")
            raise RAGServiceError(f"Unexpected error during expert query: {str(e)}")


# Validation function for RAG service availability
async def validate_rag_service_availability() -> Dict[str, Any]:
    """
    Validate that RAG service components are properly configured and available
    """
    from .rag_core import validate_openai_configuration
    from ..database import get_supabase
    
    validation_result = {
        "available": False,
        "openai_valid": False,
        "supabase_available": False,
        "errors": [],
        "solutions": []
    }
    
    # Check OpenAI configuration
    openai_validation = validate_openai_configuration()
    validation_result["openai_valid"] = openai_validation["valid"]
    
    if not openai_validation["valid"]:
        validation_result["errors"].append(openai_validation["error"])
        validation_result["solutions"].append("Configure OPENAI_API_KEY in backend environment variables")
    
    # Check Supabase availability
    try:
        supabase = get_supabase()
        if supabase:
            # Test with a simple query
            result = supabase.table("clones").select("id").limit(1).execute()
            validation_result["supabase_available"] = True
        else:
            validation_result["errors"].append("Supabase client not available")
            validation_result["solutions"].append("Check Supabase configuration (SUPABASE_URL and SUPABASE_KEY)")
    except Exception as e:
        validation_result["errors"].append(f"Supabase connection failed: {str(e)}")
        validation_result["solutions"].append("Verify Supabase credentials and network connectivity")
    
    validation_result["available"] = (
        validation_result["openai_valid"] and 
        validation_result["supabase_available"]
    )
    
    return validation_result

# Convenient wrapper functions for CloneAI integration
async def process_clone_knowledge_simple(
    clone_id: str,
    clone_name: str, 
    document_urls: Dict[str, str],
    clone_category: str = "general",
    clone_bio: str = "",
    personality_traits: Dict = None,
    communication_style: Dict = None
) -> Dict[str, Any]:
    """
    Simplified function to process clone knowledge with personality integration
    """
    logger.info("Starting simplified RAG processing", 
               clone_id=clone_id, 
               clone_name=clone_name,
               document_count=len(document_urls))
    
    # Early validation
    if not clone_id or not clone_name:
        return {
            "status": "failed",
            "error": "clone_id and clone_name are required"
        }
    
    if not document_urls:
        return {
            "status": "failed",
            "error": "No document URLs provided for processing"
        }
    
    try:
        service = RAGIntegrationService()
        async with service:
            # Check service health before proceeding
            health_status = await service.health_check()
            if not health_status["healthy"]:
                error_details = "; ".join(health_status["errors"])
                return {
                    "status": "failed",
                    "error": f"RAG service is not healthy: {error_details}",
                    "health_status": health_status
                }
            
            # Generate expert name and domain
            expert_name = clone_name.replace(" ", "_").lower() + f"_{clone_id[:8]}"
            domain_name = clone_category or "general_expertise"
            
            # Create personality-aware QA pairs
            qa_pairs = []
            if clone_bio:
                qa_pairs.append({"question": "Tell me about yourself", "answer": clone_bio})
            
            if personality_traits:
                traits_text = ", ".join([f"{k}: {v}" for k, v in personality_traits.items() if v])
                qa_pairs.append({"question": "What are your personality traits?", "answer": traits_text})
            
            if communication_style:
                style_text = f"Communication style: {communication_style.get('style', 'professional')}, Response length: {communication_style.get('response_length', 'medium')}"
                qa_pairs.append({"question": "How do you communicate?", "answer": style_text})
            
            # Initialize expert memory with documents and personality
            result = await service.initialize_expert_memory(
                expert_name=expert_name,
                domain_name=domain_name,
                qa_pairs=qa_pairs,
                document_urls=document_urls
            )
            
            # Check if initialization was successful
            if result.get("status") == "failed" or "error" in result:
                return {
                    "status": "failed",
                    "error": result.get("message", result.get("error", "Unknown error during expert memory initialization")),
                    "expert_name": expert_name,
                    "domain_name": domain_name
                }
            
            return {
                "status": "success",
                "expert_name": expert_name,
                "domain_name": domain_name,
                "assistant_id": result.get("assistant_id"),
                "vector_store_id": result.get("vector_store_id"),
                "processed_documents": result.get("processed_documents", len(document_urls))
            }
            
    except RAGServiceError as e:
        logger.error(f"RAG service error in clone knowledge processing: {str(e)}")
        return {
            "status": "failed",
            "error": f"RAG service error: {str(e)}"
        }
    except Exception as e:
        logger.error(f"Unexpected error in clone knowledge processing: {str(e)}")
        return {
            "status": "failed",
            "error": f"Unexpected error: {str(e)}"
        }


async def query_clone_expert_simple(
    clone_id: str,
    clone_name: str,
    query: str,
    memory_type: str = "expert",
    thread_id: str = None
) -> Dict[str, Any]:
    """
    Simplified function to query a clone expert with semantic search
    """
    # Early validation
    if not clone_id or not clone_name or not query:
        return {
            "response": {"text": "Error: Clone ID, clone name, and query are all required"},
            "status": "failed",
            "error": "Missing required parameters"
        }
    
    try:
        expert_name = clone_name.replace(" ", "_").lower() + f"_{clone_id[:8]}"
        
        # Use the RAG core function directly
        from .rag_core import query_expert_with_assistant
        
        result = await query_expert_with_assistant(
            expert_name=expert_name,
            query=query,
            memory_type=memory_type,
            thread_id=thread_id
        )
        
        if not result or result.get("status") == "failed":
            return {
                "response": {"text": "I'm sorry, I'm currently unable to process your question due to a system issue."},
                "status": "failed",
                "error": result.get("error", "Query processing failed")
            }
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to query clone expert {clone_id}: {str(e)}")
        return {
            "response": {"text": "I'm sorry, I'm currently experiencing technical difficulties and cannot answer your question."},
            "status": "failed",
            "error": str(e)
        }


# Export the service and utility functions
__all__ = [
    "RAGIntegrationService",
    "RAGProcessingStatus", 
    "RAGDocumentStatus",
    "RAGServiceError",
    "process_clone_knowledge_simple",
    "query_clone_expert_simple",
    "validate_rag_service_availability"
]