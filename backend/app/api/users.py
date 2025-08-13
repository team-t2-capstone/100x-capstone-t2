from app.core.supabase_auth import get_current_user_id, require_role

"""
User Profile APIs for CloneAI - Extended user profile management
"""
import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

from fastapi import (
    APIRouter, Depends, HTTPException, status, UploadFile, 
    File, Query, BackgroundTasks
)
# Import AsyncSession for type annotations only
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from app.core.security import get_current_user_id
from app.database import get_supabase, get_db_session
from app.models.schemas import (
    UserProfile as UserProfileSchema, UserUpdate, 
    UserAnalytics as UserAnalyticsSchema
)
from app.config import settings

logger = structlog.get_logger()
router = APIRouter(prefix="/users", tags=["User Profile"])


@router.get("/profile", response_model=UserProfileSchema)
async def get_extended_profile(
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> UserProfileSchema:
    """
    Get extended user profile information
    """
    try:
        result = await db.execute(
            select(UserProfile).where(UserProfile.id == current_user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found"
            )
        
        return UserProfileSchema.from_orm(user)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get user profile", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user profile"
        )


@router.put("/preferences")
async def update_preferences(
    preferences: Dict[str, Any],
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, str]:
    """
    Update user preferences
    """
    try:
        result = await db.execute(
            select(UserProfile).where(UserProfile.id == current_user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Update preferences
        user.preferences = preferences
        user.updated_at = datetime.utcnow()
        
        await db.commit()
        
        logger.info("User preferences updated", user_id=current_user_id)
        
        return {"message": "Preferences updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to update preferences", error=str(e), user_id=current_user_id)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update preferences"
        )


@router.put("/settings")
async def update_settings(
    timezone: Optional[str] = None,
    language: Optional[str] = None,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, str]:
    """
    Update user settings (timezone, language, etc.)
    """
    try:
        result = await db.execute(
            select(UserProfile).where(UserProfile.id == current_user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Update settings
        if timezone:
            user.timezone = timezone
        if language:
            user.language = language
        
        user.updated_at = datetime.utcnow()
        await db.commit()
        
        logger.info("User settings updated", user_id=current_user_id)
        
        return {"message": "Settings updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to update settings", error=str(e), user_id=current_user_id)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update settings"
        )


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session),
    supabase = Depends(get_supabase)
) -> Dict[str, str]:
    """
    Upload user avatar image
    """
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No file provided"
            )
        
        # Check file type
        allowed_types = {'image/jpeg', 'image/png', 'image/gif', 'image/webp'}
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only image files are allowed (JPEG, PNG, GIF, WebP)"
            )
        
        # Check file size (max 5MB)
        max_size = 5 * 1024 * 1024  # 5MB
        file_content = await file.read()
        if len(file_content) > max_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File size must be less than 5MB"
            )
        
        # Generate unique filename
        file_extension = file.filename.split('.')[-1].lower()
        unique_filename = f"avatars/{current_user_id}/{uuid.uuid4()}.{file_extension}"
        
        # Upload to Supabase Storage
        try:
            storage_response = supabase.storage.from_("avatars").upload(
                unique_filename,
                file_content,
                file_options={
                    "content-type": file.content_type,
                    "upsert": True  # Replace if exists
                }
            )
            
            if hasattr(storage_response, 'error') and storage_response.error:
                raise Exception(f"Storage upload failed: {storage_response.error}")
            
            # Get public URL
            avatar_url = supabase.storage.from_("avatars").get_public_url(unique_filename)
            
        except Exception as e:
            logger.error("Avatar upload to storage failed", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to upload avatar"
            )
        
        # Update user profile
        result = await db.execute(
            select(UserProfile).where(UserProfile.id == current_user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user.avatar_url = avatar_url
        user.updated_at = datetime.utcnow()
        await db.commit()
        
        logger.info("Avatar uploaded successfully", user_id=current_user_id)
        
        return {
            "message": "Avatar uploaded successfully",
            "avatar_url": avatar_url
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Avatar upload failed", error=str(e), user_id=current_user_id)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload avatar"
        )
    finally:
        await file.seek(0)


@router.get("/activity")
async def get_user_activity(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    activity_type: Optional[str] = Query(None, description="Filter by activity type"),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """
    Get user's recent activity history
    """
    try:
        # Get user's sessions
        sessions_query = select(Session).options(
            selectinload(Session.clone)
        ).where(Session.user_id == current_user_id).order_by(desc(Session.created_at))
        
        if activity_type == "active":
            sessions_query = sessions_query.where(Session.status == "active")
        elif activity_type == "completed":
            sessions_query = sessions_query.where(Session.status == "ended")
        
        # Apply pagination
        offset = (page - 1) * limit
        sessions_query = sessions_query.offset(offset).limit(limit)
        
        result = await db.execute(sessions_query)
        sessions = result.scalars().all()
        
        # Format activity data
        activities = []
        for session in sessions:
            activities.append({
                "id": str(session.id),
                "type": "session",
                "action": f"Started {session.session_type} session",
                "clone_name": session.clone.name if session.clone else "Unknown",
                "clone_id": str(session.clone_id),
                "status": session.status,
                "duration_minutes": session.duration_minutes,
                "cost": float(session.total_cost),
                "created_at": session.created_at
            })
        
        # Get total count for pagination
        count_result = await db.execute(
            select(func.count(Session.id)).where(Session.user_id == current_user_id)
        )
        total_count = count_result.scalar()
        
        return {
            "activities": activities,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count,
                "pages": (total_count + limit - 1) // limit
            }
        }
        
    except Exception as e:
        logger.error("Failed to get user activity", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve activity history"
        )


@router.get("/subscription")
async def get_subscription_info(
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """
    Get user's subscription and billing information
    """
    try:
        result = await db.execute(
            select(UserProfile).where(UserProfile.id == current_user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Calculate usage stats
        usage_stats = await db.execute(
            select(
                func.count(Session.id).label("total_sessions"),
                func.sum(Session.duration_minutes).label("total_minutes"),
                func.sum(Session.total_cost).label("total_spent")
            ).where(Session.user_id == current_user_id)
        )
        stats = usage_stats.first()
        
        return {
            "subscription": {
                "tier": user.subscription_tier,
                "credits_remaining": user.credits_remaining,
                "total_spent": float(user.total_spent),
                "created_at": user.created_at
            },
            "usage": {
                "total_sessions": stats.total_sessions or 0,
                "total_minutes": stats.total_minutes or 0,
                "total_spent": float(stats.total_spent or 0)
            },
            "limits": {
                "free_tier": {
                    "max_sessions_per_month": 10,
                    "max_minutes_per_session": 30,
                    "available_features": ["basic_chat", "public_clones"]
                },
                "pro_tier": {
                    "max_sessions_per_month": 100,
                    "max_minutes_per_session": 120,
                    "available_features": ["advanced_chat", "private_clones", "document_upload", "priority_support"]
                },
                "enterprise_tier": {
                    "max_sessions_per_month": -1,  # Unlimited
                    "max_minutes_per_session": -1,  # Unlimited
                    "available_features": ["all_features", "custom_integrations", "dedicated_support"]
                }
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get subscription info", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve subscription information"
        )


@router.get("/analytics", response_model=UserAnalyticsSchema)
async def get_user_analytics(
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> UserAnalyticsSchema:
    """
    Get user analytics and usage statistics
    """
    try:
        # Calculate date range
        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=days)
        
        # Get sessions in date range
        sessions_result = await db.execute(
            select(
                func.count(Session.id).label("total_sessions"),
                func.sum(Session.duration_minutes).label("total_duration_minutes"),
                func.sum(Session.total_cost).label("total_spent"),
                func.avg(Session.user_rating).label("average_rating")
            ).where(
                and_(
                    Session.user_id == current_user_id,
                    func.date(Session.created_at) >= start_date,
                    func.date(Session.created_at) <= end_date
                )
            )
        )
        session_stats = sessions_result.first()
        
        # Get favorite experts (most used clones)
        favorite_experts_result = await db.execute(
            select(
                Clone.id,
                Clone.name,
                Clone.category,
                func.count(Session.id).label("session_count"),
                func.avg(Session.user_rating).label("avg_rating")
            ).select_from(
                Session.join(Clone, Session.clone_id == Clone.id)
            ).where(
                and_(
                    Session.user_id == current_user_id,
                    func.date(Session.created_at) >= start_date,
                    func.date(Session.created_at) <= end_date
                )
            ).group_by(Clone.id, Clone.name, Clone.category).order_by(
                desc(func.count(Session.id))
            ).limit(5)
        )
        favorite_experts_data = favorite_experts_result.fetchall()
        
        # Get category breakdown
        category_result = await db.execute(
            select(
                Clone.category,
                func.count(Session.id).label("session_count")
            ).select_from(
                Session.join(Clone, Session.clone_id == Clone.id)
            ).where(
                and_(
                    Session.user_id == current_user_id,
                    func.date(Session.created_at) >= start_date,
                    func.date(Session.created_at) <= end_date
                )
            ).group_by(Clone.category)
        )
        category_data = category_result.fetchall()
        
        # Format response
        favorite_experts = [
            {
                "id": str(expert.id),
                "name": expert.name,
                "category": expert.category,
                "session_count": expert.session_count,
                "average_rating": float(expert.avg_rating or 0)
            }
            for expert in favorite_experts_data
        ]
        
        category_breakdown = {
            category.category: category.session_count
            for category in category_data
        }
        
        return UserAnalyticsSchema(
            total_sessions=session_stats.total_sessions or 0,
            total_duration_minutes=session_stats.total_duration_minutes or 0,
            total_spent=float(session_stats.total_spent or 0),
            average_rating=float(session_stats.average_rating or 0),
            favorite_experts=favorite_experts,
            category_breakdown=category_breakdown
        )
        
    except Exception as e:
        logger.error("Failed to get user analytics", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve analytics"
        )


@router.delete("/account")
async def delete_user_account(
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, str]:
    """
    Permanently delete user account (GDPR compliance)
    """
    try:
        result = await db.execute(
            select(UserProfile).where(UserProfile.id == current_user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Check for active sessions
        active_sessions = await db.execute(
            select(func.count(Session.id)).where(
                and_(
                    Session.user_id == current_user_id,
                    Session.status == "active"
                )
            )
        )
        active_count = active_sessions.scalar()
        
        if active_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete account with active sessions. Please end all sessions first."
            )
        
        # Soft delete by deactivating (for GDPR, we may need to anonymize data)
        user.is_active = False
        user.email = f"deleted_user_{uuid.uuid4()}@deleted.com"
        user.full_name = "Deleted User"
        user.avatar_url = None
        user.preferences = {}
        user.updated_at = datetime.utcnow()
        
        await db.commit()
        
        logger.info("User account deleted", user_id=current_user_id)
        
        return {"message": "Account deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to delete account", error=str(e), user_id=current_user_id)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete account"
        )


@router.get("/export")
async def export_user_data(
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """
    Export all user data (GDPR compliance)
    """
    try:
        # Get user profile
        user_result = await db.execute(
            select(UserProfile).where(UserProfile.id == current_user_id)
        )
        user = user_result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Get user's clones
        clones_result = await db.execute(
            select(Clone).where(Clone.creator_id == current_user_id)
        )
        clones = clones_result.scalars().all()
        
        # Get user's sessions
        sessions_result = await db.execute(
            select(Session).options(selectinload(Session.clone)).where(Session.user_id == current_user_id)
        )
        sessions = sessions_result.scalars().all()
        
        # Format export data
        export_data = {
            "profile": {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role,
                "timezone": user.timezone,
                "language": user.language,
                "subscription_tier": user.subscription_tier,
                "created_at": user.created_at.isoformat(),
                "preferences": user.preferences
            },
            "clones": [
                {
                    "id": str(clone.id),
                    "name": clone.name,
                    "description": clone.description,
                    "category": clone.category,
                    "created_at": clone.created_at.isoformat(),
                    "is_published": clone.is_published
                }
                for clone in clones
            ],
            "sessions": [
                {
                    "id": str(session.id),
                    "clone_name": session.clone.name if session.clone else "Unknown",
                    "session_type": session.session_type,
                    "duration_minutes": session.duration_minutes,
                    "total_cost": float(session.total_cost),
                    "created_at": session.created_at.isoformat(),
                    "status": session.status
                }
                for session in sessions
            ],
            "export_info": {
                "exported_at": datetime.utcnow().isoformat(),
                "format_version": "1.0"
            }
        }
        
        return export_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to export user data", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to export user data"
        )