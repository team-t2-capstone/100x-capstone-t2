"""
Knowledge Base APIs for CloneAI - Document upload and RAG integration
"""
import os
import uuid
import hashlib
from datetime import datetime
from typing import List, Optional, Dict, Any
from pathlib import Path

from fastapi import (
    APIRouter, Depends, HTTPException, status, UploadFile, 
    File, Form, Query, BackgroundTasks, Body, Request
)
from pydantic import BaseModel
from openai import OpenAI
import structlog

from app.core.supabase_auth import get_current_user_id
from app.database import get_supabase, get_authenticated_supabase, get_service_supabase
from app.models.schemas import (
    DocumentResponse, DocumentUpload, KnowledgeEntryCreate, KnowledgeEntryResponse,
    KnowledgeSearchRequest, KnowledgeSearchResult, SuccessResponse,
    DuplicateCheckRequest, DuplicateCheckResponse, ExistingDocumentInfo
)
from app.services.simplified_openai_rag import process_clone_knowledge, query_clone, validate_rag_configuration
from app.config import settings

logger = structlog.get_logger()
router = APIRouter(tags=["Knowledge Base"])


async def get_authenticated_supabase_client(request: Request):
    """Dependency to get authenticated Supabase client that respects RLS"""
    try:
        authorization = request.headers.get("authorization")
        logger.info("Creating authenticated Supabase client", 
                   has_auth=bool(authorization),
                   auth_prefix=authorization[:20] + "..." if authorization and len(authorization) > 20 else authorization)
        
        if not authorization or not authorization.startswith('Bearer '):
            logger.warning("No valid authorization header found, falling back to service role")
            return get_supabase()
        
        # Create authenticated client - use anon key for RLS
        from supabase import create_client
        
        # Try to get the anon key - prefer explicit SUPABASE_ANON_KEY, fallback to SUPABASE_KEY
        anon_key = settings.SUPABASE_ANON_KEY or settings.SUPABASE_KEY
        
        if not anon_key:
            logger.error("No anon key available for authenticated client")
            return get_supabase()
        
        logger.info("Using anon key for authenticated client", 
                   anon_key_available=bool(anon_key),
                   using_explicit_anon=bool(settings.SUPABASE_ANON_KEY))
        
        authenticated_client = create_client(
            settings.SUPABASE_URL,
            anon_key,  # Use anon key for user client to respect RLS
            options={
                "global": {
                    "headers": {
                        "Authorization": authorization
                    }
                }
            }
        )
        
        logger.info("Successfully created authenticated Supabase client")
        return authenticated_client
        
    except Exception as e:
        logger.error("Failed to create authenticated Supabase client", error=str(e))
        # Fallback to service role client
        return get_supabase()

# File validation
ALLOWED_EXTENSIONS = {'.pdf', '.txt', '.doc', '.docx', '.md', '.rtf'}
MAX_FILE_SIZE = settings.MAX_FILE_SIZE_MB * 1024 * 1024  # Convert to bytes


# Duplicate check schemas are now imported from app.models.schemas


def calculate_file_hash(file_content: bytes) -> str:
    """Calculate SHA-256 hash of file content"""
    return hashlib.sha256(file_content).hexdigest()


def check_document_duplicate(
    clone_id: str, 
    filename: str, 
    file_size: int, 
    content_hash: Optional[str], 
    supabase
) -> DuplicateCheckResponse:
    """Check if document already exists in the knowledge base"""
    
    # Query existing knowledge entries for this clone
    query = supabase.table("knowledge").select("*").eq("clone_id", clone_id).eq("content_type", "document")
    
    response = query.execute()
    existing_docs = response.data or []
    
    for doc in existing_docs:
        # Skip failed documents as they can be replaced
        if doc.get("vector_store_status") == "failed":
            continue
            
        # Check for exact filename match
        if doc.get("file_name") == filename:
            return DuplicateCheckResponse(
                is_duplicate=True,
                existing_document=ExistingDocumentInfo(
                    id=doc["id"],
                    filename=doc["file_name"],
                    processing_status=doc.get("vector_store_status", "pending"),
                    created_at=doc["created_at"],
                    match_type="filename"
                ),
                message=f"Document '{filename}' already exists in memory layer",
                allow_overwrite=True
            )
            
        # Check for content hash match (if provided)
        if content_hash and doc.get("metadata", {}).get("content_hash") == content_hash:
            return DuplicateCheckResponse(
                is_duplicate=True,
                existing_document=ExistingDocumentInfo(
                    id=doc["id"],
                    filename=doc["file_name"],
                    processing_status=doc.get("vector_store_status", "pending"),
                    created_at=doc["created_at"],
                    match_type="content_hash"
                ),
                message=f"Document with identical content already exists in memory layer",
                allow_overwrite=True
            )
            
        # Check for size + similar name match (fuzzy matching)
        if (
            doc.get("file_size_bytes") == file_size and 
            doc.get("file_name", "").lower().replace(" ", "") == filename.lower().replace(" ", "")
        ):
            return DuplicateCheckResponse(
                is_duplicate=True,
                existing_document=ExistingDocumentInfo(
                    id=doc["id"],
                    filename=doc["file_name"],
                    processing_status=doc.get("vector_store_status", "pending"),
                    created_at=doc["created_at"],
                    match_type="size_and_name"
                ),
                message=f"Similar document found in memory layer (same size and similar name)",
                allow_overwrite=True
            )
    
    return DuplicateCheckResponse(
        is_duplicate=False,
        message="Document is unique and can be uploaded",
        allow_overwrite=True
    )


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


@router.post("/clones/{clone_id}/documents/check-duplicate", response_model=DuplicateCheckResponse)
async def check_document_duplicate_endpoint(
    clone_id: str,
    request: DuplicateCheckRequest,
    current_user_id: str = Depends(get_current_user_id)
) -> DuplicateCheckResponse:
    """
    Check if a document already exists in the clone's knowledge base
    """
    try:
        # Use service role client for administrative operations to bypass RLS
        service_supabase = get_service_supabase()
        if not service_supabase:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Service role client not available"
            )
        
        # Check if clone exists and user has access
        logger.info("Checking clone access for duplicate detection",
                   clone_id=clone_id,
                   current_user_id=current_user_id)
        
        clone_response = service_supabase.table("clones").select("*").eq("id", clone_id).execute()
        
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
                detail="Only the clone creator can check for duplicates"
            )
        
        # Perform duplicate check using service role client
        duplicate_result = check_document_duplicate(
            clone_id=clone_id,
            filename=request.filename,
            file_size=request.file_size,
            content_hash=request.content_hash,
            supabase=service_supabase
        )
        
        logger.info("Document duplicate check completed", 
                   clone_id=clone_id,
                   filename=request.filename,
                   is_duplicate=duplicate_result.is_duplicate)
        
        return duplicate_result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to check document duplicate", error=str(e), clone_id=clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check for duplicate documents"
        )


@router.post("/clones/{clone_id}/documents", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    clone_id: str,
    file: UploadFile = File(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    tags_str: str = Form("", description="Comma-separated tags"),
    force_overwrite: bool = Form(False, description="Force overwrite if duplicate exists"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user_id: str = Depends(get_current_user_id)
) -> DocumentResponse:
    """
    Upload a document to a clone's knowledge base and process it through RAG
    """
    try:
        # Validate file
        validate_file(file)
        
        # Use service role client for administrative operations to bypass RLS
        service_supabase = get_service_supabase()
        if not service_supabase:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Service role client not available"
            )
        
        # Check if clone exists and user has access
        clone_response = service_supabase.table("clones").select("*").eq("id", clone_id).execute()
        
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
        
        # Calculate content hash for duplicate detection
        content_hash = calculate_file_hash(file_content)
        
        # Check for duplicates unless force_overwrite is True
        if not force_overwrite:
            duplicate_result = check_document_duplicate(
                clone_id=clone_id,
                filename=file.filename,
                file_size=file_size,
                content_hash=content_hash,
                supabase=service_supabase
            )
            
            if duplicate_result.is_duplicate:
                logger.info("Duplicate document upload blocked", 
                           clone_id=clone_id,
                           filename=file.filename,
                           match_type=duplicate_result.existing_document.get("match_type"))
                           
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "message": duplicate_result.message,
                        "existing_document": duplicate_result.existing_document,
                        "allow_overwrite": duplicate_result.allow_overwrite
                    }
                )
        
        # Generate unique filename and path
        file_extension = Path(file.filename).suffix.lower()
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = f"documents/{clone_id}/{unique_filename}"
        
        # Upload file to Supabase Storage
        try:
            # Ensure clean file_options with only string values
            file_options = {
                "content-type": file.content_type or "application/octet-stream"
            }
            
            # Remove any potential boolean values that might be added elsewhere
            clean_options = {k: v for k, v in file_options.items() 
                           if isinstance(v, (str, bytes))}
            
            storage_response = service_supabase.storage.from_("knowledge-documents").upload(
                file_path, 
                file_content,
                file_options=clean_options
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
            # get_public_url returns a string directly, not a dictionary
            document_url = service_supabase.storage.from_("knowledge-documents").get_public_url(file_path)
            # Handle case where it might return a dict with 'publicUrl' key (older versions)
            if isinstance(document_url, dict) and 'publicUrl' in document_url:
                document_url = document_url['publicUrl']
        except Exception as e:
            logger.warning("Could not get public URL for document", error=str(e))
            document_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/knowledge-documents/{file_path}"
        
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
                "file_path": file_path,
                "content_hash": content_hash
            },
            "vector_store_status": "pending",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Insert into knowledge table
        insert_response = service_supabase.table("knowledge").insert(knowledge_entry).execute()
        
        if not insert_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create knowledge entry"
            )
        
        # Note: Individual document processing will be handled when user triggers batch processing
        # This keeps the upload endpoint fast and reliable
        
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
            chunk_count=0,  # Initialize with 0, will be updated after processing
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
    current_user_id: str = Depends(get_current_user_id)
) -> List[DocumentResponse]:
    """
    List documents for a specific clone
    """
    try:
        # Use service role client for administrative operations to bypass RLS
        service_supabase = get_service_supabase()
        if not service_supabase:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Service role client not available"
            )
        
        # Check if clone exists and user has access
        clone_response = service_supabase.table("clones").select("*").eq("id", clone_id).execute()
        
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
        query = service_supabase.table("knowledge").select("*").eq("clone_id", clone_id).eq("content_type", "document")
        
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
                chunk_count=doc.get("chunk_count", 0),  # Get chunk_count from database or default to 0
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
    current_user_id: str = Depends(get_current_user_id)
) -> DocumentResponse:
    """
    Get specific document details
    """
    try:
        # Use service role client for administrative operations to bypass RLS
        service_supabase = get_service_supabase()
        if not service_supabase:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Service role client not available"
            )
        
        # Get document with clone info
        doc_response = service_supabase.table("knowledge").select("*, clones(creator_id)").eq("id", document_id).execute()
        
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
            chunk_count=document.get("chunk_count", 0),  # Get chunk_count from database or default to 0
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
    current_user_id: str = Depends(get_current_user_id)
) -> SuccessResponse:
    """
    Delete a document and its associated data
    """
    try:
        # Use service role client for administrative operations to bypass RLS
        service_supabase = get_service_supabase()
        if not service_supabase:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Service role client not available"
            )
        
        # Get document with clone info
        doc_response = service_supabase.table("knowledge").select("*, clones(creator_id)").eq("id", document_id).execute()
        
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
                storage_response = service_supabase.storage.from_("knowledge-documents").remove([file_path])
                if hasattr(storage_response, 'error') and storage_response.error:
                    logger.warning("Failed to delete file from storage", error=storage_response.error)
            except Exception as e:
                logger.warning("Storage deletion failed", error=str(e))
        
        # Delete from database
        delete_response = service_supabase.table("knowledge").delete().eq("id", document_id).execute()
        
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
    current_user_id: str = Depends(get_current_user_id)
) -> KnowledgeEntryResponse:
    """
    Create a direct knowledge entry (not from document)
    """
    try:
        # Use service role client for administrative operations to bypass RLS
        service_supabase = get_service_supabase()
        if not service_supabase:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Service role client not available"
            )
        
        # Check if clone exists and user has access
        clone_response = service_supabase.table("clones").select("*").eq("id", clone_id).execute()
        
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
        insert_response = service_supabase.table("knowledge").insert(knowledge_entry).execute()
        
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
    current_user_id: str = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """
    Get RAG processing status for a clone's knowledge base
    """
    try:
        # Use service role client for administrative operations to bypass RLS
        service_supabase = get_service_supabase()
        if not service_supabase:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Service role client not available"
            )
        
        # Check if clone exists and user has access
        clone_response = service_supabase.table("clones").select("*").eq("id", clone_id).execute()
        
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
        
        # Get document processing status from database
        docs_response = service_supabase.table("knowledge").select("vector_store_status").eq("clone_id", clone_id).eq("content_type", "document").execute()
        
        total_docs = len(docs_response.data) if docs_response.data else 0
        completed_docs = len([doc for doc in docs_response.data if doc.get("vector_store_status") == "completed"]) if docs_response.data else 0
        processing_docs = len([doc for doc in docs_response.data if doc.get("vector_store_status") == "processing"]) if docs_response.data else 0
        failed_docs = len([doc for doc in docs_response.data if doc.get("vector_store_status") == "failed"]) if docs_response.data else 0
        
        # Determine overall status
        if total_docs == 0:
            overall_status = "no_documents"
        elif completed_docs == total_docs:
            overall_status = "completed"
        elif failed_docs > 0:
            overall_status = "failed"
        elif processing_docs > 0:
            overall_status = "processing"
        else:
            overall_status = "pending"
        
        status = {
            "clone_id": clone_id,
            "status": overall_status,
            "total_documents": total_docs,
            "processing_documents": processing_docs,
            "completed_documents": completed_docs,
            "failed_documents": failed_docs,
            "progress_percentage": (completed_docs / total_docs * 100) if total_docs > 0 else 0,
            "expert_name": clone.get("name", ""),
            "assistant_id": clone.get("rag_assistant_id"),
            "error_message": None
        }
        
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
    current_user_id: str = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """
    Manually trigger processing of all pending documents for a clone using unified RAG service
    This can be called when user clicks "Process All" or "Next" in the wizard
    """
    try:
        # Use service role client for administrative operations to bypass RLS
        service_supabase = get_service_supabase()
        if not service_supabase:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Service role client not available"
            )
        
        # Check if clone exists and user has access
        clone_response = service_supabase.table("clones").select("*").eq("id", clone_id).execute()
        
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
        docs_response = service_supabase.table("knowledge").select("*").eq("clone_id", clone_id).eq("content_type", "document").eq("vector_store_status", "pending").execute()
        
        if not docs_response.data:
            return {"status": "success", "message": "No pending documents to process"}
        
        # Build document URLs for RAG processing
        document_urls = {}
        for doc in docs_response.data:
            if doc.get("file_url"):
                document_urls[doc["title"]] = doc["file_url"]
        
        if not document_urls:
            return {"status": "success", "message": "No valid document URLs found"}
        
        # Prepare clone data
        clone_data = {
            "id": clone_id,
            "name": clone["name"],
            "bio": clone.get("bio", ""),
            "category": clone.get("category", "general"),
            "personality_traits": clone.get("personality_traits", {}),
            "communication_style": clone.get("communication_style", {}),
            "professional_title": clone.get("professional_title", "")
        }
        
        # Process using simplified OpenAI RAG service
        result = await process_clone_knowledge(
            clone_id=clone_id,
            clone_data=clone_data,
            documents=document_urls
        )
        
        # Update document statuses in database
        if result["status"] == "success":
            for doc in docs_response.data:
                service_supabase.table("knowledge").update({
                    "vector_store_status": "completed",
                    "updated_at": datetime.utcnow().isoformat()
                }).eq("id", doc["id"]).execute()
        
        logger.info("Batch document processing completed",
                   clone_id=clone_id,
                   document_count=len(document_urls),
                   status=result["status"])
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to process document batch", error=str(e), clone_id=clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process document batch"
        )


@router.post("/clones/{clone_id}/retry-processing")
async def retry_knowledge_processing(
    clone_id: str,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user_id: str = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """
    Retry RAG processing for failed or partially processed knowledge entries
    This resets failed entries to pending and retriggers the full RAG workflow
    """
    try:
        logger.info("Starting retry processing for clone", clone_id=clone_id, user_id=current_user_id)
        
        # Use service role client for administrative operations to bypass RLS
        service_supabase = get_service_supabase()
        if not service_supabase:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Service role client not available"
            )
        
        # Check if clone exists and user has access
        logger.info("Querying for clone with service role client",
                   clone_id=clone_id,
                   current_user_id=current_user_id)
        
        # Get the specific clone using service role
        clone_response = service_supabase.table("clones").select("*").eq("id", clone_id).execute()
        
        logger.info("Clone query result with service role",
                   clone_id=clone_id,
                   found_clone=bool(clone_response.data),
                   clone_data=clone_response.data[0] if clone_response.data else None,
                   query_error=clone_response.error if hasattr(clone_response, 'error') else None)
        
        if not clone_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Clone not found: {clone_id}"
            )

        clone = clone_response.data[0]
        
        # Check access permissions - only clone creator can retry processing
        if clone["creator_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the clone creator can retry processing"
            )
        
        # Reset failed and partially processed documents to pending
        update_response = service_supabase.table("knowledge").update({
            "vector_store_status": "pending",
            "updated_at": datetime.utcnow().isoformat()
        }).eq("clone_id", clone_id).in_("vector_store_status", ["failed", "partial"]).execute()
        
        logger.info("Reset documents to pending", 
                   clone_id=clone_id,
                   updated_count=len(update_response.data) if update_response.data else 0)
        
        # Get all knowledge documents for processing
        docs_response = service_supabase.table("knowledge").select("*").eq("clone_id", clone_id).eq("content_type", "document").execute()
        
        if not docs_response.data:
            return {
                "status": "no_documents",
                "message": "No documents found to retry processing",
                "clone_id": clone_id
            }
        
        # Build document URLs for RAG processing
        document_urls = {}
        for doc in docs_response.data:
            if doc.get("file_url"):
                document_urls[doc["title"]] = doc["file_url"]
        
        if not document_urls:
            return {
                "status": "no_urls", 
                "message": "No valid document URLs found",
                "clone_id": clone_id
            }
        
        logger.info("Triggering retry RAG processing", 
                   clone_id=clone_id, 
                   document_count=len(document_urls))
        
        # Validate RAG service configuration before retry
        logger.info("Validating simplified OpenAI RAG service before retry processing")
        validation_result = await validate_rag_configuration()
        
        if not validation_result["valid"]:
            error_details = "; ".join(validation_result["errors"])
            solution_details = "; ".join(validation_result["suggestions"])
            logger.error("RAG service not available for retry processing",
                        errors=validation_result["errors"],
                        suggestions=validation_result["suggestions"])
            return {
                "status": "failed",
                "overall_status": "failed",
                "message": "Retry processing failed: RAG service not properly configured",
                "error": f"RAG service validation failed: {error_details}",
                "clone_id": clone_id,
                "solutions": solution_details
            }
        
        # Prepare clone data for processing
        clone_data = {
            "id": clone_id,
            "name": clone["name"],
            "bio": clone.get("bio", ""),
            "category": clone.get("category", "general"),
            "personality_traits": clone.get("personality_traits", {}),
            "communication_style": clone.get("communication_style", {}),
            "professional_title": clone.get("professional_title", "")
        }
        
        try:
            # Use simplified OpenAI RAG service for retry processing
            retry_result = await process_clone_knowledge(
                clone_id=clone_id,
                clone_data=clone_data,
                documents=document_urls
            )
            
            if retry_result.get("status") == "success":
                # Update all documents to completed status using service role
                service_supabase.table("knowledge").update({
                    "vector_store_status": "completed",
                    "updated_at": datetime.utcnow().isoformat()
                }).eq("clone_id", clone_id).execute()
                
                return {
                    "status": "success",
                    "overall_status": "completed", 
                    "message": "Retry processing completed successfully",
                    "expert_name": retry_result.get("expert_name"),
                    "assistant_id": retry_result.get("assistant_id"),
                    "processed_documents": retry_result.get("processed_documents", 0),
                    "clone_id": clone_id
                }
            else:
                error_message = retry_result.get('error', 'Processing failed')
                logger.error("Retry RAG processing failed for clone", 
                            clone_id=clone_id, 
                            error=error_message)
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Retry processing failed: {error_message}"
                )
                
        except Exception as rag_error:
            logger.error("Simplified OpenAI RAG retry processing failed", error=str(rag_error), clone_id=clone_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Retry processing failed: {str(rag_error)}"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to retry knowledge processing", error=str(e), clone_id=clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retry processing: {str(e)}"
        )


@router.post("/process-clone-knowledge")
async def process_clone_knowledge_endpoint(
    request_data: Dict[str, Any] = Body(...),
    current_user_id: str = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """
    Process documents for a clone's knowledge base using simplified OpenAI RAG service
    This endpoint is called from the frontend process-knowledge route
    """
    try:
        clone_id = request_data.get("clone_id")
        clone_name = request_data.get("clone_name")
        document_urls = request_data.get("document_urls", {})
        category = request_data.get("category", "general")
        bio = request_data.get("bio", "")
        personality_traits = request_data.get("personality_traits", {})
        communication_style = request_data.get("communication_style", {})

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

        # Use service role client for administrative operations to bypass RLS
        service_supabase = get_service_supabase()
        if not service_supabase:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Service role client not available"
            )
        
        # Verify clone exists and user has access
        logger.info("Verifying clone access", 
                   clone_id=clone_id, 
                   current_user_id=current_user_id)
        
        clone_response = service_supabase.table("clones").select("*").eq("id", clone_id).execute()
        
        if not clone_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Clone not found: {clone_id}"
            )

        clone = clone_response.data[0]
        
        # Check access permissions - only clone creator can process documents
        if clone["creator_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the clone creator can process documents"
            )

        logger.info("Starting simplified OpenAI RAG processing for clone",
                   clone_id=clone_id,
                   document_count=len(document_urls))

        # Validate RAG service configuration before processing
        validation_result = await validate_rag_configuration()
        
        if not validation_result["valid"]:
            error_details = "; ".join(validation_result["errors"])
            solution_details = "; ".join(validation_result["suggestions"])
            logger.error("RAG service not available for processing", 
                        errors=validation_result["errors"],
                        suggestions=validation_result["suggestions"])
            return {
                "status": "failed",
                "message": "RAG processing cannot proceed - service not properly configured",
                "error": f"RAG service validation failed: {error_details}",
                "solutions": solution_details,
                "processed_documents": 0,
                "clone_id": clone_id,
                "assistant_id": None,
                "expert_name": None
            }

        # Prepare clone data for processing
        clone_data = {
            "id": clone_id,
            "name": clone_name,
            "bio": bio,
            "category": category,
            "personality_traits": personality_traits,
            "communication_style": communication_style,
            "professional_title": clone.get("professional_title", "")
        }

        # Process documents and initialize expert using simplified service
        processing_result = await process_clone_knowledge(
            clone_id=clone_id,
            clone_data=clone_data,
            documents=document_urls
        )

        logger.info("Simplified OpenAI RAG processing completed",
                   clone_id=clone_id,
                   status=processing_result["status"])

        # If processing failed, return appropriate HTTP status code
        if processing_result.get("status") == "failed":
            error_message = processing_result.get("error", "Processing failed")
            logger.error("RAG processing failed for clone", 
                        clone_id=clone_id, 
                        error=error_message)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Document processing failed: {error_message}"
            )

        return processing_result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to process clone knowledge", error=str(e), clone_id=request_data.get("clone_id"))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process clone knowledge: {str(e)}"
        )


@router.get("/rag-health-check")
async def rag_health_check() -> Dict[str, Any]:
    """
    Check if RAG functionality is properly configured
    This endpoint helps users validate their RAG setup
    """
    try:
        from app.config import settings
        
        logger.info("Starting comprehensive RAG health check")
        
        # Initialize health status
        health_status = {
            "rag_ready": False,
            "openai_api_key_configured": bool(settings.OPENAI_API_KEY),
            "openai_client_initialized": False,
            "supabase_configured": False,
            "issues": [],
            "solutions": [],
            "timestamp": datetime.utcnow().isoformat(),
            "status": "unhealthy",
            "message": "Checking RAG configuration..."
        }
        
        # Check OpenAI configuration
        if not settings.OPENAI_API_KEY:
            health_status["issues"].append("OPENAI_API_KEY environment variable not configured")
            health_status["solutions"].append("Set OPENAI_API_KEY in your environment variables")
        else:
            try:
                # Test OpenAI client initialization
                test_client = OpenAI(api_key=settings.OPENAI_API_KEY)
                # Test API connectivity with a simple call
                models = test_client.models.list()
                health_status["openai_client_initialized"] = True
                logger.info("OpenAI client test successful")
            except Exception as e:
                health_status["issues"].append(f"OpenAI API key validation failed: {str(e)}")
                health_status["solutions"].append("Verify your OpenAI API key is valid and has sufficient credits")
        
        # Check Supabase configuration
        try:
            supabase = get_service_supabase()
            if supabase:
                # Test database connectivity
                test_result = supabase.table("clones").select("id").limit(1).execute()
                health_status["supabase_configured"] = True
                logger.info("Supabase connection test successful")
            else:
                health_status["issues"].append("Supabase client not available")
                health_status["solutions"].append("Check SUPABASE_URL and SUPABASE_SERVICE_KEY configuration")
        except Exception as e:
            health_status["issues"].append(f"Supabase connection failed: {str(e)}")
            health_status["solutions"].append("Verify Supabase credentials and network connectivity")
        
        # Test using simplified RAG service
        try:
            validation_result = await validate_rag_configuration()
            if validation_result.get("valid"):
                logger.info("Simplified RAG service validation successful")
            else:
                health_status["issues"].extend(validation_result.get("errors", []))
                health_status["solutions"].extend(validation_result.get("suggestions", []))
        except Exception as e:
            health_status["issues"].append(f"RAG service validation failed: {str(e)}")
            health_status["solutions"].append("Check RAG service configuration")
        
        # Determine overall health status
        health_status["rag_ready"] = (
            health_status["openai_client_initialized"] and 
            health_status["supabase_configured"] and
            len(health_status["issues"]) == 0
        )
        
        if health_status["rag_ready"]:
            health_status["status"] = "healthy"
            health_status["message"] = "RAG functionality is properly configured and ready to use"
        else:
            health_status["status"] = "unhealthy"
            health_status["message"] = f"RAG functionality has {len(health_status['issues'])} configuration issues"
        
        logger.info("RAG health check completed", 
                   rag_ready=health_status["rag_ready"],
                   issues_count=len(health_status["issues"]))
        
        return health_status
        
    except Exception as e:
        logger.error("Failed to check RAG health", error=str(e))
        return {
            "rag_ready": False,
            "status": "error",
            "error": f"Health check failed: {str(e)}",
            "message": "Unable to determine RAG configuration status",
            "issues": [f"Health check execution failed: {str(e)}"],
            "solutions": ["Check backend logs for detailed error information"],
            "openai_api_key_configured": bool(settings.OPENAI_API_KEY) if hasattr(settings, 'OPENAI_API_KEY') else False,
            "openai_client_initialized": False,
            "supabase_configured": False,
            "timestamp": datetime.utcnow().isoformat()
        }


@router.post("/query-clone-expert")
async def query_clone_expert_endpoint(
    request_data: Dict[str, Any] = Body(...),
    current_user_id: str = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """
    Query a clone's RAG expert using simplified OpenAI RAG service with semantic search
    This provides vector search capabilities for answering user questions
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

        # Use service role client for administrative operations to bypass RLS
        service_supabase = get_service_supabase()
        if not service_supabase:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Service role client not available"
            )

        # Verify clone exists
        clone_response = service_supabase.table("clones").select("*").eq("id", clone_id).execute()
        
        if not clone_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )

        clone = clone_response.data[0]

        logger.info("Querying clone expert using simplified service",
                   clone_id=clone_id,
                   query_length=len(query_text))

        # Query using simplified OpenAI RAG service
        rag_response = await query_clone(clone_id=clone_id, query=query_text, thread_id=thread_id)

        logger.info("Clone expert query completed",
                   clone_id=clone_id,
                   response_length=len(rag_response.answer))

        # Return structured response
        return {
            "response": {"text": rag_response.answer},
            "thread_id": rag_response.thread_id,
            "assistant_id": rag_response.assistant_id,
            "sources": rag_response.sources,
            "confidence": rag_response.confidence,
            "clone_id": clone_id,
            "query": query_text,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to query clone expert", error=str(e), clone_id=request_data.get("clone_id"))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to query clone expert: {str(e)}"
        )