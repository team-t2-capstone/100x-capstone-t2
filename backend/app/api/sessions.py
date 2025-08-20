from app.core.supabase_auth import get_current_user_id, require_role

"""
Session Management APIs for CloneAI - Chat session lifecycle and messaging
"""
import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

from fastapi import (
    APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, desc, or_
from sqlalchemy.orm import selectinload
import structlog

from app.core.security import get_current_user_id
from app.database import get_db_session
from app.models.database import Session, Message, Clone, UserProfile, SessionSummary
from app.models.schemas import (
    SessionCreate, SessionResponse, MessageCreate, MessageResponse,
    SessionSummaryRequest, SessionSummaryResponse
)
from app.config import settings

logger = structlog.get_logger()
router = APIRouter(prefix="/sessions", tags=["Session Management"])


@router.post("/", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    session_data: SessionCreate,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> SessionResponse:
    """
    Create a new chat session with an AI expert clone
    """
    try:
        # Verify clone exists and is available
        result = await db.execute(
            select(Clone).options(selectinload(Clone.creator)).where(
                and_(
                    Clone.id == session_data.expert_id,
                    Clone.is_published == True,
                    Clone.is_active == True
                )
            )
        )
        clone = result.scalar_one_or_none()
        
        if not clone:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Expert clone not found or not available"
            )
        
        # Get user info
        user_result = await db.execute(
            select(UserProfile).where(UserProfile.id == current_user_id)
        )
        user = user_result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Check if user has sufficient credits (for demo mode or free tier)
        if session_data.demo_mode:
            # Demo sessions are free but limited
            demo_sessions_today = await db.execute(
                select(func.count(Session.id)).where(
                    and_(
                        Session.user_id == current_user_id,
                        Session.demo_mode == True,
                        func.date(Session.created_at) == datetime.utcnow().date()
                    )
                )
            )
            demo_count = demo_sessions_today.scalar()
            
            if demo_count >= 3:  # Max 3 demo sessions per day
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Demo session limit reached for today. Please upgrade to continue."
                )
        else:
            # Check subscription limits for paid sessions
            if user.subscription_tier == "free" and user.credits_remaining <= 0:
                raise HTTPException(
                    status_code=status.HTTP_402_PAYMENT_REQUIRED,
                    detail="Insufficient credits. Please upgrade your subscription."
                )
        
        # Check for existing active sessions with the same clone (limit concurrent sessions)
        active_sessions = await db.execute(
            select(func.count(Session.id)).where(
                and_(
                    Session.user_id == current_user_id,
                    Session.clone_id == session_data.expert_id,
                    Session.status == "active"
                )
            )
        )
        active_count = active_sessions.scalar()
        
        if active_count >= 1:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You already have an active session with this expert. Please end the current session first."
            )
        
        # Create new session
        rate_per_minute = 0.0 if session_data.demo_mode else clone.base_price
        
        new_session = Session(
            user_id=uuid.UUID(current_user_id),
            clone_id=uuid.UUID(session_data.expert_id),
            session_type=session_data.session_type,
            demo_mode=session_data.demo_mode,
            status="active",
            rate_per_minute=rate_per_minute,
            total_cost=0.0,
            duration_minutes=0,
            message_count=0,
            session_metadata={
                "user_subscription": user.subscription_tier,
                "clone_category": clone.category,
                "created_from": "api"
            }
        )
        
        db.add(new_session)
        await db.commit()
        await db.refresh(new_session)
        
        # Send initial message if provided
        if session_data.initial_message:
            initial_msg = Message(
                session_id=new_session.id,
                sender_type="user",
                content=session_data.initial_message,
                cost_increment=0.0,
                tokens_used=0
            )
            db.add(initial_msg)
            new_session.message_count = 1
            await db.commit()
        
        # Update clone session count
        clone.total_sessions += 1
        await db.commit()
        
        logger.info("Session created successfully",
                   session_id=str(new_session.id),
                   user_id=current_user_id,
                   expert_id=session_data.expert_id,
                   demo_mode=session_data.demo_mode)
        
        return SessionResponse.from_orm(new_session)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Session creation failed", error=str(e), user_id=current_user_id)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create session"
        )


@router.get("/", response_model=List[SessionResponse])
async def list_user_sessions(
    status_filter: Optional[str] = Query(None, regex="^(active|paused|ended)$"),
    session_type: Optional[str] = Query(None, regex="^(chat|voice|video)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> List[SessionResponse]:
    """
    List user's chat sessions with filtering and pagination
    """
    try:
        # Build query
        query = select(Session).options(
            selectinload(Session.clone)
        ).where(Session.user_id == current_user_id)
        
        if status_filter:
            query = query.where(Session.status == status_filter)
        
        if session_type:
            query = query.where(Session.session_type == session_type)
        
        query = query.order_by(desc(Session.created_at))
        
        # Apply pagination
        offset = (page - 1) * limit
        query = query.offset(offset).limit(limit)
        
        # Execute query
        result = await db.execute(query)
        sessions = result.scalars().all()
        
        return [SessionResponse.from_orm(session) for session in sessions]
        
    except Exception as e:
        logger.error("Failed to list sessions", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve sessions"
        )


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    include_messages: bool = Query(False, description="Include recent messages in response"),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> SessionResponse:
    """
    Get detailed information about a specific session
    """
    try:
        # Get session with related data
        query = select(Session).options(
            selectinload(Session.clone),
            selectinload(Session.user)
        ).where(Session.id == session_id)
        
        result = await db.execute(query)
        session = result.scalar_one_or_none()
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        # Check access permissions
        if str(session.user_id) != current_user_id:
            # Also allow clone creator to view sessions
            if not session.clone or str(session.clone.creator_id) != current_user_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied"
                )
        
        # Update duration if session is active
        if session.status == "active":
            current_duration = int((datetime.utcnow() - session.start_time).total_seconds() / 60)
            session.duration_minutes = current_duration
            
            # Calculate current cost
            if not session.demo_mode:
                session.total_cost = current_duration * session.rate_per_minute
            
            await db.commit()
        
        return SessionResponse.from_orm(session)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get session", error=str(e), session_id=session_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve session"
        )


@router.put("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: str,
    action: str = Query(..., regex="^(pause|resume|end)$"),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> SessionResponse:
    """
    Update session status (pause, resume, or end)
    """
    try:
        result = await db.execute(
            select(Session).options(selectinload(Session.clone)).where(Session.id == session_id)
        )
        session = result.scalar_one_or_none()
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        # Check if user owns the session
        if str(session.user_id) != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the session owner can update the session"
            )
        
        # Update session based on action
        now = datetime.utcnow()
        
        if action == "pause":
            if session.status != "active":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Can only pause active sessions"
                )
            
            session.status = "paused"
            # Update duration and cost
            session.duration_minutes = int((now - session.start_time).total_seconds() / 60)
            if not session.demo_mode:
                session.total_cost = session.duration_minutes * session.rate_per_minute
            
        elif action == "resume":
            if session.status != "paused":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Can only resume paused sessions"
                )
            
            session.status = "active"
            # Reset start time to continue timing from now
            session.start_time = now
            
        elif action == "end":
            if session.status == "ended":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Session is already ended"
                )
            
            session.status = "ended"
            session.end_time = now
            
            # Final duration and cost calculation
            if session.status != "paused":  # If not paused, calculate from start_time
                session.duration_minutes = int((now - session.start_time).total_seconds() / 60)
            
            if not session.demo_mode:
                session.total_cost = session.duration_minutes * session.rate_per_minute
                
                # Deduct from user credits if applicable
                user_result = await db.execute(
                    select(UserProfile).where(UserProfile.id == current_user_id)
                )
                user = user_result.scalar_one_or_none()
                if user and user.subscription_tier == "free":
                    user.credits_remaining = max(0, user.credits_remaining - int(session.total_cost))
                    user.total_spent += session.total_cost
                
                # Update clone earnings
                if session.clone:
                    session.clone.total_earnings += session.total_cost
        
        session.updated_at = now
        await db.commit()
        await db.refresh(session)
        
        logger.info("Session updated successfully",
                   session_id=session_id,
                   action=action,
                   new_status=session.status)
        
        return SessionResponse.from_orm(session)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Session update failed", error=str(e), session_id=session_id)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update session"
        )


@router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, str]:
    """
    Delete a session (only ended sessions can be deleted)
    """
    try:
        result = await db.execute(
            select(Session).where(Session.id == session_id)
        )
        session = result.scalar_one_or_none()
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        if str(session.user_id) != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the session owner can delete the session"
            )
        
        if session.status != "ended":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can only delete ended sessions"
            )
        
        # Delete session (cascade will handle messages)
        await db.delete(session)
        await db.commit()
        
        logger.info("Session deleted successfully", session_id=session_id)
        
        return {"message": "Session deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Session deletion failed", error=str(e), session_id=session_id)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete session"
        )


@router.post("/{session_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    session_id: str,
    message_data: MessageCreate,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> MessageResponse:
    """
    Send a message in a chat session
    """
    try:
        # Get session and verify access
        result = await db.execute(
            select(Session).options(
                selectinload(Session.clone)
            ).where(Session.id == session_id)
        )
        session = result.scalar_one_or_none()
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        if str(session.user_id) != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        if session.status != "active":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot send messages to inactive sessions"
            )
        
        # Check message limits for free users
        if session.demo_mode or (session.user and session.user.subscription_tier == "free"):
            if session.message_count >= settings.FREE_MESSAGES_LIMIT:
                raise HTTPException(
                    status_code=status.HTTP_402_PAYMENT_REQUIRED,
                    detail=f"Free message limit ({settings.FREE_MESSAGES_LIMIT}) reached. Please upgrade to continue."
                )
        
        # Create user message
        user_message = Message(
            session_id=uuid.UUID(session_id),
            sender_type="user",
            content=message_data.content,
            attachments=message_data.attachments,
            cost_increment=0.0,  # User messages are free
            tokens_used=len(message_data.content.split())  # Rough token estimate
        )
        
        db.add(user_message)
        
        # Update session message count
        session.message_count += 1
        session.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(user_message)
        
        # Schedule AI response generation in background
        if session.clone:
            background_tasks.add_task(
                generate_ai_response,
                session_id,
                message_data.content,
                session.clone
            )
        
        logger.info("Message sent successfully",
                   session_id=session_id,
                   message_id=str(user_message.id),
                   user_id=current_user_id)
        
        return MessageResponse.from_orm(user_message)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to send message", error=str(e), session_id=session_id)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send message"
        )


@router.get("/{session_id}/messages", response_model=List[MessageResponse])
async def get_session_messages(
    session_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    order: str = Query("desc", regex="^(asc|desc)$"),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> List[MessageResponse]:
    """
    Get messages from a chat session
    """
    try:
        # Verify session access
        session_result = await db.execute(
            select(Session).where(Session.id == session_id)
        )
        session = session_result.scalar_one_or_none()
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        if str(session.user_id) != current_user_id:
            # Also allow clone creator to view messages
            clone_result = await db.execute(
                select(Clone).where(Clone.id == session.clone_id)
            )
            clone = clone_result.scalar_one_or_none()
            if not clone or str(clone.creator_id) != current_user_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied"
                )
        
        # Get messages
        query = select(Message).where(Message.session_id == session_id)
        
        if order == "desc":
            query = query.order_by(desc(Message.created_at))
        else:
            query = query.order_by(Message.created_at)
        
        # Apply pagination
        offset = (page - 1) * limit
        query = query.offset(offset).limit(limit)
        
        result = await db.execute(query)
        messages = result.scalars().all()
        
        # If desc order, reverse to show chronological order
        if order == "desc":
            messages = list(reversed(messages))
        
        return [MessageResponse.from_orm(message) for message in messages]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get messages", error=str(e), session_id=session_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve messages"
        )


@router.put("/{session_id}/rating")
async def rate_session(
    session_id: str,
    rating: int = Query(..., ge=1, le=5, description="Rating from 1 to 5 stars"),
    feedback: Optional[str] = Query(None, max_length=1000, description="Optional feedback"),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, str]:
    """
    Rate a completed session
    """
    try:
        result = await db.execute(
            select(Session).options(selectinload(Session.clone)).where(Session.id == session_id)
        )
        session = result.scalar_one_or_none()
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        if str(session.user_id) != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the session owner can rate the session"
            )
        
        if session.status != "ended":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can only rate completed sessions"
            )
        
        if session.user_rating is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Session has already been rated"
            )
        
        # Update session rating
        session.user_rating = rating
        session.user_feedback = feedback
        session.updated_at = datetime.utcnow()
        
        # Update clone's average rating
        if session.clone:
            clone = session.clone
            total_rating_points = (clone.average_rating * clone.total_ratings) + rating
            clone.total_ratings += 1
            clone.average_rating = total_rating_points / clone.total_ratings
        
        await db.commit()
        
        logger.info("Session rated successfully",
                   session_id=session_id,
                   rating=rating,
                   user_id=current_user_id)
        
        return {"message": "Session rated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Session rating failed", error=str(e), session_id=session_id)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to rate session"
        )


@router.get("/{session_id}/summary", response_model=SessionSummaryResponse)
async def get_session_summary(
    session_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> SessionSummaryResponse:
    """
    Get AI-generated summary of a completed session
    """
    try:
        # Verify session access
        session_result = await db.execute(
            select(Session).where(Session.id == session_id)
        )
        session = session_result.scalar_one_or_none()
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        if str(session.user_id) != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        if session.status != "ended":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can only summarize completed sessions"
            )
        
        # Check if summary already exists
        from app.models.database import SessionSummary
        summary_result = await db.execute(
            select(SessionSummary).where(SessionSummary.session_id == session_id)
        )
        existing_summary = summary_result.scalar_one_or_none()
        
        if existing_summary:
            return SessionSummaryResponse.from_orm(existing_summary)
        
        # Generate new summary (would use AI in production)
        # For now, create a basic summary
        summary = SessionSummary(
            session_id=uuid.UUID(session_id),
            summary_text=f"Session with {session.clone.name if session.clone else 'AI Expert'} lasted {session.duration_minutes} minutes with {session.message_count} messages exchanged.",
            key_insights=["Productive conversation", "Clear communication", "Goals discussed"],
            action_items=[{"task": "Follow up on discussed topics", "priority": "medium"}],
            recommendations=["Consider scheduling follow-up session"],
            next_session_topics=["Continue previous discussion"],
            summary_type="detailed",
            confidence_score=0.85
        )
        
        db.add(summary)
        await db.commit()
        await db.refresh(summary)
        
        return SessionSummaryResponse.from_orm(summary)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get session summary", error=str(e), session_id=session_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate session summary"
        )


# Background task for AI response generation
async def generate_ai_response(session_id: str, user_message: str, clone: Clone):
    """
    Generate AI response in background (would integrate with your AI system)
    """
    try:
        logger.info("Generating AI response", session_id=session_id)
        
        # Simulate AI processing time
        import asyncio
        await asyncio.sleep(2)
        
        # In production, this would:
        # 1. Use the clone's system prompt and configuration
        # 2. Retrieve relevant context from RAG system
        # 3. Generate response using OpenAI API
        # 4. Calculate token usage and costs
        # 5. Store the AI message in the database
        
        # For now, create a simple response
        ai_response_content = f"Thank you for your message. As {clone.name}, I understand you're asking about: {user_message[:100]}..."
        
        # This would be replaced with actual database insertion
        logger.info("AI response generated", session_id=session_id, response_length=len(ai_response_content))
        
    except Exception as e:
        logger.error("AI response generation failed", error=str(e), session_id=session_id)