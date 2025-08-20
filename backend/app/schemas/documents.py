"""
Document-related Pydantic schemas (non-RAG)

Simple document schemas without RAG processing dependencies.
"""

from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

class DuplicateCheckRequest(BaseModel):
    """Request model for document duplicate checking"""
    clone_id: str
    filename: str
    file_size: int
    content_hash: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "clone_id": "123e4567-e89b-12d3-a456-426614174000",
                "filename": "document.pdf",
                "file_size": 1024000,
                "content_hash": "sha256_hash_optional"
            }
        }

class ExistingDocument(BaseModel):
    """Information about an existing document"""
    id: str
    filename: str
    processing_status: str
    created_at: str
    match_type: str  # "filename", "content", "size_and_name"

class DuplicateCheckResponse(BaseModel):
    """Response model for document duplicate checking"""
    is_duplicate: bool
    existing_document: Optional[ExistingDocument] = None
    message: str
    allow_overwrite: bool = True
    
    class Config:
        json_schema_extra = {
            "example": {
                "is_duplicate": False,
                "existing_document": None,
                "message": "No duplicate found",
                "allow_overwrite": True
            }
        }

class DocumentUploadRequest(BaseModel):
    """Basic document upload request (simplified)"""
    clone_id: str
    filename: str
    content_type: str
    file_size: int
    
class DocumentUploadResponse(BaseModel):
    """Basic document upload response"""
    success: bool
    message: str
    document_id: Optional[str] = None