from app.core.supabase_auth import get_current_user_id, require_role

"""
Real-time Chat APIs for CloneAI - WebSocket and live messaging functionality
"""
import json
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any, Set
from collections import defaultdict

from fastapi import (
    APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, 
    status, Query, BackgroundTasks
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc
from sqlalchemy.orm import selectinload
import structlog

from app.core.security import get_current_user_id, verify_websocket_token
from app.database import get_db_session
from app.models.database import Session, Message, Clone, UserProfile
from app.models.schemas import MessageCreate, MessageResponse
from app.config import settings

logger = structlog.get_logger()
router = APIRouter(prefix="/chat", tags=["Real-time Chat"])


class ConnectionManager:
    """Manages WebSocket connections for real-time chat"""
    
    def __init__(self):
        # session_id -> set of WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = defaultdict(set)
        # websocket -> user_id mapping
        self.connection_users: Dict[WebSocket, str] = {}
        # user_id -> set of session_ids they're connected to
        self.user_sessions: Dict[str, Set[str]] = defaultdict(set)
        
    async def connect(self, websocket: WebSocket, session_id: str, user_id: str):
        """Accept WebSocket connection and add to session room"""
        await websocket.accept()
        self.active_connections[session_id].add(websocket)
        self.connection_users[websocket] = user_id
        self.user_sessions[user_id].add(session_id)
        
        logger.info("WebSocket connected", 
                   session_id=session_id, 
                   user_id=user_id,
                   total_connections=len(self.active_connections[session_id]))
    
    def disconnect(self, websocket: WebSocket, session_id: str):
        """Remove WebSocket connection"""
        if websocket in self.active_connections[session_id]:
            self.active_connections[session_id].remove(websocket)
            
        user_id = self.connection_users.pop(websocket, None)
        if user_id and session_id in self.user_sessions[user_id]:
            self.user_sessions[user_id].remove(session_id)
            
        # Clean up empty sets
        if not self.active_connections[session_id]:
            del self.active_connections[session_id]
        if user_id and not self.user_sessions[user_id]:
            del self.user_sessions[user_id]
            
        logger.info("WebSocket disconnected", 
                   session_id=session_id, 
                   user_id=user_id,
                   remaining_connections=len(self.active_connections.get(session_id, [])))
    
    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """Send message to specific WebSocket connection"""
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error("Failed to send personal message", error=str(e))
    
    async def broadcast_to_session(self, message: dict, session_id: str, exclude_websocket: Optional[WebSocket] = None):
        """Broadcast message to all connections in a session"""
        if session_id not in self.active_connections:
            return
            
        disconnected = []
        for websocket in self.active_connections[session_id].copy():
            if exclude_websocket and websocket == exclude_websocket:
                continue
                
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error("Failed to broadcast message", error=str(e))
                disconnected.append(websocket)
        
        # Clean up disconnected websockets
        for websocket in disconnected:
            self.disconnect(websocket, session_id)
    
    def get_session_connection_count(self, session_id: str) -> int:
        """Get number of active connections for a session"""
        return len(self.active_connections.get(session_id, []))
    
    def is_user_connected(self, user_id: str, session_id: str) -> bool:
        """Check if user is connected to a specific session"""
        return session_id in self.user_sessions.get(user_id, set())


# Global connection manager instance
manager = ConnectionManager()


@router.websocket("/ws/{session_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    session_id: str,
    token: str = Query(..., description="JWT authentication token"),
    db: AsyncSession = Depends(get_db_session)
):
    """
    WebSocket endpoint for real-time chat in a session
    """
    try:
        # Verify authentication token
        user_id = await verify_websocket_token(token)
        if not user_id:
            await websocket.close(code=4001, reason="Invalid authentication token")
            return
        
        # Verify session exists and user has access
        result = await db.execute(
            select(Session).options(
                selectinload(Session.clone)
            ).where(Session.id == session_id)
        )
        session = result.scalar_one_or_none()
        
        if not session:
            await websocket.close(code=4004, reason="Session not found")
            return
        
        # Check if user has access to this session
        if str(session.user_id) != user_id:
            # Also allow clone creator to join
            if not session.clone or str(session.clone.creator_id) != user_id:
                await websocket.close(code=4003, reason="Access denied")
                return
        
        # Check if session is active
        if session.status != "active":
            await websocket.close(code=4005, reason="Session is not active")
            return
        
        # Connect to session
        await manager.connect(websocket, session_id, user_id)
        
        # Send connection confirmation
        await manager.send_personal_message({
            "type": "connection_confirmed",
            "session_id": session_id,
            "timestamp": datetime.utcnow().isoformat(),
            "session_info": {
                "clone_name": session.clone.name if session.clone else "AI Assistant",
                "session_type": session.session_type,
                "demo_mode": session.demo_mode
            }
        }, websocket)
        
        # Notify other participants about new connection
        await manager.broadcast_to_session({
            "type": "user_joined",
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat(),
            "connection_count": manager.get_session_connection_count(session_id)
        }, session_id, exclude_websocket=websocket)
        
        # Listen for messages
        while True:
            try:
                data = await websocket.receive_text()
                message_data = json.loads(data)
                
                await handle_websocket_message(
                    websocket, session_id, user_id, message_data, db
                )
                
            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                await manager.send_personal_message({
                    "type": "error",
                    "message": "Invalid JSON format",
                    "timestamp": datetime.utcnow().isoformat()
                }, websocket)
            except Exception as e:
                logger.error("WebSocket message handling error", 
                           error=str(e), session_id=session_id, user_id=user_id)
                await manager.send_personal_message({
                    "type": "error", 
                    "message": "Message processing failed",
                    "timestamp": datetime.utcnow().isoformat()
                }, websocket)
    
    except Exception as e:
        logger.error("WebSocket connection error", error=str(e), session_id=session_id)
        await websocket.close(code=4000, reason="Connection error")
    
    finally:
        # Clean up connection
        manager.disconnect(websocket, session_id)
        
        # Notify other participants about disconnection
        await manager.broadcast_to_session({
            "type": "user_left",
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat(),
            "connection_count": manager.get_session_connection_count(session_id)
        }, session_id)


async def handle_websocket_message(
    websocket: WebSocket, 
    session_id: str, 
    user_id: str, 
    message_data: dict,
    db: AsyncSession
):
    """Handle different types of WebSocket messages"""
    
    message_type = message_data.get("type")
    
    if message_type == "chat_message":
        await handle_chat_message(websocket, session_id, user_id, message_data, db)
    
    elif message_type == "typing_start":
        await handle_typing_indicator(session_id, user_id, True, websocket)
    
    elif message_type == "typing_stop":
        await handle_typing_indicator(session_id, user_id, False, websocket)
    
    elif message_type == "ping":
        await manager.send_personal_message({
            "type": "pong",
            "timestamp": datetime.utcnow().isoformat()
        }, websocket)
    
    elif message_type == "request_history":
        await handle_history_request(websocket, session_id, user_id, message_data, db)
    
    else:
        await manager.send_personal_message({
            "type": "error",
            "message": f"Unknown message type: {message_type}",
            "timestamp": datetime.utcnow().isoformat()
        }, websocket)


async def handle_chat_message(
    websocket: WebSocket,
    session_id: str, 
    user_id: str, 
    message_data: dict,
    db: AsyncSession
):
    """Handle incoming chat messages"""
    try:
        content = message_data.get("content", "").strip()
        if not content:
            await manager.send_personal_message({
                "type": "error",
                "message": "Message content cannot be empty",
                "timestamp": datetime.utcnow().isoformat()
            }, websocket)
            return
        
        # Get session to verify it's still active
        result = await db.execute(
            select(Session).options(
                selectinload(Session.clone),
                selectinload(Session.user)
            ).where(Session.id == session_id)
        )
        session = result.scalar_one_or_none()
        
        if not session or session.status != "active":
            await manager.send_personal_message({
                "type": "error",
                "message": "Session is no longer active",
                "timestamp": datetime.utcnow().isoformat()
            }, websocket)
            return
        
        # Check message limits for free users
        if session.demo_mode or (session.user and session.user.subscription_tier == "free"):
            if session.message_count >= settings.FREE_MESSAGES_LIMIT:
                await manager.send_personal_message({
                    "type": "error",
                    "message": f"Free message limit ({settings.FREE_MESSAGES_LIMIT}) reached. Please upgrade to continue.",
                    "timestamp": datetime.utcnow().isoformat()
                }, websocket)
                return
        
        # Create and save message
        user_message = Message(
            session_id=uuid.UUID(session_id),
            sender_type="user",
            content=content,
            attachments=message_data.get("attachments", []),
            cost_increment=0.0,
            tokens_used=len(content.split())  # Rough estimate
        )
        
        db.add(user_message)
        
        # Update session message count
        session.message_count += 1
        session.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(user_message)
        
        # Broadcast message to all session participants
        broadcast_message = {
            "type": "new_message",
            "message": {
                "id": str(user_message.id),
                "content": content,
                "sender_type": "user",
                "sender_id": user_id,
                "attachments": message_data.get("attachments", []),
                "timestamp": user_message.created_at.isoformat(),
                "tokens_used": user_message.tokens_used
            },
            "session_info": {
                "message_count": session.message_count,
                "total_cost": float(session.total_cost)
            }
        }
        
        await manager.broadcast_to_session(broadcast_message, session_id)
        
        # Trigger AI response generation (if clone exists)
        if session.clone:
            await generate_ai_response_realtime(session_id, content, session.clone, db)
        
        logger.info("Real-time message sent", 
                   session_id=session_id, 
                   user_id=user_id,
                   message_id=str(user_message.id))
    
    except Exception as e:
        logger.error("Failed to handle chat message", 
                   error=str(e), session_id=session_id, user_id=user_id)
        await manager.send_personal_message({
            "type": "error",
            "message": "Failed to send message",
            "timestamp": datetime.utcnow().isoformat()
        }, websocket)


async def handle_typing_indicator(
    session_id: str,
    user_id: str, 
    is_typing: bool,
    sender_websocket: WebSocket
):
    """Handle typing indicators"""
    await manager.broadcast_to_session({
        "type": "typing_indicator",
        "user_id": user_id,
        "is_typing": is_typing,
        "timestamp": datetime.utcnow().isoformat()
    }, session_id, exclude_websocket=sender_websocket)


async def handle_history_request(
    websocket: WebSocket,
    session_id: str,
    user_id: str,
    message_data: dict,
    db: AsyncSession
):
    """Handle request for message history"""
    try:
        limit = min(message_data.get("limit", 50), 100)  # Max 100 messages
        offset = max(message_data.get("offset", 0), 0)
        
        # Get messages
        messages_result = await db.execute(
            select(Message).where(
                Message.session_id == session_id
            ).order_by(desc(Message.created_at)).offset(offset).limit(limit)
        )
        messages = messages_result.scalars().all()
        
        # Format messages (reverse to get chronological order)
        formatted_messages = []
        for message in reversed(messages):
            formatted_messages.append({
                "id": str(message.id),
                "content": message.content,
                "sender_type": message.sender_type,
                "attachments": message.attachments or [],
                "timestamp": message.created_at.isoformat(),
                "tokens_used": message.tokens_used,
                "cost_increment": float(message.cost_increment)
            })
        
        await manager.send_personal_message({
            "type": "message_history",
            "messages": formatted_messages,
            "pagination": {
                "offset": offset,
                "limit": limit,
                "count": len(formatted_messages)
            },
            "timestamp": datetime.utcnow().isoformat()
        }, websocket)
        
    except Exception as e:
        logger.error("Failed to handle history request", 
                   error=str(e), session_id=session_id, user_id=user_id)
        await manager.send_personal_message({
            "type": "error",
            "message": "Failed to retrieve message history",
            "timestamp": datetime.utcnow().isoformat()
        }, websocket)


async def generate_ai_response_realtime(
    session_id: str,
    user_message: str,
    clone: Clone,
    db: AsyncSession
):
    """Generate AI response and broadcast to session participants"""
    try:
        # Simulate AI processing (in production, integrate with your AI system)
        import asyncio
        
        # Send typing indicator for AI
        await manager.broadcast_to_session({
            "type": "ai_typing",
            "clone_id": str(clone.id),
            "clone_name": clone.name,
            "is_typing": True,
            "timestamp": datetime.utcnow().isoformat()
        }, session_id)
        
        # Simulate processing time
        await asyncio.sleep(2)
        
        # Generate response (placeholder - integrate with your AI system)
        ai_response_content = f"Thank you for your message. As {clone.name}, I understand you're asking about: {user_message[:100]}..."
        
        # Create AI message in database
        ai_message = Message(
            session_id=uuid.UUID(session_id),
            sender_type="ai",
            content=ai_response_content,
            cost_increment=0.02,  # Example cost
            tokens_used=len(ai_response_content.split())
        )
        
        db.add(ai_message)
        
        # Update session stats
        session_result = await db.execute(
            select(Session).where(Session.id == session_id)
        )
        session = session_result.scalar_one_or_none()
        
        if session:
            session.message_count += 1
            session.total_cost += ai_message.cost_increment
            session.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(ai_message)
        
        # Stop typing indicator
        await manager.broadcast_to_session({
            "type": "ai_typing",
            "clone_id": str(clone.id),
            "clone_name": clone.name,
            "is_typing": False,
            "timestamp": datetime.utcnow().isoformat()
        }, session_id)
        
        # Broadcast AI response
        await manager.broadcast_to_session({
            "type": "new_message",
            "message": {
                "id": str(ai_message.id),
                "content": ai_response_content,
                "sender_type": "ai",
                "sender_id": str(clone.id),
                "sender_name": clone.name,
                "timestamp": ai_message.created_at.isoformat(),
                "tokens_used": ai_message.tokens_used,
                "cost_increment": float(ai_message.cost_increment)
            },
            "session_info": {
                "message_count": session.message_count if session else 0,
                "total_cost": float(session.total_cost if session else 0)
            }
        }, session_id)
        
        logger.info("AI response generated and broadcast", 
                   session_id=session_id, 
                   clone_id=str(clone.id),
                   response_length=len(ai_response_content))
        
    except Exception as e:
        logger.error("AI response generation failed", 
                   error=str(e), session_id=session_id, clone_id=str(clone.id))
        
        # Send error notification
        await manager.broadcast_to_session({
            "type": "ai_error",
            "message": "AI response generation failed",
            "timestamp": datetime.utcnow().isoformat()
        }, session_id)


@router.get("/sessions/{session_id}/status")
async def get_realtime_session_status(
    session_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """
    Get real-time status of a chat session
    """
    try:
        # Verify session access
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
        
        # Check access permissions
        if str(session.user_id) != current_user_id:
            if not session.clone or str(session.clone.creator_id) != current_user_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied"
                )
        
        # Get connection status
        connection_count = manager.get_session_connection_count(session_id)
        is_user_connected = manager.is_user_connected(current_user_id, session_id)
        
        return {
            "session_id": session_id,
            "status": session.status,
            "connection_count": connection_count,
            "is_user_connected": is_user_connected,
            "last_activity": session.updated_at,
            "message_count": session.message_count,
            "total_cost": float(session.total_cost),
            "clone_info": {
                "id": str(session.clone.id),
                "name": session.clone.name,
                "avatar_url": session.clone.avatar_url
            } if session.clone else None,
            "websocket_url": f"/chat/ws/{session_id}",
            "timestamp": datetime.utcnow()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get session status", error=str(e), session_id=session_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve session status"
        )


@router.get("/active-sessions")
async def get_active_chat_sessions(
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """
    Get all active chat sessions for the current user
    """
    try:
        # Get user's active sessions
        result = await db.execute(
            select(Session).options(
                selectinload(Session.clone)
            ).where(
                and_(
                    Session.user_id == current_user_id,
                    Session.status == "active"
                )
            ).order_by(desc(Session.updated_at))
        )
        sessions = result.scalars().all()
        
        # Add real-time connection info
        active_sessions = []
        for session in sessions:
            connection_count = manager.get_session_connection_count(str(session.id))
            is_connected = manager.is_user_connected(current_user_id, str(session.id))
            
            active_sessions.append({
                "id": str(session.id),
                "clone_name": session.clone.name if session.clone else "AI Assistant",
                "clone_avatar": session.clone.avatar_url if session.clone else None,
                "session_type": session.session_type,
                "demo_mode": session.demo_mode,
                "created_at": session.created_at,
                "last_activity": session.updated_at,
                "message_count": session.message_count,
                "total_cost": float(session.total_cost),
                "connection_count": connection_count,
                "is_connected": is_connected,
                "websocket_url": f"/chat/ws/{session.id}"
            })
        
        return {
            "active_sessions": active_sessions,
            "count": len(active_sessions),
            "total_connections": sum(
                manager.get_session_connection_count(str(s.id)) for s in sessions
            )
        }
        
    except Exception as e:
        logger.error("Failed to get active sessions", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve active sessions"
        )


@router.post("/sessions/{session_id}/broadcast")
async def broadcast_message_to_session(
    session_id: str,
    message: Dict[str, Any],
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, str]:
    """
    Broadcast a system message to all participants in a session (admin/creator only)
    """
    try:
        # Verify session exists and user has admin access
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
        
        # Check if user is clone creator (admin access)
        if not session.clone or str(session.clone.creator_id) != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only clone creators can broadcast messages"
            )
        
        # Broadcast system message
        broadcast_data = {
            "type": "system_broadcast",
            "message": message.get("content", ""),
            "from": "system",
            "priority": message.get("priority", "normal"),
            "timestamp": datetime.utcnow().isoformat()
        }
        
        await manager.broadcast_to_session(broadcast_data, session_id)
        
        logger.info("System message broadcast", 
                   session_id=session_id, 
                   user_id=current_user_id)
        
        return {"message": "Broadcast sent successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to broadcast message", error=str(e), session_id=session_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to broadcast message"
        )