from app.core.supabase_auth import get_current_user_id, require_role

"""
Expert Discovery APIs for CloneAI - Public clone search and discovery
"""
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc, asc, text
from sqlalchemy.orm import selectinload
import structlog

from app.core.security import get_current_user_id
from app.database import get_db_session
from app.models.database import Clone, UserProfile, Session
from app.models.schemas import CloneResponse, PaginationInfo
from app.config import settings

logger = structlog.get_logger()
router = APIRouter(prefix="/discovery", tags=["Expert Discovery"])


@router.get("/experts", response_model=Dict[str, Any])
async def search_experts(
    # Search parameters
    q: Optional[str] = Query(None, description="Search query for expert names, descriptions, or expertise"),
    category: Optional[str] = Query(None, description="Filter by category"),
    expertise: Optional[str] = Query(None, description="Filter by expertise area"),
    language: Optional[str] = Query(None, description="Filter by supported language"),
    
    # Price filtering
    price_min: Optional[float] = Query(None, ge=0, description="Minimum price per minute"),
    price_max: Optional[float] = Query(None, ge=0, description="Maximum price per minute"),
    
    # Quality filtering
    rating_min: Optional[float] = Query(None, ge=0, le=5, description="Minimum average rating"),
    min_sessions: Optional[int] = Query(None, ge=0, description="Minimum number of sessions"),
    
    # Sorting
    sort_by: str = Query("popularity", regex="^(popularity|rating|price_low|price_high|newest|alphabetical)$"),
    
    # Pagination
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    
    # Optional user context (for personalization)
    current_user_id: Optional[str] = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """
    Search and discover published expert clones with advanced filtering
    """
    try:
        # Base query for published and active clones
        query = select(Clone).options(
            selectinload(Clone.creator)
        ).where(
            and_(
                Clone.is_published == True,
                Clone.is_active == True
            )
        )
        
        # Text search across multiple fields
        if q:
            search_filter = or_(
                Clone.name.ilike(f"%{q}%"),
                Clone.description.ilike(f"%{q}%"),
                Clone.bio.ilike(f"%{q}%"),
                func.array_to_string(Clone.expertise_areas, ' ').ilike(f"%{q}%")
            )
            query = query.where(search_filter)
        
        # Category filter
        if category:
            query = query.where(Clone.category == category)
        
        # Expertise filter
        if expertise:
            query = query.where(func.array_to_string(Clone.expertise_areas, ' ').ilike(f"%{expertise}%"))
        
        # Language filter
        if language:
            query = query.where(func.array_to_string(Clone.languages, ' ').ilike(f"%{language}%"))
        
        # Price range filter
        if price_min is not None:
            query = query.where(Clone.base_price >= price_min)
        if price_max is not None:
            query = query.where(Clone.base_price <= price_max)
        
        # Quality filters
        if rating_min is not None:
            query = query.where(Clone.average_rating >= rating_min)
        if min_sessions is not None:
            query = query.where(Clone.total_sessions >= min_sessions)
        
        # Apply sorting
        if sort_by == "popularity":
            query = query.order_by(desc(Clone.total_sessions), desc(Clone.average_rating))
        elif sort_by == "rating":
            query = query.order_by(desc(Clone.average_rating), desc(Clone.total_sessions))
        elif sort_by == "price_low":
            query = query.order_by(asc(Clone.base_price))
        elif sort_by == "price_high":
            query = query.order_by(desc(Clone.base_price))
        elif sort_by == "newest":
            query = query.order_by(desc(Clone.published_at))
        elif sort_by == "alphabetical":
            query = query.order_by(asc(Clone.name))
        
        # Get total count for pagination
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar()
        
        # Apply pagination
        offset = (page - 1) * limit
        query = query.offset(offset).limit(limit)
        
        # Execute query
        result = await db.execute(query)
        clones = result.scalars().all()
        
        # Format results with additional discovery info
        experts = []
        for clone in clones:
            expert_data = {
                "id": str(clone.id),
                "name": clone.name,
                "description": clone.description,
                "category": clone.category,
                "expertise_areas": clone.expertise_areas,
                "languages": clone.languages,
                "avatar_url": clone.avatar_url,
                "base_price": float(clone.base_price),
                "currency": clone.currency,
                "average_rating": float(clone.average_rating),
                "total_sessions": clone.total_sessions,
                "total_ratings": clone.total_ratings,
                "created_at": clone.created_at,
                "published_at": clone.published_at,
                "creator": {
                    "id": str(clone.creator.id),
                    "full_name": clone.creator.full_name,
                    "avatar_url": clone.creator.avatar_url
                } if clone.creator else None,
                "popularity_score": calculate_popularity_score(clone),
                "is_featured": clone.total_sessions > 50 and clone.average_rating > 4.0,
                "is_trending": is_clone_trending(clone)
            }
            experts.append(expert_data)
        
        # Calculate pagination info
        pages = (total + limit - 1) // limit
        
        return {
            "experts": experts,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "pages": pages,
                "has_next": page < pages,
                "has_prev": page > 1
            },
            "filters_applied": {
                "search_query": q,
                "category": category,
                "expertise": expertise,
                "language": language,
                "price_range": {"min": price_min, "max": price_max},
                "rating_min": rating_min,
                "min_sessions": min_sessions,
                "sort_by": sort_by
            },
            "search_metadata": {
                "total_results": total,
                "search_time_ms": 0,  # Would be calculated in production
                "suggested_filters": await get_suggested_filters(db, q, category)
            }
        }
        
    except Exception as e:
        logger.error("Expert search failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search experts"
        )


@router.get("/experts/{expert_id}", response_model=Dict[str, Any])
async def get_expert_details(
    expert_id: str,
    current_user_id: Optional[str] = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """
    Get detailed information about a specific expert (public view)
    """
    try:
        result = await db.execute(
            select(Clone).options(
                selectinload(Clone.creator)
            ).where(
                and_(
                    Clone.id == expert_id,
                    Clone.is_published == True,
                    Clone.is_active == True
                )
            )
        )
        clone = result.scalar_one_or_none()
        
        if not clone:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Expert not found or not available"
            )
        
        # Get recent session stats
        recent_stats = await db.execute(
            select(
                func.count(Session.id).label("recent_sessions"),
                func.avg(Session.user_rating).label("recent_rating")
            ).where(
                and_(
                    Session.clone_id == expert_id,
                    Session.created_at >= datetime.utcnow() - timedelta(days=30)
                )
            )
        )
        stats = recent_stats.first()
        
        # Get sample reviews (anonymized)
        reviews_result = await db.execute(
            select(
                Session.user_rating,
                Session.user_feedback,
                Session.created_at
            ).where(
                and_(
                    Session.clone_id == expert_id,
                    Session.user_rating.isnot(None),
                    Session.user_feedback.isnot(None)
                )
            ).order_by(desc(Session.created_at)).limit(5)
        )
        reviews_data = reviews_result.fetchall()
        
        # Format response
        expert_details = {
            "id": str(clone.id),
            "name": clone.name,
            "description": clone.description,
            "bio": clone.bio,
            "category": clone.category,
            "expertise_areas": clone.expertise_areas,
            "languages": clone.languages,
            "avatar_url": clone.avatar_url,
            "pricing": {
                "base_price": float(clone.base_price),
                "currency": clone.currency
            },
            "performance": {
                "average_rating": float(clone.average_rating),
                "total_sessions": clone.total_sessions,
                "total_ratings": clone.total_ratings,
                "recent_sessions_30d": stats.recent_sessions or 0,
                "recent_rating_30d": float(stats.recent_rating or 0),
                "popularity_score": calculate_popularity_score(clone),
                "response_time": "< 30 seconds",  # Would be calculated from actual data
                "availability": "24/7"
            },
            "creator": {
                "id": str(clone.creator.id),
                "full_name": clone.creator.full_name,
                "avatar_url": clone.creator.avatar_url,
                "member_since": clone.creator.created_at
            } if clone.creator else None,
            "ai_configuration": {
                "personality_traits": clone.personality_traits,
                "communication_style": clone.communication_style,
                "temperature": float(clone.temperature or 0.7),
                "max_response_length": clone.max_tokens or 1000
            },
            "reviews": [
                {
                    "rating": review.user_rating,
                    "feedback": review.user_feedback[:200] + "..." if len(review.user_feedback) > 200 else review.user_feedback,
                    "date": review.created_at,
                    "user": "Anonymous"  # Privacy protection
                }
                for review in reviews_data
            ],
            "metadata": {
                "created_at": clone.created_at,
                "published_at": clone.published_at,
                "last_updated": clone.updated_at,
                "is_featured": clone.total_sessions > 50 and clone.average_rating > 4.0,
                "is_trending": is_clone_trending(clone),
                "tags": ["ai", "expert", clone.category] + (clone.expertise_areas or [])
            }
        }
        
        return expert_details
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get expert details", error=str(e), expert_id=expert_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve expert details"
        )


@router.get("/categories", response_model=Dict[str, Any])
async def get_categories(
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """
    Get all available categories with expert counts
    """
    try:
        # Get categories with counts
        result = await db.execute(
            select(
                Clone.category,
                func.count(Clone.id).label("expert_count"),
                func.avg(Clone.average_rating).label("avg_rating"),
                func.avg(Clone.base_price).label("avg_price")
            ).where(
                and_(Clone.is_published == True, Clone.is_active == True)
            ).group_by(Clone.category).order_by(desc(func.count(Clone.id)))
        )
        categories_data = result.fetchall()
        
        # Format categories
        categories = []
        for cat in categories_data:
            categories.append({
                "category": cat.category,
                "expert_count": cat.expert_count,
                "average_rating": float(cat.avg_rating or 0),
                "average_price": float(cat.avg_price or 0),
                "description": get_category_description(cat.category)
            })
        
        return {
            "categories": categories,
            "total_categories": len(categories),
            "metadata": {
                "updated_at": datetime.utcnow(),
                "total_experts": sum(cat["expert_count"] for cat in categories)
            }
        }
        
    except Exception as e:
        logger.error("Failed to get categories", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve categories"
        )


@router.get("/featured", response_model=Dict[str, Any])
async def get_featured_experts(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """
    Get featured experts (high-performing, popular experts)
    """
    try:
        # Featured criteria: high rating + many sessions + recent activity
        query = select(Clone).options(
            selectinload(Clone.creator)
        ).where(
            and_(
                Clone.is_published == True,
                Clone.is_active == True,
                Clone.average_rating >= 4.0,
                Clone.total_sessions >= 10
            )
        ).order_by(
            desc(Clone.average_rating * Clone.total_sessions)  # Composite score
        ).limit(limit)
        
        result = await db.execute(query)
        clones = result.scalars().all()
        
        # Format featured experts
        featured_experts = []
        for clone in clones:
            featured_experts.append({
                "id": str(clone.id),
                "name": clone.name,
                "description": clone.description,
                "category": clone.category,
                "avatar_url": clone.avatar_url,
                "base_price": float(clone.base_price),
                "average_rating": float(clone.average_rating),
                "total_sessions": clone.total_sessions,
                "expertise_areas": clone.expertise_areas[:3],  # Top 3 only
                "creator_name": clone.creator.full_name if clone.creator else "Unknown",
                "featured_reason": determine_featured_reason(clone)
            })
        
        return {
            "featured_experts": featured_experts,
            "count": len(featured_experts),
            "criteria": {
                "min_rating": 4.0,
                "min_sessions": 10,
                "sort_by": "performance_score"
            },
            "updated_at": datetime.utcnow()
        }
        
    except Exception as e:
        logger.error("Failed to get featured experts", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve featured experts"
        )


@router.get("/trending", response_model=Dict[str, Any])
async def get_trending_experts(
    days: int = Query(7, ge=1, le=30, description="Number of days to analyze for trending"),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """
    Get trending experts (recently popular or growing in popularity)
    """
    try:
        # Calculate trending based on recent session growth
        since_date = datetime.utcnow() - timedelta(days=days)
        
        # Get experts with recent activity
        trending_query = select(
            Clone,
            func.count(Session.id).label("recent_sessions")
        ).options(
            selectinload(Clone.creator)
        ).outerjoin(
            Session, and_(
                Session.clone_id == Clone.id,
                Session.created_at >= since_date
            )
        ).where(
            and_(
                Clone.is_published == True,
                Clone.is_active == True
            )
        ).group_by(Clone.id).having(
            func.count(Session.id) > 0
        ).order_by(
            desc(func.count(Session.id))
        ).limit(limit)
        
        result = await db.execute(trending_query)
        trending_data = result.fetchall()
        
        # Format trending experts
        trending_experts = []
        for clone, recent_sessions in trending_data:
            growth_rate = calculate_growth_rate(clone, days)
            trending_experts.append({
                "id": str(clone.id),
                "name": clone.name,
                "description": clone.description,
                "category": clone.category,
                "avatar_url": clone.avatar_url,
                "base_price": float(clone.base_price),
                "average_rating": float(clone.average_rating),
                "recent_sessions": recent_sessions,
                "growth_rate": growth_rate,
                "trending_score": recent_sessions * (1 + growth_rate),
                "expertise_areas": clone.expertise_areas[:2],
                "creator_name": clone.creator.full_name if clone.creator else "Unknown"
            })
        
        return {
            "trending_experts": trending_experts,
            "count": len(trending_experts),
            "analysis_period": f"{days} days",
            "criteria": {
                "min_recent_sessions": 1,
                "sort_by": "recent_activity"
            },
            "updated_at": datetime.utcnow()
        }
        
    except Exception as e:
        logger.error("Failed to get trending experts", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve trending experts"
        )


@router.get("/recommendations", response_model=Dict[str, Any])
async def get_personalized_recommendations(
    limit: int = Query(10, ge=1, le=20),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """
    Get personalized expert recommendations based on user's history
    """
    try:
        # Get user's session history to understand preferences
        user_sessions = await db.execute(
            select(Session).options(
                selectinload(Session.clone)
            ).where(Session.user_id == current_user_id).limit(20)
        )
        sessions = user_sessions.scalars().all()
        
        if not sessions:
            # No history - return featured experts
            return await get_featured_experts(limit, db)
        
        # Analyze user preferences
        user_categories = {}
        user_avg_price = 0
        total_sessions = len(sessions)
        
        for session in sessions:
            if session.clone and session.clone.category:
                category = session.clone.category
                user_categories[category] = user_categories.get(category, 0) + 1
                user_avg_price += session.clone.base_price
        
        user_avg_price = user_avg_price / total_sessions if total_sessions > 0 else 0
        preferred_categories = sorted(user_categories.keys(), key=user_categories.get, reverse=True)
        
        # Find similar experts
        recommendations_query = select(Clone).options(
            selectinload(Clone.creator)
        ).where(
            and_(
                Clone.is_published == True,
                Clone.is_active == True,
                Clone.category.in_(preferred_categories[:3]) if preferred_categories else True,
                Clone.base_price <= user_avg_price * 1.5  # Within 150% of user's typical spending
            )
        ).order_by(
            desc(Clone.average_rating),
            desc(Clone.total_sessions)
        ).limit(limit * 2)  # Get more to filter out already used
        
        result = await db.execute(recommendations_query)
        potential_clones = result.scalars().all()
        
        # Filter out experts user has already used
        used_clone_ids = {str(session.clone_id) for session in sessions if session.clone_id}
        recommended_clones = [
            clone for clone in potential_clones 
            if str(clone.id) not in used_clone_ids
        ][:limit]
        
        # Format recommendations
        recommendations = []
        for clone in recommended_clones:
            match_reasons = []
            if clone.category in preferred_categories:
                match_reasons.append(f"You've enjoyed {clone.category} experts")
            if abs(clone.base_price - user_avg_price) < user_avg_price * 0.3:
                match_reasons.append("Within your typical price range")
            if clone.average_rating >= 4.0:
                match_reasons.append("Highly rated by users like you")
            
            recommendations.append({
                "id": str(clone.id),
                "name": clone.name,
                "description": clone.description,
                "category": clone.category,
                "avatar_url": clone.avatar_url,
                "base_price": float(clone.base_price),
                "average_rating": float(clone.average_rating),
                "total_sessions": clone.total_sessions,
                "match_score": calculate_match_score(clone, user_categories, user_avg_price),
                "match_reasons": match_reasons,
                "creator_name": clone.creator.full_name if clone.creator else "Unknown"
            })
        
        return {
            "recommendations": recommendations,
            "count": len(recommendations),
            "personalization": {
                "based_on_sessions": total_sessions,
                "preferred_categories": preferred_categories[:3],
                "average_price_range": user_avg_price,
                "recommendation_algorithm": "collaborative_filtering"
            },
            "generated_at": datetime.utcnow()
        }
        
    except Exception as e:
        logger.error("Failed to get recommendations", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate recommendations"
        )


# Helper functions
def calculate_popularity_score(clone: Clone) -> float:
    """Calculate popularity score based on sessions, ratings, and recency"""
    base_score = clone.total_sessions * 0.1
    rating_bonus = (clone.average_rating - 3.0) * 20 if clone.average_rating > 3.0 else 0
    recency_bonus = 10 if clone.published_at and clone.published_at > datetime.utcnow() - timedelta(days=30) else 0
    return min(100.0, base_score + rating_bonus + recency_bonus)


def is_clone_trending(clone: Clone) -> bool:
    """Determine if a clone is trending (simplified logic)"""
    if not clone.published_at:
        return False
    
    # Consider trending if published recently and has good engagement
    is_recent = clone.published_at > datetime.utcnow() - timedelta(days=30)
    has_engagement = clone.total_sessions > 5 and clone.average_rating > 3.5
    
    return is_recent and has_engagement


async def get_suggested_filters(db: AsyncSession, query: str, category: str) -> Dict[str, List[str]]:
    """Get suggested filters based on search context"""
    suggestions = {
        "categories": [],
        "expertise_areas": [],
        "price_ranges": ["$0-5", "$5-15", "$15-30", "$30+"]
    }
    
    try:
        # Get popular categories
        if not category:
            result = await db.execute(
                select(Clone.category, func.count(Clone.id).label("count"))
                .where(and_(Clone.is_published == True, Clone.is_active == True))
                .group_by(Clone.category)
                .order_by(desc(func.count(Clone.id)))
                .limit(5)
            )
            suggestions["categories"] = [row.category for row in result.fetchall()]
        
        # Get popular expertise areas
        expertise_result = await db.execute(
            select(func.unnest(Clone.expertise_areas).label("expertise"))
            .where(and_(Clone.is_published == True, Clone.is_active == True))
        )
        all_expertise = [row.expertise for row in expertise_result.fetchall()]
        expertise_counts = {}
        for exp in all_expertise:
            expertise_counts[exp] = expertise_counts.get(exp, 0) + 1
        
        suggestions["expertise_areas"] = sorted(expertise_counts.keys(), key=expertise_counts.get, reverse=True)[:10]
        
    except Exception as e:
        logger.warning("Failed to get suggested filters", error=str(e))
    
    return suggestions


def get_category_description(category: str) -> str:
    """Get description for a category"""
    descriptions = {
        "business": "Business strategy, entrepreneurship, and professional development experts",
        "tech": "Technology, programming, and software development specialists",
        "finance": "Financial planning, investment, and economic advisory experts",
        "health": "Health, wellness, and medical guidance professionals",
        "legal": "Legal advice, compliance, and regulatory experts",
        "education": "Learning, teaching, and educational development specialists"
    }
    return descriptions.get(category, f"Experts specializing in {category}")


def determine_featured_reason(clone: Clone) -> str:
    """Determine why an expert is featured"""
    if clone.average_rating >= 4.8:
        return "Exceptional rating"
    elif clone.total_sessions >= 100:
        return "Highly experienced"
    elif clone.published_at and clone.published_at > datetime.utcnow() - timedelta(days=14):
        return "Rising star"
    else:
        return "Consistently excellent"


def calculate_growth_rate(clone: Clone, days: int) -> float:
    """Calculate growth rate (simplified - would need historical data in production)"""
    # Simplified calculation - in production would compare recent vs historical session counts
    if clone.total_sessions <= 10:
        return 0.5  # New experts get moderate growth score
    elif clone.average_rating > 4.5:
        return 0.8  # High-rated experts likely growing
    else:
        return 0.2  # Stable growth


def calculate_match_score(clone: Clone, user_categories: Dict[str, int], user_avg_price: float) -> float:
    """Calculate how well an expert matches user preferences"""
    score = 0.0
    
    # Category match
    if clone.category in user_categories:
        score += 0.4 * (user_categories[clone.category] / sum(user_categories.values()))
    
    # Price match
    price_diff = abs(clone.base_price - user_avg_price) / max(user_avg_price, 1)
    score += 0.3 * (1 - min(price_diff, 1))
    
    # Quality score
    score += 0.3 * (clone.average_rating / 5.0)
    
    return min(1.0, score)