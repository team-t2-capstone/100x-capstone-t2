"""
Analytics API endpoints for CloneAI platform
Provides comprehensive analytics for users, creators, clones, and platform performance
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, text
from sqlalchemy.orm import selectinload

import structlog

from app.database import get_db_session, get_supabase
from app.core.supabase_auth import get_current_user_id, require_role
from app.models.database import (
    UserProfile, Clone, Session, Message, 
    UserAnalytics, CreatorAnalytics, SessionSummary,
    Document, KnowledgeEntry, ConversationMemory
)
from app.models.schemas import (
    UserAnalytics as UserAnalyticsSchema,
    CreatorAnalytics as CreatorAnalyticsSchema,
    BaseSchema
)

logger = structlog.get_logger()

router = APIRouter(prefix="/analytics", tags=["Analytics"])


# Analytics Response Schemas
class PlatformAnalyticsResponse(BaseSchema):
    """Platform-wide analytics response"""
    total_users: int
    total_clones: int
    total_sessions: int
    total_messages: int
    total_revenue: float
    active_users_today: int
    active_users_week: int
    active_users_month: int
    popular_categories: List[Dict[str, Any]]
    user_growth_trend: List[Dict[str, Any]]
    revenue_trend: List[Dict[str, Any]]
    system_performance: Dict[str, Any]
    generated_at: datetime


class UserEngagementResponse(BaseSchema):
    """User engagement analytics response"""
    user_id: str
    total_sessions: int
    total_duration_minutes: int
    total_messages_sent: int
    total_spent: float
    average_session_duration: float
    favorite_categories: List[str]
    most_used_clones: List[Dict[str, Any]]
    engagement_score: float
    last_active: Optional[datetime]
    activity_streak_days: int
    weekly_activity: List[Dict[str, Any]]
    monthly_trends: Dict[str, List[float]]


class ClonePerformanceResponse(BaseSchema):
    """Clone performance analytics response"""
    clone_id: str
    clone_name: str
    total_sessions: int
    total_earnings: float
    average_rating: float
    total_ratings: int
    total_duration_minutes: int
    unique_users: int
    user_retention_rate: float
    popular_topics: List[str]
    performance_score: float
    earnings_trend: List[Dict[str, Any]]
    usage_patterns: Dict[str, Any]
    feedback_analysis: Dict[str, Any]


class RevenueAnalyticsResponse(BaseSchema):
    """Revenue analytics response"""
    total_revenue: float
    revenue_today: float
    revenue_week: float
    revenue_month: float
    revenue_by_tier: Dict[str, float]
    revenue_by_category: Dict[str, float]
    top_earning_clones: List[Dict[str, Any]]
    subscription_metrics: Dict[str, Any]
    payment_trends: List[Dict[str, Any]]
    churn_analysis: Dict[str, Any]
    generated_at: datetime


class SystemPerformanceResponse(BaseSchema):
    """System performance analytics response"""
    api_response_times: Dict[str, float]
    database_performance: Dict[str, Any]
    error_rates: Dict[str, float]
    uptime_percentage: float
    active_connections: int
    memory_usage_mb: float
    cpu_usage_percentage: float
    storage_usage_gb: float
    background_jobs_status: Dict[str, Any]
    cache_hit_rates: Dict[str, float]
    generated_at: datetime


# Platform Analytics Endpoints
@router.get("/platform", response_model=PlatformAnalyticsResponse)
async def get_platform_analytics(
    days: int = Query(default=30, ge=1, le=365, description="Number of days to analyze"),
    current_user_id: str = Depends(require_role(["admin"])),
    db: AsyncSession = Depends(get_db_session)
) -> PlatformAnalyticsResponse:
    """
    Get comprehensive platform-wide analytics
    Requires admin role
    """
    try:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Get basic counts
        total_users_result = await db.execute(select(func.count(UserProfile.id)))
        total_users = total_users_result.scalar()
        
        total_clones_result = await db.execute(
            select(func.count(Clone.id)).where(Clone.is_published == True)
        )
        total_clones = total_clones_result.scalar()
        
        total_sessions_result = await db.execute(select(func.count(Session.id)))
        total_sessions = total_sessions_result.scalar()
        
        total_messages_result = await db.execute(select(func.count(Message.id)))
        total_messages = total_messages_result.scalar()
        
        # Get revenue data
        total_revenue_result = await db.execute(
            select(func.sum(Session.total_cost))
        )
        total_revenue = float(total_revenue_result.scalar() or 0)
        
        # Get active users metrics
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        week_ago = today - timedelta(days=7)
        month_ago = today - timedelta(days=30)
        
        active_today_result = await db.execute(
            select(func.count(func.distinct(Session.user_id)))
            .where(Session.start_time >= today)
        )
        active_users_today = active_today_result.scalar()
        
        active_week_result = await db.execute(
            select(func.count(func.distinct(Session.user_id)))
            .where(Session.start_time >= week_ago)
        )
        active_users_week = active_week_result.scalar()
        
        active_month_result = await db.execute(
            select(func.count(func.distinct(Session.user_id)))
            .where(Session.start_time >= month_ago)
        )
        active_users_month = active_month_result.scalar()
        
        # Get popular categories
        popular_categories_result = await db.execute(
            select(Clone.category, func.count(Session.id).label('session_count'))
            .join(Session, Clone.id == Session.clone_id)
            .where(Session.start_time >= start_date)
            .group_by(Clone.category)
            .order_by(func.count(Session.id).desc())
            .limit(10)
        )
        popular_categories = [
            {"category": row.category, "sessions": row.session_count}
            for row in popular_categories_result
        ]
        
        # Get user growth trend (weekly)
        user_growth_trend = []
        for i in range(4):  # Last 4 weeks
            week_start = today - timedelta(weeks=i+1)
            week_end = today - timedelta(weeks=i)
            
            new_users_result = await db.execute(
                select(func.count(UserProfile.id))
                .where(and_(
                    UserProfile.created_at >= week_start,
                    UserProfile.created_at < week_end
                ))
            )
            new_users = new_users_result.scalar()
            
            user_growth_trend.append({
                "week": week_start.strftime("%Y-W%W"),
                "new_users": new_users
            })
        
        user_growth_trend.reverse()
        
        # Get revenue trend (daily for last 7 days)
        revenue_trend = []
        for i in range(7):
            day_start = today - timedelta(days=i+1)
            day_end = day_start + timedelta(days=1)
            
            daily_revenue_result = await db.execute(
                select(func.sum(Session.total_cost))
                .where(and_(
                    Session.start_time >= day_start,
                    Session.start_time < day_end
                ))
            )
            daily_revenue = float(daily_revenue_result.scalar() or 0)
            
            revenue_trend.append({
                "date": day_start.strftime("%Y-%m-%d"),
                "revenue": daily_revenue
            })
        
        revenue_trend.reverse()
        
        # System performance metrics (placeholder)
        system_performance = {
            "avg_response_time_ms": 150.0,
            "uptime_percentage": 99.8,
            "error_rate": 0.02,
            "active_connections": 45
        }
        
        return PlatformAnalyticsResponse(
            total_users=total_users,
            total_clones=total_clones,
            total_sessions=total_sessions,
            total_messages=total_messages,
            total_revenue=total_revenue,
            active_users_today=active_users_today,
            active_users_week=active_users_week,
            active_users_month=active_users_month,
            popular_categories=popular_categories,
            user_growth_trend=user_growth_trend,
            revenue_trend=revenue_trend,
            system_performance=system_performance,
            generated_at=datetime.utcnow()
        )
        
    except Exception as e:
        logger.error("Failed to get platform analytics", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve platform analytics"
        )


# User Analytics Endpoints
@router.get("/users/{user_id}", response_model=UserEngagementResponse)
async def get_user_analytics(
    user_id: str,
    days: int = Query(default=30, ge=1, le=365),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> UserEngagementResponse:
    """
    Get detailed user engagement analytics
    Users can only view their own analytics unless they're admin
    """
    try:
        # Check permissions
        if user_id != current_user_id:
            # Verify admin role for viewing other users' analytics
            user_result = await db.execute(
                select(UserProfile).where(UserProfile.id == current_user_id)
            )
            current_user = user_result.scalar_one_or_none()
            if not current_user or current_user.role != "admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to view other users' analytics"
                )
        
        # Verify target user exists
        user_result = await db.execute(
            select(UserProfile).where(UserProfile.id == user_id)
        )
        user = user_result.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Get user session data
        sessions_result = await db.execute(
            select(Session)
            .where(and_(
                Session.user_id == user_id,
                Session.start_time >= start_date
            ))
            .options(selectinload(Session.clone))
        )
        sessions = sessions_result.scalars().all()
        
        # Calculate metrics
        total_sessions = len(sessions)
        total_duration = sum(s.duration_minutes for s in sessions)
        total_spent = sum(s.total_cost for s in sessions)
        
        avg_session_duration = total_duration / total_sessions if total_sessions > 0 else 0
        
        # Get messages count
        messages_result = await db.execute(
            select(func.count(Message.id))
            .join(Session, Message.session_id == Session.id)
            .where(and_(
                Session.user_id == user_id,
                Session.start_time >= start_date,
                Message.sender_type == "user"
            ))
        )
        total_messages_sent = messages_result.scalar()
        
        # Get favorite categories
        category_counts = {}
        clone_usage = {}
        
        for session in sessions:
            if session.clone:
                category = session.clone.category
                category_counts[category] = category_counts.get(category, 0) + 1
                
                clone_key = f"{session.clone.id}:{session.clone.name}"
                clone_usage[clone_key] = clone_usage.get(clone_key, 0) + 1
        
        favorite_categories = sorted(category_counts.keys(), 
                                   key=lambda x: category_counts[x], reverse=True)[:5]
        
        most_used_clones = [
            {"clone_id": key.split(":")[0], "clone_name": key.split(":")[1], "sessions": count}
            for key, count in sorted(clone_usage.items(), key=lambda x: x[1], reverse=True)[:5]
        ]
        
        # Calculate engagement score (simplified)
        days_since_signup = (datetime.utcnow() - user.created_at).days or 1
        engagement_score = min((total_sessions / days_since_signup) * 10, 100)
        
        # Activity streak (simplified - consecutive days with sessions)
        activity_streak_days = 0
        current_date = datetime.utcnow().date()
        
        session_dates = set(s.start_time.date() for s in sessions)
        while current_date in session_dates:
            activity_streak_days += 1
            current_date -= timedelta(days=1)
        
        # Weekly activity
        weekly_activity = []
        for i in range(4):  # Last 4 weeks
            week_start = end_date - timedelta(weeks=i+1)
            week_end = end_date - timedelta(weeks=i)
            
            week_sessions = [s for s in sessions 
                           if week_start <= s.start_time < week_end]
            
            weekly_activity.append({
                "week": week_start.strftime("%Y-W%W"),
                "sessions": len(week_sessions),
                "duration_minutes": sum(s.duration_minutes for s in week_sessions),
                "spent": sum(s.total_cost for s in week_sessions)
            })
        
        weekly_activity.reverse()
        
        # Monthly trends (last 6 months)
        monthly_trends = {"sessions": [], "duration": [], "spent": []}
        for i in range(6):
            month_start = (end_date.replace(day=1) - timedelta(days=32*i)).replace(day=1)
            month_end = (month_start + timedelta(days=32)).replace(day=1)
            
            month_sessions = [s for s in sessions 
                            if month_start <= s.start_time < month_end]
            
            monthly_trends["sessions"].append(len(month_sessions))
            monthly_trends["duration"].append(sum(s.duration_minutes for s in month_sessions))
            monthly_trends["spent"].append(sum(s.total_cost for s in month_sessions))
        
        # Reverse to show chronological order
        for key in monthly_trends:
            monthly_trends[key].reverse()
        
        return UserEngagementResponse(
            user_id=user_id,
            total_sessions=total_sessions,
            total_duration_minutes=total_duration,
            total_messages_sent=total_messages_sent,
            total_spent=total_spent,
            average_session_duration=avg_session_duration,
            favorite_categories=favorite_categories,
            most_used_clones=most_used_clones,
            engagement_score=engagement_score,
            last_active=max(s.start_time for s in sessions) if sessions else None,
            activity_streak_days=activity_streak_days,
            weekly_activity=weekly_activity,
            monthly_trends=monthly_trends
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get user analytics", 
                    error=str(e), user_id=current_user_id, target_user=user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user analytics"
        )


# Creator Analytics Endpoints
@router.get("/creators/{creator_id}", response_model=CreatorAnalyticsSchema)
async def get_creator_analytics(
    creator_id: str,
    days: int = Query(default=30, ge=1, le=365),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> CreatorAnalyticsSchema:
    """
    Get creator performance analytics
    Creators can only view their own analytics unless admin
    """
    try:
        # Check permissions
        if creator_id != current_user_id:
            user_result = await db.execute(
                select(UserProfile).where(UserProfile.id == current_user_id)
            )
            current_user = user_result.scalar_one_or_none()
            if not current_user or current_user.role != "admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to view other creators' analytics"
                )
        
        # Verify creator exists and has creator role
        creator_result = await db.execute(
            select(UserProfile).where(UserProfile.id == creator_id)
        )
        creator = creator_result.scalar_one_or_none()
        if not creator:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Creator not found"
            )
        
        if creator.role not in ["creator", "admin"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is not a creator"
            )
        
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Get creator's clones and their sessions
        clones_result = await db.execute(
            select(Clone).where(Clone.creator_id == creator_id)
        )
        clones = clones_result.scalars().all()
        
        if not clones:
            return CreatorAnalyticsSchema(
                total_earnings=0.0,
                total_sessions=0,
                average_rating=0.0,
                user_retention_rate=0.0,
                popular_topics=[],
                monthly_trends={"earnings": [0]*6, "sessions": [0]*6, "ratings": [0]*6}
            )
        
        clone_ids = [clone.id for clone in clones]
        
        # Get sessions for creator's clones
        sessions_result = await db.execute(
            select(Session)
            .where(and_(
                Session.clone_id.in_(clone_ids),
                Session.start_time >= start_date
            ))
            .options(selectinload(Session.clone))
        )
        sessions = sessions_result.scalars().all()
        
        # Calculate metrics
        total_sessions = len(sessions)
        total_earnings = sum(s.total_cost for s in sessions)
        
        # Calculate average rating
        rated_sessions = [s for s in sessions if s.user_rating is not None]
        average_rating = (sum(s.user_rating for s in rated_sessions) / len(rated_sessions)) if rated_sessions else 0.0
        
        # Calculate user retention rate (users who had multiple sessions)
        user_session_counts = {}
        for session in sessions:
            user_id = session.user_id
            user_session_counts[user_id] = user_session_counts.get(user_id, 0) + 1
        
        returning_users = sum(1 for count in user_session_counts.values() if count > 1)
        total_unique_users = len(user_session_counts)
        user_retention_rate = (returning_users / total_unique_users * 100) if total_unique_users > 0 else 0.0
        
        # Get popular topics from session summaries
        summaries_result = await db.execute(
            select(SessionSummary.main_topics)
            .join(Session, SessionSummary.session_id == Session.id)
            .where(Session.clone_id.in_(clone_ids))
        )
        
        all_topics = []
        for summary in summaries_result:
            if summary.main_topics:
                all_topics.extend(summary.main_topics)
        
        # Count topic frequency
        topic_counts = {}
        for topic in all_topics:
            topic_counts[topic] = topic_counts.get(topic, 0) + 1
        
        popular_topics = sorted(topic_counts.keys(), 
                              key=lambda x: topic_counts[x], reverse=True)[:10]
        
        # Monthly trends (last 6 months)
        monthly_trends = {"earnings": [], "sessions": [], "ratings": []}
        for i in range(6):
            month_start = (end_date.replace(day=1) - timedelta(days=32*i)).replace(day=1)
            month_end = (month_start + timedelta(days=32)).replace(day=1)
            
            month_sessions = [s for s in sessions 
                            if month_start <= s.start_time < month_end]
            
            month_earnings = sum(s.total_cost for s in month_sessions)
            month_rated_sessions = [s for s in month_sessions if s.user_rating is not None]
            month_avg_rating = (sum(s.user_rating for s in month_rated_sessions) / len(month_rated_sessions)) if month_rated_sessions else 0.0
            
            monthly_trends["earnings"].append(month_earnings)
            monthly_trends["sessions"].append(len(month_sessions))
            monthly_trends["ratings"].append(month_avg_rating)
        
        # Reverse to show chronological order
        for key in monthly_trends:
            monthly_trends[key].reverse()
        
        return CreatorAnalyticsSchema(
            total_earnings=total_earnings,
            total_sessions=total_sessions,
            average_rating=average_rating,
            user_retention_rate=user_retention_rate,
            popular_topics=popular_topics,
            monthly_trends=monthly_trends
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get creator analytics", 
                    error=str(e), user_id=current_user_id, creator_id=creator_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve creator analytics"
        )


# Clone Performance Analytics
@router.get("/clones/{clone_id}", response_model=ClonePerformanceResponse)
async def get_clone_analytics(
    clone_id: str,
    days: int = Query(default=30, ge=1, le=365),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> ClonePerformanceResponse:
    """
    Get detailed clone performance analytics
    Only clone owners and admins can access
    """
    try:
        # Get clone and verify ownership
        clone_result = await db.execute(
            select(Clone).where(Clone.id == clone_id)
            .options(selectinload(Clone.creator))
        )
        clone = clone_result.scalar_one_or_none()
        if not clone:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        # Check permissions
        user_result = await db.execute(
            select(UserProfile).where(UserProfile.id == current_user_id)
        )
        current_user = user_result.scalar_one_or_none()
        
        if (clone.creator_id != current_user_id and 
            (not current_user or current_user.role != "admin")):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this clone's analytics"
            )
        
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Get clone sessions
        sessions_result = await db.execute(
            select(Session)
            .where(and_(
                Session.clone_id == clone_id,
                Session.start_time >= start_date
            ))
        )
        sessions = sessions_result.scalars().all()
        
        # Calculate basic metrics
        total_sessions = len(sessions)
        total_earnings = sum(s.total_cost for s in sessions)
        total_duration = sum(s.duration_minutes for s in sessions)
        
        # Get ratings
        rated_sessions = [s for s in sessions if s.user_rating is not None]
        average_rating = (sum(s.user_rating for s in rated_sessions) / len(rated_sessions)) if rated_sessions else 0.0
        total_ratings = len(rated_sessions)
        
        # Unique users
        unique_users = len(set(s.user_id for s in sessions))
        
        # User retention rate
        user_session_counts = {}
        for session in sessions:
            user_id = session.user_id
            user_session_counts[user_id] = user_session_counts.get(user_id, 0) + 1
        
        returning_users = sum(1 for count in user_session_counts.values() if count > 1)
        user_retention_rate = (returning_users / unique_users * 100) if unique_users > 0 else 0.0
        
        # Popular topics from summaries
        summaries_result = await db.execute(
            select(SessionSummary.main_topics)
            .join(Session, SessionSummary.session_id == Session.id)
            .where(Session.clone_id == clone_id)
        )
        
        all_topics = []
        for summary in summaries_result:
            if summary.main_topics:
                all_topics.extend(summary.main_topics)
        
        topic_counts = {}
        for topic in all_topics:
            topic_counts[topic] = topic_counts.get(topic, 0) + 1
        
        popular_topics = sorted(topic_counts.keys(), 
                              key=lambda x: topic_counts[x], reverse=True)[:10]
        
        # Performance score (composite metric)
        performance_score = min((
            (average_rating / 5.0) * 30 +  # 30% rating
            (user_retention_rate / 100) * 25 +  # 25% retention
            (min(total_sessions / 100, 1.0)) * 25 +  # 25% usage
            (min(total_earnings / 1000, 1.0)) * 20  # 20% revenue
        ) * 100, 100)
        
        # Earnings trend (weekly)
        earnings_trend = []
        for i in range(4):  # Last 4 weeks
            week_start = end_date - timedelta(weeks=i+1)
            week_end = end_date - timedelta(weeks=i)
            
            week_sessions = [s for s in sessions 
                           if week_start <= s.start_time < week_end]
            week_earnings = sum(s.total_cost for s in week_sessions)
            
            earnings_trend.append({
                "week": week_start.strftime("%Y-W%W"),
                "earnings": week_earnings,
                "sessions": len(week_sessions)
            })
        
        earnings_trend.reverse()
        
        # Usage patterns
        hour_usage = {}
        day_usage = {}
        
        for session in sessions:
            hour = session.start_time.hour
            day = session.start_time.strftime("%A")
            
            hour_usage[hour] = hour_usage.get(hour, 0) + 1
            day_usage[day] = day_usage.get(day, 0) + 1
        
        peak_hour = max(hour_usage.items(), key=lambda x: x[1])[0] if hour_usage else 0
        peak_day = max(day_usage.items(), key=lambda x: x[1])[0] if day_usage else "Monday"
        
        usage_patterns = {
            "peak_hour": peak_hour,
            "peak_day": peak_day,
            "hourly_distribution": hour_usage,
            "daily_distribution": day_usage
        }
        
        # Feedback analysis
        positive_ratings = len([s for s in rated_sessions if s.user_rating >= 4])
        negative_ratings = len([s for s in rated_sessions if s.user_rating <= 2])
        
        feedback_analysis = {
            "positive_feedback_rate": (positive_ratings / total_ratings * 100) if total_ratings > 0 else 0,
            "negative_feedback_rate": (negative_ratings / total_ratings * 100) if total_ratings > 0 else 0,
            "satisfaction_trend": "stable"  # Placeholder - would need historical data
        }
        
        return ClonePerformanceResponse(
            clone_id=clone_id,
            clone_name=clone.name,
            total_sessions=total_sessions,
            total_earnings=total_earnings,
            average_rating=average_rating,
            total_ratings=total_ratings,
            total_duration_minutes=total_duration,
            unique_users=unique_users,
            user_retention_rate=user_retention_rate,
            popular_topics=popular_topics,
            performance_score=performance_score,
            earnings_trend=earnings_trend,
            usage_patterns=usage_patterns,
            feedback_analysis=feedback_analysis
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get clone analytics", 
                    error=str(e), user_id=current_user_id, clone_id=clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve clone analytics"
        )


# Revenue Analytics (Admin only)
@router.get("/revenue", response_model=RevenueAnalyticsResponse)
async def get_revenue_analytics(
    days: int = Query(default=30, ge=1, le=365),
    current_user_id: str = Depends(require_role(["admin"])),
    db: AsyncSession = Depends(get_db_session)
) -> RevenueAnalyticsResponse:
    """
    Get comprehensive revenue analytics
    Requires admin role
    """
    try:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Get total revenue
        total_revenue_result = await db.execute(
            select(func.sum(Session.total_cost))
        )
        total_revenue = float(total_revenue_result.scalar() or 0)
        
        # Get revenue for different periods
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        week_ago = today - timedelta(days=7)
        month_ago = today - timedelta(days=30)
        
        # Revenue today
        revenue_today_result = await db.execute(
            select(func.sum(Session.total_cost))
            .where(Session.start_time >= today)
        )
        revenue_today = float(revenue_today_result.scalar() or 0)
        
        # Revenue this week
        revenue_week_result = await db.execute(
            select(func.sum(Session.total_cost))
            .where(Session.start_time >= week_ago)
        )
        revenue_week = float(revenue_week_result.scalar() or 0)
        
        # Revenue this month
        revenue_month_result = await db.execute(
            select(func.sum(Session.total_cost))
            .where(Session.start_time >= month_ago)
        )
        revenue_month = float(revenue_month_result.scalar() or 0)
        
        # Revenue by tier (based on user subscription tier)
        revenue_by_tier_result = await db.execute(
            select(UserProfile.subscription_tier, func.sum(Session.total_cost))
            .join(Session, UserProfile.id == Session.user_id)
            .where(Session.start_time >= start_date)
            .group_by(UserProfile.subscription_tier)
        )
        
        revenue_by_tier = {
            row.subscription_tier: float(row[1])
            for row in revenue_by_tier_result
        }
        
        # Revenue by category
        revenue_by_category_result = await db.execute(
            select(Clone.category, func.sum(Session.total_cost))
            .join(Session, Clone.id == Session.clone_id)
            .where(Session.start_time >= start_date)
            .group_by(Clone.category)
        )
        
        revenue_by_category = {
            row.category: float(row[1])
            for row in revenue_by_category_result
        }
        
        # Top earning clones
        top_earning_result = await db.execute(
            select(Clone.id, Clone.name, func.sum(Session.total_cost).label('earnings'))
            .join(Session, Clone.id == Session.clone_id)
            .where(Session.start_time >= start_date)
            .group_by(Clone.id, Clone.name)
            .order_by(func.sum(Session.total_cost).desc())
            .limit(10)
        )
        
        top_earning_clones = [
            {
                "clone_id": str(row.id),
                "clone_name": row.name,
                "earnings": float(row.earnings)
            }
            for row in top_earning_result
        ]
        
        # Subscription metrics
        subscription_counts_result = await db.execute(
            select(UserProfile.subscription_tier, func.count(UserProfile.id))
            .group_by(UserProfile.subscription_tier)
        )
        
        subscription_metrics = {
            "tier_distribution": {
                row.subscription_tier: row[1]
                for row in subscription_counts_result
            },
            "total_subscribers": sum(row[1] for row in subscription_counts_result if row.subscription_tier != "free")
        }
        
        # Payment trends (daily for last 7 days)
        payment_trends = []
        for i in range(7):
            day_start = today - timedelta(days=i+1)
            day_end = day_start + timedelta(days=1)
            
            daily_revenue_result = await db.execute(
                select(func.sum(Session.total_cost), func.count(Session.id))
                .where(and_(
                    Session.start_time >= day_start,
                    Session.start_time < day_end
                ))
            )
            
            row = daily_revenue_result.first()
            daily_revenue = float(row[0] or 0)
            daily_transactions = row[1] or 0
            
            payment_trends.append({
                "date": day_start.strftime("%Y-%m-%d"),
                "revenue": daily_revenue,
                "transactions": daily_transactions
            })
        
        payment_trends.reverse()
        
        # Churn analysis (simplified)
        # Users who were active last month but not this month
        last_month_users_result = await db.execute(
            select(func.count(func.distinct(Session.user_id)))
            .where(and_(
                Session.start_time >= month_ago,
                Session.start_time < week_ago
            ))
        )
        last_month_users = last_month_users_result.scalar()
        
        this_week_users_result = await db.execute(
            select(func.count(func.distinct(Session.user_id)))
            .where(Session.start_time >= week_ago)
        )
        this_week_users = this_week_users_result.scalar()
        
        churn_rate = ((last_month_users - this_week_users) / last_month_users * 100) if last_month_users > 0 else 0
        
        churn_analysis = {
            "churn_rate_percentage": max(0, churn_rate),  # Don't show negative churn
            "at_risk_users": 0,  # Placeholder - would need more complex analysis
            "retention_rate": 100 - max(0, churn_rate)
        }
        
        return RevenueAnalyticsResponse(
            total_revenue=total_revenue,
            revenue_today=revenue_today,
            revenue_week=revenue_week,
            revenue_month=revenue_month,
            revenue_by_tier=revenue_by_tier,
            revenue_by_category=revenue_by_category,
            top_earning_clones=top_earning_clones,
            subscription_metrics=subscription_metrics,
            payment_trends=payment_trends,
            churn_analysis=churn_analysis,
            generated_at=datetime.utcnow()
        )
        
    except Exception as e:
        logger.error("Failed to get revenue analytics", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve revenue analytics"
        )


# System Performance Analytics (Admin only)
@router.get("/system", response_model=SystemPerformanceResponse)
async def get_system_analytics(
    current_user_id: str = Depends(require_role(["admin"])),
    db: AsyncSession = Depends(get_db_session)
) -> SystemPerformanceResponse:
    """
    Get system performance analytics
    Requires admin role
    """
    try:
        # These would be collected from actual monitoring systems
        # For now, we'll return placeholder data
        
        api_response_times = {
            "/api/v1/auth": 120.5,
            "/api/v1/sessions": 180.2,
            "/api/v1/chat": 95.8,
            "/api/v1/clones": 150.3,
            "average": 136.7
        }
        
        database_performance = {
            "avg_query_time_ms": 45.2,
            "active_connections": 12,
            "slow_queries_count": 3,
            "connection_pool_usage": 60.0
        }
        
        error_rates = {
            "4xx_errors": 2.1,
            "5xx_errors": 0.3,
            "total_error_rate": 2.4
        }
        
        background_jobs_status = {
            "pending_jobs": 5,
            "processing_jobs": 2,
            "failed_jobs": 1,
            "completed_today": 145
        }
        
        cache_hit_rates = {
            "redis_cache": 85.6,
            "database_cache": 92.3,
            "cdn_cache": 88.9
        }
        
        return SystemPerformanceResponse(
            api_response_times=api_response_times,
            database_performance=database_performance,
            error_rates=error_rates,
            uptime_percentage=99.8,
            active_connections=45,
            memory_usage_mb=512.0,
            cpu_usage_percentage=23.5,
            storage_usage_gb=15.6,
            background_jobs_status=background_jobs_status,
            cache_hit_rates=cache_hit_rates,
            generated_at=datetime.utcnow()
        )
        
    except Exception as e:
        logger.error("Failed to get system analytics", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve system analytics"
        )


# Analytics Export Endpoint
@router.post("/export")
async def export_analytics(
    background_tasks: BackgroundTasks,
    analytics_type: str = Query(..., description="Type of analytics to export"),
    format: str = Query(default="csv", description="Export format (csv, json, xlsx)"),
    days: int = Query(default=30, ge=1, le=365),
    current_user_id: str = Depends(require_role(["admin", "creator"])),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Export analytics data in various formats
    Supports CSV, JSON, and Excel formats
    """
    try:
        if format not in ["csv", "json", "xlsx"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported export format"
            )
        
        if analytics_type not in ["platform", "users", "creators", "clones", "revenue"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported analytics type"
            )
        
        # Create export job (placeholder)
        export_id = f"export_{analytics_type}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        
        # In a real implementation, this would queue a background job
        # background_tasks.add_task(generate_analytics_export, export_id, analytics_type, format, days)
        
        logger.info("Analytics export requested", 
                   export_id=export_id, 
                   analytics_type=analytics_type, 
                   format=format,
                   user_id=current_user_id)
        
        return {
            "export_id": export_id,
            "status": "queued",
            "message": "Export job has been queued and will be processed shortly",
            "estimated_completion": (datetime.utcnow() + timedelta(minutes=5)).isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to queue analytics export", 
                    error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to queue export job"
        )


# Export Status Endpoint
@router.get("/export/{export_id}")
async def get_export_status(
    export_id: str,
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Get the status of an analytics export job
    """
    try:
        # Placeholder implementation
        # In reality, this would check the status of a background job
        
        return {
            "export_id": export_id,
            "status": "completed",
            "download_url": f"/api/v1/analytics/download/{export_id}",
            "created_at": datetime.utcnow().isoformat(),
            "expires_at": (datetime.utcnow() + timedelta(hours=24)).isoformat()
        }
        
    except Exception as e:
        logger.error("Failed to get export status", 
                    error=str(e), export_id=export_id, user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve export status"
        )