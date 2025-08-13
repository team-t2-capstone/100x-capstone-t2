"""
Clone Management API endpoints for CloneAI - Supabase Integration
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPAuthorizationCredentials
import structlog

from app.database import get_supabase
from app.core.supabase_auth import get_current_user_id, security
from app.models.schemas import (
    CloneCreate, CloneUpdate, CloneResponse, CloneListResponse,
    PaginationInfo, DocumentProcessingRequest, KnowledgeProcessingStatus,
    RAGQueryRequest, RAGQueryResponse
)

logger = structlog.get_logger()
router = APIRouter(prefix="/clones", tags=["Clone Management"])


@router.get("/test-no-auth")
async def test_no_auth():
    """
    Simple endpoint without authentication to test basic connectivity
    """
    return {"message": "No auth test successful", "timestamp": datetime.utcnow().isoformat()}


@router.get("/test-auth")
async def test_auth(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Simple endpoint to test authentication - returns user ID and token info if auth succeeds
    """
    token = credentials.credentials
    return {
        "user_id": current_user_id, 
        "message": "Authentication successful",
        "token_length": len(token),
        "token_prefix": token[:50] + "..." if len(token) > 50 else token
    }


@router.get("/", response_model=CloneListResponse)
async def list_clones(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    category: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    price_min: Optional[float] = Query(default=None, ge=0),
    price_max: Optional[float] = Query(default=None, ge=0),
    creator_id: Optional[str] = Query(default=None),
    current_user_id: str = Depends(get_current_user_id),
    supabase_client = Depends(get_supabase)
) -> CloneListResponse:
    """
    Get paginated list of published clones
    """
    try:
        # Build query for published clones only
        query = supabase_client.table("clones").select("*").eq("is_published", True).eq("is_active", True)
        
        # Apply filters
        if category:
            query = query.eq("category", category)
        
        if creator_id:
            query = query.eq("creator_id", creator_id)
            
        if price_min is not None:
            query = query.gte("base_price", price_min)
            
        if price_max is not None:
            query = query.lte("base_price", price_max)
        
        if search:
            # Search in name, description, and bio
            query = query.or_(f"name.ilike.%{search}%,description.ilike.%{search}%,bio.ilike.%{search}%")
        
        # Get total count for pagination
        count_response = query.execute()
        total_count = len(count_response.data) if count_response.data else 0
        
        # Apply pagination
        offset = (page - 1) * limit
        paginated_query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
        
        response = paginated_query.execute()
        
        if not response.data:
            response.data = []
        
        # Convert to CloneResponse objects
        clones = []
        for clone_data in response.data:
            clones.append(CloneResponse(
                id=clone_data["id"],
                creator_id=clone_data["creator_id"],
                name=clone_data["name"],
                description=clone_data["description"],
                category=clone_data["category"],
                expertise_areas=clone_data.get("expertise_areas", []),
                avatar_url=clone_data.get("avatar_url"),
                base_price=float(clone_data["base_price"]),
                bio=clone_data.get("bio"),
                personality_traits=clone_data.get("personality_traits", {}),
                communication_style=clone_data.get("communication_style", {}),
                languages=clone_data.get("languages", ["English"]),
                average_rating=float(clone_data.get("average_rating", 0.0)),
                total_sessions=int(clone_data.get("total_sessions", 0)),
                total_earnings=float(clone_data.get("total_earnings", 0.0)),
                is_published=clone_data["is_published"],
                is_active=clone_data["is_active"],
                created_at=datetime.fromisoformat(clone_data["created_at"].replace('Z', '+00:00')),
                updated_at=datetime.fromisoformat(clone_data["updated_at"].replace('Z', '+00:00')),
                published_at=datetime.fromisoformat(clone_data["published_at"].replace('Z', '+00:00')) if clone_data.get("published_at") else None
            ))
        
        # Calculate pagination info
        total_pages = (total_count + limit - 1) // limit
        has_next = page < total_pages
        has_prev = page > 1
        
        pagination = PaginationInfo(
            page=page,
            limit=limit,
            total=total_count,
            pages=total_pages,
            has_next=has_next,
            has_prev=has_prev
        )
        
        return CloneListResponse(
            clones=clones,
            pagination=pagination
        )
        
    except Exception as e:
        logger.error("Failed to list clones", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve clones"
        )


@router.get("/{clone_id}", response_model=CloneResponse)
async def get_clone(
    clone_id: str,
    current_user_id: str = Depends(get_current_user_id),
    supabase_client = Depends(get_supabase)
) -> CloneResponse:
    """
    Get a specific clone by ID
    """
    try:
        # Fetch clone from Supabase
        response = supabase_client.table("clones").select("*").eq("id", clone_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        clone_data = response.data[0]
        
        # Check if clone is published or if user is the creator
        if not clone_data["is_published"] and clone_data["creator_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        return CloneResponse(
            id=clone_data["id"],
            creator_id=clone_data["creator_id"],
            name=clone_data["name"],
            description=clone_data["description"],
            category=clone_data["category"],
            expertise_areas=clone_data.get("expertise_areas", []),
            avatar_url=clone_data.get("avatar_url"),
            base_price=float(clone_data["base_price"]),
            bio=clone_data.get("bio"),
            personality_traits=clone_data.get("personality_traits", {}),
            communication_style=clone_data.get("communication_style", {}),
            languages=clone_data.get("languages", ["English"]),
            average_rating=float(clone_data.get("average_rating", 0.0)),
            total_sessions=int(clone_data.get("total_sessions", 0)),
            total_earnings=float(clone_data.get("total_earnings", 0.0)),
            is_published=clone_data["is_published"],
            is_active=clone_data["is_active"],
            created_at=datetime.fromisoformat(clone_data["created_at"].replace('Z', '+00:00')),
            updated_at=datetime.fromisoformat(clone_data["updated_at"].replace('Z', '+00:00')),
            published_at=datetime.fromisoformat(clone_data["published_at"].replace('Z', '+00:00')) if clone_data.get("published_at") else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get clone", error=str(e), clone_id=clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve clone"
        )


@router.get("/my-clones", response_model=CloneListResponse)
async def get_my_clones(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    published_only: Optional[bool] = Query(default=None),
    current_user_id: str = Depends(get_current_user_id),
    supabase_client = Depends(get_supabase)
) -> CloneListResponse:
    """
    Get current user's clones
    """
    try:
        # Build query for user's clones
        query = supabase_client.table("clones").select("*").eq("creator_id", current_user_id)
        
        # Filter by published status if specified
        if published_only is not None:
            query = query.eq("is_published", published_only)
        
        # Get total count for pagination
        count_response = query.execute()
        total_count = len(count_response.data) if count_response.data else 0
        
        # Apply pagination
        offset = (page - 1) * limit
        paginated_query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
        
        response = paginated_query.execute()
        
        if not response.data:
            response.data = []
        
        # Convert to CloneResponse objects
        clones = []
        for clone_data in response.data:
            clones.append(CloneResponse(
                id=clone_data["id"],
                creator_id=clone_data["creator_id"],
                name=clone_data["name"],
                description=clone_data["description"],
                category=clone_data["category"],
                expertise_areas=clone_data.get("expertise_areas", []),
                avatar_url=clone_data.get("avatar_url"),
                base_price=float(clone_data["base_price"]),
                bio=clone_data.get("bio"),
                personality_traits=clone_data.get("personality_traits", {}),
                communication_style=clone_data.get("communication_style", {}),
                languages=clone_data.get("languages", ["English"]),
                average_rating=float(clone_data.get("average_rating", 0.0)),
                total_sessions=int(clone_data.get("total_sessions", 0)),
                total_earnings=float(clone_data.get("total_earnings", 0.0)),
                is_published=clone_data["is_published"],
                is_active=clone_data["is_active"],
                created_at=datetime.fromisoformat(clone_data["created_at"].replace('Z', '+00:00')),
                updated_at=datetime.fromisoformat(clone_data["updated_at"].replace('Z', '+00:00')),
                published_at=datetime.fromisoformat(clone_data["published_at"].replace('Z', '+00:00')) if clone_data.get("published_at") else None
            ))
        
        # Calculate pagination info
        total_pages = (total_count + limit - 1) // limit
        has_next = page < total_pages
        has_prev = page > 1
        
        pagination = PaginationInfo(
            page=page,
            limit=limit,
            total=total_count,
            pages=total_pages,
            has_next=has_next,
            has_prev=has_prev
        )
        
        return CloneListResponse(
            clones=clones,
            pagination=pagination
        )
        
    except Exception as e:
        logger.error("Failed to get user clones", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user clones"
        )


@router.post("/", response_model=CloneResponse, status_code=status.HTTP_201_CREATED)
async def create_clone(
    clone_data: CloneCreate,
    current_user_id: str = Depends(get_current_user_id),
    supabase_client = Depends(get_supabase)
) -> CloneResponse:
    """
    Create a new AI expert clone using Supabase
    """
    try:
        # Create clone data for Supabase
        clone_id = str(uuid4())
        clone_data_dict = {
            "id": clone_id,
            "creator_id": current_user_id,
            "name": clone_data.name,
            "description": clone_data.description,
            "category": clone_data.category,
            "expertise_areas": clone_data.expertise_areas,
            "base_price": float(clone_data.base_price),
            "bio": clone_data.bio,
            "personality_traits": clone_data.personality_traits,
            "communication_style": clone_data.communication_style,
            "languages": clone_data.languages,
            "is_published": False,
            "is_active": True,
            "average_rating": 0.0,
            "total_sessions": 0,
            "total_earnings": 0.0,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Insert into Supabase clones table
        response = supabase_client.table("clones").insert(clone_data_dict).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create clone in database"
            )
        
        created_clone = response.data[0]
        
        logger.info("Clone created successfully in Supabase", 
                   clone_id=clone_id, 
                   creator_id=current_user_id)
        
        # Return response using created data
        return CloneResponse(
            id=created_clone["id"],
            creator_id=created_clone["creator_id"],
            name=created_clone["name"],
            description=created_clone["description"],
            category=created_clone["category"],
            expertise_areas=created_clone["expertise_areas"],
            avatar_url=created_clone.get("avatar_url"),
            base_price=created_clone["base_price"],
            bio=created_clone["bio"],
            personality_traits=created_clone["personality_traits"],
            communication_style=created_clone["communication_style"],
            languages=created_clone["languages"],
            average_rating=created_clone["average_rating"],
            total_sessions=created_clone["total_sessions"],
            total_earnings=created_clone["total_earnings"],
            is_published=created_clone["is_published"],
            is_active=created_clone["is_active"],
            created_at=datetime.fromisoformat(created_clone["created_at"].replace('Z', '+00:00')),
            updated_at=datetime.fromisoformat(created_clone["updated_at"].replace('Z', '+00:00')),
            published_at=datetime.fromisoformat(created_clone["published_at"].replace('Z', '+00:00')) if created_clone.get("published_at") else None
        )
        
    except Exception as e:
        logger.error("Clone creation failed", error=str(e), creator_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create clone"
        )


@router.put("/{clone_id}", response_model=CloneResponse)
async def update_clone(
    clone_id: str,
    clone_data: CloneUpdate,
    current_user_id: str = Depends(get_current_user_id),
    supabase_client = Depends(get_supabase)
) -> CloneResponse:
    """
    Update an existing clone (only by creator)
    """
    try:
        # First check if clone exists and user owns it
        response = supabase_client.table("clones").select("*").eq("id", clone_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        existing_clone = response.data[0]
        
        # Check if user is the creator
        if existing_clone["creator_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the creator can update this clone"
            )
        
        # Build update data
        update_dict = clone_data.dict(exclude_unset=True)
        update_dict["updated_at"] = datetime.utcnow().isoformat()
        
        # If publishing for the first time, set published_at
        if clone_data.is_published and not existing_clone.get("published_at"):
            update_dict["published_at"] = datetime.utcnow().isoformat()
        
        # Update in Supabase
        update_response = supabase_client.table("clones").update(update_dict).eq("id", clone_id).execute()
        
        if not update_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update clone"
            )
        
        updated_clone = update_response.data[0]
        
        logger.info("Clone updated successfully", 
                   clone_id=clone_id, 
                   creator_id=current_user_id)
        
        return CloneResponse(
            id=updated_clone["id"],
            creator_id=updated_clone["creator_id"],
            name=updated_clone["name"],
            description=updated_clone["description"],
            category=updated_clone["category"],
            expertise_areas=updated_clone.get("expertise_areas", []),
            avatar_url=updated_clone.get("avatar_url"),
            base_price=float(updated_clone["base_price"]),
            bio=updated_clone.get("bio"),
            personality_traits=updated_clone.get("personality_traits", {}),
            communication_style=updated_clone.get("communication_style", {}),
            languages=updated_clone.get("languages", ["English"]),
            average_rating=float(updated_clone.get("average_rating", 0.0)),
            total_sessions=int(updated_clone.get("total_sessions", 0)),
            total_earnings=float(updated_clone.get("total_earnings", 0.0)),
            is_published=updated_clone["is_published"],
            is_active=updated_clone["is_active"],
            created_at=datetime.fromisoformat(updated_clone["created_at"].replace('Z', '+00:00')),
            updated_at=datetime.fromisoformat(updated_clone["updated_at"].replace('Z', '+00:00')),
            published_at=datetime.fromisoformat(updated_clone["published_at"].replace('Z', '+00:00')) if updated_clone.get("published_at") else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Clone update failed", error=str(e), clone_id=clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update clone"
        )


@router.delete("/{clone_id}")
async def delete_clone(
    clone_id: str,
    current_user_id: str = Depends(get_current_user_id),
    supabase_client = Depends(get_supabase)
) -> dict:
    """
    Delete a clone (only by creator) - soft delete by deactivating
    """
    try:
        # First check if clone exists and user owns it
        response = supabase_client.table("clones").select("*").eq("id", clone_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        existing_clone = response.data[0]
        
        # Check if user is the creator
        if existing_clone["creator_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the creator can delete this clone"
            )
        
        # Check if clone has active sessions
        sessions_response = supabase_client.table("sessions").select("id").eq("clone_id", clone_id).eq("status", "active").execute()
        
        if sessions_response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete clone with active sessions"
            )
        
        # Soft delete by deactivating
        update_data = {
            "is_active": False,
            "is_published": False,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        update_response = supabase_client.table("clones").update(update_data).eq("id", clone_id).execute()
        
        if not update_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete clone"
            )
        
        logger.info("Clone deleted successfully", 
                   clone_id=clone_id, 
                   deleted_by=current_user_id)
        
        return {"message": "Clone deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Clone deletion failed", error=str(e), clone_id=clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete clone"
        )


@router.post("/{clone_id}/publish")
async def publish_clone(
    clone_id: str,
    current_user_id: str = Depends(get_current_user_id),
    supabase_client = Depends(get_supabase)
) -> dict:
    """
    Publish a clone to make it publicly available
    """
    try:
        # First check if clone exists and user owns it
        response = supabase_client.table("clones").select("*").eq("id", clone_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        existing_clone = response.data[0]
        
        # Check if user is the creator
        if existing_clone["creator_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the creator can publish this clone"
            )
        
        # Validate clone has required fields for publishing
        if not existing_clone.get("name") or not existing_clone.get("description") or not existing_clone.get("category"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Clone must have name, description, and category to be published"
            )
        
        # Update to published status
        update_data = {
            "is_published": True,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Set published_at if not already set
        if not existing_clone.get("published_at"):
            update_data["published_at"] = datetime.utcnow().isoformat()
        
        update_response = supabase_client.table("clones").update(update_data).eq("id", clone_id).execute()
        
        if not update_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to publish clone"
            )
        
        logger.info("Clone published successfully", 
                   clone_id=clone_id, 
                   creator_id=current_user_id)
        
        return {"message": "Clone published successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Clone publishing failed", error=str(e), clone_id=clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to publish clone"
        )


@router.post("/{clone_id}/unpublish")
async def unpublish_clone(
    clone_id: str,
    current_user_id: str = Depends(get_current_user_id),
    supabase_client = Depends(get_supabase)
) -> dict:
    """
    Unpublish a clone to make it private/draft
    """
    try:
        # First check if clone exists and user owns it
        response = supabase_client.table("clones").select("*").eq("id", clone_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        existing_clone = response.data[0]
        
        # Check if user is the creator
        if existing_clone["creator_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the creator can unpublish this clone"
            )
        
        # Check if clone has active sessions
        sessions_response = supabase_client.table("sessions").select("id").eq("clone_id", clone_id).eq("status", "active").execute()
        
        if sessions_response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot unpublish clone with active sessions"
            )
        
        # Update to unpublished status
        update_data = {
            "is_published": False,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        update_response = supabase_client.table("clones").update(update_data).eq("id", clone_id).execute()
        
        if not update_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to unpublish clone"
            )
        
        logger.info("Clone unpublished successfully", 
                   clone_id=clone_id, 
                   creator_id=current_user_id)
        
        return {"message": "Clone unpublished successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Clone unpublishing failed", error=str(e), clone_id=clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to unpublish clone"
        )


@router.get("/{clone_id}/stats")
async def get_clone_stats(
    clone_id: str,
    current_user_id: str = Depends(get_current_user_id),
    supabase_client = Depends(get_supabase)
) -> dict:
    """
    Get statistics for a clone (only by creator)
    """
    try:
        # First check if clone exists and user owns it
        response = supabase_client.table("clones").select("*").eq("id", clone_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        clone_data = response.data[0]
        
        # Check if user is the creator
        if clone_data["creator_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the creator can view clone statistics"
            )
        
        # Get session statistics from sessions table
        sessions_response = supabase_client.table("sessions").select("*").eq("clone_id", clone_id).execute()
        
        sessions = sessions_response.data or []
        
        # Calculate stats
        total_sessions = len(sessions)
        total_minutes = sum(session.get("duration_minutes", 0) for session in sessions)
        total_earnings = sum(session.get("total_cost", 0) for session in sessions)
        
        # Calculate average rating
        ratings = [session.get("user_rating") for session in sessions if session.get("user_rating") is not None]
        avg_rating = sum(ratings) / len(ratings) if ratings else 0.0
        
        return {
            "total_sessions": total_sessions,
            "total_duration_minutes": total_minutes,
            "total_earnings": float(total_earnings),
            "average_rating": float(avg_rating),
            "is_published": clone_data["is_published"],
            "created_at": clone_data["created_at"],
            "published_at": clone_data.get("published_at")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get clone stats", error=str(e), clone_id=clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve clone statistics"
        )


# RAG Integration Endpoints

@router.post("/{clone_id}/process-knowledge", response_model=KnowledgeProcessingStatus)
async def process_clone_knowledge(
    clone_id: str,
    request: DocumentProcessingRequest,
    current_user_id: str = Depends(get_current_user_id),
    supabase_client = Depends(get_supabase)
) -> KnowledgeProcessingStatus:
    """
    Process knowledge documents for a clone using RAG workflow
    """
    try:
        # Import here to avoid circular imports
        from app.services.rag_integration import process_clone_knowledge
        
        # First check if clone exists and user owns it
        response = supabase_client.table("clones").select("*").eq("id", clone_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        clone_data = response.data[0]
        
        # Check if user is the creator
        if clone_data["creator_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the creator can process clone knowledge"
            )
        
        # Extract clone information
        clone_name = clone_data.get("name", "Unknown Clone")
        clone_expertise = clone_data.get("expertise_areas", ["General Knowledge"])
        clone_expertise_str = ", ".join(clone_expertise) if isinstance(clone_expertise, list) else str(clone_expertise)
        clone_background = clone_data.get("bio", "")
        personality_traits = str(clone_data.get("personality_traits", {}))
        
        # Process the knowledge using RAG integration
        processing_status = await process_clone_knowledge(
            clone_id=clone_id,
            clone_name=clone_name,
            clone_expertise=clone_expertise_str,
            clone_background=clone_background,
            personality_traits=personality_traits,
            documents=request.documents,
            links=request.links
        )
        
        # Update clone with RAG information
        rag_update_data = {
            "rag_expert_name": processing_status.expert_name,
            "rag_domain_name": processing_status.domain_name,
            "document_processing_status": processing_status.overall_status,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        if processing_status.rag_assistant_id:
            rag_update_data["rag_assistant_id"] = processing_status.rag_assistant_id
        
        supabase_client.table("clones").update(rag_update_data).eq("id", clone_id).execute()
        
        logger.info("Clone knowledge processing completed", 
                   clone_id=clone_id, 
                   status=processing_status.overall_status)
        
        return processing_status
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Clone knowledge processing failed", error=str(e), clone_id=clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process clone knowledge: {str(e)}"
        )


@router.get("/{clone_id}/processing-status", response_model=KnowledgeProcessingStatus)
async def get_processing_status(
    clone_id: str,
    current_user_id: str = Depends(get_current_user_id),
    supabase_client = Depends(get_supabase)
) -> KnowledgeProcessingStatus:
    """
    Get the current processing status for a clone's knowledge
    """
    try:
        # First check if clone exists and user owns it
        response = supabase_client.table("clones").select("*").eq("id", clone_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        clone_data = response.data[0]
        
        # Check if user is the creator
        if clone_data["creator_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the creator can view processing status"
            )
        
        # Get RAG information from clone data
        processing_status = KnowledgeProcessingStatus(
            clone_id=clone_id,
            expert_name=clone_data.get("rag_expert_name", ""),
            domain_name=clone_data.get("rag_domain_name", ""),
            overall_status=clone_data.get("document_processing_status", "pending"),
            rag_assistant_id=clone_data.get("rag_assistant_id"),
            processing_started=clone_data.get("updated_at"),
            processing_completed=clone_data.get("updated_at") if clone_data.get("document_processing_status") == "completed" else None
        )
        
        return processing_status
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get processing status", error=str(e), clone_id=clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve processing status"
        )


@router.post("/{clone_id}/query", response_model=RAGQueryResponse)
async def query_clone_expert(
    clone_id: str,
    request: RAGQueryRequest,
    current_user_id: str = Depends(get_current_user_id),
    supabase_client = Depends(get_supabase)
) -> RAGQueryResponse:
    """
    Query a clone's RAG expert for testing and chat
    """
    try:
        # Import here to avoid circular imports
        from app.services.rag_integration import query_clone_expert
        
        # Check if clone exists
        response = supabase_client.table("clones").select("*").eq("id", clone_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        clone_data = response.data[0]
        
        # Check if clone has been processed
        if not clone_data.get("rag_expert_name"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Clone knowledge has not been processed yet"
            )
        
        if clone_data.get("document_processing_status") != "completed":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Clone knowledge processing is not complete"
            )
        
        # Query the expert using direct RAG integration
        clone_name = clone_data.get("name", "Unknown Clone")
        
        result = await query_clone_expert(
            clone_id=clone_id,
            clone_name=clone_name,
            query=request.query,
            memory_type=request.memory_type
        )
        
        # Format response
        response_text = result.get("response", {}).get("text", result.get("response", ""))
        if isinstance(response_text, dict):
            response_text = response_text.get("text", str(response_text))
        
        return RAGQueryResponse(
            response=str(response_text),
            thread_id=result.get("thread_id"),
            assistant_id=result.get("assistant_id"),
            citations=result.get("citations"),
            error=result.get("error")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Clone query failed", error=str(e), clone_id=clone_id)
        return RAGQueryResponse(
            response=f"I'm sorry, I'm currently unable to process your question. Error: {str(e)}",
            error=str(e)
        )


@router.post("/{clone_id}/retry-processing")
async def retry_failed_processing(
    clone_id: str,
    current_user_id: str = Depends(get_current_user_id),
    supabase_client = Depends(get_supabase)
) -> dict:
    """
    Retry processing for failed documents
    """
    try:
        # First check if clone exists and user owns it
        response = supabase_client.table("clones").select("*").eq("id", clone_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        clone_data = response.data[0]
        
        # Check if user is the creator
        if clone_data["creator_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the creator can retry processing"
            )
        
        # Check if there are failed documents to retry
        current_status = clone_data.get("document_processing_status")
        if current_status not in ["failed", "partial"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No failed processing to retry"
            )
        
        # Reset processing status to pending
        update_data = {
            "document_processing_status": "pending",
            "updated_at": datetime.utcnow().isoformat()
        }
        
        supabase_client.table("clones").update(update_data).eq("id", clone_id).execute()
        
        logger.info("Clone processing retry initiated", clone_id=clone_id)
        
        return {"message": "Processing retry initiated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to retry processing", error=str(e), clone_id=clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retry processing"
        )