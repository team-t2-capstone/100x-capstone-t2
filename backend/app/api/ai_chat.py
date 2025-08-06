"""
AI Chat API endpoints
Handles AI-powered conversations using OpenAI
"""
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

import structlog

from app.database import get_db_session, get_supabase
from app.core.supabase_auth import get_current_user_id
from app.services.openai_service import openai_service
from app.models.schemas import BaseSchema

logger = structlog.get_logger()

router = APIRouter(prefix="/ai", tags=["AI Chat"])


# Request/Response Models
class ChatMessage(BaseSchema):
    """Chat message model"""
    role: str  # 'user', 'assistant', 'system'
    content: str
    timestamp: Optional[datetime] = None


class ChatRequest(BaseSchema):
    """Chat completion request"""
    messages: List[ChatMessage]
    model: Optional[str] = None
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = None
    stream: bool = False
    clone_id: Optional[str] = None
    session_id: Optional[str] = None


class ChatResponse(BaseSchema):
    """Chat completion response"""
    id: str
    object: str
    created: int
    model: str
    choices: List[Dict[str, Any]]
    usage: Dict[str, Any]
    session_id: Optional[str] = None


class EmbeddingRequest(BaseSchema):
    """Embedding request"""
    texts: List[str]
    model: Optional[str] = None


class EmbeddingResponse(BaseSchema):
    """Embedding response"""
    object: str
    model: str
    data: List[Dict[str, Any]]
    usage: Dict[str, Any]


class AIHealthResponse(BaseSchema):
    """AI service health response"""
    service: str
    available: bool
    api_key_configured: bool
    usage: Dict[str, Any]
    test_successful: Optional[bool] = None
    test_model: Optional[str] = None
    test_error: Optional[str] = None


# Health Check Endpoint
@router.get("/health", response_model=AIHealthResponse)
async def ai_health_check():
    """
    Check AI service health and configuration
    """
    try:
        health_status = await openai_service.health_check()
        return AIHealthResponse(**health_status)
    except Exception as e:
        logger.error("AI health check failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI health check failed"
        )


# Chat Completion Endpoints
@router.post("/chat/completions")
async def create_chat_completion(
    chat_request: ChatRequest,
    background_tasks: BackgroundTasks,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Create a chat completion using OpenAI
    Supports both standard and streaming responses
    """
    try:
        # Convert messages to OpenAI format
        openai_messages = [
            {
                "role": msg.role,
                "content": msg.content
            }
            for msg in chat_request.messages
        ]

        # Generate session ID if not provided
        session_id = chat_request.session_id or str(uuid.uuid4())

        logger.info("Creating chat completion",
                   user_id=current_user_id,
                   session_id=session_id,
                   message_count=len(openai_messages),
                   clone_id=chat_request.clone_id)

        if chat_request.stream:
            # Return streaming response
            async def generate_stream():
                try:
                    async for chunk in openai_service.create_chat_completion(
                        messages=openai_messages,
                        model=chat_request.model,
                        temperature=chat_request.temperature,
                        max_tokens=chat_request.max_tokens,
                        stream=True,
                        user_id=current_user_id
                    ):
                        # Add session_id to chunk
                        chunk['session_id'] = session_id
                        yield f"data: {json.dumps(chunk)}\n\n"
                        
                    yield "data: [DONE]\n\n"
                    
                except Exception as e:
                    error_chunk = {
                        "error": {
                            "message": str(e),
                            "type": "api_error"
                        }
                    }
                    yield f"data: {json.dumps(error_chunk)}\n\n"

            return StreamingResponse(
                generate_stream(),
                media_type="text/plain",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "Content-Type": "text/event-stream"
                }
            )
        else:
            # Standard response
            response = await openai_service.create_chat_completion(
                messages=openai_messages,
                model=chat_request.model,
                temperature=chat_request.temperature,
                max_tokens=chat_request.max_tokens,
                stream=False,
                user_id=current_user_id
            )
            
            response['session_id'] = session_id
            
            # Queue background task to save conversation
            background_tasks.add_task(
                save_conversation,
                user_id=current_user_id,
                session_id=session_id,
                messages=chat_request.messages,
                response_message=response['choices'][0]['message'] if response['choices'] else None,
                clone_id=chat_request.clone_id
            )
            
            return response

    except Exception as e:
        logger.error("Chat completion failed", 
                    error=str(e), 
                    user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/chat/simple")
async def simple_chat(
    message: str,
    model: Optional[str] = None,
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Simple chat endpoint for quick testing
    Sends a single user message and returns assistant response
    """
    try:
        messages = [
            {
                "role": "user",
                "content": message
            }
        ]

        response = await openai_service.create_chat_completion(
            messages=messages,
            model=model,
            user_id=current_user_id
        )

        if response['choices']:
            return {
                "message": response['choices'][0]['message']['content'],
                "model": response['model'],
                "usage": response['usage']
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No response generated"
            )

    except Exception as e:
        logger.error("Simple chat failed", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# Embeddings Endpoints
@router.post("/embeddings", response_model=EmbeddingResponse)
async def create_embeddings(
    embedding_request: EmbeddingRequest,
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Create embeddings for text(s)
    """
    try:
        logger.info("Creating embeddings",
                   user_id=current_user_id,
                   text_count=len(embedding_request.texts))

        response = await openai_service.create_embeddings(
            texts=embedding_request.texts,
            model=embedding_request.model,
            user_id=current_user_id
        )

        return EmbeddingResponse(**response)

    except Exception as e:
        logger.error("Embeddings creation failed", 
                    error=str(e), 
                    user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# Clone-specific Chat Endpoints
@router.post("/clones/{clone_id}/chat")
async def chat_with_clone(
    clone_id: str,
    chat_request: ChatRequest,
    background_tasks: BackgroundTasks,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Chat with a specific AI clone
    Includes clone personality and context in the conversation
    """
    try:
        # TODO: Fetch clone data and personality from database
        # For now, we'll use a basic system message
        
        clone_system_message = {
            "role": "system",
            "content": f"You are an AI assistant clone with ID {clone_id}. Respond helpfully and professionally."
        }

        # Prepend system message to conversation
        openai_messages = [clone_system_message] + [
            {
                "role": msg.role,
                "content": msg.content
            }
            for msg in chat_request.messages
        ]

        response = await openai_service.create_chat_completion(
            messages=openai_messages,
            model=chat_request.model,
            temperature=chat_request.temperature,
            max_tokens=chat_request.max_tokens,
            user_id=current_user_id
        )

        session_id = chat_request.session_id or str(uuid.uuid4())
        response['session_id'] = session_id
        response['clone_id'] = clone_id

        # Queue background task to save conversation
        background_tasks.add_task(
            save_conversation,
            user_id=current_user_id,
            session_id=session_id,
            messages=chat_request.messages,
            response_message=response['choices'][0]['message'] if response['choices'] else None,
            clone_id=clone_id
        )

        return response

    except Exception as e:
        logger.error("Clone chat failed", 
                    error=str(e), 
                    user_id=current_user_id,
                    clone_id=clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# Usage and Statistics
@router.get("/usage")
async def get_ai_usage(
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Get AI usage statistics for the current user
    """
    try:
        # Get global usage stats
        global_usage = openai_service.usage_tracker.copy()
        
        # TODO: Get user-specific usage from database
        user_usage = {
            "user_id": current_user_id,
            "daily_requests": 0,
            "daily_tokens": 0,
            "daily_cost": 0.0,
            "monthly_requests": 0,
            "monthly_tokens": 0,
            "monthly_cost": 0.0
        }
        
        return {
            "global_usage": global_usage,
            "user_usage": user_usage,
            "limits": {
                "daily_cost_limit": getattr(openai_service, 'DAILY_COST_LIMIT', 1000.0),
                "max_tokens_per_request": getattr(openai_service, 'MAX_TOKENS_PER_REQUEST', 2000)
            }
        }

    except Exception as e:
        logger.error("Failed to get AI usage", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve usage statistics"
        )


# Background Tasks
async def save_conversation(
    user_id: str,
    session_id: str,
    messages: List[ChatMessage],
    response_message: Optional[Dict[str, str]],
    clone_id: Optional[str] = None
):
    """
    Background task to save conversation to database
    """
    try:
        logger.info("Saving conversation", 
                   user_id=user_id, 
                   session_id=session_id,
                   clone_id=clone_id)
        
        # TODO: Implement database storage
        # This would typically:
        # 1. Create or update session record
        # 2. Save all messages to conversation history
        # 3. Update usage statistics
        # 4. Update clone interaction history if applicable
        
        pass
        
    except Exception as e:
        logger.error("Failed to save conversation", 
                    error=str(e),
                    user_id=user_id, 
                    session_id=session_id)


# Models/Endpoints for future features
@router.get("/models")
async def list_available_models():
    """
    List available AI models
    """
    models = [
        {
            "id": "gpt-4",
            "object": "model",
            "created": 1687882411,
            "owned_by": "openai",
            "capability": ["chat", "completion"],
            "description": "Most capable GPT-4 model"
        },
        {
            "id": "gpt-4-turbo",
            "object": "model", 
            "created": 1712361441,
            "owned_by": "openai",
            "capability": ["chat", "completion"],
            "description": "Latest GPT-4 Turbo model"
        },
        {
            "id": "gpt-3.5-turbo",
            "object": "model",
            "created": 1677610602,
            "owned_by": "openai",
            "capability": ["chat", "completion"],
            "description": "Fast and cost-effective model"
        },
        {
            "id": "text-embedding-3-large",
            "object": "model",
            "created": 1705953180,
            "owned_by": "openai",
            "capability": ["embedding"],
            "description": "High-performance embedding model"
        },
        {
            "id": "text-embedding-3-small",
            "object": "model",
            "created": 1705948997,
            "owned_by": "openai",
            "capability": ["embedding"],
            "description": "Cost-effective embedding model"
        }
    ]
    
    return {
        "object": "list",
        "data": models
    }