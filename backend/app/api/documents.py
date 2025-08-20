"""
Document management API endpoints (non-RAG)

Provides basic document upload and duplicate checking functionality
without RAG processing capabilities.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from typing import Dict, Any, Optional, List
import structlog
from datetime import datetime

from app.database import get_service_supabase
from app.core.supabase_auth import get_current_user_id
from app.schemas.documents import DuplicateCheckRequest, DuplicateCheckResponse

logger = structlog.get_logger("documents_api")
router = APIRouter(prefix="/clones", tags=["documents"])

# Knowledge API router - for fetching knowledge items
knowledge_router = APIRouter(tags=["knowledge"])

@router.post("/{clone_id}/documents/check-duplicate")
async def check_document_duplicate_endpoint(
    clone_id: str,
    request: DuplicateCheckRequest,
    current_user_id: str = Depends(get_current_user_id)
) -> DuplicateCheckResponse:
    """
    Check if a document is a duplicate based on filename and optionally content hash.
    
    This is a simplified version that doesn't require RAG functionality.
    """
    try:
        logger.info("Checking document duplicate", 
                   clone_id=clone_id, 
                   filename=request.filename,
                   file_size=request.file_size,
                   user_id=current_user_id)
        
        # Get service client for database operations
        service_supabase = get_service_supabase()
        if not service_supabase:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Service client not available"
            )
        
        # Check if clone exists and user has access
        clone_result = service_supabase.table("clones").select("*").eq("id", clone_id).execute()
        if not clone_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        clone = clone_result.data[0]
        if clone["creator_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Only clone creator can check duplicates"
            )
        
        # Check for duplicate documents by filename
        # Note: This is a simplified check without full RAG knowledge processing
        duplicate_check_result = service_supabase.table("clones").select(
            "id, name, created_at"
        ).eq("creator_id", current_user_id).eq("name", request.filename).execute()
        
        # For now, we'll do a basic filename-based duplicate check
        # In the future, this could be expanded to check actual uploaded files
        is_duplicate = len(duplicate_check_result.data) > 0
        existing_document = None
        
        if is_duplicate:
            existing_doc = duplicate_check_result.data[0]
            existing_document = {
                "id": existing_doc["id"],
                "filename": existing_doc["name"],
                "processing_status": "completed",  # Simplified status
                "created_at": existing_doc["created_at"],
                "match_type": "filename"
            }
        
        response = DuplicateCheckResponse(
            is_duplicate=is_duplicate,
            existing_document=existing_document,
            message="Duplicate check completed successfully" if not is_duplicate else "Potential duplicate found",
            allow_overwrite=True  # Always allow overwrite for now
        )
        
        logger.info("Duplicate check completed",
                   clone_id=clone_id,
                   is_duplicate=is_duplicate,
                   filename=request.filename)
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Duplicate check failed",
                    clone_id=clone_id,
                    error=str(e),
                    filename=request.filename)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check document duplicate: {str(e)}"
        )

@knowledge_router.get("/knowledge")
async def get_knowledge_items(
    clone_id: Optional[str] = None,
    current_user_id: str = Depends(get_current_user_id)
) -> List[Dict[str, Any]]:
    """
    Get knowledge items from the knowledge table.
    If clone_id is provided, filter by that clone.
    """
    try:
        logger.info("Fetching knowledge items", 
                   clone_id=clone_id, 
                   user_id=current_user_id)
        
        # Get service client for database operations
        service_supabase = get_service_supabase()
        if not service_supabase:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Service client not available"
            )
        
        # Build query
        query = service_supabase.table("knowledge").select("*")
        
        if clone_id:
            # Check if clone exists and user has access
            clone_result = service_supabase.table("clones").select("*").eq("id", clone_id).execute()
            if not clone_result.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Clone not found"
                )
            
            clone = clone_result.data[0]
            if clone["creator_id"] != current_user_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: Only clone creator can access knowledge"
                )
            
            query = query.eq("clone_id", clone_id)
        else:
            # If no clone_id provided, get all knowledge items for user's clones
            user_clones = service_supabase.table("clones").select("id").eq("creator_id", current_user_id).execute()
            if user_clones.data:
                clone_ids = [clone["id"] for clone in user_clones.data]
                query = query.in_("clone_id", clone_ids)
            else:
                # No clones, return empty list
                return []
        
        # Execute query
        result = query.execute()
        
        logger.info("Knowledge items fetched successfully",
                   count=len(result.data),
                   clone_id=clone_id)
        
        return result.data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to fetch knowledge items",
                    clone_id=clone_id,
                    error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch knowledge items: {str(e)}"
        )