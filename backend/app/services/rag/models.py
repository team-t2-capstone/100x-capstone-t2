"""
RAG Service Data Models

Clean, typed models for RAG operations.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from enum import Enum

class ProcessingStatus(str, Enum):
    """Document processing status"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class RAGStatus(str, Enum):
    """Overall RAG status for a clone"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class DocumentInfo(BaseModel):
    """Document information for processing"""
    name: str
    url: str
    content_type: str = "document"

class ProcessingResult(BaseModel):
    """Result of document processing"""
    status: ProcessingStatus
    clone_id: str
    assistant_id: Optional[str] = None
    vector_store_id: Optional[str] = None
    processed_documents: int = 0
    failed_documents: int = 0
    total_documents: int = 0
    error_message: Optional[str] = None
    processing_time_seconds: Optional[float] = None

class QueryRequest(BaseModel):
    """Query request to the RAG system"""
    clone_id: str
    query: str
    max_tokens: Optional[int] = 1000
    temperature: Optional[float] = 0.7

class QueryResult(BaseModel):
    """Result of a RAG query"""
    response: str
    clone_id: str
    assistant_id: Optional[str] = None
    thread_id: Optional[str] = None
    sources: Optional[List[str]] = None
    confidence: Optional[float] = None
    response_time_seconds: Optional[float] = None

class RAGHealthStatus(BaseModel):
    """Health status of RAG service"""
    is_healthy: bool
    openai_configured: bool
    supabase_configured: bool
    vector_stores_active: int = 0
    assistants_active: int = 0
    issues: List[str] = []
    last_check: str