# Phase 2: Backend API Integration Guide

## Overview

This guide provides comprehensive implementation details for integrating the RAG system into the CloneAI backend, creating a unified API layer that seamlessly handles both RAG-enhanced and fallback responses.

## Architecture Strategy

- **Hybrid Approach**: RAG-first with intelligent fallback to existing OpenAI integration
- **Service Layer Pattern**: Centralized RAG service with clean interfaces
- **Error Resilience**: Graceful degradation when RAG components fail
- **Performance Optimization**: Caching and connection pooling

## Prerequisites

- Phase 1 (Database Schema Integration) completed
- Backend running on FastAPI with Supabase integration
- OpenAI API credentials configured
- Understanding of existing backend architecture

## Implementation Steps

### Step 1: RAG Service Module

Create `/backend/app/services/rag_service.py`:

```python
"""
RAG Service for CloneAI Integration
Handles RAG operations with fallback to standard LLM responses
"""
import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any, Union
from uuid import UUID

import httpx
import openai
from openai import AsyncOpenAI
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings
from app.database import get_supabase
from app.models.schemas import RAGResponse, RAGInitRequest, RAGQueryRequest

logger = structlog.get_logger()

class RAGServiceError(Exception):
    """Custom exception for RAG service errors"""
    pass

class RAGService:
    """
    Unified RAG service for CloneAI
    Handles memory initialization, document processing, and intelligent queries
    """
    
    def __init__(self):
        self.openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.rag_base_url = getattr(settings, 'RAG_SERVICE_URL', 'http://localhost:8000')
        self.supabase = get_supabase()
        self._http_client = None
        
    async def get_http_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client for RAG service communication"""
        if self._http_client is None:
            self._http_client = httpx.AsyncClient(
                timeout=httpx.Timeout(timeout=30.0),
                limits=httpx.Limits(max_keepalive_connections=5, max_connections=10)
            )
        return self._http_client
    
    async def cleanup(self):
        """Cleanup resources"""
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None
    
    # =================== CORE RAG OPERATIONS ===================
    
    async def initialize_clone_memory(
        self,
        clone_id: str,
        expert_name: str,
        domain_name: str,
        context: str,
        documents: List[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Initialize RAG memory for a clone
        This is the main entry point for RAG setup during clone creation
        """
        try:
            logger.info(f"Initializing RAG memory for clone {clone_id}")
            
            # 1. Update clone RAG status
            await self._update_clone_rag_status(clone_id, 'initializing')
            
            # 2. Prepare documents from existing knowledge if not provided
            if not documents:
                documents = await self._get_clone_documents(clone_id)
            
            # 3. Call RAG service to initialize memory
            rag_result = await self._call_rag_initialize(
                expert_name=expert_name,
                domain_name=domain_name,
                context=context,
                documents=documents
            )
            
            if not rag_result.get('success'):
                raise RAGServiceError(f"RAG initialization failed: {rag_result.get('error')}")
            
            # 4. Store RAG mapping in database
            await self._create_clone_rag_mapping(
                clone_id=clone_id,
                expert_name=expert_name,
                domain_name=domain_name,
                assistant_id=rag_result['data'].get('assistant_id'),
                vector_store_id=rag_result['data'].get('vector_store_id')
            )
            
            # 5. Update clone status to ready
            await self._update_clone_rag_status(clone_id, 'ready')
            
            logger.info(f"Successfully initialized RAG memory for clone {clone_id}")
            return {
                'success': True,
                'message': 'RAG memory initialized successfully',
                'data': rag_result['data']
            }
            
        except Exception as e:
            logger.error(f"Failed to initialize RAG memory for clone {clone_id}: {str(e)}")
            await self._update_clone_rag_status(clone_id, 'error', str(e))
            return {
                'success': False,
                'error': str(e)
            }
    
    async def query_clone_with_rag(
        self,
        clone_id: str,
        query: str,
        conversation_history: List[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Query clone using RAG system with intelligent fallback
        
        Flow:
        1. Check if RAG is available for clone
        2. Try RAG query first
        3. Fallback to standard LLM if RAG fails
        4. Apply personality/style tuning
        """
        try:
            logger.info(f"Processing query for clone {clone_id}: {query[:100]}...")
            
            # 1. Check RAG availability
            rag_mapping = await self._get_clone_rag_mapping(clone_id)
            use_rag = rag_mapping and rag_mapping.get('rag_status') == 'ready'
            
            if use_rag:
                # 2. Try RAG query first
                try:
                    rag_result = await self._query_with_rag(clone_id, query, conversation_history)
                    if rag_result.get('success'):
                        return self._format_rag_response(rag_result, 'rag')
                    else:
                        logger.warning(f"RAG query failed for clone {clone_id}, falling back to LLM")
                except Exception as e:
                    logger.warning(f"RAG query error for clone {clone_id}: {str(e)}, falling back to LLM")
            
            # 3. Fallback to standard LLM
            fallback_result = await self._query_with_llm_fallback(clone_id, query, conversation_history)
            return self._format_rag_response(fallback_result, 'llm_fallback')
            
        except Exception as e:
            logger.error(f"Failed to process query for clone {clone_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'response': "I'm sorry, I'm having trouble processing your request right now. Please try again."
            }
    
    # =================== RAG SERVICE COMMUNICATION ===================
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def _call_rag_initialize(
        self,
        expert_name: str,
        domain_name: str,
        context: str,
        documents: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Call RAG service to initialize expert memory"""
        http_client = await self.get_http_client()
        
        payload = {
            "expert_name": expert_name,
            "domain_name": domain_name,
            "context": context,
            "documents": documents or []
        }
        
        try:
            response = await http_client.post(
                f"{self.rag_base_url}/memory/expert/initialize",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            response.raise_for_status()
            return response.json()
            
        except httpx.HTTPStatusError as e:
            logger.error(f"RAG service HTTP error: {e.response.status_code} - {e.response.text}")
            raise RAGServiceError(f"RAG service error: {e.response.status_code}")
        except httpx.RequestError as e:
            logger.error(f"RAG service connection error: {str(e)}")
            raise RAGServiceError(f"RAG service unavailable: {str(e)}")
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def _query_with_rag(
        self,
        clone_id: str,
        query: str,
        conversation_history: List[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Query RAG service for clone response"""
        http_client = await self.get_http_client()
        
        # Get expert name from mapping
        rag_mapping = await self._get_clone_rag_mapping(clone_id)
        if not rag_mapping:
            raise RAGServiceError("No RAG mapping found for clone")
        
        payload = {
            "expert_name": rag_mapping['expert_name'],
            "query": query,
            "conversation_history": conversation_history or []
        }
        
        try:
            response = await http_client.post(
                f"{self.rag_base_url}/query_expert_with_assistant",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            response.raise_for_status()
            return response.json()
            
        except httpx.HTTPStatusError as e:
            logger.error(f"RAG query HTTP error: {e.response.status_code} - {e.response.text}")
            raise RAGServiceError(f"RAG query error: {e.response.status_code}")
        except httpx.RequestError as e:
            logger.error(f"RAG query connection error: {str(e)}")
            raise RAGServiceError(f"RAG service unavailable: {str(e)}")
    
    # =================== LLM FALLBACK ===================
    
    async def _query_with_llm_fallback(
        self,
        clone_id: str,
        query: str,
        conversation_history: List[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Fallback to direct OpenAI query with clone personality"""
        try:
            # Get clone information
            clone_info = await self._get_clone_info(clone_id)
            if not clone_info:
                raise RAGServiceError("Clone not found")
            
            # Build system prompt from clone data
            system_prompt = self._build_system_prompt(clone_info)
            
            # Build messages
            messages = [{"role": "system", "content": system_prompt}]
            
            # Add conversation history
            if conversation_history:
                messages.extend(conversation_history[-5:])  # Last 5 messages
            
            # Add current query
            messages.append({"role": "user", "content": query})
            
            # Call OpenAI
            response = await self.openai_client.chat.completions.create(
                model=settings.GPT_4_MINI_MODEL,
                messages=messages,
                max_tokens=4000,
                temperature=0.7
            )
            
            response_text = response.choices[0].message.content
            
            return {
                'success': True,
                'response': response_text,
                'sources': [],
                'mode': 'llm_fallback'
            }
            
        except Exception as e:
            logger.error(f"LLM fallback failed: {str(e)}")
            raise RAGServiceError(f"LLM fallback failed: {str(e)}")
    
    # =================== DATABASE OPERATIONS ===================
    
    async def _update_clone_rag_status(
        self,
        clone_id: str,
        status: str,
        error_message: str = None
    ):
        """Update clone RAG initialization status"""
        try:
            update_data = {
                'rag_initialization_status': status,
                'updated_at': datetime.utcnow().isoformat()
            }
            
            if status == 'error' and error_message:
                update_data['rag_config'] = {'error_message': error_message}
            
            result = self.supabase.table('clones').update(update_data).eq('id', clone_id).execute()
            
            if result.data:
                logger.info(f"Updated clone {clone_id} RAG status to {status}")
            else:
                logger.warning(f"Failed to update clone {clone_id} RAG status")
                
        except Exception as e:
            logger.error(f"Failed to update clone RAG status: {str(e)}")
    
    async def _create_clone_rag_mapping(
        self,
        clone_id: str,
        expert_name: str,
        domain_name: str,
        assistant_id: str = None,
        vector_store_id: str = None
    ):
        """Create RAG mapping record for clone"""
        try:
            mapping_data = {
                'clone_id': clone_id,
                'expert_name': expert_name,
                'domain_name': domain_name,
                'assistant_id': assistant_id,
                'vector_store_id': vector_store_id,
                'rag_status': 'ready',
                'last_processed_at': datetime.utcnow().isoformat()
            }
            
            # Use upsert to handle cases where mapping already exists
            result = self.supabase.table('clone_rag_mapping').upsert(mapping_data).execute()
            
            if result.data:
                logger.info(f"Created RAG mapping for clone {clone_id}")
            else:
                logger.warning(f"Failed to create RAG mapping for clone {clone_id}")
                
        except Exception as e:
            logger.error(f"Failed to create RAG mapping: {str(e)}")
            raise
    
    async def _get_clone_rag_mapping(self, clone_id: str) -> Optional[Dict[str, Any]]:
        """Get RAG mapping for clone"""
        try:
            result = self.supabase.table('clone_rag_mapping').select('*').eq('clone_id', clone_id).execute()
            
            if result.data and len(result.data) > 0:
                return result.data[0]
            return None
            
        except Exception as e:
            logger.error(f"Failed to get RAG mapping for clone {clone_id}: {str(e)}")
            return None
    
    async def _get_clone_info(self, clone_id: str) -> Optional[Dict[str, Any]]:
        """Get clone information from database"""
        try:
            result = self.supabase.table('clones').select('*').eq('id', clone_id).execute()
            
            if result.data and len(result.data) > 0:
                return result.data[0]
            return None
            
        except Exception as e:
            logger.error(f"Failed to get clone info for {clone_id}: {str(e)}")
            return None
    
    async def _get_clone_documents(self, clone_id: str) -> List[Dict[str, Any]]:
        """Get documents for clone from knowledge table"""
        try:
            result = self.supabase.table('knowledge').select('*').eq('clone_id', clone_id).execute()
            
            documents = []
            if result.data:
                for doc in result.data:
                    documents.append({
                        'name': doc['title'],
                        'url': doc['file_url'] or doc['original_url'],
                        'type': doc['content_type']
                    })
            
            return documents
            
        except Exception as e:
            logger.error(f"Failed to get documents for clone {clone_id}: {str(e)}")
            return []
    
    # =================== HELPER METHODS ===================
    
    def _build_system_prompt(self, clone_info: Dict[str, Any]) -> str:
        """Build system prompt from clone information"""
        prompt_parts = []
        
        # Basic role and personality
        if clone_info.get('professional_title'):
            prompt_parts.append(f"You are {clone_info['name']}, a {clone_info['professional_title']}.")
        else:
            prompt_parts.append(f"You are {clone_info['name']}, an expert in {clone_info['category']}.")
        
        # Bio and credentials
        if clone_info.get('bio'):
            prompt_parts.append(f"Background: {clone_info['bio']}")
        
        if clone_info.get('credentials_qualifications'):
            prompt_parts.append(f"Credentials: {clone_info['credentials_qualifications']}")
        
        # Communication style
        if clone_info.get('communication_style'):
            style = clone_info['communication_style']
            if isinstance(style, dict):
                style_desc = ", ".join([f"{k}: {v}" for k, v in style.items()])
                prompt_parts.append(f"Communication style: {style_desc}")
        
        # System prompt if available
        if clone_info.get('system_prompt'):
            prompt_parts.append(clone_info['system_prompt'])
        
        # Default instruction
        prompt_parts.append("Provide helpful, accurate, and personalized responses based on your expertise.")
        
        return "\n\n".join(prompt_parts)
    
    def _format_rag_response(self, result: Dict[str, Any], mode: str) -> Dict[str, Any]:
        """Format response from RAG or LLM"""
        return {
            'success': result.get('success', False),
            'response': result.get('response', ''),
            'sources': result.get('sources', []),
            'mode': mode,
            'timestamp': datetime.utcnow().isoformat()
        }

# Global service instance
rag_service = RAGService()

# Cleanup function for FastAPI shutdown
async def cleanup_rag_service():
    """Cleanup RAG service resources"""
    await rag_service.cleanup()
```

### Step 2: API Endpoints Integration

Create `/backend/app/api/rag.py`:

```python
"""
RAG API endpoints for CloneAI
Provides unified interface for RAG operations
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
import structlog

from app.core.supabase_auth import get_current_user_id, security
from app.services.rag_service import rag_service
from app.models.schemas import (
    RAGInitRequest, RAGQueryRequest, RAGResponse, 
    CloneRAGStatus, DocumentProcessingStatus
)

logger = structlog.get_logger()
router = APIRouter(prefix="/rag", tags=["RAG Operations"])

@router.post("/initialize/{clone_id}")
async def initialize_clone_rag(
    clone_id: str,
    request: RAGInitRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user_id: str = Depends(get_current_user_id)
) -> RAGResponse:
    """
    Initialize RAG memory for a clone
    This endpoint is called during clone creation or when enabling RAG
    """
    try:
        logger.info(f"Initializing RAG for clone {clone_id} by user {current_user_id}")
        
        # Verify clone ownership
        clone_info = await rag_service._get_clone_info(clone_id)
        if not clone_info:
            raise HTTPException(status_code=404, detail="Clone not found")
        
        if clone_info.get('creator_id') != current_user_id:
            raise HTTPException(status_code=403, detail="Not authorized to modify this clone")
        
        # Initialize RAG memory
        result = await rag_service.initialize_clone_memory(
            clone_id=clone_id,
            expert_name=request.expert_name or clone_info['name'],
            domain_name=request.domain_name,
            context=request.context,
            documents=request.documents
        )
        
        if not result['success']:
            raise HTTPException(
                status_code=500, 
                detail=f"RAG initialization failed: {result['error']}"
            )
        
        return RAGResponse(
            success=True,
            message="RAG memory initialized successfully",
            data=result['data']
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to initialize RAG for clone {clone_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/query/{clone_id}")
async def query_clone_rag(
    clone_id: str,
    request: RAGQueryRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user_id: str = Depends(get_current_user_id)
) -> RAGResponse:
    """
    Query clone using RAG system with intelligent fallback
    This is the main endpoint for chat interactions
    """
    try:
        logger.info(f"RAG query for clone {clone_id} by user {current_user_id}")
        
        # Verify access (clone must be published or user must be creator)
        clone_info = await rag_service._get_clone_info(clone_id)
        if not clone_info:
            raise HTTPException(status_code=404, detail="Clone not found")
        
        if not clone_info.get('is_published') and clone_info.get('creator_id') != current_user_id:
            raise HTTPException(status_code=403, detail="Clone not accessible")
        
        # Process query
        result = await rag_service.query_clone_with_rag(
            clone_id=clone_id,
            query=request.query,
            conversation_history=request.conversation_history
        )
        
        if not result['success']:
            raise HTTPException(
                status_code=500, 
                detail=f"Query processing failed: {result['error']}"
            )
        
        return RAGResponse(
            success=True,
            message="Query processed successfully",
            response=result['response'],
            sources=result.get('sources', []),
            mode=result.get('mode', 'unknown')
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to process RAG query for clone {clone_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status/{clone_id}")
async def get_clone_rag_status(
    clone_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user_id: str = Depends(get_current_user_id)
) -> CloneRAGStatus:
    """
    Get RAG status for a clone
    Used by frontend to check initialization progress
    """
    try:
        # Verify access
        clone_info = await rag_service._get_clone_info(clone_id)
        if not clone_info:
            raise HTTPException(status_code=404, detail="Clone not found")
        
        if clone_info.get('creator_id') != current_user_id:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        # Get RAG mapping
        rag_mapping = await rag_service._get_clone_rag_mapping(clone_id)
        
        status_data = {
            'clone_id': clone_id,
            'rag_enabled': clone_info.get('rag_enabled', False),
            'rag_status': clone_info.get('rag_initialization_status', 'pending'),
            'expert_name': rag_mapping.get('expert_name') if rag_mapping else None,
            'domain_name': rag_mapping.get('domain_name') if rag_mapping else None,
            'last_processed_at': rag_mapping.get('last_processed_at') if rag_mapping else None,
            'error_message': clone_info.get('rag_config', {}).get('error_message') if clone_info.get('rag_config') else None
        }
        
        return CloneRAGStatus(**status_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get RAG status for clone {clone_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/documents/process/{clone_id}")
async def process_clone_documents(
    clone_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user_id: str = Depends(get_current_user_id)
) -> RAGResponse:
    """
    Process existing documents for RAG integration
    Called when adding documents to an existing clone
    """
    try:
        logger.info(f"Processing documents for clone {clone_id}")
        
        # Verify ownership
        clone_info = await rag_service._get_clone_info(clone_id)
        if not clone_info:
            raise HTTPException(status_code=404, detail="Clone not found")
        
        if clone_info.get('creator_id') != current_user_id:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        # Get documents and process them
        documents = await rag_service._get_clone_documents(clone_id)
        
        if not documents:
            return RAGResponse(
                success=True,
                message="No documents to process",
                data={'processed_count': 0}
            )
        
        # If RAG is already initialized, add documents to existing vector store
        rag_mapping = await rag_service._get_clone_rag_mapping(clone_id)
        if rag_mapping and rag_mapping.get('rag_status') == 'ready':
            # TODO: Implement document addition to existing vector store
            # This would call a different RAG service endpoint
            pass
        
        return RAGResponse(
            success=True,
            message=f"Processed {len(documents)} documents",
            data={'processed_count': len(documents)}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to process documents for clone {clone_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/cleanup/{clone_id}")
async def cleanup_clone_rag(
    clone_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user_id: str = Depends(get_current_user_id)
) -> RAGResponse:
    """
    Cleanup RAG resources for a clone
    Called when deleting a clone or disabling RAG
    """
    try:
        logger.info(f"Cleaning up RAG resources for clone {clone_id}")
        
        # Verify ownership
        clone_info = await rag_service._get_clone_info(clone_id)
        if not clone_info:
            raise HTTPException(status_code=404, detail="Clone not found")
        
        if clone_info.get('creator_id') != current_user_id:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        # TODO: Implement RAG resource cleanup
        # This would:
        # 1. Delete OpenAI assistant
        # 2. Delete vector store
        # 3. Remove database records
        # 4. Update clone status
        
        return RAGResponse(
            success=True,
            message="RAG resources cleaned up successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to cleanup RAG for clone {clone_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
```

### Step 3: Schema Models

Create `/backend/app/models/rag_schemas.py`:

```python
"""
Pydantic schemas for RAG operations
"""
from datetime import datetime
from typing import List, Optional, Dict, Any, Union
from uuid import UUID

from pydantic import BaseModel, Field, validator

class DocumentInfo(BaseModel):
    """Document information for RAG processing"""
    name: str = Field(..., description="Document name")
    url: str = Field(..., description="Document URL or file path")
    type: str = Field(default="pdf", description="Document type (pdf, docx, txt, etc.)")
    size_bytes: Optional[int] = Field(None, description="File size in bytes")

class RAGInitRequest(BaseModel):
    """Request model for RAG initialization"""
    expert_name: Optional[str] = Field(None, description="Expert name (defaults to clone name)")
    domain_name: str = Field(..., description="Domain category")
    context: str = Field(..., description="Expert context and expertise description")
    documents: Optional[List[DocumentInfo]] = Field(None, description="Documents to process")
    
    @validator('domain_name')
    def validate_domain(cls, v):
        valid_domains = [
            'health-wellness', 'business-strategy', 'education-learning',
            'finance-investment', 'life-coaching', 'legal-consulting',
            'ai-technology', 'other'
        ]
        if v not in valid_domains:
            raise ValueError(f"Domain must be one of: {', '.join(valid_domains)}")
        return v

class RAGQueryRequest(BaseModel):
    """Request model for RAG queries"""
    query: str = Field(..., description="User query")
    conversation_history: Optional[List[Dict[str, str]]] = Field(
        None, description="Previous conversation messages"
    )
    
    @validator('conversation_history')
    def validate_history(cls, v):
        if v is not None:
            for msg in v:
                if 'role' not in msg or 'content' not in msg:
                    raise ValueError("Each message must have 'role' and 'content' fields")
                if msg['role'] not in ['user', 'assistant']:
                    raise ValueError("Message role must be 'user' or 'assistant'")
        return v

class SourceInfo(BaseModel):
    """Source information for RAG responses"""
    document_name: str = Field(..., description="Source document name")
    page_number: Optional[int] = Field(None, description="Page number if applicable")
    relevance_score: Optional[float] = Field(None, description="Relevance score")
    excerpt: Optional[str] = Field(None, description="Relevant text excerpt")

class RAGResponse(BaseModel):
    """Response model for RAG operations"""
    success: bool = Field(..., description="Operation success status")
    message: str = Field(..., description="Response message")
    response: Optional[str] = Field(None, description="Generated response text")
    sources: Optional[List[SourceInfo]] = Field(None, description="Source documents used")
    mode: Optional[str] = Field(None, description="Response mode (rag, llm_fallback, etc.)")
    data: Optional[Dict[str, Any]] = Field(None, description="Additional response data")
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class CloneRAGStatus(BaseModel):
    """Clone RAG status information"""
    clone_id: str = Field(..., description="Clone ID")
    rag_enabled: bool = Field(..., description="Whether RAG is enabled")
    rag_status: str = Field(..., description="RAG initialization status")
    expert_name: Optional[str] = Field(None, description="Expert name")
    domain_name: Optional[str] = Field(None, description="Domain name")
    last_processed_at: Optional[datetime] = Field(None, description="Last processing timestamp")
    error_message: Optional[str] = Field(None, description="Error message if failed")

class DocumentProcessingStatus(BaseModel):
    """Document processing status"""
    document_id: str = Field(..., description="Document ID")
    status: str = Field(..., description="Processing status")
    progress_percentage: Optional[int] = Field(None, description="Processing progress")
    error_message: Optional[str] = Field(None, description="Error message if failed")
    openai_file_id: Optional[str] = Field(None, description="OpenAI file ID")
```

### Step 4: Integration with Existing Chat Service

Update `/backend/app/services/chat_service.py` to integrate RAG:

```python
# Add these imports at the top
from app.services.rag_service import rag_service

# Update the ChatService class to use RAG
class ChatService:
    """Handles chat operations with RAG integration"""
    
    def __init__(self):
        self.connection_manager = connection_manager
        self.rag_service = rag_service  # Add RAG service
    
    # Update the generate_ai_response method
    async def generate_ai_response(
        self,
        clone_id: str,
        user_message: str,
        conversation_history: List[Dict[str, str]] = None,
        session_context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Generate AI response using RAG-enhanced or fallback methods
        """
        try:
            logger.info(f"Generating response for clone {clone_id}")
            
            # Use RAG service for intelligent response generation
            rag_result = await self.rag_service.query_clone_with_rag(
                clone_id=clone_id,
                query=user_message,
                conversation_history=conversation_history
            )
            
            if rag_result['success']:
                return {
                    'response': rag_result['response'],
                    'sources': rag_result.get('sources', []),
                    'mode': rag_result.get('mode', 'unknown'),
                    'tokens_used': rag_result.get('tokens_used', 0),
                    'cost_increment': rag_result.get('cost_increment', 0.0)
                }
            else:
                # If RAG fails completely, use the existing OpenAI service
                return await self._fallback_to_openai_service(
                    clone_id, user_message, conversation_history
                )
                
        except Exception as e:
            logger.error(f"Failed to generate AI response: {str(e)}")
            # Ultimate fallback
            return await self._fallback_to_openai_service(
                clone_id, user_message, conversation_history
            )
    
    async def _fallback_to_openai_service(
        self,
        clone_id: str,
        user_message: str,
        conversation_history: List[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Fallback to existing OpenAI service"""
        try:
            # Use existing OpenAI service implementation
            response = await openai_service.generate_response(
                clone_id=clone_id,
                prompt=user_message,
                conversation_history=conversation_history
            )
            
            return {
                'response': response.get('content', 'I apologize, but I cannot generate a response right now.'),
                'sources': [],
                'mode': 'openai_fallback',
                'tokens_used': response.get('tokens_used', 0),
                'cost_increment': response.get('cost_increment', 0.0)
            }
            
        except Exception as e:
            logger.error(f"OpenAI fallback also failed: {str(e)}")
            return {
                'response': 'I apologize, but I am experiencing technical difficulties. Please try again later.',
                'sources': [],
                'mode': 'error_fallback',
                'tokens_used': 0,
                'cost_increment': 0.0
            }
```

### Step 5: Update Main FastAPI Application

Update `/backend/app/main.py` to include RAG routes:

```python
# Add RAG router import
from app.api.rag import router as rag_router

# Include RAG router
app.include_router(rag_router, prefix="/api/v1")

# Add cleanup on shutdown
@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup resources on shutdown"""
    from app.services.rag_service import cleanup_rag_service
    await cleanup_rag_service()
```

### Step 6: Environment Configuration

Update `/backend/app/config.py`:

```python
class Settings(BaseSettings):
    # ... existing settings ...
    
    # RAG Service settings
    RAG_SERVICE_URL: str = "http://localhost:8000"
    RAG_SERVICE_TIMEOUT: int = 30
    RAG_RETRY_ATTEMPTS: int = 3
    RAG_ENABLED: bool = True
    
    # OpenAI Assistant API settings
    OPENAI_ASSISTANT_MODEL: str = "gpt-4-turbo-preview"
    OPENAI_MAX_FILES_PER_ASSISTANT: int = 20
    
    # Vector store settings
    VECTOR_STORE_MAX_FILES: int = 10000
    VECTOR_STORE_CLEANUP_DAYS: int = 30
```

### Step 7: Integration with Clone Creation

Update the clone creation endpoint in `/backend/app/api/clones.py`:

```python
# Add RAG service import
from app.services.rag_service import rag_service

# Update clone creation to optionally initialize RAG
@router.post("/", response_model=CloneResponse)
async def create_clone(
    clone_data: CloneCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user_id: str = Depends(get_current_user_id)
):
    """Create a new clone with optional RAG initialization"""
    try:
        logger.info(f"Creating clone for user {current_user_id}")
        
        # Create clone record (existing logic)
        clone_dict = clone_data.dict()
        clone_dict['creator_id'] = current_user_id
        clone_dict['id'] = str(uuid4())
        
        # Set RAG defaults
        clone_dict['rag_enabled'] = clone_data.enable_rag if hasattr(clone_data, 'enable_rag') else False
        clone_dict['rag_initialization_status'] = 'pending' if clone_dict['rag_enabled'] else 'disabled'
        
        # Insert clone
        result = supabase.table('clones').insert(clone_dict).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create clone")
        
        created_clone = result.data[0]
        clone_id = created_clone['id']
        
        # Initialize RAG if enabled
        if clone_dict['rag_enabled']:
            try:
                # Map clone category to domain
                domain_mapping = {
                    'medical': 'health-wellness',
                    'business': 'business-strategy',
                    'education': 'education-learning',
                    'finance': 'finance-investment',
                    'coaching': 'life-coaching',
                    'legal': 'legal-consulting',
                    'ai': 'ai-technology'
                }
                domain_name = domain_mapping.get(clone_data.category, 'other')
                
                # Build context from clone data
                context_parts = []
                if clone_data.professional_title:
                    context_parts.append(f"Professional title: {clone_data.professional_title}")
                if clone_data.bio:
                    context_parts.append(f"Background: {clone_data.bio}")
                if clone_data.credentials_qualifications:
                    context_parts.append(f"Credentials: {clone_data.credentials_qualifications}")
                
                context = "\n".join(context_parts) or f"Expert in {clone_data.category}"
                
                # Initialize RAG (async - don't wait for completion)
                asyncio.create_task(
                    rag_service.initialize_clone_memory(
                        clone_id=clone_id,
                        expert_name=clone_data.name,
                        domain_name=domain_name,
                        context=context
                    )
                )
                
            except Exception as e:
                logger.warning(f"RAG initialization failed for clone {clone_id}: {str(e)}")
                # Don't fail clone creation if RAG fails
        
        return CloneResponse(**created_clone)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create clone: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
```

## Testing Strategy

### 1. Unit Tests

Create `/backend/tests/test_rag_service.py`:

```python
import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch

from app.services.rag_service import RAGService, RAGServiceError

@pytest.fixture
def rag_service():
    return RAGService()

@pytest.mark.asyncio
async def test_initialize_clone_memory_success(rag_service):
    """Test successful RAG memory initialization"""
    with patch.object(rag_service, '_call_rag_initialize', return_value={
        'success': True,
        'data': {'assistant_id': 'asst_123', 'vector_store_id': 'vs_123'}
    }), \
    patch.object(rag_service, '_update_clone_rag_status'), \
    patch.object(rag_service, '_create_clone_rag_mapping'), \
    patch.object(rag_service, '_get_clone_documents', return_value=[]):
        
        result = await rag_service.initialize_clone_memory(
            clone_id='clone_123',
            expert_name='Dr. Smith',
            domain_name='health-wellness',
            context='Medical expert'
        )
        
        assert result['success'] is True
        assert 'assistant_id' in result['data']

@pytest.mark.asyncio
async def test_query_clone_with_rag_fallback(rag_service):
    """Test RAG query with LLM fallback"""
    with patch.object(rag_service, '_get_clone_rag_mapping', return_value=None), \
    patch.object(rag_service, '_query_with_llm_fallback', return_value={
        'success': True,
        'response': 'Fallback response',
        'sources': []
    }):
        
        result = await rag_service.query_clone_with_rag(
            clone_id='clone_123',
            query='What is your expertise?'
        )
        
        assert result['success'] is True
        assert 'Fallback response' in result['response']
```

### 2. Integration Tests

Create `/backend/tests/test_rag_api.py`:

```python
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch

from app.main import app

client = TestClient(app)

def test_initialize_rag_endpoint():
    """Test RAG initialization endpoint"""
    with patch('app.services.rag_service.rag_service.initialize_clone_memory') as mock_init:
        mock_init.return_value = {
            'success': True,
            'data': {'assistant_id': 'asst_123'}
        }
        
        response = client.post(
            "/api/v1/rag/initialize/clone_123",
            json={
                "domain_name": "health-wellness",
                "context": "Medical expert",
                "documents": []
            },
            headers={"Authorization": "Bearer test_token"}
        )
        
        assert response.status_code == 200
        assert response.json()["success"] is True
```

### 3. End-to-End Testing

Create comprehensive test scenarios:

```python
# /backend/tests/test_rag_e2e.py
import pytest
import asyncio
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_full_rag_workflow():
    """Test complete RAG workflow from initialization to query"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # 1. Create clone
        clone_response = await ac.post("/api/v1/clones", json={
            "name": "Dr. Test",
            "category": "medical",
            "enable_rag": True
        })
        clone_id = clone_response.json()["id"]
        
        # 2. Wait for RAG initialization
        await asyncio.sleep(5)
        
        # 3. Check RAG status
        status_response = await ac.get(f"/api/v1/rag/status/{clone_id}")
        assert status_response.json()["rag_status"] == "ready"
        
        # 4. Query clone
        query_response = await ac.post(f"/api/v1/rag/query/{clone_id}", json={
            "query": "What is your medical expertise?"
        })
        
        assert query_response.status_code == 200
        assert "response" in query_response.json()
```

## Error Handling & Monitoring

### 1. Comprehensive Error Handling

```python
# Add to rag_service.py
class RAGErrorHandler:
    """Centralized error handling for RAG operations"""
    
    @staticmethod
    def handle_rag_service_error(e: Exception, operation: str, clone_id: str):
        """Handle and log RAG service errors"""
        error_info = {
            'operation': operation,
            'clone_id': clone_id,
            'error_type': type(e).__name__,
            'error_message': str(e)
        }
        
        if isinstance(e, httpx.HTTPStatusError):
            error_info['http_status'] = e.response.status_code
            error_info['response_text'] = e.response.text
        
        logger.error("RAG service error", **error_info)
        
        # Return user-friendly error message
        if isinstance(e, httpx.TimeoutException):
            return "The knowledge system is taking longer than expected. Please try again."
        elif isinstance(e, httpx.ConnectError):
            return "Unable to connect to the knowledge system. Using standard responses."
        else:
            return "Experiencing temporary issues with enhanced features. Basic functionality available."
```

### 2. Performance Monitoring

```python
# Add to rag_service.py
import time
from functools import wraps

def monitor_performance(operation_name: str):
    """Decorator to monitor RAG operation performance"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = await func(*args, **kwargs)
                duration = time.time() - start_time
                logger.info(f"RAG operation completed", 
                           operation=operation_name, 
                           duration=duration,
                           success=True)
                return result
            except Exception as e:
                duration = time.time() - start_time
                logger.error(f"RAG operation failed", 
                            operation=operation_name, 
                            duration=duration,
                            error=str(e))
                raise
        return wrapper
    return decorator

# Apply to key methods
@monitor_performance("initialize_memory")
async def initialize_clone_memory(self, ...):
    # existing code

@monitor_performance("query_rag")
async def query_clone_with_rag(self, ...):
    # existing code
```

## Deployment Considerations

### 1. Configuration Management

```python
# Environment-specific settings
class ProductionSettings(Settings):
    RAG_SERVICE_URL: str = "https://rag-service.your-domain.com"
    RAG_SERVICE_TIMEOUT: int = 60
    RAG_RETRY_ATTEMPTS: int = 5

class DevelopmentSettings(Settings):
    RAG_SERVICE_URL: str = "http://localhost:8000"
    RAG_SERVICE_TIMEOUT: int = 30
    RAG_RETRY_ATTEMPTS: int = 3
```

### 2. Health Checks

```python
# Add to main.py
@app.get("/health/rag")
async def rag_health_check():
    """Check RAG service health"""
    try:
        # Test RAG service connectivity
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{settings.RAG_SERVICE_URL}/health")
            rag_healthy = response.status_code == 200
    except:
        rag_healthy = False
    
    return {
        "rag_service": "healthy" if rag_healthy else "unhealthy",
        "database": "healthy",  # Add database check
        "openai": "healthy"     # Add OpenAI check
    }
```

## Success Criteria

- ✅ RAG service successfully integrates with existing FastAPI backend
- ✅ Intelligent fallback system works when RAG is unavailable
- ✅ Clone creation supports optional RAG initialization
- ✅ Chat service uses RAG for enhanced responses
- ✅ Comprehensive error handling and monitoring
- ✅ API endpoints are properly authenticated and authorized
- ✅ Database operations maintain data integrity
- ✅ Performance monitoring tracks operation metrics
- ✅ Integration tests pass for all workflows
- ✅ Documentation is complete and accurate

## Next Steps

After completing Phase 2:
1. Proceed to Phase 3: Frontend Testing & Preview Integration
2. Test all API endpoints thoroughly
3. Monitor performance and error rates
4. Optimize database queries and caching
5. Set up production deployment pipeline