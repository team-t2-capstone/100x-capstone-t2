from app.core.supabase_auth import get_current_user_id, require_role

"""
Memory Management APIs for CloneAI - Advanced memory and context management
"""
import uuid
import asyncio
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

from fastapi import (
    APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc, asc, text, delete, update
from sqlalchemy.orm import selectinload
import structlog

from app.core.security import get_current_user_id, require_admin
from app.database import get_db_session
from app.models.database import (
    UserMemoryContext, ConversationMemory, CloneLearning, MemoryPolicy,
    MemoryUsageStats, UserProfile, Clone, Session, Message
)
from app.models.schemas import (
    UserMemoryContextCreate, UserMemoryContextUpdate, UserMemoryContextResponse,
    ConversationMemoryCreate, ConversationMemoryUpdate, ConversationMemoryResponse,
    MemorySearchRequest, MemorySearchResult, CloneLearningCreate, CloneLearningUpdate,
    CloneLearningResponse, MemoryPolicyCreate, MemoryPolicyResponse,
    MemoryAnalyticsResponse, MemoryCleanupRequest, MemoryCleanupResponse
)
from app.config import settings

logger = structlog.get_logger()
router = APIRouter(prefix="/memory", tags=["Memory Management"])


# User Memory Context APIs
@router.get("/users/context", response_model=UserMemoryContextResponse)
async def get_user_memory_context(
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> UserMemoryContextResponse:
    """
    Get user's long-term memory context
    """
    try:
        result = await db.execute(
            select(UserMemoryContext).where(UserMemoryContext.user_id == current_user_id)
        )
        context = result.scalar_one_or_none()
        
        if not context:
            # Create default context if none exists
            context = UserMemoryContext(
                user_id=uuid.UUID(current_user_id),
                context_summary="New user - learning preferences",
                key_preferences={},
                communication_patterns={},
                topics_of_interest=[],
                personality_insights={}
            )
            db.add(context)
            await db.commit()
            await db.refresh(context)
        
        return UserMemoryContextResponse.from_orm(context)
        
    except Exception as e:
        logger.error("Failed to get user memory context", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve memory context"
        )


@router.put("/users/context", response_model=UserMemoryContextResponse)
async def update_user_memory_context(
    context_update: UserMemoryContextUpdate,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> UserMemoryContextResponse:
    """
    Update user's memory context
    """
    try:
        result = await db.execute(
            select(UserMemoryContext).where(UserMemoryContext.user_id == current_user_id)
        )
        context = result.scalar_one_or_none()
        
        if not context:
            # Create new context
            context = UserMemoryContext(
                user_id=uuid.UUID(current_user_id),
                context_summary=context_update.context_summary or "",
                key_preferences=context_update.key_preferences or {},
                communication_patterns=context_update.communication_patterns or {},
                topics_of_interest=context_update.topics_of_interest or [],
                personality_insights=context_update.personality_insights or {}
            )
            db.add(context)
        else:
            # Update existing context
            if context_update.context_summary is not None:
                context.context_summary = context_update.context_summary
            if context_update.key_preferences is not None:
                context.key_preferences = context_update.key_preferences
            if context_update.communication_patterns is not None:
                context.communication_patterns = context_update.communication_patterns
            if context_update.topics_of_interest is not None:
                context.topics_of_interest = context_update.topics_of_interest
            if context_update.personality_insights is not None:
                context.personality_insights = context_update.personality_insights
            
            context.context_version += 1
            context.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(context)
        
        logger.info("User memory context updated",
                   user_id=current_user_id,
                   context_version=context.context_version)
        
        return UserMemoryContextResponse.from_orm(context)
        
    except Exception as e:
        logger.error("Failed to update memory context", error=str(e), user_id=current_user_id)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update memory context"
        )


@router.delete("/users/context")
async def clear_user_memory_context(
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, str]:
    """
    Clear user's memory context
    """
    try:
        await db.execute(
            delete(UserMemoryContext).where(UserMemoryContext.user_id == current_user_id)
        )
        await db.commit()
        
        logger.info("User memory context cleared", user_id=current_user_id)
        
        return {"message": "Memory context cleared successfully"}
        
    except Exception as e:
        logger.error("Failed to clear memory context", error=str(e), user_id=current_user_id)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to clear memory context"
        )


# Conversation Memory APIs
@router.post("/conversations", response_model=ConversationMemoryResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation_memory(
    memory_data: ConversationMemoryCreate,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> ConversationMemoryResponse:
    """
    Create a new conversation memory
    """
    try:
        # Verify clone exists and user has access
        clone_result = await db.execute(
            select(Clone).where(Clone.id == memory_data.clone_id)
        )
        clone = clone_result.scalar_one_or_none()
        
        if not clone:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        # Create conversation memory
        memory = ConversationMemory(
            user_id=uuid.UUID(current_user_id),
            clone_id=uuid.UUID(memory_data.clone_id),
            session_id=uuid.UUID(memory_data.session_id) if memory_data.session_id else None,
            memory_summary=memory_data.memory_summary,
            key_points=memory_data.key_points,
            emotional_context=memory_data.emotional_context,
            topics_discussed=memory_data.topics_discussed,
            importance_score=memory_data.importance_score,
            relevance_tags=memory_data.relevance_tags,
            memory_type=memory_data.memory_type
        )
        
        db.add(memory)
        await db.commit()
        await db.refresh(memory)
        
        logger.info("Conversation memory created",
                   memory_id=str(memory.id),
                   user_id=current_user_id,
                   clone_id=memory_data.clone_id)
        
        return ConversationMemoryResponse.from_orm(memory)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to create conversation memory", error=str(e), user_id=current_user_id)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create conversation memory"
        )


@router.get("/conversations", response_model=List[ConversationMemoryResponse])
async def list_conversation_memories(
    clone_id: Optional[str] = Query(None, description="Filter by clone ID"),
    memory_type: Optional[str] = Query(None, description="Filter by memory type"),
    importance_min: Optional[float] = Query(None, ge=0.0, le=1.0, description="Minimum importance score"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> List[ConversationMemoryResponse]:
    """
    List user's conversation memories
    """
    try:
        query = select(ConversationMemory).where(
            ConversationMemory.user_id == current_user_id
        )
        
        if clone_id:
            query = query.where(ConversationMemory.clone_id == clone_id)
        if memory_type:
            query = query.where(ConversationMemory.memory_type == memory_type)
        if importance_min is not None:
            query = query.where(ConversationMemory.importance_score >= importance_min)
        
        query = query.order_by(desc(ConversationMemory.importance_score), desc(ConversationMemory.created_at))
        
        # Apply pagination
        offset = (page - 1) * limit
        query = query.offset(offset).limit(limit)
        
        result = await db.execute(query)
        memories = result.scalars().all()
        
        return [ConversationMemoryResponse.from_orm(memory) for memory in memories]
        
    except Exception as e:
        logger.error("Failed to list conversation memories", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve conversation memories"
        )


@router.post("/search", response_model=List[MemorySearchResult])
async def search_memory(
    search_request: MemorySearchRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> List[MemorySearchResult]:
    """
    Search through user's memories using semantic and text search
    """
    try:
        # Build search query
        query = select(ConversationMemory).options(
            selectinload(ConversationMemory.clone)
        ).where(ConversationMemory.user_id == current_user_id)
        
        # Apply filters
        if search_request.clone_id:
            query = query.where(ConversationMemory.clone_id == search_request.clone_id)
        
        if search_request.memory_types:
            query = query.where(ConversationMemory.memory_type.in_(search_request.memory_types))
        
        query = query.where(ConversationMemory.importance_score >= search_request.importance_threshold)
        
        # Time range filter
        if search_request.time_range_days:
            since_date = datetime.utcnow() - timedelta(days=search_request.time_range_days)
            query = query.where(ConversationMemory.created_at >= since_date)
        
        # Text search (simplified - in production would use vector similarity)
        search_filter = or_(
            ConversationMemory.memory_summary.ilike(f"%{search_request.query}%"),
            func.array_to_string(ConversationMemory.topics_discussed, ' ').ilike(f"%{search_request.query}%"),
            func.array_to_string(ConversationMemory.relevance_tags, ' ').ilike(f"%{search_request.query}%")
        )
        query = query.where(search_filter)
        
        # Order by relevance (importance score for now)
        query = query.order_by(desc(ConversationMemory.importance_score))
        query = query.limit(search_request.max_results)
        
        result = await db.execute(query)
        memories = result.scalars().all()
        
        # Update access counts
        for memory in memories:
            memory.access_count += 1
            memory.last_accessed = datetime.utcnow()
        
        await db.commit()
        
        # Format results
        search_results = []
        for memory in memories:
            search_results.append(MemorySearchResult(
                memory_id=str(memory.id),
                memory_summary=memory.memory_summary,
                relevance_score=memory.importance_score,  # Simplified relevance
                memory_type=memory.memory_type,
                topics_discussed=memory.topics_discussed,
                importance_score=memory.importance_score,
                created_at=memory.created_at,
                clone_name=memory.clone.name if memory.clone else None,
                session_context={
                    "session_id": str(memory.session_id) if memory.session_id else None,
                    "emotional_context": memory.emotional_context,
                    "key_points": memory.key_points
                } if search_request.include_context else None
            ))
        
        logger.info("Memory search performed",
                   query=search_request.query,
                   results_count=len(search_results),
                   user_id=current_user_id)
        
        return search_results
        
    except Exception as e:
        logger.error("Memory search failed", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search memories"
        )


@router.put("/conversations/{memory_id}/importance")
async def update_memory_importance(
    memory_id: str,
    importance_score: float = Query(..., ge=0.0, le=1.0),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, str]:
    """
    Update memory importance score
    """
    try:
        result = await db.execute(
            select(ConversationMemory).where(
                and_(
                    ConversationMemory.id == memory_id,
                    ConversationMemory.user_id == current_user_id
                )
            )
        )
        memory = result.scalar_one_or_none()
        
        if not memory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Memory not found"
            )
        
        memory.importance_score = importance_score
        memory.updated_at = datetime.utcnow()
        
        await db.commit()
        
        logger.info("Memory importance updated",
                   memory_id=memory_id,
                   new_importance=importance_score,
                   user_id=current_user_id)
        
        return {"message": "Memory importance updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to update memory importance", error=str(e), memory_id=memory_id)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update memory importance"
        )


# Clone Learning APIs
@router.get("/clones/{clone_id}/learning", response_model=CloneLearningResponse)
async def get_clone_learning(
    clone_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> CloneLearningResponse:
    """
    Get clone's learned patterns for the current user
    """
    try:
        result = await db.execute(
            select(CloneLearning).where(
                and_(
                    CloneLearning.clone_id == clone_id,
                    CloneLearning.user_id == current_user_id
                )
            )
        )
        learning = result.scalar_one_or_none()
        
        if not learning:
            # Create default learning record
            learning = CloneLearning(
                clone_id=uuid.UUID(clone_id),
                user_id=uuid.UUID(current_user_id),
                learned_preferences={},
                successful_patterns={},
                adaptive_traits={},
                communication_adjustments={}
            )
            db.add(learning)
            await db.commit()
            await db.refresh(learning)
        
        return CloneLearningResponse.from_orm(learning)
        
    except Exception as e:
        logger.error("Failed to get clone learning", error=str(e), clone_id=clone_id, user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve clone learning data"
        )


@router.post("/clones/{clone_id}/learn-from-interaction")
async def learn_from_interaction(
    clone_id: str,
    interaction_data: Dict[str, Any],
    feedback_rating: Optional[float] = Query(None, ge=1.0, le=5.0),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, str]:
    """
    Update clone learning based on user interaction
    """
    try:
        # Get or create learning record
        result = await db.execute(
            select(CloneLearning).where(
                and_(
                    CloneLearning.clone_id == clone_id,
                    CloneLearning.user_id == current_user_id
                )
            )
        )
        learning = result.scalar_one_or_none()
        
        if not learning:
            learning = CloneLearning(
                clone_id=uuid.UUID(clone_id),
                user_id=uuid.UUID(current_user_id)
            )
            db.add(learning)
        
        # Update learning data
        learning.interaction_count += 1
        learning.last_learning_event = datetime.utcnow()
        
        if feedback_rating:
            learning.last_feedback_rating = feedback_rating
            # Update success rate based on feedback
            if feedback_rating >= 4.0:
                positive_interactions = learning.interaction_count * learning.success_rate + 1
                learning.success_rate = positive_interactions / learning.interaction_count
            else:
                positive_interactions = learning.interaction_count * learning.success_rate
                learning.success_rate = positive_interactions / learning.interaction_count
            
            # Update learning confidence
            learning.learning_confidence = min(1.0, learning.interaction_count * 0.02)
        
        # Process interaction data to update patterns
        if "preferred_response_style" in interaction_data:
            learning.learned_preferences["response_style"] = interaction_data["preferred_response_style"]
        
        if "successful_topics" in interaction_data:
            current_topics = learning.successful_patterns.get("topics", [])
            new_topics = interaction_data["successful_topics"]
            learning.successful_patterns["topics"] = list(set(current_topics + new_topics))
        
        if "communication_preferences" in interaction_data:
            learning.communication_adjustments.update(interaction_data["communication_preferences"])
        
        await db.commit()
        
        logger.info("Clone learning updated from interaction",
                   clone_id=clone_id,
                   user_id=current_user_id,
                   interaction_count=learning.interaction_count,
                   success_rate=learning.success_rate)
        
        return {"message": "Clone learning updated from interaction"}
        
    except Exception as e:
        logger.error("Failed to learn from interaction", error=str(e), clone_id=clone_id)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update clone learning"
        )


# Memory Analytics APIs
@router.get("/analytics", response_model=MemoryAnalyticsResponse)
async def get_memory_analytics(
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> MemoryAnalyticsResponse:
    """
    Get memory usage analytics for the user
    """
    try:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Get memory statistics
        memory_stats = await db.execute(
            select(
                func.count(ConversationMemory.id).label("total_memories"),
                func.avg(ConversationMemory.importance_score).label("avg_importance"),
                func.count(ConversationMemory.access_count > 0).label("accessed_memories")
            ).where(
                and_(
                    ConversationMemory.user_id == current_user_id,
                    ConversationMemory.created_at >= start_date
                )
            )
        )
        stats = memory_stats.first()
        
        # Get memories by type
        type_stats = await db.execute(
            select(
                ConversationMemory.memory_type,
                func.count(ConversationMemory.id).label("count")
            ).where(
                and_(
                    ConversationMemory.user_id == current_user_id,
                    ConversationMemory.created_at >= start_date
                )
            ).group_by(ConversationMemory.memory_type)
        )
        memories_by_type = {row.memory_type: row.count for row in type_stats.fetchall()}
        
        # Get trending topics
        topic_stats = await db.execute(
            select(func.unnest(ConversationMemory.topics_discussed).label("topic"))
            .where(
                and_(
                    ConversationMemory.user_id == current_user_id,
                    ConversationMemory.created_at >= start_date
                )
            )
        )
        all_topics = [row.topic for row in topic_stats.fetchall()]
        topic_counts = {}
        for topic in all_topics:
            topic_counts[topic] = topic_counts.get(topic, 0) + 1
        
        trending_topics = sorted(topic_counts.keys(), key=topic_counts.get, reverse=True)[:10]
        
        # Calculate performance metrics
        total_memories = stats.total_memories or 0
        accessed_memories = stats.accessed_memories or 0
        memory_retention_rate = (accessed_memories / total_memories) if total_memories > 0 else 0.0
        
        return MemoryAnalyticsResponse(
            user_id=current_user_id,
            total_memories=total_memories,
            memories_by_type=memories_by_type,
            average_importance_score=float(stats.avg_importance or 0.0),
            memory_retention_rate=memory_retention_rate,
            context_retrieval_frequency=accessed_memories / days if days > 0 else 0.0,
            storage_usage_mb=total_memories * 0.1,  # Estimated
            performance_metrics={
                "search_efficiency": 0.85,
                "context_relevance": 0.78,
                "learning_effectiveness": 0.82
            },
            trending_topics=trending_topics,
            memory_effectiveness_score=(memory_retention_rate + float(stats.avg_importance or 0.0)) / 2,
            generated_at=datetime.utcnow()
        )
        
    except Exception as e:
        logger.error("Failed to get memory analytics", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve memory analytics"
        )


# Memory Management and Cleanup APIs
@router.post("/cleanup", response_model=MemoryCleanupResponse)
async def cleanup_memories(
    cleanup_request: MemoryCleanupRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> MemoryCleanupResponse:
    """
    Clean up old or low-importance memories
    """
    try:
        cleanup_id = str(uuid.uuid4())
        memories_cleaned = 0
        memories_archived = 0
        storage_freed = 0.0
        
        # Apply memory policy if specified
        policy = None
        if cleanup_request.policy_name:
            policy_result = await db.execute(
                select(MemoryPolicy).where(MemoryPolicy.policy_name == cleanup_request.policy_name)
            )
            policy = policy_result.scalar_one_or_none()
        
        # Default cleanup thresholds
        days_threshold = cleanup_request.days_threshold or (policy.retention_days if policy else 90)
        importance_threshold = policy.importance_threshold if policy else 0.2
        
        cleanup_date = datetime.utcnow() - timedelta(days=days_threshold)
        
        # Build cleanup query
        cleanup_conditions = []
        
        if "expired" in cleanup_request.cleanup_types:
            cleanup_conditions.append(ConversationMemory.expires_at < datetime.utcnow())
        
        if "low_importance" in cleanup_request.cleanup_types:
            cleanup_conditions.append(ConversationMemory.importance_score < importance_threshold)
        
        if "old" in cleanup_request.cleanup_types:
            cleanup_conditions.append(ConversationMemory.created_at < cleanup_date)
        
        if not cleanup_conditions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No cleanup types specified"
            )
        
        # Find memories to cleanup
        query = select(ConversationMemory).where(
            and_(
                ConversationMemory.user_id == current_user_id if cleanup_request.user_id is None else cleanup_request.user_id,
                or_(*cleanup_conditions)
            )
        )
        
        result = await db.execute(query)
        memories_to_cleanup = result.scalars().all()
        
        if not cleanup_request.dry_run:
            # Actually perform cleanup
            for memory in memories_to_cleanup:
                # Estimate storage freed (rough calculation)
                storage_freed += len(memory.memory_summary) * 0.001  # KB
                
                if memory.importance_score > 0.4:  # Archive important memories
                    memory.expires_at = datetime.utcnow() + timedelta(days=365)  # Archive for 1 year
                    memories_archived += 1
                else:  # Delete unimportant memories
                    await db.delete(memory)
                    memories_cleaned += 1
            
            await db.commit()
        else:
            # Dry run - just count what would be cleaned
            for memory in memories_to_cleanup:
                storage_freed += len(memory.memory_summary) * 0.001
                if memory.importance_score > 0.4:
                    memories_archived += 1
                else:
                    memories_cleaned += 1
        
        cleanup_summary = {
            "policy_applied": cleanup_request.policy_name,
            "cleanup_types": cleanup_request.cleanup_types,
            "days_threshold": days_threshold,
            "importance_threshold": importance_threshold,
            "dry_run": cleanup_request.dry_run,
            "total_candidates": len(memories_to_cleanup)
        }
        
        logger.info("Memory cleanup completed",
                   cleanup_id=cleanup_id,
                   memories_cleaned=memories_cleaned,
                   memories_archived=memories_archived,
                   dry_run=cleanup_request.dry_run)
        
        return MemoryCleanupResponse(
            cleanup_id=cleanup_id,
            memories_cleaned=memories_cleaned,
            memories_archived=memories_archived,
            storage_freed_mb=round(storage_freed, 2),
            cleanup_summary=cleanup_summary,
            executed_at=datetime.utcnow(),
            next_cleanup_scheduled=datetime.utcnow() + timedelta(days=7) if policy and policy.auto_cleanup_enabled else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Memory cleanup failed", error=str(e))
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cleanup memories"
        )


# Memory Policy APIs (Admin only)
@router.post("/policies", response_model=MemoryPolicyResponse, status_code=status.HTTP_201_CREATED)
async def create_memory_policy(
    policy_data: MemoryPolicyCreate,
    current_user_id: str = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session)
) -> MemoryPolicyResponse:
    """
    Create a new memory management policy (Admin only)
    """
    try:
        policy = MemoryPolicy(**policy_data.dict())
        db.add(policy)
        await db.commit()
        await db.refresh(policy)
        
        logger.info("Memory policy created",
                   policy_name=policy.policy_name,
                   created_by=current_user_id)
        
        return MemoryPolicyResponse.from_orm(policy)
        
    except Exception as e:
        logger.error("Failed to create memory policy", error=str(e))
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create memory policy"
        )


@router.get("/policies", response_model=List[MemoryPolicyResponse])
async def list_memory_policies(
    active_only: bool = Query(True, description="Show only active policies"),
    current_user_id: str = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session)
) -> List[MemoryPolicyResponse]:
    """
    List all memory management policies (Admin only)
    """
    try:
        query = select(MemoryPolicy)
        
        if active_only:
            query = query.where(MemoryPolicy.is_active == True)
        
        query = query.order_by(MemoryPolicy.policy_name)
        
        result = await db.execute(query)
        policies = result.scalars().all()
        
        return [MemoryPolicyResponse.from_orm(policy) for policy in policies]
        
    except Exception as e:
        logger.error("Failed to list memory policies", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve memory policies"
        )


# Background task for automated memory processing
async def process_session_for_memory(session_id: str, db: AsyncSession):
    """
    Background task to extract and store memory from completed sessions
    """
    try:
        # Get session with messages
        session_result = await db.execute(
            select(Session).options(
                selectinload(Session.messages),
                selectinload(Session.clone),
                selectinload(Session.user)
            ).where(Session.id == session_id)
        )
        session = session_result.scalar_one_or_none()
        
        if not session or session.status != "ended":
            return
        
        # Extract key information from messages
        messages = sorted(session.messages, key=lambda m: m.created_at)
        conversation_text = " ".join([msg.content for msg in messages if msg.sender_type == "user"])
        
        # Simple topic extraction (in production, use NLP)
        topics = []
        if "business" in conversation_text.lower():
            topics.append("business")
        if "technology" in conversation_text.lower():
            topics.append("technology")
        if "help" in conversation_text.lower() or "support" in conversation_text.lower():
            topics.append("support")
        
        # Calculate importance based on session metrics
        importance_score = min(1.0, (
            (session.duration_minutes / 60.0) * 0.3 +  # Duration factor
            (session.message_count / 10.0) * 0.3 +     # Message count factor
            (session.user_rating or 3.0) / 5.0 * 0.4   # Rating factor
        ))
        
        # Create conversation memory
        memory = ConversationMemory(
            user_id=session.user_id,
            clone_id=session.clone_id,
            session_id=session.id,
            memory_summary=f"Conversation about {', '.join(topics) or 'general topics'} lasting {session.duration_minutes} minutes",
            key_points=[f"Discussed {topic}" for topic in topics],
            emotional_context={"overall_sentiment": "positive" if (session.user_rating or 3.0) >= 4.0 else "neutral"},
            topics_discussed=topics,
            importance_score=importance_score,
            relevance_tags=topics + ["session_memory"],
            memory_type="conversation"
        )
        
        db.add(memory)
        await db.commit()
        
        logger.info("Session memory processed",
                   session_id=session_id,
                   memory_id=str(memory.id),
                   importance_score=importance_score)
        
    except Exception as e:
        logger.error("Failed to process session memory", error=str(e), session_id=session_id)