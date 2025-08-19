"""
Clean RAG Processing API

New clean API endpoint for clone knowledge processing using the CleanRAGService.
This replaces the multiple overlapping RAG implementations.
"""

from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
import structlog

from app.core.security import get_current_user_id
from app.services.rag import CleanRAGService
from app.services.rag.models import DocumentInfo, ProcessingResult, QueryRequest, QueryResult
from app.services.rag.exceptions import RAGException

logger = structlog.get_logger("rag_api")
router = APIRouter()

class ProcessKnowledgeRequest(BaseModel):
    """Request model for processing clone knowledge"""
    documents: List[DocumentInfo]
    links: List[str] = []  # For future link processing

class ProcessKnowledgeResponse(BaseModel):
    """Response model for knowledge processing"""
    status: str
    message: str
    clone_id: str
    assistant_id: str | None = None
    expert_name: str | None = None
    domain_name: str | None = None
    processed_documents: int = 0
    failed_documents: int = 0
    total_documents: int = 0
    processing_time_seconds: float | None = None
    error: str | None = None

@router.post("/clones/{clone_id}/process-knowledge")
async def process_clone_knowledge(
    clone_id: str,
    request: ProcessKnowledgeRequest,
    current_user_id: str = Depends(get_current_user_id)
) -> ProcessKnowledgeResponse:
    """
    Process knowledge documents for a clone using the clean RAG service.
    
    This endpoint:
    1. Validates the clone and user permissions
    2. Processes documents through the clean RAG workflow
    3. Creates vector stores and OpenAI assistants
    4. Returns detailed processing results
    
    Args:
        clone_id: UUID of the clone to process
        request: Documents and links to process
        current_user_id: ID of the authenticated user
        
    Returns:
        ProcessKnowledgeResponse: Detailed processing results
    """
    logger.info("RAG processing request received", 
               clone_id=clone_id, 
               documents_count=len(request.documents),
               user_id=current_user_id)
    
    try:
        # Get the clean RAG service instance
        rag_service = CleanRAGService()
        
        # Initialize service if needed
        initialization_success = await rag_service.initialize()
        if not initialization_success:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="RAG service initialization failed"
            )
        
        # Process the documents
        result: ProcessingResult = await rag_service.process_clone_documents(
            clone_id=clone_id,
            documents=request.documents
        )
        
        # Determine response status
        if result.status.value == "completed":
            response_status = "success"
            message = f"Successfully processed {result.processed_documents} documents"
        elif result.status.value == "failed":
            response_status = "failed"
            message = result.error_message or "Processing failed"
        else:
            response_status = "partial"
            message = f"Processed {result.processed_documents} of {result.total_documents} documents"
        
        response = ProcessKnowledgeResponse(
            status=response_status,
            message=message,
            clone_id=clone_id,
            assistant_id=result.assistant_id,
            processed_documents=result.processed_documents,
            failed_documents=result.failed_documents,
            total_documents=result.total_documents,
            processing_time_seconds=result.processing_time_seconds,
            error=result.error_message
        )
        
        logger.info("RAG processing completed", 
                   clone_id=clone_id,
                   status=response_status,
                   assistant_id=result.assistant_id)
        
        return response
        
    except RAGException as e:
        logger.error("RAG processing failed", 
                    clone_id=clone_id, 
                    error=str(e), 
                    error_type=type(e).__name__)
        
        return ProcessKnowledgeResponse(
            status="failed",
            message="RAG processing failed",
            clone_id=clone_id,
            total_documents=len(request.documents),
            failed_documents=len(request.documents),
            error=str(e)
        )
        
    except HTTPException:
        raise
        
    except Exception as e:
        logger.error("Unexpected error in RAG processing", 
                    clone_id=clone_id, 
                    error=str(e))
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during RAG processing"
        )

@router.post("/clones/{clone_id}/query")
async def query_clone_knowledge(
    clone_id: str,
    request: QueryRequest,
    current_user_id: str = Depends(get_current_user_id)
) -> QueryResult:
    """
    Query a clone's knowledge base using the clean RAG service.
    
    Args:
        clone_id: UUID of the clone to query
        request: Query request with question text
        current_user_id: ID of the authenticated user
        
    Returns:
        QueryResult: Response from the clone's assistant
    """
    logger.info("RAG query request received", 
               clone_id=clone_id, 
               query=request.query[:100],
               user_id=current_user_id)
    
    try:
        # Get the clean RAG service instance
        rag_service = CleanRAGService()
        
        # Process the query
        result: QueryResult = await rag_service.query_clone(request)
        
        logger.info("RAG query completed", 
                   clone_id=clone_id,
                   response_length=len(result.response))
        
        return result
        
    except RAGException as e:
        logger.error("RAG query failed", 
                    clone_id=clone_id, 
                    error=str(e))
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
        
    except Exception as e:
        logger.error("Unexpected error in RAG query", 
                    clone_id=clone_id, 
                    error=str(e))
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during RAG query"
        )

@router.get("/rag/health")
async def get_rag_health(
    current_user_id: str = Depends(get_current_user_id)
):
    """Get health status of the RAG service"""
    try:
        rag_service = CleanRAGService()
        health_status = await rag_service.get_health_status()
        return health_status
        
    except Exception as e:
        logger.error("RAG health check failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Health check failed"
        )