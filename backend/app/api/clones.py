from app.core.supabase_auth import get_current_user_id, require_role

"""
Clone Management API endpoints for CloneAI
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc
from sqlalchemy.orm import selectinload
import structlog

from app.database import get_db_session, get_supabase
from app.models.database import Clone, UserProfile, Session
from app.models.schemas import (
    CloneCreate, CloneUpdate, CloneResponse, CloneListResponse,
    ExpertSearchRequest, PaginationInfo
)

logger = structlog.get_logger()
router = APIRouter(prefix="/clones", tags=["Clone Management"])


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
        from uuid import uuid4
        from datetime import datetime
        
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
            base_price=created_clone["base_price"],
            bio=created_clone["bio"],
            personality_traits=created_clone["personality_traits"],
            communication_style=created_clone["communication_style"],
            languages=created_clone["languages"],
            is_published=created_clone["is_published"],
            is_active=created_clone["is_active"],
            average_rating=created_clone["average_rating"],
            total_sessions=created_clone["total_sessions"],
            total_earnings=created_clone["total_earnings"],
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


@router.get("/my-clones", response_model=CloneListResponse)
async def list_my_clones(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    include_drafts: bool = Query(True),
    current_user_id: str = Depends(get_current_user_id),
    supabase_client = Depends(get_supabase)
) -> CloneListResponse:
    """
    List current user's clones (including drafts) from Supabase
    """
    try:
        from datetime import datetime
        
        # Build Supabase query for user's clones
        query = supabase_client.table("clones").select("*").eq("creator_id", current_user_id)
        
        if not include_drafts:
            query = query.eq("is_published", True)
        
        # Execute query
        response = query.execute()
        
        clones_data = response.data if response.data else []
        
        # Apply pagination
        total = len(clones_data)
        offset = (page - 1) * limit
        paginated_clones = clones_data[offset:offset + limit]
        
        # Convert to CloneResponse objects
        clones = []
        for clone_data in paginated_clones:
            clones.append(CloneResponse(
                id=clone_data["id"],
                creator_id=clone_data["creator_id"],
                name=clone_data["name"],
                description=clone_data["description"],
                category=clone_data["category"],
                expertise_areas=clone_data["expertise_areas"],
                base_price=clone_data["base_price"],
                bio=clone_data.get("bio", ""),
                personality_traits=clone_data.get("personality_traits", []),
                communication_style=clone_data.get("communication_style", ""),
                languages=clone_data.get("languages", []),
                is_published=clone_data["is_published"],
                is_active=clone_data["is_active"],
                average_rating=clone_data.get("average_rating", 0.0),
                total_sessions=clone_data.get("total_sessions", 0),
                total_earnings=clone_data.get("total_earnings", 0.0),
                created_at=datetime.fromisoformat(clone_data["created_at"].replace('Z', '+00:00')),
                updated_at=datetime.fromisoformat(clone_data["updated_at"].replace('Z', '+00:00')),
                published_at=datetime.fromisoformat(clone_data["published_at"].replace('Z', '+00:00')) if clone_data.get("published_at") else None
            ))
        
        # Calculate pagination info
        pages = (total + limit - 1) // limit
        
        logger.info("Listed user clones from Supabase", 
                   user_id=current_user_id, 
                   total_clones=total)
        
        return CloneListResponse(
            clones=clones,
            total=total,
            page=page,
            limit=limit,
            pages=pages
        )
        
    except Exception as e:
        logger.error("Failed to list user clones from Supabase", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve your clones"
        )


@router.get("/{clone_id}", response_model=CloneResponse)
async def get_clone(
    clone_id: str,
    current_user_id: Optional[str] = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> CloneResponse:
    """
    Get a specific clone by ID
    """
    try:
        result = await db.execute(
            select(Clone).where(Clone.id == clone_id)
        )
        clone = result.scalar_one_or_none()
        
        if not clone:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        # Check if clone is accessible
        # Public published clones are accessible to everyone
        # Draft clones are only accessible to their creators
        if not clone.is_published:
            if not current_user_id or str(clone.creator_id) != current_user_id:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Clone not found"
                )
        
        return CloneResponse.from_orm(clone)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get clone", error=str(e), clone_id=clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve clone"
        )


@router.put("/{clone_id}", response_model=CloneResponse)
async def update_clone(
    clone_id: str,
    clone_data: CloneUpdate,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> CloneResponse:
    """
    Update an existing clone (only by creator)
    """
    try:
        result = await db.execute(
            select(Clone).where(Clone.id == clone_id)
        )
        clone = result.scalar_one_or_none()
        
        if not clone:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        # Check if user is the creator
        if str(clone.creator_id) != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the creator can update this clone"
            )
        
        # Update fields if provided
        update_dict = clone_data.dict(exclude_unset=True)
        for field, value in update_dict.items():
            if hasattr(clone, field):
                setattr(clone, field, value)
        
        clone.updated_at = datetime.utcnow()
        
        # If publishing for the first time, set published_at
        if clone_data.is_published and not clone.published_at:
            clone.published_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(clone)
        
        logger.info("Clone updated successfully", 
                   clone_id=clone_id, 
                   creator_id=current_user_id)
        
        return CloneResponse.from_orm(clone)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Clone update failed", error=str(e), clone_id=clone_id)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update clone"
        )


@router.delete("/{clone_id}")
async def delete_clone(
    clone_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> dict:
    """
    Delete a clone (only by creator or admin)
    """
    try:
        result = await db.execute(
            select(Clone).where(Clone.id == clone_id)
        )
        clone = result.scalar_one_or_none()
        
        if not clone:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        # Check permissions
        user_result = await db.execute(
            select(UserProfile).where(UserProfile.id == current_user_id)
        )
        user = user_result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Allow creator or admin to delete
        if str(clone.creator_id) != current_user_id and user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the creator or admin can delete this clone"
            )
        
        # Check if clone has active sessions
        active_sessions = await db.execute(
            select(func.count(Session.id)).where(
                and_(
                    Session.clone_id == clone_id,
                    Session.status == "active"
                )
            )
        )
        active_count = active_sessions.scalar()
        
        if active_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete clone with active sessions"
            )
        
        # Soft delete by deactivating
        clone.is_active = False
        clone.is_published = False
        clone.updated_at = datetime.utcnow()
        
        await db.commit()
        
        logger.info("Clone deleted successfully", 
                   clone_id=clone_id, 
                   deleted_by=current_user_id)
        
        return {"message": "Clone deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Clone deletion failed", error=str(e), clone_id=clone_id)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete clone"
        )


@router.post("/{clone_id}/publish")
async def publish_clone(
    clone_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> dict:
    """
    Publish a clone to make it publicly available
    """
    try:
        result = await db.execute(
            select(Clone).where(Clone.id == clone_id)
        )
        clone = result.scalar_one_or_none()
        
        if not clone:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        # Check if user is the creator
        if str(clone.creator_id) != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the creator can publish this clone"
            )
        
        # Validate clone has required fields for publishing
        if not clone.name or not clone.description or not clone.category:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Clone must have name, description, and category to be published"
            )
        
        # Publish the clone
        clone.is_published = True
        if not clone.published_at:
            clone.published_at = datetime.utcnow()
        clone.updated_at = datetime.utcnow()
        
        await db.commit()
        
        logger.info("Clone published successfully", 
                   clone_id=clone_id, 
                   creator_id=current_user_id)
        
        return {"message": "Clone published successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Clone publishing failed", error=str(e), clone_id=clone_id)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to publish clone"
        )


@router.post("/{clone_id}/unpublish")
async def unpublish_clone(
    clone_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> dict:
    """
    Unpublish a clone to make it private/draft
    """
    try:
        result = await db.execute(
            select(Clone).where(Clone.id == clone_id)
        )
        clone = result.scalar_one_or_none()
        
        if not clone:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        # Check if user is the creator
        if str(clone.creator_id) != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the creator can unpublish this clone"
            )
        
        # Check if clone has active sessions
        active_sessions = await db.execute(
            select(func.count(Session.id)).where(
                and_(
                    Session.clone_id == clone_id,
                    Session.status == "active"
                )
            )
        )
        active_count = active_sessions.scalar()
        
        if active_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot unpublish clone with active sessions"
            )
        
        # Unpublish the clone
        clone.is_published = False
        clone.updated_at = datetime.utcnow()
        
        await db.commit()
        
        logger.info("Clone unpublished successfully", 
                   clone_id=clone_id, 
                   creator_id=current_user_id)
        
        return {"message": "Clone unpublished successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Clone unpublishing failed", error=str(e), clone_id=clone_id)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to unpublish clone"
        )


@router.get("/{clone_id}/stats")
async def get_clone_stats(
    clone_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> dict:
    """
    Get statistics for a clone (only by creator)
    """
    try:
        result = await db.execute(
            select(Clone).where(Clone.id == clone_id)
        )
        clone = result.scalar_one_or_none()
        
        if not clone:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        # Check if user is the creator
        if str(clone.creator_id) != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the creator can view clone statistics"
            )
        
        # Get session statistics
        session_stats = await db.execute(
            select(
                func.count(Session.id).label("total_sessions"),
                func.sum(Session.duration_minutes).label("total_minutes"),
                func.sum(Session.total_cost).label("total_earnings"),
                func.avg(Session.user_rating).label("avg_rating")
            ).where(Session.clone_id == clone_id)
        )
        stats = session_stats.first()
        
        return {
            "total_sessions": stats.total_sessions or 0,
            "total_duration_minutes": stats.total_minutes or 0,
            "total_earnings": float(stats.total_earnings or 0),
            "average_rating": float(stats.avg_rating or 0),
            "is_published": clone.is_published,
            "created_at": clone.created_at,
            "published_at": clone.published_at
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get clone stats", error=str(e), clone_id=clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve clone statistics"
        )