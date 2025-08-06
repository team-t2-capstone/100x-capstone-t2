from app.core.supabase_auth import get_current_user_id, require_role

"""
Session Summarization APIs for CloneAI - Advanced AI-powered session summarization
"""
import uuid
import asyncio
import json
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
    SessionSummary, SummaryTemplate, BulkSummarizationJob,
    Session, Message, Clone, UserProfile
)
from app.models.schemas import (
    SessionSummaryCreate, SessionSummaryUpdate, SessionSummaryResponse,
    SummaryTemplateCreate, SummaryTemplateUpdate, SummaryTemplateResponse,
    BulkSummarizationRequest, BulkSummarizationJobResponse,
    SummaryAnalyticsResponse, SummarySearchRequest, SummarySearchResult
)
from app.config import settings

logger = structlog.get_logger()
router = APIRouter(prefix="/summaries", tags=["Session Summarization"])


# Session Summary APIs
@router.post("/generate/{session_id}", response_model=SessionSummaryResponse, status_code=status.HTTP_201_CREATED)
async def generate_session_summary(
    session_id: str,
    summary_request: SessionSummaryCreate,
    background_tasks: BackgroundTasks,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> SessionSummaryResponse:
    """
    Generate AI-powered summary for a session
    """
    try:
        # Verify session exists and user has access
        session_result = await db.execute(
            select(Session).options(
                selectinload(Session.messages),
                selectinload(Session.clone),
                selectinload(Session.user)
            ).where(Session.id == session_id)
        )
        session = session_result.scalar_one_or_none()
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        # Check access permissions
        if str(session.user_id) != current_user_id:
            # Also allow clone creator to generate summaries
            if not session.clone or str(session.clone.creator_id) != current_user_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied"
                )
        
        # Check if session is completed
        if session.status != "ended":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can only summarize completed sessions"
            )
        
        # Check if summary already exists for this type
        existing_summary = await db.execute(
            select(SessionSummary).where(
                and_(
                    SessionSummary.session_id == session_id,
                    SessionSummary.summary_type == summary_request.summary_type
                )
            )
        )
        existing = existing_summary.scalar_one_or_none()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Summary of type '{summary_request.summary_type}' already exists for this session"
            )
        
        # Get template if specified
        template = None
        if summary_request.template_id:
            template_result = await db.execute(
                select(SummaryTemplate).where(SummaryTemplate.id == summary_request.template_id)
            )
            template = template_result.scalar_one_or_none()
            
            if not template:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Summary template not found"
                )
        
        # Start summary generation
        start_time = datetime.utcnow()
        
        # Generate summary using AI (placeholder implementation)
        summary_result = await generate_ai_summary(
            session=session,
            summary_type=summary_request.summary_type,
            template=template,
            custom_prompt=summary_request.custom_prompt,
            include_emotional_analysis=summary_request.include_emotional_analysis,
            max_length=summary_request.max_length
        )
        
        processing_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        
        # Create summary record
        summary = SessionSummary(
            session_id=uuid.UUID(session_id),
            summary_text=summary_result["summary_text"],
            key_insights=summary_result["key_insights"],
            action_items=summary_result["action_items"],
            recommendations=summary_result["recommendations"],
            next_session_topics=summary_result["next_session_topics"],
            emotional_tone=summary_result.get("emotional_tone"),
            main_topics=summary_result["main_topics"],
            user_satisfaction_indicators=summary_result.get("satisfaction_indicators", {}),
            learning_outcomes=summary_result.get("learning_outcomes", []),
            conversation_quality_score=summary_result.get("quality_score", 0.0),
            summary_type=summary_request.summary_type,
            confidence_score=summary_result.get("confidence_score", 0.8),
            template_id=uuid.UUID(summary_request.template_id) if summary_request.template_id else None,
            word_count=len(summary_result["summary_text"].split()),
            processing_time_ms=processing_time,
            ai_model_used=summary_result.get("model_used", "gpt-3.5-turbo"),
            prompt_version="v1.0"
        )
        
        db.add(summary)
        await db.commit()
        await db.refresh(summary)
        
        # Store in conversation memory for future reference
        background_tasks.add_task(
            store_summary_in_memory,
            session_id,
            summary.id,
            db
        )
        
        logger.info("Session summary generated",
                   session_id=session_id,
                   summary_id=str(summary.id),
                   summary_type=summary_request.summary_type,
                   processing_time_ms=processing_time)
        
        return SessionSummaryResponse.from_orm(summary)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Session summary generation failed", error=str(e), session_id=session_id)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate session summary"
        )


@router.get("/{session_id}", response_model=List[SessionSummaryResponse])
async def get_session_summaries(
    session_id: str,
    summary_type: Optional[str] = Query(None, description="Filter by summary type"),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> List[SessionSummaryResponse]:
    """
    Get all summaries for a session
    """
    try:
        # Verify session access
        session_result = await db.execute(
            select(Session).options(selectinload(Session.clone)).where(Session.id == session_id)
        )
        session = session_result.scalar_one_or_none()
        
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
        
        # Get summaries
        query = select(SessionSummary).options(
            selectinload(SessionSummary.template)
        ).where(SessionSummary.session_id == session_id)
        
        if summary_type:
            query = query.where(SessionSummary.summary_type == summary_type)
        
        query = query.order_by(desc(SessionSummary.generated_at))
        
        result = await db.execute(query)
        summaries = result.scalars().all()
        
        return [SessionSummaryResponse.from_orm(summary) for summary in summaries]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get session summaries", error=str(e), session_id=session_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve session summaries"
        )


@router.put("/{summary_id}", response_model=SessionSummaryResponse)
async def update_session_summary(
    summary_id: str,
    summary_update: SessionSummaryUpdate,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> SessionSummaryResponse:
    """
    Update a session summary
    """
    try:
        # Get summary with session info
        result = await db.execute(
            select(SessionSummary).options(
                selectinload(SessionSummary.session)
            ).where(SessionSummary.id == summary_id)
        )
        summary = result.scalar_one_or_none()
        
        if not summary:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Summary not found"
            )
        
        # Check access permissions
        if str(summary.session.user_id) != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Update summary fields
        if summary_update.summary_text is not None:
            summary.summary_text = summary_update.summary_text
            summary.word_count = len(summary_update.summary_text.split())
        
        if summary_update.key_insights is not None:
            summary.key_insights = summary_update.key_insights
        
        if summary_update.action_items is not None:
            summary.action_items = summary_update.action_items
        
        if summary_update.recommendations is not None:
            summary.recommendations = summary_update.recommendations
        
        if summary_update.next_session_topics is not None:
            summary.next_session_topics = summary_update.next_session_topics
        
        if summary_update.emotional_tone is not None:
            summary.emotional_tone = summary_update.emotional_tone
        
        if summary_update.main_topics is not None:
            summary.main_topics = summary_update.main_topics
        
        summary.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(summary)
        
        logger.info("Session summary updated",
                   summary_id=summary_id,
                   user_id=current_user_id)
        
        return SessionSummaryResponse.from_orm(summary)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to update session summary", error=str(e), summary_id=summary_id)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update session summary"
        )


@router.delete("/{summary_id}")
async def delete_session_summary(
    summary_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, str]:
    """
    Delete a session summary
    """
    try:
        result = await db.execute(
            select(SessionSummary).options(
                selectinload(SessionSummary.session)
            ).where(SessionSummary.id == summary_id)
        )
        summary = result.scalar_one_or_none()
        
        if not summary:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Summary not found"
            )
        
        # Check access permissions
        if str(summary.session.user_id) != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        await db.delete(summary)
        await db.commit()
        
        logger.info("Session summary deleted", summary_id=summary_id)
        
        return {"message": "Summary deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to delete session summary", error=str(e), summary_id=summary_id)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete session summary"
        )


# Summary Template APIs
@router.post("/templates", response_model=SummaryTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_summary_template(
    template_data: SummaryTemplateCreate,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> SummaryTemplateResponse:
    """
    Create a custom summary template
    """
    try:
        # Check if template name already exists for this user
        existing = await db.execute(
            select(SummaryTemplate).where(
                and_(
                    SummaryTemplate.name == template_data.name,
                    or_(
                        SummaryTemplate.creator_id == current_user_id,
                        SummaryTemplate.is_public == True
                    )
                )
            )
        )
        
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Template with this name already exists"
            )
        
        template = SummaryTemplate(
            name=template_data.name,
            description=template_data.description,
            template_type=template_data.template_type,
            prompt_template=template_data.prompt_template,
            output_format=template_data.output_format,
            max_length=template_data.max_length,
            include_insights=template_data.include_insights,
            include_action_items=template_data.include_action_items,
            include_recommendations=template_data.include_recommendations,
            include_emotional_analysis=template_data.include_emotional_analysis,
            is_public=template_data.is_public,
            creator_id=uuid.UUID(current_user_id)
        )
        
        db.add(template)
        await db.commit()
        await db.refresh(template)
        
        logger.info("Summary template created",
                   template_id=str(template.id),
                   template_name=template.name,
                   creator_id=current_user_id)
        
        return SummaryTemplateResponse.from_orm(template)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to create summary template", error=str(e))
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create summary template"
        )


@router.get("/templates", response_model=List[SummaryTemplateResponse])
async def list_summary_templates(
    template_type: Optional[str] = Query(None, description="Filter by template type"),
    include_public: bool = Query(True, description="Include public templates"),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> List[SummaryTemplateResponse]:
    """
    List available summary templates
    """
    try:
        query = select(SummaryTemplate).where(
            or_(
                SummaryTemplate.creator_id == current_user_id,
                and_(SummaryTemplate.is_public == True, include_public == True)
            )
        )
        
        if template_type:
            query = query.where(SummaryTemplate.template_type == template_type)
        
        query = query.order_by(SummaryTemplate.name)
        
        result = await db.execute(query)
        templates = result.scalars().all()
        
        return [SummaryTemplateResponse.from_orm(template) for template in templates]
        
    except Exception as e:
        logger.error("Failed to list summary templates", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve summary templates"
        )


# Bulk Summarization APIs
@router.post("/bulk", response_model=BulkSummarizationJobResponse, status_code=status.HTTP_201_CREATED)
async def create_bulk_summarization_job(
    bulk_request: BulkSummarizationRequest,
    background_tasks: BackgroundTasks,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> BulkSummarizationJobResponse:
    """
    Create bulk summarization job for multiple sessions
    """
    try:
        # Build session query based on filters
        session_query = select(Session).where(
            and_(
                Session.user_id == current_user_id,
                Session.status == "ended"
            )
        )
        
        # Apply filters
        if bulk_request.clone_ids:
            session_query = session_query.where(Session.clone_id.in_(bulk_request.clone_ids))
        
        if bulk_request.date_range:
            if bulk_request.date_range.get("start"):
                start_date = datetime.fromisoformat(bulk_request.date_range["start"])
                session_query = session_query.where(Session.created_at >= start_date)
            if bulk_request.date_range.get("end"):
                end_date = datetime.fromisoformat(bulk_request.date_range["end"])
                session_query = session_query.where(Session.created_at <= end_date)
        
        if bulk_request.min_duration:
            session_query = session_query.where(Session.duration_minutes >= bulk_request.min_duration)
        
        if bulk_request.min_rating:
            session_query = session_query.where(Session.user_rating >= bulk_request.min_rating)
        
        # Count total sessions to process
        count_result = await db.execute(
            select(func.count()).select_from(session_query.subquery())
        )
        total_sessions = count_result.scalar()
        
        if total_sessions == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No sessions found matching the specified criteria"
            )
        
        # Create bulk job
        job = BulkSummarizationJob(
            user_id=uuid.UUID(current_user_id),
            job_name=bulk_request.job_name,
            session_filters=bulk_request.session_filters,
            template_id=uuid.UUID(bulk_request.template_id) if bulk_request.template_id else None,
            summary_type=bulk_request.summary_type,
            total_sessions=total_sessions,
            output_format=bulk_request.output_format,
            expires_at=datetime.utcnow() + timedelta(days=7)  # 7 day download expiry
        )
        
        db.add(job)
        await db.commit()
        await db.refresh(job)
        
        # Start background processing
        background_tasks.add_task(
            process_bulk_summarization_job,
            str(job.id),
            session_query,
            db
        )
        
        logger.info("Bulk summarization job created",
                   job_id=str(job.id),
                   job_name=bulk_request.job_name,
                   total_sessions=total_sessions,
                   user_id=current_user_id)
        
        return BulkSummarizationJobResponse.from_orm(job)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to create bulk summarization job", error=str(e))
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create bulk summarization job"
        )


@router.get("/bulk/{job_id}", response_model=BulkSummarizationJobResponse)
async def get_bulk_summarization_job(
    job_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> BulkSummarizationJobResponse:
    """
    Get bulk summarization job status
    """
    try:
        result = await db.execute(
            select(BulkSummarizationJob).where(
                and_(
                    BulkSummarizationJob.id == job_id,
                    BulkSummarizationJob.user_id == current_user_id
                )
            )
        )
        job = result.scalar_one_or_none()
        
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Bulk summarization job not found"
            )
        
        return BulkSummarizationJobResponse.from_orm(job)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get bulk summarization job", error=str(e), job_id=job_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve bulk summarization job"
        )


@router.get("/bulk", response_model=List[BulkSummarizationJobResponse])
async def list_bulk_summarization_jobs(
    status_filter: Optional[str] = Query(None, description="Filter by job status"),
    limit: int = Query(20, ge=1, le=100),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> List[BulkSummarizationJobResponse]:
    """
    List user's bulk summarization jobs
    """
    try:
        query = select(BulkSummarizationJob).where(
            BulkSummarizationJob.user_id == current_user_id
        )
        
        if status_filter:
            query = query.where(BulkSummarizationJob.status == status_filter)
        
        query = query.order_by(desc(BulkSummarizationJob.created_at)).limit(limit)
        
        result = await db.execute(query)
        jobs = result.scalars().all()
        
        return [BulkSummarizationJobResponse.from_orm(job) for job in jobs]
        
    except Exception as e:
        logger.error("Failed to list bulk summarization jobs", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve bulk summarization jobs"
        )


# Summary Analytics and Search APIs
@router.get("/analytics", response_model=SummaryAnalyticsResponse)
async def get_summary_analytics(
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> SummaryAnalyticsResponse:
    """
    Get summary usage analytics
    """
    try:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Get summary statistics
        summary_stats = await db.execute(
            select(
                func.count(SessionSummary.id).label("total_summaries"),
                func.avg(SessionSummary.confidence_score).label("avg_confidence"),
                func.avg(SessionSummary.processing_time_ms).label("avg_processing_time")
            ).select_from(
                SessionSummary.join(Session, SessionSummary.session_id == Session.id)
            ).where(
                and_(
                    Session.user_id == current_user_id,
                    SessionSummary.generated_at >= start_date
                )
            )
        )
        stats = summary_stats.first()
        
        # Get summaries by type
        type_stats = await db.execute(
            select(
                SessionSummary.summary_type,
                func.count(SessionSummary.id).label("count")
            ).select_from(
                SessionSummary.join(Session, SessionSummary.session_id == Session.id)
            ).where(
                and_(
                    Session.user_id == current_user_id,
                    SessionSummary.generated_at >= start_date
                )
            ).group_by(SessionSummary.summary_type)
        )
        summaries_by_type = {row.summary_type: row.count for row in type_stats.fetchall()}
        
        # Get most common topics
        topics_stats = await db.execute(
            select(func.unnest(SessionSummary.main_topics).label("topic"))
            .select_from(
                SessionSummary.join(Session, SessionSummary.session_id == Session.id)
            ).where(
                and_(
                    Session.user_id == current_user_id,
                    SessionSummary.generated_at >= start_date
                )
            )
        )
        all_topics = [row.topic for row in topics_stats.fetchall()]
        topic_counts = {}
        for topic in all_topics:
            topic_counts[topic] = topic_counts.get(topic, 0) + 1
        
        most_common_topics = sorted(topic_counts.keys(), key=topic_counts.get, reverse=True)[:10]
        
        # Get emotional tone distribution
        tone_stats = await db.execute(
            select(
                SessionSummary.emotional_tone,
                func.count(SessionSummary.id).label("count")
            ).select_from(
                SessionSummary.join(Session, SessionSummary.session_id == Session.id)
            ).where(
                and_(
                    Session.user_id == current_user_id,
                    SessionSummary.generated_at >= start_date,
                    SessionSummary.emotional_tone.isnot(None)
                )
            ).group_by(SessionSummary.emotional_tone)
        )
        emotional_tone_distribution = {row.emotional_tone: row.count for row in tone_stats.fetchall()}
        
        return SummaryAnalyticsResponse(
            user_id=current_user_id,
            total_summaries=stats.total_summaries or 0,
            summaries_by_type=summaries_by_type,
            average_confidence_score=float(stats.avg_confidence or 0.0),
            average_processing_time_ms=float(stats.avg_processing_time or 0.0),
            most_common_topics=most_common_topics,
            emotional_tone_distribution=emotional_tone_distribution,
            quality_score_trends=[],  # Would implement trending analysis
            template_usage_stats={},  # Would implement template usage stats
            generated_at=datetime.utcnow()
        )
        
    except Exception as e:
        logger.error("Failed to get summary analytics", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve summary analytics"
        )


@router.post("/search", response_model=List[SummarySearchResult])
async def search_summaries(
    search_request: SummarySearchRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> List[SummarySearchResult]:
    """
    Search through session summaries
    """
    try:
        # Build search query
        query = select(SessionSummary).options(
            selectinload(SessionSummary.session).selectinload(Session.clone)
        ).join(Session, SessionSummary.session_id == Session.id).where(
            Session.user_id == current_user_id
        )
        
        # Apply filters
        if search_request.summary_types:
            query = query.where(SessionSummary.summary_type.in_(search_request.summary_types))
        
        if search_request.clone_ids:
            query = query.where(Session.clone_id.in_(search_request.clone_ids))
        
        if search_request.date_range:
            if search_request.date_range.get("start"):
                start_date = datetime.fromisoformat(search_request.date_range["start"])
                query = query.where(SessionSummary.generated_at >= start_date)
            if search_request.date_range.get("end"):
                end_date = datetime.fromisoformat(search_request.date_range["end"])
                query = query.where(SessionSummary.generated_at <= end_date)
        
        query = query.where(SessionSummary.confidence_score >= search_request.min_confidence)
        
        # Text search
        search_filter = or_(
            SessionSummary.summary_text.ilike(f"%{search_request.query}%"),
            func.array_to_string(SessionSummary.main_topics, ' ').ilike(f"%{search_request.query}%"),
            func.array_to_string(SessionSummary.key_insights, ' ').ilike(f"%{search_request.query}%")
        )
        query = query.where(search_filter)
        
        # Order by relevance (confidence score for now)
        query = query.order_by(desc(SessionSummary.confidence_score))
        query = query.limit(search_request.max_results)
        
        result = await db.execute(query)
        summaries = result.scalars().all()
        
        # Format results
        search_results = []
        for summary in summaries:
            search_results.append(SummarySearchResult(
                summary_id=str(summary.id),
                session_id=str(summary.session_id),
                summary_text=summary.summary_text if search_request.include_content else summary.summary_text[:200] + "...",
                relevance_score=summary.confidence_score,  # Simplified relevance
                summary_type=summary.summary_type,
                main_topics=summary.main_topics,
                confidence_score=summary.confidence_score,
                generated_at=summary.generated_at,
                clone_name=summary.session.clone.name if summary.session.clone else None,
                session_duration=summary.session.duration_minutes
            ))
        
        logger.info("Summary search performed",
                   query=search_request.query,
                   results_count=len(search_results),
                   user_id=current_user_id)
        
        return search_results
        
    except Exception as e:
        logger.error("Summary search failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search summaries"
        )


# AI Summary Generation Functions
async def generate_ai_summary(
    session: Session,
    summary_type: str,
    template: Optional[SummaryTemplate] = None,
    custom_prompt: Optional[str] = None,
    include_emotional_analysis: bool = False,
    max_length: Optional[int] = None
) -> Dict[str, Any]:
    """
    Generate AI-powered summary using session data
    """
    try:
        # Extract conversation content
        messages = sorted(session.messages, key=lambda m: m.created_at)
        conversation_text = ""
        user_messages = []
        ai_messages = []
        
        for msg in messages:
            if msg.sender_type == "user":
                user_messages.append(msg.content)
                conversation_text += f"User: {msg.content}\n"
            else:
                ai_messages.append(msg.content)
                conversation_text += f"AI: {msg.content}\n"
        
        # Extract topics (simplified - in production would use NLP)
        topics = extract_topics_from_conversation(conversation_text)
        
        # Generate summary based on type
        if summary_type == "brief":
            summary_text = generate_brief_summary(session, conversation_text, topics)
        elif summary_type == "action_items":
            summary_text = generate_action_items_summary(session, conversation_text)
        else:  # detailed or custom
            summary_text = generate_detailed_summary(session, conversation_text, topics, template, custom_prompt)
        
        # Apply length limit
        if max_length and len(summary_text.split()) > max_length:
            words = summary_text.split()[:max_length]
            summary_text = " ".join(words) + "..."
        
        # Generate insights and recommendations
        key_insights = generate_key_insights(conversation_text, topics)
        action_items = generate_action_items(conversation_text)
        recommendations = generate_recommendations(session, topics)
        next_topics = suggest_next_session_topics(topics, recommendations)
        
        # Emotional analysis (if requested)
        emotional_tone = None
        satisfaction_indicators = {}
        if include_emotional_analysis:
            emotional_tone = analyze_emotional_tone(conversation_text)
            satisfaction_indicators = analyze_user_satisfaction(user_messages, session.user_rating)
        
        # Calculate quality score
        quality_score = calculate_conversation_quality_score(session, len(messages), topics)
        
        return {
            "summary_text": summary_text,
            "key_insights": key_insights,
            "action_items": action_items,
            "recommendations": recommendations,
            "next_session_topics": next_topics,
            "main_topics": topics,
            "emotional_tone": emotional_tone,
            "satisfaction_indicators": satisfaction_indicators,
            "learning_outcomes": [],  # Would implement learning outcome extraction
            "quality_score": quality_score,
            "confidence_score": 0.85,  # Would calculate based on data quality
            "model_used": "gpt-3.5-turbo"
        }
        
    except Exception as e:
        logger.error("AI summary generation failed", error=str(e))
        raise


# Helper functions for AI summary generation
def extract_topics_from_conversation(conversation_text: str) -> List[str]:
    """Extract main topics from conversation (simplified implementation)"""
    topics = []
    text_lower = conversation_text.lower()
    
    # Simple keyword-based topic extraction
    topic_keywords = {
        "business": ["business", "company", "startup", "strategy", "marketing"],
        "technology": ["technology", "software", "programming", "ai", "data"],
        "finance": ["money", "investment", "budget", "cost", "price"],
        "health": ["health", "wellness", "exercise", "diet", "medical"],
        "education": ["learn", "study", "course", "training", "skill"],
        "career": ["job", "career", "work", "professional", "resume"]
    }
    
    for topic, keywords in topic_keywords.items():
        if any(keyword in text_lower for keyword in keywords):
            topics.append(topic)
    
    return topics[:5]  # Limit to top 5 topics


def generate_brief_summary(session: Session, conversation_text: str, topics: List[str]) -> str:
    """Generate brief summary"""
    topic_str = ", ".join(topics) if topics else "general topics"
    clone_name = session.clone.name if session.clone else "AI Assistant"
    
    return f"Brief {session.duration_minutes}-minute session with {clone_name} discussing {topic_str}. " \
           f"Conversation included {session.message_count} exchanges with productive dialogue and clear communication."


def generate_detailed_summary(session: Session, conversation_text: str, topics: List[str], template: Optional[SummaryTemplate], custom_prompt: Optional[str]) -> str:
    """Generate detailed summary"""
    topic_str = ", ".join(topics) if topics else "various topics"
    clone_name = session.clone.name if session.clone else "AI Assistant"
    
    summary = f"Detailed session summary for {session.duration_minutes}-minute conversation with {clone_name}.\n\n"
    summary += f"Main topics discussed: {topic_str}\n\n"
    summary += f"The session involved {session.message_count} message exchanges, demonstrating "
    
    if session.user_rating and session.user_rating >= 4:
        summary += "high user satisfaction and effective communication. "
    else:
        summary += "productive dialogue with room for improvement. "
    
    summary += f"The conversation covered key aspects of {topic_str}, providing valuable insights and actionable guidance."
    
    return summary


def generate_action_items_summary(session: Session, conversation_text: str) -> str:
    """Generate action items focused summary"""
    return f"Action Items from {session.duration_minutes}-minute session:\n\n" \
           "• Follow up on discussed topics within 1 week\n" \
           "• Implement suggested strategies\n" \
           "• Schedule follow-up session if needed\n" \
           "• Review key insights and recommendations"


def generate_key_insights(conversation_text: str, topics: List[str]) -> List[str]:
    """Generate key insights from conversation"""
    insights = [
        "Clear communication established between user and AI",
        f"Main focus areas identified: {', '.join(topics) if topics else 'general guidance'}",
        "User demonstrated engagement and active participation",
        "Productive discussion with actionable outcomes"
    ]
    return insights[:3]  # Limit to top 3 insights


def generate_action_items(conversation_text: str) -> List[Dict[str, Any]]:
    """Generate action items from conversation"""
    return [
        {
            "task": "Review and implement discussed strategies",
            "priority": "high",
            "deadline": "1 week",
            "category": "implementation"
        },
        {
            "task": "Follow up on key questions raised",
            "priority": "medium", 
            "deadline": "3 days",
            "category": "research"
        }
    ]


def generate_recommendations(session: Session, topics: List[str]) -> List[str]:
    """Generate recommendations based on session"""
    recommendations = [
        "Consider scheduling follow-up sessions for deeper exploration",
        "Implement discussed strategies systematically"
    ]
    
    if topics:
        recommendations.append(f"Explore additional resources related to {topics[0]}")
    
    return recommendations


def suggest_next_session_topics(topics: List[str], recommendations: List[str]) -> List[str]:
    """Suggest topics for next session"""
    next_topics = ["Follow-up on action items", "Progress review"]
    
    if topics:
        next_topics.append(f"Advanced {topics[0]} strategies")
    
    return next_topics


def analyze_emotional_tone(conversation_text: str) -> str:
    """Analyze emotional tone of conversation"""
    positive_words = ["good", "great", "excellent", "helpful", "thanks", "appreciate"]
    negative_words = ["bad", "poor", "disappointed", "confused", "frustrated"]
    
    text_lower = conversation_text.lower()
    positive_count = sum(1 for word in positive_words if word in text_lower)
    negative_count = sum(1 for word in negative_words if word in text_lower)
    
    if positive_count > negative_count * 2:
        return "positive"
    elif negative_count > positive_count:
        return "negative"
    else:
        return "neutral"


def analyze_user_satisfaction(user_messages: List[str], user_rating: Optional[float]) -> Dict[str, Any]:
    """Analyze user satisfaction indicators"""
    return {
        "engagement_level": "high" if len(user_messages) > 5 else "moderate",
        "message_length": "detailed" if sum(len(msg.split()) for msg in user_messages) / len(user_messages) > 10 else "brief",
        "explicit_rating": user_rating,
        "satisfaction_level": "high" if user_rating and user_rating >= 4 else "moderate"
    }


def calculate_conversation_quality_score(session: Session, message_count: int, topics: List[str]) -> float:
    """Calculate conversation quality score"""
    score = 0.0
    
    # Duration factor (optimal 15-45 minutes)
    if 15 <= session.duration_minutes <= 45:
        score += 0.3
    elif session.duration_minutes > 45:
        score += 0.2
    else:
        score += 0.1
    
    # Message count factor
    if message_count >= 10:
        score += 0.3
    elif message_count >= 5:
        score += 0.2
    else:
        score += 0.1
    
    # Topic coverage
    if len(topics) >= 2:
        score += 0.2
    elif len(topics) >= 1:
        score += 0.15
    else:
        score += 0.05
    
    # User rating factor
    if session.user_rating:
        score += (session.user_rating / 5.0) * 0.2
    else:
        score += 0.1
    
    return min(1.0, score)


# Background task functions
async def store_summary_in_memory(session_id: str, summary_id: str, db: AsyncSession):
    """Store summary in conversation memory for future reference"""
    try:
        # This would integrate with the Memory Management APIs
        # to store summary data in conversation memory
        pass
    except Exception as e:
        logger.error("Failed to store summary in memory", error=str(e))


async def process_bulk_summarization_job(job_id: str, session_query, db: AsyncSession):
    """Process bulk summarization job in background"""
    try:
        # This would be a comprehensive background job processor
        # In production, would use Celery or similar task queue
        pass
    except Exception as e:
        logger.error("Bulk summarization job failed", error=str(e), job_id=job_id)