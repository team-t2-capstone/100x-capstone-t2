"""
WebRTC Signaling Server API
Handles WebRTC signaling for voice and video calls between users and AI clones
"""
import logging
import json
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Set
from uuid import uuid4

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

import structlog

from app.database import get_db_session
from app.core.supabase_auth import get_current_user_id
from app.models.database import Clone, Session as CallSession, UserProfile
from app.models.schemas import BaseSchema

logger = structlog.get_logger()

router = APIRouter(prefix="/webrtc", tags=["WebRTC"])

# WebRTC Connection Manager
class WebRTCConnectionManager:
    def __init__(self):
        # Store active connections: room_id -> {user_id: websocket, clone_id: ai_connection}
        self.active_rooms: Dict[str, Dict[str, Any]] = {}
        # Store call sessions: room_id -> session_data
        self.call_sessions: Dict[str, Dict[str, Any]] = {}
        # Store user connections: user_id -> websocket
        self.user_connections: Dict[str, WebSocket] = {}

    async def create_room(self, user_id: str, clone_id: str, call_type: str) -> str:
        """Create a new WebRTC room for a call session"""
        room_id = f"call_{uuid4().hex[:8]}"
        
        self.active_rooms[room_id] = {
            "user_id": user_id,
            "clone_id": clone_id,
            "call_type": call_type,  # "voice" or "video"
            "status": "waiting",
            "created_at": datetime.utcnow(),
            "user_connection": None,
            "clone_connection": None
        }
        
        self.call_sessions[room_id] = {
            "start_time": None,
            "end_time": None,
            "duration_seconds": 0,
            "user_id": user_id,
            "clone_id": clone_id,
            "call_type": call_type,
            "status": "created"
        }
        
        logger.info("WebRTC room created", room_id=room_id, user_id=user_id, clone_id=clone_id)
        return room_id

    async def join_room(self, room_id: str, user_id: str, websocket: WebSocket, role: str = "user"):
        """Join a user to a WebRTC room"""
        if room_id not in self.active_rooms:
            raise HTTPException(status_code=404, detail="Room not found")
        
        room = self.active_rooms[room_id]
        
        if role == "user":
            if room["user_id"] != user_id:
                raise HTTPException(status_code=403, detail="Not authorized for this room")
            room["user_connection"] = websocket
            self.user_connections[user_id] = websocket
        
        room["status"] = "connected"
        
        logger.info("User joined WebRTC room", room_id=room_id, user_id=user_id, role=role)
        
        # Notify about successful connection
        await self.broadcast_to_room(room_id, {
            "type": "user_joined",
            "user_id": user_id,
            "role": role,
            "timestamp": datetime.utcnow().isoformat()
        })

    async def leave_room(self, room_id: str, user_id: str):
        """Remove a user from a WebRTC room"""
        if room_id not in self.active_rooms:
            return
        
        room = self.active_rooms[room_id]
        
        if room.get("user_id") == user_id:
            room["user_connection"] = None
            if user_id in self.user_connections:
                del self.user_connections[user_id]
        
        # End the call session
        if room_id in self.call_sessions:
            session = self.call_sessions[room_id]
            if session["status"] == "active":
                session["end_time"] = datetime.utcnow()
                session["status"] = "ended"
                if session["start_time"]:
                    session["duration_seconds"] = (session["end_time"] - session["start_time"]).total_seconds()
        
        logger.info("User left WebRTC room", room_id=room_id, user_id=user_id)
        
        # Notify about disconnection
        await self.broadcast_to_room(room_id, {
            "type": "user_left",
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat()
        })

    async def broadcast_to_room(self, room_id: str, message: Dict[str, Any]):
        """Broadcast a message to all connections in a room"""
        if room_id not in self.active_rooms:
            return
        
        room = self.active_rooms[room_id]
        message_json = json.dumps(message)
        
        # Send to user connection
        if room["user_connection"]:
            try:
                await room["user_connection"].send_text(message_json)
            except Exception as e:
                logger.error("Failed to send to user connection", error=str(e), room_id=room_id)

    async def handle_signaling(self, room_id: str, user_id: str, message: Dict[str, Any]):
        """Handle WebRTC signaling messages"""
        message["from_user"] = user_id
        message["timestamp"] = datetime.utcnow().isoformat()
        
        # Start the session when we receive the first offer
        if message.get("type") == "offer" and room_id in self.call_sessions:
            session = self.call_sessions[room_id]
            if session["status"] == "created":
                session["start_time"] = datetime.utcnow()
                session["status"] = "active"
        
        # Relay signaling message to other participants
        await self.broadcast_to_room(room_id, message)
        
        logger.debug("WebRTC signaling message processed", 
                    room_id=room_id, 
                    user_id=user_id, 
                    message_type=message.get("type"))

    def get_room_info(self, room_id: str) -> Optional[Dict[str, Any]]:
        """Get information about a WebRTC room"""
        if room_id not in self.active_rooms:
            return None
        
        room = self.active_rooms[room_id]
        session = self.call_sessions.get(room_id, {})
        
        return {
            "room_id": room_id,
            "user_id": room["user_id"],
            "clone_id": room["clone_id"],
            "call_type": room["call_type"],
            "status": room["status"],
            "created_at": room["created_at"].isoformat(),
            "session": session
        }

    async def cleanup_inactive_rooms(self):
        """Clean up inactive rooms (called periodically)"""
        cutoff_time = datetime.utcnow() - timedelta(hours=1)
        
        rooms_to_remove = []
        for room_id, room in self.active_rooms.items():
            if room["created_at"] < cutoff_time and room["status"] != "active":
                rooms_to_remove.append(room_id)
        
        for room_id in rooms_to_remove:
            del self.active_rooms[room_id]
            if room_id in self.call_sessions:
                del self.call_sessions[room_id]
        
        if rooms_to_remove:
            logger.info("Cleaned up inactive WebRTC rooms", count=len(rooms_to_remove))

# Global connection manager instance
connection_manager = WebRTCConnectionManager()

# Pydantic schemas
class CreateCallRequest(BaseSchema):
    clone_id: str
    call_type: str  # "voice" or "video"

class CreateCallResponse(BaseSchema):
    room_id: str
    clone_id: str
    call_type: str
    status: str

class RoomInfoResponse(BaseSchema):
    room_id: str
    user_id: str
    clone_id: str
    call_type: str
    status: str
    created_at: str
    session: Dict[str, Any]

# REST API Endpoints
@router.post("/create-call", response_model=CreateCallResponse)
async def create_call(
    request: CreateCallRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
):
    """Create a new WebRTC call room"""
    try:
        # Verify the clone exists
        clone_result = await db.execute(
            select(Clone).where(Clone.id == request.clone_id)
        )
        clone = clone_result.scalar_one_or_none()
        if not clone:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        # Validate call type
        if request.call_type not in ["voice", "video"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Call type must be 'voice' or 'video'"
            )
        
        # Create the room
        room_id = await connection_manager.create_room(
            user_id=current_user_id,
            clone_id=request.clone_id,
            call_type=request.call_type
        )
        
        return CreateCallResponse(
            room_id=room_id,
            clone_id=request.clone_id,
            call_type=request.call_type,
            status="waiting"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to create call", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create call"
        )

@router.get("/room/{room_id}", response_model=RoomInfoResponse)
async def get_room_info(
    room_id: str,
    current_user_id: str = Depends(get_current_user_id)
):
    """Get information about a WebRTC room"""
    room_info = connection_manager.get_room_info(room_id)
    if not room_info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )
    
    # Check authorization
    if room_info["user_id"] != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this room"
        )
    
    return RoomInfoResponse(**room_info)

@router.delete("/room/{room_id}")
async def end_call(
    room_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
):
    """End a call and clean up the room"""
    room_info = connection_manager.get_room_info(room_id)
    if not room_info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )
    
    # Check authorization
    if room_info["user_id"] != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to end this call"
        )
    
    # Leave the room (this will end the session)
    await connection_manager.leave_room(room_id, current_user_id)
    
    # Save the call session to database
    session_data = connection_manager.call_sessions.get(room_id)
    if session_data and session_data["status"] == "ended":
        try:
            call_session = CallSession(
                user_id=session_data["user_id"],
                clone_id=session_data["clone_id"],
                session_type="call",
                start_time=session_data.get("start_time"),
                end_time=session_data.get("end_time"),
                duration_minutes=int(session_data.get("duration_seconds", 0) / 60),
                total_cost=0.0,  # Will be calculated based on clone pricing
                status="completed",
                metadata={
                    "call_type": session_data["call_type"],
                    "room_id": room_id,
                    "duration_seconds": session_data.get("duration_seconds", 0)
                }
            )
            
            db.add(call_session)
            await db.commit()
            
            logger.info("Call session saved", room_id=room_id, duration=session_data.get("duration_seconds", 0))
            
        except Exception as e:
            logger.error("Failed to save call session", error=str(e), room_id=room_id)
    
    return {"message": "Call ended successfully"}

# WebSocket endpoint for signaling
@router.websocket("/signal/{room_id}")
async def websocket_signaling(
    websocket: WebSocket,
    room_id: str
):
    """WebSocket endpoint for WebRTC signaling"""
    await websocket.accept()
    
    user_id = None
    
    try:
        # Wait for initial authentication message
        auth_data = await websocket.receive_json()
        
        if auth_data.get("type") != "auth":
            await websocket.send_json({"type": "error", "message": "Authentication required"})
            await websocket.close()
            return
        
        # TODO: Validate JWT token from auth_data["token"]
        user_id = auth_data.get("user_id")
        
        if not user_id:
            await websocket.send_json({"type": "error", "message": "Invalid authentication"})
            await websocket.close()
            return
        
        # Join the room
        await connection_manager.join_room(room_id, user_id, websocket)
        
        # Send connection success
        await websocket.send_json({
            "type": "connected",
            "room_id": room_id,
            "user_id": user_id
        })
        
        # Handle signaling messages
        while True:
            try:
                message = await websocket.receive_json()
                
                if message.get("type") in ["offer", "answer", "ice-candidate"]:
                    await connection_manager.handle_signaling(room_id, user_id, message)
                elif message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                else:
                    logger.warning("Unknown message type", message_type=message.get("type"))
                
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error("WebSocket message handling error", error=str(e), user_id=user_id)
                break
    
    except Exception as e:
        logger.error("WebSocket connection error", error=str(e), room_id=room_id)
    
    finally:
        # Clean up connection
        if user_id:
            await connection_manager.leave_room(room_id, user_id)
        
        try:
            await websocket.close()
        except:
            pass

# Background task to clean up inactive rooms
async def cleanup_inactive_rooms_task():
    """Background task to periodically clean up inactive rooms"""
    while True:
        try:
            await connection_manager.cleanup_inactive_rooms()
            await asyncio.sleep(300)  # Run every 5 minutes
        except Exception as e:
            logger.error("Room cleanup task error", error=str(e))
            await asyncio.sleep(60)  # Retry after 1 minute on error

# Start cleanup task - this should be called after event loop is running
# asyncio.create_task(cleanup_inactive_rooms_task())  # Commented out to prevent import-time error