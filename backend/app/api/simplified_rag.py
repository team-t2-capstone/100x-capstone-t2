"""
Simplified RAG API endpoints for CloneAI
Replaces complex RAG workflow with streamlined OpenAI native approach
"""

from datetime import datetime
from typing import Dict, List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, status, Body
import structlog

from app.core.supabase_auth import get_current_user_id
from app.database import get_service_supabase
from app.services.simplified_openai_rag import (
    process_clone_knowledge, 
    query_clone, 
    validate_rag_configuration
)

logger = structlog.get_logger()
router = APIRouter(prefix="/api/v1", tags=["Simplified RAG"])


@router.post("/process-clone-knowledge")
async def process_clone_knowledge_endpoint(
    request_data: Dict[str, Any] = Body(...),
    current_user_id: str = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """
    Process documents for a clone using simplified OpenAI native RAG
    
    Simplified flow:
    1. Validate input and permissions
    2. Create OpenAI vector store and upload documents
    3. Create Assistant with file_search tool
    4. Store minimal metadata
    """
    try:
        # Extract and validate required fields
        clone_id = request_data.get("clone_id")
        clone_name = request_data.get("clone_name")
        document_urls = request_data.get("document_urls", {})
        
        if not clone_id or not clone_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="clone_id and clone_name are required"
            )
        
        if not document_urls:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No documents provided for processing"
            )
        
        # Verify clone ownership
        supabase = get_service_supabase()
        clone_response = supabase.table("clones").select("*").eq("id", clone_id).execute()
        
        if not clone_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        clone = clone_response.data[0]
        if clone["creator_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the clone creator can process documents"
            )
        
        # Validate RAG configuration
        validation = await validate_rag_configuration()
        if not validation["valid"]:
            return {
                "status": "failed",
                "error": "RAG service not properly configured",
                "details": validation["errors"],
                "solutions": validation["suggestions"]
            }
        
        # Prepare clone data
        clone_data = {
            "id": clone_id,
            "name": clone_name,
            "bio": request_data.get("bio", ""),
            "category": request_data.get("category", "general"),
            "personality_traits": request_data.get("personality_traits", {}),
            "communication_style": request_data.get("communication_style", {})
        }
        
        # Process documents using simplified service
        result = await process_clone_knowledge(clone_id, clone_data, document_urls)
        
        logger.info("Simplified RAG processing completed", 
                   clone_id=clone_id, 
                   status=result["status"],
                   processed_docs=result.get("processed_documents", 0))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Simplified RAG processing failed", 
                    error=str(e), 
                    clone_id=request_data.get("clone_id"))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Processing failed: {str(e)}"
        )


@router.post("/query-clone-expert")
async def query_clone_expert_endpoint(
    request_data: Dict[str, Any] = Body(...),
    current_user_id: str = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """
    Query a clone using simplified OpenAI native RAG with file_search
    
    Simplified flow:
    1. Validate clone access
    2. Query using OpenAI Assistant with file_search
    3. Return structured response
    """
    try:
        clone_id = request_data.get("clone_id")
        query_text = request_data.get("query")
        thread_id = request_data.get("thread_id")
        
        if not clone_id or not query_text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="clone_id and query are required"
            )
        
        # Verify clone exists (public access for published clones)
        supabase = get_service_supabase()
        clone_response = supabase.table("clones").select("*").eq("id", clone_id).execute()
        
        if not clone_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        clone = clone_response.data[0]
        
        # Check if clone has been processed
        if not clone.get("rag_assistant_id") or clone.get("rag_status") != "completed":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Clone knowledge has not been processed yet"
            )
        
        # Query using simplified service
        rag_response = await query_clone(clone_id, query_text, thread_id)
        
        logger.info("Simplified RAG query completed",
                   clone_id=clone_id,
                   response_length=len(rag_response.answer))
        
        return {
            "response": rag_response.answer,
            "answer": rag_response.answer,  # Backward compatibility
            "sources": rag_response.sources,
            "confidence": rag_response.confidence,
            "thread_id": rag_response.thread_id,
            "assistant_id": rag_response.assistant_id,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Simplified RAG query failed", 
                    error=str(e), 
                    clone_id=request_data.get("clone_id"))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Query failed: {str(e)}"
        )


@router.get("/rag-health")
async def rag_health_check() -> Dict[str, Any]:
    """
    Check simplified RAG service health
    """
    try:
        validation = await validate_rag_configuration()
        
        return {
            "status": "healthy" if validation["valid"] else "unhealthy",
            "rag_ready": validation["valid"],
            "openai_configured": validation["openai_configured"],
            "supabase_configured": validation["supabase_configured"],
            "issues": validation["errors"],
            "solutions": validation["suggestions"],
            "service_type": "simplified_openai_native",
            "timestamp": datetime.utcnow().isoformat(),
            "message": "Simplified RAG service using OpenAI native capabilities"
        }
        
    except Exception as e:
        logger.error("RAG health check failed", error=str(e))
        return {
            "status": "error",
            "rag_ready": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


@router.get("/clone/{clone_id}/rag-status")
async def get_clone_rag_status(
    clone_id: str,
    current_user_id: str = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """
    Get simplified RAG status for a clone
    """
    try:
        supabase = get_service_supabase()
        clone_response = supabase.table("clones").select("*").eq("id", clone_id).execute()
        
        if not clone_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        clone = clone_response.data[0]
        
        # Check permissions (owner or published clone)
        if clone["creator_id"] != current_user_id and not clone.get("is_published"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Get document count
        docs_response = supabase.table("knowledge").select("id, vector_store_status").eq("clone_id", clone_id).execute()
        
        total_docs = len(docs_response.data) if docs_response.data else 0
        completed_docs = sum(1 for doc in docs_response.data if doc.get("vector_store_status") == "completed") if docs_response.data else 0
        
        return {
            "clone_id": clone_id,
            "rag_status": clone.get("rag_status", "pending"),
            "assistant_id": clone.get("rag_assistant_id"),
            "total_documents": total_docs,
            "processed_documents": completed_docs,
            "progress_percentage": (completed_docs / total_docs * 100) if total_docs > 0 else 0,
            "is_ready": clone.get("rag_status") == "completed" and clone.get("rag_assistant_id"),
            "message": "RAG processing completed" if clone.get("rag_status") == "completed" else "RAG processing pending or in progress"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get RAG status", error=str(e), clone_id=clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve RAG status"
        )