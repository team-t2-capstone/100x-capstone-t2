"""
Knowledge Base APIs for CloneAI - Document upload and RAG integration
"""
import os
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from pathlib import Path

from fastapi import (
    APIRouter, Depends, HTTPException, status, UploadFile, 
    File, Form, Query, BackgroundTasks
)
import structlog

from app.core.security import get_current_user_id
from app.database import get_supabase
from app.models.schemas import (
    DocumentResponse, DocumentUpload, KnowledgeEntryCreate, KnowledgeEntryResponse,
    KnowledgeSearchRequest, KnowledgeSearchResult, SuccessResponse
)
from app.services.rag_workflow import rag_workflow, process_clone_documents_background
from app.config import settings

logger = structlog.get_logger()
router = APIRouter(tags=["Knowledge Base"])

# File validation
ALLOWED_EXTENSIONS = {'.pdf', '.txt', '.doc', '.docx', '.md', '.rtf'}
MAX_FILE_SIZE = settings.MAX_FILE_SIZE_MB * 1024 * 1024  # Convert to bytes


def validate_file(file: UploadFile) -> None:
    """Validate uploaded file"""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No filename provided"
        )
    
    # Check file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type {file_ext} not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Check file size (basic check)
    if hasattr(file, 'size') and file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds {settings.MAX_FILE_SIZE_MB}MB limit"
        )


@router.post("/clones/{clone_id}/documents", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    clone_id: str,
    file: UploadFile = File(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    tags_str: str = Form("", description="Comma-separated tags"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user_id: str = Depends(get_current_user_id),
    supabase = Depends(get_supabase)
) -> DocumentResponse:
    """
    Upload a document to a clone's knowledge base and process it through RAG
    """
    try:
        # Validate file
        validate_file(file)
        
        # Check if clone exists and user has access
        clone_response = supabase.table("clones").select("*").eq("id", clone_id).execute()
        
        if not clone_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        clone = clone_response.data[0]
        
        # Check if user is the clone creator
        if clone["creator_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the clone creator can upload documents"
            )
        
        # Read file content and size
        file_content = await file.read()
        file_size = len(file_content)
        
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size {file_size} bytes exceeds {settings.MAX_FILE_SIZE_MB}MB limit"
            )
        
        # Generate unique filename and path
        file_extension = Path(file.filename).suffix.lower()
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = f"documents/{clone_id}/{unique_filename}"
        
        # Upload file to Supabase Storage
        try:
            storage_response = supabase.storage.from_("documents").upload(
                file_path, 
                file_content,
                file_options={
                    "content-type": file.content_type or "application/octet-stream",
                    "upsert": False
                }
            )
            
            if hasattr(storage_response, 'error') and storage_response.error:
                raise Exception(f"Storage upload failed: {storage_response.error}")
                
        except Exception as e:
            logger.error("File upload to storage failed", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to upload file to storage"
            )
        
        # Parse tags
        tags = [tag.strip() for tag in tags_str.split(",") if tag.strip()] if tags_str else []
        
        # Get public URL for the uploaded file (for RAG processing)
        try:
            public_url_response = supabase.storage.from_("documents").get_public_url(file_path)
            document_url = public_url_response.get("publicUrl") or public_url_response.get("public_url")
        except Exception as e:
            logger.warning("Could not get public URL for document", error=str(e))
            document_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/documents/{file_path}"
        
        # Create knowledge entry in Supabase
        knowledge_entry = {
            "id": str(uuid.uuid4()),
            "clone_id": clone_id,
            "title": title,
            "description": description,
            "content_type": "document",
            "file_name": file.filename,
            "file_url": document_url,
            "file_type": file_extension[1:],  # Remove the dot
            "file_size_bytes": file_size,
            "tags": tags,
            "metadata": {
                "content_type": file.content_type,
                "uploaded_by": current_user_id,
                "file_path": file_path
            },
            "vector_store_status": "pending",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Insert into knowledge table
        insert_response = supabase.table("knowledge").insert(knowledge_entry).execute()
        
        if not insert_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create knowledge entry"
            )
        
        # Schedule RAG processing in background
        document_urls = {title: document_url}
        background_tasks.add_task(
            process_clone_documents_background,
            clone_id,
            document_urls
        )
        
        logger.info("Document uploaded successfully", 
                   document_id=knowledge_entry["id"],
                   clone_id=clone_id,
                   file_name=file.filename)
        
        # Convert to DocumentResponse format
        doc_response = DocumentResponse(
            id=knowledge_entry["id"],
            clone_id=clone_id,
            title=title,
            description=description,
            file_name=file.filename,
            file_path=file_path,
            file_type=file_extension[1:],
            file_size_bytes=file_size,
            processing_status="pending",
            tags=tags,
            doc_metadata=knowledge_entry["metadata"],
            upload_date=datetime.fromisoformat(knowledge_entry["created_at"].replace('Z', '+00:00'))
        )
        
        return doc_response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Document upload failed", error=str(e), clone_id=clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload document"
        )
    finally:
        # Reset file position for potential cleanup
        await file.seek(0)


@router.get("/clones/{clone_id}/documents", response_model=List[DocumentResponse])
async def list_documents(
    clone_id: str,
    status_filter: Optional[str] = Query(None, regex="^(pending|processing|completed|failed)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user_id: str = Depends(get_current_user_id),
    supabase = Depends(get_supabase)
) -> List[DocumentResponse]:
    """
    List documents for a specific clone
    """
    try:
        # Check if clone exists and user has access
        clone_response = supabase.table("clones").select("*").eq("id", clone_id).execute()
        
        if not clone_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        clone = clone_response.data[0]
        
        # Check access permissions
        if clone["creator_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the clone creator can view documents"
            )
        
        # Build query
        query = supabase.table("knowledge").select("*").eq("clone_id", clone_id).eq("content_type", "document")
        
        if status_filter:
            query = query.eq("vector_store_status", status_filter)
        
        # Apply pagination
        offset = (page - 1) * limit
        query = query.range(offset, offset + limit - 1).order("created_at", desc=True)
        
        # Execute query
        response = query.execute()
        documents = response.data or []
        
        # Convert to DocumentResponse format
        doc_responses = []
        for doc in documents:
            doc_response = DocumentResponse(
                id=doc["id"],
                clone_id=doc["clone_id"],
                title=doc["title"],
                description=doc.get("description"),
                file_name=doc.get("file_name", ""),
                file_path=doc.get("metadata", {}).get("file_path", ""),
                file_type=doc.get("file_type", ""),
                file_size_bytes=doc.get("file_size_bytes", 0),
                processing_status=doc.get("vector_store_status", "pending"),
                tags=doc.get("tags", []),
                doc_metadata=doc.get("metadata", {}),
                upload_date=datetime.fromisoformat(doc["created_at"].replace('Z', '+00:00'))
            )
            doc_responses.append(doc_response)
        
        return doc_responses
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to list documents", error=str(e), clone_id=clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve documents"
        )


@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    current_user_id: str = Depends(get_current_user_id),
    supabase = Depends(get_supabase)
) -> DocumentResponse:
    """
    Get specific document details
    """
    try:
        # Get document with clone info
        doc_response = supabase.table("knowledge").select("*, clones(creator_id)").eq("id", document_id).execute()
        
        if not doc_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
        
        document = doc_response.data[0]
        
        # Check access permissions
        if document["clones"]["creator_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Convert to DocumentResponse
        doc_response = DocumentResponse(
            id=document["id"],
            clone_id=document["clone_id"],
            title=document["title"],
            description=document.get("description"),
            file_name=document.get("file_name", ""),
            file_path=document.get("metadata", {}).get("file_path", ""),
            file_type=document.get("file_type", ""),
            file_size_bytes=document.get("file_size_bytes", 0),
            processing_status=document.get("vector_store_status", "pending"),
            tags=document.get("tags", []),
            doc_metadata=document.get("metadata", {}),
            upload_date=datetime.fromisoformat(document["created_at"].replace('Z', '+00:00'))
        )
        
        return doc_response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get document", error=str(e), document_id=document_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve document"
        )


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    current_user_id: str = Depends(get_current_user_id),
    supabase = Depends(get_supabase)
) -> SuccessResponse:
    """
    Delete a document and its associated data
    """
    try:
        # Get document with clone info
        doc_response = supabase.table("knowledge").select("*, clones(creator_id)").eq("id", document_id).execute()
        
        if not doc_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
        
        document = doc_response.data[0]
        
        # Check access permissions
        if document["clones"]["creator_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the clone creator can delete documents"
            )
        
        # Delete from storage if file path exists
        file_path = document.get("metadata", {}).get("file_path")
        if file_path:
            try:
                storage_response = supabase.storage.from_("documents").remove([file_path])
                if hasattr(storage_response, 'error') and storage_response.error:
                    logger.warning("Failed to delete file from storage", error=storage_response.error)
            except Exception as e:
                logger.warning("Storage deletion failed", error=str(e))
        
        # Delete from database
        delete_response = supabase.table("knowledge").delete().eq("id", document_id).execute()
        
        if not delete_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete document from database"
            )
        
        logger.info("Document deleted successfully", document_id=document_id)
        
        return SuccessResponse(message="Document deleted successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to delete document", error=str(e), document_id=document_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete document"
        )


@router.post("/clones/{clone_id}/knowledge", response_model=KnowledgeEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_knowledge_entry(
    clone_id: str,
    knowledge_data: KnowledgeEntryCreate,
    current_user_id: str = Depends(get_current_user_id),
    supabase = Depends(get_supabase)
) -> KnowledgeEntryResponse:
    """
    Create a direct knowledge entry (not from document)
    """
    try:
        # Check if clone exists and user has access
        clone_response = supabase.table("clones").select("*").eq("id", clone_id).execute()
        
        if not clone_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        clone = clone_response.data[0]
        
        # Check if user is the clone creator
        if clone["creator_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the clone creator can add knowledge entries"
            )
        
        # Create knowledge entry
        knowledge_entry = {
            "id": str(uuid.uuid4()),
            "clone_id": clone_id,
            "title": knowledge_data.title,
            "description": knowledge_data.content[:500],  # First 500 chars as description
            "content_type": "link",
            "original_url": None,
            "content_preview": knowledge_data.content,
            "tags": knowledge_data.tags,
            "metadata": {
                "created_by": current_user_id,
                "entry_type": "manual"
            },
            "vector_store_status": "pending",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Insert into knowledge table
        insert_response = supabase.table("knowledge").insert(knowledge_entry).execute()
        
        if not insert_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create knowledge entry"
            )
        
        # TODO: Process this entry through RAG as well (for text-based entries)
        
        logger.info("Knowledge entry created successfully", 
                   entry_id=knowledge_entry["id"],
                   clone_id=clone_id)
        
        # Convert to response format
        response = KnowledgeEntryResponse(
            id=knowledge_entry["id"],
            clone_id=clone_id,
            title=knowledge_data.title,
            content=knowledge_data.content,
            category=knowledge_data.category,
            tags=knowledge_data.tags,
            doc_metadata=knowledge_entry["metadata"],
            created_at=datetime.fromisoformat(knowledge_entry["created_at"]),
            updated_at=datetime.fromisoformat(knowledge_entry["updated_at"])
        )
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to create knowledge entry", error=str(e), clone_id=clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create knowledge entry"
        )


@router.get("/clones/{clone_id}/processing-status")
async def get_processing_status(
    clone_id: str,
    current_user_id: str = Depends(get_current_user_id),
    supabase = Depends(get_supabase)
) -> Dict[str, Any]:
    """
    Get RAG processing status for a clone's knowledge base
    """
    try:
        # Check if clone exists and user has access
        clone_response = supabase.table("clones").select("*").eq("id", clone_id).execute()
        
        if not clone_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        clone = clone_response.data[0]
        
        # Check access permissions
        if clone["creator_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the clone creator can view processing status"
            )
        
        # Get processing status from workflow
        status = await rag_workflow.get_clone_processing_status(clone_id)
        
        return status
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get processing status", error=str(e), clone_id=clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve processing status"
        )


@router.post("/clones/{clone_id}/process-batch")
async def process_document_batch(
    clone_id: str,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user_id: str = Depends(get_current_user_id),
    supabase = Depends(get_supabase)
) -> SuccessResponse:
    """
    Manually trigger processing of all pending documents for a clone
    This can be called when user clicks "Process All" or "Next" in the wizard
    """
    try:
        # Check if clone exists and user has access
        clone_response = supabase.table("clones").select("*").eq("id", clone_id).execute()
        
        if not clone_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        clone = clone_response.data[0]
        
        # Check access permissions
        if clone["creator_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the clone creator can trigger processing"
            )
        
        # Get all pending documents for this clone
        docs_response = supabase.table("knowledge").select("*").eq("clone_id", clone_id).eq("content_type", "document").eq("vector_store_status", "pending").execute()
        
        if not docs_response.data:
            return SuccessResponse(message="No pending documents to process")
        
        # Build document URLs for RAG processing
        document_urls = {}
        for doc in docs_response.data:
            if doc.get("file_url"):
                document_urls[doc["title"]] = doc["file_url"]
        
        if not document_urls:
            return SuccessResponse(message="No valid document URLs found")
        
        # Schedule batch processing
        background_tasks.add_task(
            process_clone_documents_background,
            clone_id,
            document_urls
        )
        
        logger.info("Batch document processing scheduled",
                   clone_id=clone_id,
                   document_count=len(document_urls))
        
        return SuccessResponse(
            message=f"Processing scheduled for {len(document_urls)} documents",
            data={"document_count": len(document_urls)}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to schedule batch processing", error=str(e), clone_id=clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to schedule document processing"
        )