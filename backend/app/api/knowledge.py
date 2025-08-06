from app.core.supabase_auth import get_current_user_id, require_role

"""
Knowledge Base APIs for CloneAI - Document upload and knowledge management
"""
import os
import uuid
import asyncio
from datetime import datetime
from typing import List, Optional, Dict, Any
from pathlib import Path

from fastapi import (
    APIRouter, Depends, HTTPException, status, UploadFile, 
    File, Form, Query, BackgroundTasks
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, desc, or_
from sqlalchemy.orm import selectinload
import structlog

from app.core.security import get_current_user_id
from app.database import get_db_session, get_supabase
from app.models.database import Clone, Document, DocumentChunk, KnowledgeEntry
from app.models.schemas import (
    DocumentResponse, DocumentUpload, KnowledgeEntryCreate, KnowledgeEntryResponse,
    KnowledgeSearchRequest, KnowledgeSearchResult
)
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
    
    # Check file size (basic check - more detailed in processing)
    if hasattr(file, 'size') and file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds {settings.MAX_FILE_SIZE_MB}MB limit"
        )


# Import the RAG processor
from app.services.rag_processor import process_document_background


@router.post("/clones/{clone_id}/documents", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    clone_id: str,
    file: UploadFile = File(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    tags_str: str = Form("", description="Comma-separated tags"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session),
    supabase = Depends(get_supabase)
) -> DocumentResponse:
    """
    Upload a document to a clone's knowledge base
    """
    try:
        # Validate file
        validate_file(file)
        
        # Check if clone exists and user has access
        result = await db.execute(
            select(Clone).where(Clone.id == clone_id)
        )
        clone = result.scalar_one_or_none()
        
        if not clone:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        # Check if user is the clone creator
        if str(clone.creator_id) != current_user_id:
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
        
        # Create document record
        new_document = Document(
            clone_id=uuid.UUID(clone_id),
            title=title,
            description=description,
            file_name=file.filename,
            file_path=file_path,
            file_type=file_extension[1:],  # Remove the dot
            file_size_bytes=file_size,
            processing_status="pending",
            tags=tags,
            doc_metadata={
                "content_type": file.content_type,
                "uploaded_by": current_user_id
            }
        )
        
        db.add(new_document)
        await db.commit()
        await db.refresh(new_document)
        
        # Schedule background processing
        background_tasks.add_task(
            process_document_background,
            str(new_document.id),
            file_path,
            clone_id
        )
        
        logger.info("Document uploaded successfully", 
                   document_id=str(new_document.id),
                   clone_id=clone_id,
                   file_name=file.filename)
        
        return DocumentResponse.from_orm(new_document)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Document upload failed", error=str(e), clone_id=clone_id)
        await db.rollback()
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
    db: AsyncSession = Depends(get_db_session)
) -> List[DocumentResponse]:
    """
    List documents for a specific clone
    """
    try:
        # Check if clone exists and user has access
        result = await db.execute(
            select(Clone).where(Clone.id == clone_id)
        )
        clone = result.scalar_one_or_none()
        
        if not clone:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        # Check access permissions
        if str(clone.creator_id) != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the clone creator can view documents"
            )
        
        # Build query
        query = select(Document).where(Document.clone_id == clone_id)
        
        if status_filter:
            query = query.where(Document.processing_status == status_filter)
        
        query = query.order_by(desc(Document.upload_date))
        
        # Apply pagination
        offset = (page - 1) * limit
        query = query.offset(offset).limit(limit)
        
        # Execute query
        result = await db.execute(query)
        documents = result.scalars().all()
        
        return [DocumentResponse.from_orm(doc) for doc in documents]
        
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
    db: AsyncSession = Depends(get_db_session)
) -> DocumentResponse:
    """
    Get specific document details
    """
    try:
        result = await db.execute(
            select(Document).options(selectinload(Document.clone)).where(Document.id == document_id)
        )
        document = result.scalar_one_or_none()
        
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
        
        # Check access permissions
        if str(document.clone.creator_id) != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        return DocumentResponse.from_orm(document)
        
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
    db: AsyncSession = Depends(get_db_session),
    supabase = Depends(get_supabase)
) -> Dict[str, str]:
    """
    Delete a document and its associated chunks
    """
    try:
        result = await db.execute(
            select(Document).options(selectinload(Document.clone)).where(Document.id == document_id)
        )
        document = result.scalar_one_or_none()
        
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
        
        # Check access permissions
        if str(document.clone.creator_id) != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the clone creator can delete documents"
            )
        
        # Delete from storage
        try:
            storage_response = supabase.storage.from_("documents").remove([document.file_path])
            if hasattr(storage_response, 'error') and storage_response.error:
                logger.warning("Failed to delete file from storage", error=storage_response.error)
        except Exception as e:
            logger.warning("Storage deletion failed", error=str(e))
            # Continue with database deletion even if storage fails
        
        # Delete from database (cascade will handle chunks)
        await db.delete(document)
        await db.commit()
        
        logger.info("Document deleted successfully", document_id=document_id)
        
        return {"message": "Document deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to delete document", error=str(e), document_id=document_id)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete document"
        )


@router.post("/clones/{clone_id}/knowledge", response_model=KnowledgeEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_knowledge_entry(
    clone_id: str,
    knowledge_data: KnowledgeEntryCreate,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> KnowledgeEntryResponse:
    """
    Create a direct knowledge entry (not from document)
    """
    try:
        # Check if clone exists and user has access
        result = await db.execute(
            select(Clone).where(Clone.id == clone_id)
        )
        clone = result.scalar_one_or_none()
        
        if not clone:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        # Check if user is the clone creator
        if str(clone.creator_id) != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the clone creator can add knowledge entries"
            )
        
        # Create knowledge entry
        new_entry = KnowledgeEntry(
            clone_id=uuid.UUID(clone_id),
            title=knowledge_data.title,
            content=knowledge_data.content,
            category=knowledge_data.category,
            tags=knowledge_data.tags,
            doc_metadata={
                "created_by": current_user_id,
                "entry_type": "manual"
            }
        )
        
        # Note: In a full implementation, we would generate embeddings here
        # new_entry.embedding = await generate_embedding(knowledge_data.content)
        
        db.add(new_entry)
        await db.commit()
        await db.refresh(new_entry)
        
        logger.info("Knowledge entry created successfully", 
                   entry_id=str(new_entry.id),
                   clone_id=clone_id)
        
        return KnowledgeEntryResponse.from_orm(new_entry)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to create knowledge entry", error=str(e), clone_id=clone_id)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create knowledge entry"
        )


@router.get("/clones/{clone_id}/knowledge", response_model=List[KnowledgeEntryResponse])
async def list_knowledge_entries(
    clone_id: str,
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> List[KnowledgeEntryResponse]:
    """
    List knowledge entries for a specific clone
    """
    try:
        # Check if clone exists and user has access
        result = await db.execute(
            select(Clone).where(Clone.id == clone_id)
        )
        clone = result.scalar_one_or_none()
        
        if not clone:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        # Check access permissions
        if str(clone.creator_id) != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the clone creator can view knowledge entries"
            )
        
        # Build query
        query = select(KnowledgeEntry).where(KnowledgeEntry.clone_id == clone_id)
        
        if category:
            query = query.where(KnowledgeEntry.category == category)
        
        if search:
            query = query.where(
                or_(
                    KnowledgeEntry.title.ilike(f"%{search}%"),
                    KnowledgeEntry.content.ilike(f"%{search}%")
                )
            )
        
        query = query.order_by(desc(KnowledgeEntry.created_at))
        
        # Apply pagination
        offset = (page - 1) * limit
        query = query.offset(offset).limit(limit)
        
        # Execute query
        result = await db.execute(query)
        entries = result.scalars().all()
        
        return [KnowledgeEntryResponse.from_orm(entry) for entry in entries]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to list knowledge entries", error=str(e), clone_id=clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve knowledge entries"
        )


@router.delete("/knowledge/{entry_id}")
async def delete_knowledge_entry(
    entry_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, str]:
    """
    Delete a knowledge entry
    """
    try:
        result = await db.execute(
            select(KnowledgeEntry).options(selectinload(KnowledgeEntry.clone)).where(KnowledgeEntry.id == entry_id)
        )
        entry = result.scalar_one_or_none()
        
        if not entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Knowledge entry not found"
            )
        
        # Check access permissions
        if str(entry.clone.creator_id) != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the clone creator can delete knowledge entries"
            )
        
        # Delete from database
        await db.delete(entry)
        await db.commit()
        
        logger.info("Knowledge entry deleted successfully", entry_id=entry_id)
        
        return {"message": "Knowledge entry deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to delete knowledge entry", error=str(e), entry_id=entry_id)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete knowledge entry"
        )