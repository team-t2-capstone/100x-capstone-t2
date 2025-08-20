"""
WebSocket API for Real-time Chat
Handles WebSocket connections for live chat with AI clones
"""
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession

import structlog

from app.database import get_db_session
from app.core.supabase_auth import get_current_user_id_from_token, get_current_user_id
from app.services.chat_service import handle_websocket_connection, chat_service
from app.models.schemas import BaseSchema
from pydantic import BaseModel

# Request models
class CreateChatSessionRequest(BaseModel):
    clone_id: str
    title: str = None

logger = structlog.get_logger()

router = APIRouter(prefix="/chat", tags=["Real-time Chat"])


# WebSocket endpoint for real-time chat
@router.websocket("/ws/{session_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    session_id: str,
    token: Optional[str] = None
):
    """
    WebSocket endpoint for real-time chat
    
    Parameters:
    - session_id: Chat session ID
    - token: Authentication token (passed as query parameter)
    """
    try:
        # Authenticate user from token
        if not token:
            await websocket.close(code=1008, reason="Authentication token required")
            return
        
        try:
            user_id = await get_current_user_id_from_token(token)
        except Exception as e:
            logger.error("WebSocket authentication failed", error=str(e))
            await websocket.close(code=1008, reason="Authentication failed")
            return
        
        logger.info("WebSocket connection attempt", 
                   user_id=user_id, 
                   session_id=session_id)
        
        # Handle WebSocket connection
        await handle_websocket_connection(websocket, user_id, session_id)
        
    except Exception as e:
        logger.error("WebSocket endpoint error", 
                    session_id=session_id,
                    error=str(e))


# REST API endpoints for chat sessions
@router.post("/sessions")
async def create_chat_session(
    request: CreateChatSessionRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
):
    """Create a new chat session with a clone"""
    try:
        session = await chat_service.create_chat_session(
            user_id=current_user_id,
            clone_id=request.clone_id,
            title=request.title,
            db=db
        )
        
        return {
            "id": str(session.id),
            "clone_id": str(session.clone_id),
            "title": session.title,
            "created_at": session.created_at.isoformat(),
            "message_count": session.message_count,
            "is_active": session.is_active,
            "updated_at": session.updated_at.isoformat()
        }
        
    except Exception as e:
        logger.error("Failed to create chat session", 
                    clone_id=request.clone_id,
                    user_id=current_user_id,
                    error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create chat session"
        )


@router.get("/sessions/{session_id}/history")
async def get_chat_history(
    session_id: str,
    limit: int = 50,
    offset: int = 0,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
):
    """Get chat history for a session"""
    try:
        # Verify user owns this session
        async with db.begin():
            from app.models.database import ChatSession
            from sqlalchemy import select
            
            query = select(ChatSession).where(
                ChatSession.id == session_id,
                ChatSession.user_id == current_user_id
            )
            result = await db.execute(query)
            session = result.scalar_one_or_none()
            
            if not session:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Chat session not found"
                )
        
        # Get message history
        messages = await chat_service.get_chat_history(
            session_id=session_id,
            limit=limit,
            offset=offset,
            db=db
        )
        
        # Format response
        formatted_messages = []
        for message in messages:
            formatted_messages.append({
                "id": str(message.id),
                "sender_type": message.sender_type,
                "content": message.content,
                "message_type": message.message_type,
                "metadata": message.metadata,
                "created_at": message.created_at.isoformat(),
                "is_edited": message.is_edited
            })
        
        return {
            "session_id": session_id,
            "messages": formatted_messages,
            "total_messages": len(formatted_messages),
            "has_more": len(formatted_messages) == limit
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get chat history", 
                    session_id=session_id,
                    user_id=current_user_id,
                    error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve chat history"
        )


@router.get("/sessions")
async def get_user_chat_sessions(
    limit: int = 20,
    offset: int = 0,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
):
    """Get user's chat sessions"""
    try:
        from app.models.database import ChatSession, Clone
        from sqlalchemy import select, desc
        from sqlalchemy.orm import selectinload
        
        query = (
            select(ChatSession)
            .options(selectinload(ChatSession.clone))
            .where(ChatSession.user_id == current_user_id)
            .order_by(desc(ChatSession.updated_at))
            .offset(offset)
            .limit(limit)
        )
        
        result = await db.execute(query)
        sessions = result.scalars().all()
        
        # Format response
        formatted_sessions = []
        for session in sessions:
            formatted_sessions.append({
                "id": str(session.id),
                "clone_id": str(session.clone_id),
                "clone_name": session.clone.name if session.clone else "Unknown Clone",
                "title": session.title,
                "message_count": session.message_count,
                "is_active": session.is_active,
                "created_at": session.created_at.isoformat(),
                "updated_at": session.updated_at.isoformat()
            })
        
        return {
            "sessions": formatted_sessions,
            "total_sessions": len(formatted_sessions),
            "has_more": len(formatted_sessions) == limit
        }
        
    except Exception as e:
        logger.error("Failed to get user chat sessions", 
                    user_id=current_user_id,
                    error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve chat sessions"
        )


@router.delete("/sessions/{session_id}")
async def delete_chat_session(
    session_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
):
    """Delete a chat session"""
    try:
        from app.models.database import ChatSession
        from sqlalchemy import select, delete
        
        # Verify user owns this session
        query = select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user_id
        )
        result = await db.execute(query)
        session = result.scalar_one_or_none()
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Chat session not found"
            )
        
        # Delete session (messages will be cascade deleted)
        await db.delete(session)
        await db.commit()
        
        return {"message": "Chat session deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to delete chat session", 
                    session_id=session_id,
                    user_id=current_user_id,
                    error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete chat session"
        )


# Test page for WebSocket connection (development only)
@router.get("/test")
async def get_chat_test_page():
    """Test page for WebSocket chat (development only)"""
    return HTMLResponse("""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Chat WebSocket Test</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            #messages { border: 1px solid #ccc; height: 400px; overflow-y: scroll; padding: 10px; margin: 10px 0; }
            #messageInput { width: 70%; padding: 10px; }
            #sendButton { width: 25%; padding: 10px; }
            .message { margin: 5px 0; padding: 5px; }
            .user { background: #e3f2fd; }
            .assistant { background: #f3e5f5; }
            .system { background: #fff3e0; color: #666; font-style: italic; }
        </style>
    </head>
    <body>
        <h1>Chat WebSocket Test</h1>
        <div>
            <input type="text" id="tokenInput" placeholder="Auth token" style="width: 48%; margin-right: 2%;" />
            <input type="text" id="sessionInput" placeholder="Session ID" style="width: 48%;" />
        </div>
        <br>
        <input type="text" id="cloneInput" placeholder="Clone ID" style="width: 98%;" />
        <br><br>
        <button id="connectButton">Connect</button>
        <button id="disconnectButton">Disconnect</button>
        <div id="messages"></div>
        <input type="text" id="messageInput" placeholder="Type a message..." />
        <button id="sendButton">Send</button>

        <script>
            let ws = null;
            const messages = document.getElementById('messages');
            const messageInput = document.getElementById('messageInput');
            const tokenInput = document.getElementById('tokenInput');
            const sessionInput = document.getElementById('sessionInput');
            const cloneInput = document.getElementById('cloneInput');

            function addMessage(content, type = 'system') {
                const div = document.createElement('div');
                div.className = `message ${type}`;
                div.textContent = `[${new Date().toLocaleTimeString()}] ${content}`;
                messages.appendChild(div);
                messages.scrollTop = messages.scrollHeight;
            }

            document.getElementById('connectButton').onclick = () => {
                const token = tokenInput.value;
                const sessionId = sessionInput.value;
                if (!token || !sessionId) {
                    alert('Please provide auth token and session ID');
                    return;
                }
                
                ws = new WebSocket(`ws://localhost:8000/api/v1/chat/ws/${sessionId}?token=${token}`);
                
                ws.onopen = () => {
                    addMessage('Connected to chat WebSocket', 'system');
                };
                
                ws.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    if (data.type === 'message_chunk' && !data.is_complete) {
                        // Handle streaming content
                        let lastMsg = messages.lastElementChild;
                        if (lastMsg && lastMsg.classList.contains('assistant') && lastMsg.dataset.streaming) {
                            lastMsg.textContent += data.content;
                        } else {
                            const div = document.createElement('div');
                            div.className = 'message assistant';
                            div.dataset.streaming = 'true';
                            div.textContent = data.content;
                            messages.appendChild(div);
                        }
                    } else if (data.type === 'message_complete') {
                        let lastMsg = messages.lastElementChild;
                        if (lastMsg && lastMsg.dataset.streaming) {
                            delete lastMsg.dataset.streaming;
                            if (data.sources && data.sources.length > 0) {
                                lastMsg.textContent += ` [Sources: ${data.sources.join(', ')}]`;
                            }
                        }
                    } else if (data.type === 'typing_indicator') {
                        addMessage(`AI is ${data.is_typing ? 'typing...' : 'done typing'}`, 'system');
                    } else if (data.type === 'error') {
                        addMessage(`Error: ${data.content}`, 'system');
                    }
                    messages.scrollTop = messages.scrollHeight;
                };
                
                ws.onclose = () => {
                    addMessage('Disconnected from chat WebSocket', 'system');
                };
                
                ws.onerror = (error) => {
                    addMessage(`WebSocket error: ${error}`, 'system');
                };
            };

            document.getElementById('disconnectButton').onclick = () => {
                if (ws) {
                    ws.close();
                }
            };

            document.getElementById('sendButton').onclick = () => {
                const message = messageInput.value.trim();
                const cloneId = cloneInput.value;
                if (message && ws && ws.readyState === WebSocket.OPEN) {
                    addMessage(message, 'user');
                    ws.send(JSON.stringify({
                        type: 'chat',
                        content: message,
                        clone_id: cloneId
                    }));
                    messageInput.value = '';
                }
            };

            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    document.getElementById('sendButton').click();
                }
            });
        </script>
    </body>
    </html>
    """)