"""
Voice and Video Call API endpoints
Handles AI clone voice/video calls with real-time response generation
"""
import logging
import asyncio
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status, Response, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

import structlog

from app.database import get_db_session
from app.core.supabase_auth import get_current_user_id
from app.models.database import Clone, Session as CallSession, Message, ConversationMemory
from app.models.schemas import BaseSchema
from app.services.voice_synthesis import voice_synthesis_service, synthesize_clone_speech
from app.services.openai_service import openai_service
from app.services.rag_processor import rag_processor

logger = structlog.get_logger()

router = APIRouter(prefix="/calls", tags=["Voice/Video Calls"])

# Pydantic schemas
class VoiceCallRequest(BaseSchema):
    message: str
    clone_id: str
    session_id: Optional[str] = None

class VoiceCallResponse(BaseSchema):
    session_id: str
    clone_id: str
    response_text: str
    audio_url: str
    duration_seconds: float
    timestamp: datetime

class CallSessionInfo(BaseSchema):
    session_id: str
    clone_id: str
    clone_name: str
    call_type: str
    status: str
    start_time: datetime
    duration_seconds: int
    total_cost: float
    message_count: int

class VoiceSettings(BaseSchema):
    voice: str = "alloy"
    model: str = "tts-1"
    speed: float = 1.0

class VoiceCustomizationRequest(BaseSchema):
    clone_id: str
    voice_settings: VoiceSettings

# In-memory storage for active call sessions (in production, use Redis)
active_call_sessions: Dict[str, Dict[str, Any]] = {}

@router.post("/voice/message", response_model=VoiceCallResponse)
async def process_voice_message(
    request: VoiceCallRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Process a voice message during a call and return AI response with synthesized audio
    """
    try:
        # Get clone information
        clone_result = await db.execute(
            select(Clone).where(Clone.id == request.clone_id)
        )
        clone = clone_result.scalar_one_or_none()
        if not clone:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )

        # Get or create call session
        session_id = request.session_id
        if not session_id:
            session_id = f"call_{uuid4().hex[:12]}"
            
            # Create new call session
            call_session = CallSession(
                id=session_id,
                user_id=current_user_id,
                clone_id=request.clone_id,
                session_type="call",
                start_time=datetime.utcnow(),
                status="active",
                metadata={"call_type": "voice", "messages": []}
            )
            db.add(call_session)
            
            # Add to active sessions
            active_call_sessions[session_id] = {
                "clone_id": request.clone_id,
                "user_id": current_user_id,
                "start_time": datetime.utcnow(),
                "message_count": 0,
                "total_cost": 0.0
            }
        
        # Generate AI response using RAG
        ai_response = await openai_service.generate_response(
            message=request.message,
            clone_id=request.clone_id,
            user_id=current_user_id,
            session_id=session_id,
            include_context=True
        )

        # Synthesize speech for the AI response
        audio_data = await synthesize_clone_speech(
            text=ai_response["content"],
            clone_id=request.clone_id,
            clone_category=clone.category
        )

        # Save audio to temporary location and create URL
        # In production, upload to cloud storage (S3, GCS)
        import tempfile
        import base64
        
        audio_filename = f"call_audio_{session_id}_{uuid4().hex[:8]}.mp3"
        audio_url = f"/api/v1/calls/audio/{audio_filename}"
        
        # Store audio data (in production, use proper storage)
        # For now, we'll return it as base64 in the response
        audio_base64 = base64.b64encode(audio_data).decode()

        # Save message to database
        user_message = Message(
            session_id=session_id,
            sender_type="user",
            content=request.message,
            timestamp=datetime.utcnow(),
            metadata={"message_type": "voice"}
        )
        
        ai_message = Message(
            session_id=session_id,
            sender_type="assistant", 
            content=ai_response["content"],
            timestamp=datetime.utcnow(),
            metadata={
                "message_type": "voice",
                "audio_url": audio_url,
                "audio_duration": len(audio_data) / 1000,  # Rough estimate
                "tokens_used": ai_response.get("tokens_used", 0)
            }
        )
        
        db.add(user_message)
        db.add(ai_message)
        
        # Update session
        if session_id in active_call_sessions:
            active_call_sessions[session_id]["message_count"] += 2
            active_call_sessions[session_id]["total_cost"] += 0.05  # $0.05 per message for demo

        await db.commit()

        logger.info("Voice message processed", 
                   session_id=session_id,
                   clone_id=request.clone_id,
                   message_length=len(request.message),
                   response_length=len(ai_response["content"]))

        return VoiceCallResponse(
            session_id=session_id,
            clone_id=request.clone_id,
            response_text=ai_response["content"],
            audio_url=f"data:audio/mp3;base64,{audio_base64}",  # Return as data URI for demo
            duration_seconds=len(audio_data) / 1000,  # Rough estimate
            timestamp=datetime.utcnow()
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Voice message processing failed", 
                    error=str(e), 
                    user_id=current_user_id,
                    clone_id=request.clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process voice message"
        )

@router.get("/audio/{filename}")
async def get_call_audio(filename: str):
    """Serve call audio files"""
    # In production, this would serve from cloud storage
    # For now, return a placeholder
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Audio file not found"
    )

@router.post("/voice/customize", response_model=Dict[str, Any])
async def customize_clone_voice(
    request: VoiceCustomizationRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
):
    """Customize voice settings for a clone"""
    try:
        # Verify clone ownership
        clone_result = await db.execute(
            select(Clone).where(
                Clone.id == request.clone_id,
                Clone.creator_id == current_user_id
            )
        )
        clone = clone_result.scalar_one_or_none()
        if not clone:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found or not owned by user"
            )

        # Customize voice settings
        voice_profile = await voice_synthesis_service.customize_clone_voice(
            clone_id=request.clone_id,
            voice_settings=request.voice_settings.dict()
        )

        # In production, save to database
        # For now, return the profile
        
        return {
            "message": "Voice settings customized successfully",
            "clone_id": request.clone_id,
            "voice_profile": voice_profile
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Voice customization failed", 
                    error=str(e),
                    clone_id=request.clone_id,
                    user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to customize voice settings"
        )

@router.get("/voice/preview/{voice}")
async def preview_voice(
    voice: str,
    model: str = "tts-1",
    speed: float = 1.0
):
    """Generate a voice sample for preview"""
    try:
        if voice not in ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid voice selection"
            )

        audio_data = await voice_synthesis_service.generate_sample_audio(
            voice=voice,
            model=model,
            speed=speed
        )

        return StreamingResponse(
            iter([audio_data]),
            media_type="audio/mpeg",
            headers={"Content-Disposition": f"attachment; filename=voice_preview_{voice}.mp3"}
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Voice preview generation failed", error=str(e), voice=voice)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate voice preview"
        )

@router.get("/voices")
async def get_available_voices():
    """Get list of available voices and their details"""
    try:
        voices = await voice_synthesis_service.get_available_voices("openai")
        return voices
    except Exception as e:
        logger.error("Failed to get available voices", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve available voices"
        )

@router.get("/session/{session_id}", response_model=CallSessionInfo)
async def get_call_session(
    session_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
):
    """Get information about a call session"""
    try:
        # Get session from database
        session_result = await db.execute(
            select(CallSession, Clone.name)
            .join(Clone, CallSession.clone_id == Clone.id)
            .where(
                CallSession.id == session_id,
                CallSession.user_id == current_user_id
            )
        )
        result = session_result.first()
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Call session not found"
            )
        
        call_session, clone_name = result

        # Get message count
        message_count_result = await db.execute(
            select(func.count(Message.id))
            .where(Message.session_id == session_id)
        )
        message_count = message_count_result.scalar()

        # Calculate duration
        if call_session.end_time:
            duration = (call_session.end_time - call_session.start_time).total_seconds()
        else:
            duration = (datetime.utcnow() - call_session.start_time).total_seconds()

        return CallSessionInfo(
            session_id=session_id,
            clone_id=call_session.clone_id,
            clone_name=clone_name,
            call_type=call_session.metadata.get("call_type", "voice"),
            status=call_session.status,
            start_time=call_session.start_time,
            duration_seconds=int(duration),
            total_cost=call_session.total_cost or 0.0,
            message_count=message_count or 0
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get call session", 
                    error=str(e), 
                    session_id=session_id,
                    user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve call session"
        )

@router.post("/session/{session_id}/end")
async def end_call_session(
    session_id: str,
    background_tasks: BackgroundTasks,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
):
    """End a call session and finalize billing"""
    try:
        # Get session from database
        session_result = await db.execute(
            select(CallSession).where(
                CallSession.id == session_id,
                CallSession.user_id == current_user_id
            )
        )
        call_session = session_result.scalar_one_or_none()
        
        if not call_session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Call session not found"
            )

        # Update session end time and status
        call_session.end_time = datetime.utcnow()
        call_session.status = "completed"
        
        # Calculate final duration and cost
        duration_seconds = (call_session.end_time - call_session.start_time).total_seconds()
        call_session.duration_minutes = int(duration_seconds / 60)
        
        # Simple cost calculation for demo (in production, use clone pricing)
        base_cost_per_minute = 1.5  # $1.50 per minute for voice calls
        call_session.total_cost = (duration_seconds / 60) * base_cost_per_minute

        # Remove from active sessions
        if session_id in active_call_sessions:
            del active_call_sessions[session_id]

        await db.commit()

        # Schedule background tasks
        background_tasks.add_task(generate_call_summary, session_id)
        background_tasks.add_task(cleanup_call_resources, session_id)

        logger.info("Call session ended", 
                   session_id=session_id,
                   duration_minutes=call_session.duration_minutes,
                   total_cost=call_session.total_cost)

        return {
            "message": "Call session ended successfully",
            "session_id": session_id,
            "duration_minutes": call_session.duration_minutes,
            "total_cost": call_session.total_cost,
            "status": "completed"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to end call session", 
                    error=str(e),
                    session_id=session_id,
                    user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to end call session"
        )

# Background task functions
async def generate_call_summary(session_id: str):
    """Generate a summary of the call session"""
    try:
        from app.database import get_db_session_sync
        
        async with get_db_session_sync() as db:
            # Get all messages from the session
            messages_result = await db.execute(
                select(Message).where(Message.session_id == session_id)
                .order_by(Message.timestamp)
            )
            messages = messages_result.scalars().all()
            
            if not messages:
                return
            
            # Create conversation text for summarization
            conversation = "\n".join([
                f"{msg.sender_type}: {msg.content}" for msg in messages
            ])
            
            # Generate summary using OpenAI
            summary = await openai_service.summarize_conversation(
                conversation=conversation,
                session_type="voice_call"
            )
            
            # Save summary (implementation depends on your schema)
            logger.info("Call summary generated", 
                       session_id=session_id,
                       summary_length=len(summary))
            
    except Exception as e:
        logger.error("Failed to generate call summary", 
                    error=str(e), 
                    session_id=session_id)

async def cleanup_call_resources(session_id: str):
    """Clean up temporary resources from the call"""
    try:
        # Clean up temporary audio files
        # Remove from caches
        # Log cleanup completion
        logger.info("Call resources cleaned up", session_id=session_id)
        
    except Exception as e:
        logger.error("Failed to cleanup call resources", 
                    error=str(e),
                    session_id=session_id)

@router.get("/active-sessions")
async def get_active_call_sessions(
    current_user_id: str = Depends(get_current_user_id)
):
    """Get active call sessions for the current user"""
    try:
        user_sessions = {
            session_id: session_data 
            for session_id, session_data in active_call_sessions.items()
            if session_data["user_id"] == current_user_id
        }
        
        return {
            "active_sessions": user_sessions,
            "count": len(user_sessions)
        }
        
    except Exception as e:
        logger.error("Failed to get active sessions", 
                    error=str(e),
                    user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve active sessions"
        )