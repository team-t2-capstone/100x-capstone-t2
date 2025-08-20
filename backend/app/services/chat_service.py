"""
Real-time Chat Service with RAG Integration
Handles WebSocket connections, message streaming, and knowledge-enhanced responses
"""
import asyncio
import json
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any, AsyncGenerator
from uuid import UUID

from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

import structlog

from app.models.database import ChatSession, ChatMessage, Clone, UserProfile
from app.services.openai_service import openai_service
from app.database import get_db_session

logger = structlog.get_logger()

class ConnectionManager:
    """Manages WebSocket connections for real-time chat"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_sessions: Dict[str, List[str]] = {}  # user_id -> [session_ids]
    
    async def connect(self, websocket: WebSocket, user_id: str, session_id: str):
        """Accept WebSocket connection and register user session"""
        await websocket.accept()
        connection_id = f"{user_id}:{session_id}"
        self.active_connections[connection_id] = websocket
        
        # Track user sessions
        if user_id not in self.user_sessions:
            self.user_sessions[user_id] = []
        if session_id not in self.user_sessions[user_id]:
            self.user_sessions[user_id].append(session_id)
        
        logger.info("WebSocket connected", 
                   user_id=user_id, 
                   session_id=session_id,
                   total_connections=len(self.active_connections))
    
    def disconnect(self, user_id: str, session_id: str):
        """Remove WebSocket connection"""
        connection_id = f"{user_id}:{session_id}"
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
        
        # Clean up user sessions
        if user_id in self.user_sessions and session_id in self.user_sessions[user_id]:
            self.user_sessions[user_id].remove(session_id)
            if not self.user_sessions[user_id]:
                del self.user_sessions[user_id]
        
        logger.info("WebSocket disconnected", 
                   user_id=user_id, 
                   session_id=session_id,
                   total_connections=len(self.active_connections))
    
    async def send_personal_message(self, user_id: str, session_id: str, message: dict):
        """Send message to specific user session"""
        connection_id = f"{user_id}:{session_id}"
        if connection_id in self.active_connections:
            try:
                await self.active_connections[connection_id].send_text(json.dumps(message))
            except Exception as e:
                logger.error("Failed to send personal message", 
                           user_id=user_id, 
                           session_id=session_id, 
                           error=str(e))
                # Remove dead connection
                self.disconnect(user_id, session_id)
    
    async def send_typing_indicator(self, user_id: str, session_id: str, is_typing: bool):
        """Send typing indicator to user"""
        message = {
            "type": "typing_indicator",
            "is_typing": is_typing,
            "timestamp": datetime.utcnow().isoformat()
        }
        await self.send_personal_message(user_id, session_id, message)

# Global connection manager
connection_manager = ConnectionManager()

class ChatService:
    """Handles chat operations with RAG integration"""
    
    def __init__(self):
        self.connection_manager = connection_manager
    
    async def create_chat_session(
        self, 
        user_id: str, 
        clone_id: str, 
        title: Optional[str] = None,
        db: AsyncSession = None
    ) -> ChatSession:
        """Create a new chat session"""
        if not db:
            db = await get_db_session()
        
        try:
            # Create new chat session
            session = ChatSession(
                id=uuid.uuid4(),
                user_id=UUID(user_id),
                clone_id=UUID(clone_id),
                title=title or f"Chat with Clone - {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
                message_count=0,
                is_active=True
            )
            
            db.add(session)
            await db.commit()
            await db.refresh(session)
            
            logger.info("Chat session created", 
                       session_id=str(session.id),
                       user_id=user_id,
                       clone_id=clone_id)
            
            return session
            
        except Exception as e:
            logger.error("Failed to create chat session", 
                        error=str(e),
                        user_id=user_id,
                        clone_id=clone_id)
            await db.rollback()
            raise
    
    async def get_chat_history(
        self, 
        session_id: str, 
        limit: int = 50,
        offset: int = 0,
        db: AsyncSession = None
    ) -> List[ChatMessage]:
        """Get chat history for a session"""
        if not db:
            db = await get_db_session()
        
        try:
            query = (
                select(ChatMessage)
                .where(ChatMessage.session_id == UUID(session_id))
                .order_by(desc(ChatMessage.created_at))
                .offset(offset)
                .limit(limit)
            )
            
            result = await db.execute(query)
            messages = result.scalars().all()
            
            # Return in chronological order
            return list(reversed(messages))
            
        except Exception as e:
            logger.error("Failed to get chat history", 
                        session_id=session_id,
                        error=str(e))
            return []
    
    async def save_message(
        self, 
        session_id: str,
        sender_type: str,  # 'user' or 'assistant'
        content: str,
        message_type: str = 'text',
        metadata: Optional[Dict[str, Any]] = None,
        db: AsyncSession = None
    ) -> ChatMessage:
        """Save message to database"""
        if not db:
            db = await get_db_session()
        
        try:
            message = ChatMessage(
                id=uuid.uuid4(),
                session_id=UUID(session_id),
                sender_type=sender_type,
                content=content,
                message_type=message_type,
                metadata=metadata or {},
                created_at=datetime.utcnow(),
                is_edited=False
            )
            
            db.add(message)
            
            # Update session message count and timestamp
            await db.execute(
                f"""
                UPDATE chat_sessions 
                SET message_count = message_count + 1,
                    updated_at = '{datetime.utcnow()}'
                WHERE id = '{session_id}'
                """
            )
            
            await db.commit()
            await db.refresh(message)
            
            return message
            
        except Exception as e:
            logger.error("Failed to save message", 
                        session_id=session_id,
                        sender_type=sender_type,
                        error=str(e))
            await db.rollback()
            raise
    
    async def generate_rag_response(
        self,
        user_message: str,
        clone_id: str,
        session_id: str,
        conversation_history: List[ChatMessage] = None,
        db: AsyncSession = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Generate AI response with RAG context"""
        try:
            logger.info("Generating RAG response", 
                       clone_id=clone_id,
                       session_id=session_id,
                       message_length=len(user_message))
            
            # Step 1: Search knowledge base for relevant context - RAG functionality removed
            knowledge_context = []
            
            # Step 2: Build conversation context
            conversation_context = []
            if conversation_history:
                # Include last 10 messages for context
                recent_messages = conversation_history[-10:] if len(conversation_history) > 10 else conversation_history
                for msg in recent_messages:
                    role = "user" if msg.sender_type == "user" else "assistant"
                    conversation_context.append({
                        "role": role,
                        "content": msg.content
                    })
            
            # Step 3: Build system prompt with RAG context
            system_prompt = self._build_rag_system_prompt(knowledge_context, clone_id)
            
            # Step 4: Prepare messages for OpenAI
            messages = [{"role": "system", "content": system_prompt}]
            messages.extend(conversation_context)
            messages.append({"role": "user", "content": user_message})
            
            # Step 5: Stream response from OpenAI
            response_chunks = []
            async for chunk in openai_service.create_chat_completion(
                messages=messages,
                model="gpt-4o-mini",
                temperature=0.7,
                max_tokens=1000,
                stream=True,
                user_id=clone_id
            ):
                # Extract content from streaming chunk
                if chunk.get('choices') and len(chunk['choices']) > 0:
                    delta = chunk['choices'][0].get('delta', {})
                    content = delta.get('content', '')
                    finish_reason = chunk['choices'][0].get('finish_reason')
                    
                    if content:
                        response_chunks.append(content)
                        yield {
                            "type": "message_chunk",
                            "content": content,
                            "is_complete": False,
                            "knowledge_used": len(knowledge_context) > 0,
                            "sources": [ctx['source'] for ctx in knowledge_context] if knowledge_context else []
                        }
                    
                    if finish_reason == "stop":
                        # Send completion signal with full response
                        full_response = "".join(response_chunks)
                        yield {
                            "type": "message_complete",
                            "content": full_response,
                            "is_complete": True,
                            "knowledge_used": len(knowledge_context) > 0,
                            "sources": [ctx['source'] for ctx in knowledge_context] if knowledge_context else [],
                            "metadata": {
                                "knowledge_chunks_used": len(knowledge_context),
                                "response_length": len(full_response),
                                "model_used": "gpt-4o-mini"
                            }
                        }
                        
                        # Save assistant response to database
                        await self.save_message(
                            session_id=session_id,
                            sender_type="assistant",
                            content=full_response,
                            metadata={
                                "knowledge_context": knowledge_context,
                                "model_used": "gpt-4o-mini",
                                "response_time": datetime.utcnow().isoformat()
                            },
                            db=db
                        )
                        break
            
        except Exception as e:
            logger.error("RAG response generation failed", 
                        error=str(e),
                        clone_id=clone_id,
                        session_id=session_id)
            yield {
                "type": "error",
                "content": "I'm having trouble generating a response right now. Please try again.",
                "error": str(e),
                "is_complete": True
            }
    
    def _build_rag_system_prompt(self, knowledge_context: List[Dict], clone_id: str) -> str:
        """Build system prompt with RAG context"""
        base_prompt = f"""You are an AI assistant helping a user by answering questions based on their uploaded documents and general knowledge. 

Your clone ID is {clone_id}. Be helpful, accurate, and engaging in your responses."""
        
        if knowledge_context:
            context_text = "\n\n".join([
                f"Source: {ctx['source']}\nContent: {ctx['content']}\n---"
                for ctx in knowledge_context
            ])
            
            rag_prompt = f"""

RELEVANT CONTEXT FROM USER'S DOCUMENTS:
{context_text}

Instructions:
1. Use the context from the user's documents when relevant to their question
2. If the context doesn't contain relevant information, answer based on your general knowledge
3. When using information from the documents, mention the source briefly
4. Be conversational and helpful
5. If you're unsure about something from the documents, say so

Remember to prioritize information from the user's documents when it's relevant to their question."""
            
            return base_prompt + rag_prompt
        
        return base_prompt + "\n\nAnswer the user's questions helpfully and conversationally."
    
    async def handle_websocket_message(
        self, 
        websocket: WebSocket,
        user_id: str,
        session_id: str,
        message_data: dict,
        db: AsyncSession
    ):
        """Handle incoming WebSocket message"""
        try:
            message_type = message_data.get('type', 'chat')
            
            if message_type == 'chat':
                # Handle chat message
                user_message = message_data.get('content', '')
                clone_id = message_data.get('clone_id', '')
                
                if not user_message.strip():
                    return
                
                # Save user message
                await self.save_message(
                    session_id=session_id,
                    sender_type="user",
                    content=user_message,
                    db=db
                )
                
                # Send typing indicator
                await self.connection_manager.send_typing_indicator(user_id, session_id, True)
                
                # Get conversation history
                history = await self.get_chat_history(session_id, limit=20, db=db)
                
                # Generate and stream response
                async for response_chunk in self.generate_rag_response(
                    user_message=user_message,
                    clone_id=clone_id,
                    session_id=session_id,
                    conversation_history=history,
                    db=db
                ):
                    await self.connection_manager.send_personal_message(
                        user_id, session_id, response_chunk
                    )
                
                # Stop typing indicator
                await self.connection_manager.send_typing_indicator(user_id, session_id, False)
                
            elif message_type == 'typing':
                # Handle typing indicator (could relay to other participants)
                is_typing = message_data.get('is_typing', False)
                # For now, just log it
                logger.debug("User typing indicator", 
                           user_id=user_id,
                           session_id=session_id,
                           is_typing=is_typing)
                
        except Exception as e:
            logger.error("Error handling WebSocket message", 
                        error=str(e),
                        user_id=user_id,
                        session_id=session_id,
                        message_data=message_data)
            
            await self.connection_manager.send_personal_message(user_id, session_id, {
                "type": "error",
                "content": "Sorry, I encountered an error processing your message.",
                "error": str(e)
            })

# Global chat service
chat_service = ChatService()

# WebSocket endpoint handler
async def handle_websocket_connection(
    websocket: WebSocket, 
    user_id: str, 
    session_id: str
):
    """Handle WebSocket connection for real-time chat"""
    await connection_manager.connect(websocket, user_id, session_id)
    
    try:
        async with get_db_session() as db:
            while True:
                # Receive message from WebSocket
                data = await websocket.receive_text()
                message_data = json.loads(data)
                
                # Handle the message
                await chat_service.handle_websocket_message(
                    websocket, user_id, session_id, message_data, db
                )
                
    except WebSocketDisconnect:
        connection_manager.disconnect(user_id, session_id)
    except Exception as e:
        logger.error("WebSocket connection error", 
                    user_id=user_id,
                    session_id=session_id,
                    error=str(e))
        connection_manager.disconnect(user_id, session_id)