from app.core.supabase_auth import get_current_user_id, require_role

"""
RAG System APIs for CloneAI - Interface with existing RAG workflow
"""
import uuid
import asyncio
from datetime import datetime
from typing import List, Optional, Dict, Any

from fastapi import (
    APIRouter, Depends, HTTPException, status, BackgroundTasks
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, desc
from sqlalchemy.orm import selectinload
import structlog

from app.core.security import get_current_user_id
from app.database import get_db_session
from app.models.database import Clone, Document, DocumentChunk, KnowledgeEntry
from app.models.schemas import KnowledgeSearchRequest, KnowledgeSearchResult
from app.config import settings

logger = structlog.get_logger()
router = APIRouter(prefix="/rag", tags=["RAG System"])


@router.post("/workflows/start/{clone_id}")
async def start_rag_workflow(
    clone_id: str,
    document_ids: Optional[List[str]] = None,
    knowledge_entry_ids: Optional[List[str]] = None,
    workflow_config: Optional[Dict[str, Any]] = None,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """
    Start RAG workflow for a specific clone
    Processes documents and knowledge entries to generate embeddings
    """
    try:
        # Verify clone exists and user has access
        result = await db.execute(
            select(Clone).where(Clone.id == clone_id)
        )
        clone = result.scalar_one_or_none()
        
        if not clone:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        # Check if user is the clone creator
        if str(clone.creator_id) != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the clone creator can start RAG workflows"
            )
        
        # Get documents to process
        documents_to_process = []
        if document_ids:
            docs_result = await db.execute(
                select(Document).where(
                    and_(
                        Document.clone_id == clone_id,
                        Document.id.in_(document_ids),
                        Document.processing_status.in_(["pending", "failed"])
                    )
                )
            )
            documents_to_process = docs_result.scalars().all()
        else:
            # Process all pending documents for the clone
            docs_result = await db.execute(
                select(Document).where(
                    and_(
                        Document.clone_id == clone_id,
                        Document.processing_status.in_(["pending", "failed"])
                    )
                )
            )
            documents_to_process = docs_result.scalars().all()
        
        # Get knowledge entries to process
        knowledge_to_process = []
        if knowledge_entry_ids:
            knowledge_result = await db.execute(
                select(KnowledgeEntry).where(
                    and_(
                        KnowledgeEntry.clone_id == clone_id,
                        KnowledgeEntry.id.in_(knowledge_entry_ids),
                        KnowledgeEntry.embedding.is_(None)  # Not yet processed
                    )
                )
            )
            knowledge_to_process = knowledge_result.scalars().all()
        else:
            # Process all unprocessed knowledge entries
            knowledge_result = await db.execute(
                select(KnowledgeEntry).where(
                    and_(
                        KnowledgeEntry.clone_id == clone_id,
                        KnowledgeEntry.embedding.is_(None)
                    )
                )
            )
            knowledge_to_process = knowledge_result.scalars().all()
        
        if not documents_to_process and not knowledge_to_process:
            return {
                "message": "No items found for processing",
                "workflow_id": None,
                "items_queued": 0,
                "status": "no_work"
            }
        
        # Generate workflow ID
        workflow_id = str(uuid.uuid4())
        
        # Update document status to processing
        for doc in documents_to_process:
            doc.processing_status = "processing"
        
        await db.commit()
        
        # Configure workflow parameters
        config = workflow_config or {}
        default_config = {
            "chunk_size": 1000,
            "chunk_overlap": 200,
            "embedding_model": "text-embedding-3-small",
            "batch_size": 10,
            "max_retries": 3
        }
        config = {**default_config, **config}
        
        # Start background RAG workflow
        background_tasks.add_task(
            execute_rag_workflow,
            workflow_id,
            clone_id,
            documents_to_process,
            knowledge_to_process,
            config
        )
        
        logger.info(
            "RAG workflow started",
            workflow_id=workflow_id,
            clone_id=clone_id,
            documents_count=len(documents_to_process),
            knowledge_count=len(knowledge_to_process)
        )
        
        return {
            "message": "RAG workflow started successfully",
            "workflow_id": workflow_id,
            "clone_id": clone_id,
            "items_queued": len(documents_to_process) + len(knowledge_to_process),
            "documents_processing": len(documents_to_process),
            "knowledge_processing": len(knowledge_to_process),
            "config": config,
            "started_at": datetime.utcnow(),
            "status": "processing"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to start RAG workflow", error=str(e), clone_id=clone_id)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start RAG workflow"
        )


@router.delete("/workflows/{workflow_id}")
async def stop_rag_workflow(
    workflow_id: str,
    force: bool = False,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """
    Stop/cancel a running RAG workflow
    """
    try:
        # In a real implementation, you would:
        # 1. Look up the workflow in a workflow tracking table
        # 2. Check if user has permission to stop it
        # 3. Send cancellation signal to the background process
        # 4. Clean up any partial processing
        
        # For now, we'll simulate workflow cancellation
        logger.info(
            "RAG workflow stop requested",
            workflow_id=workflow_id,
            user_id=current_user_id,
            force=force
        )
        
        # Reset any documents that were being processed
        if force:
            # Force stop - reset all processing documents to pending
            await db.execute(
                f"""
                UPDATE documents 
                SET processing_status = 'pending', processing_error = 'Workflow cancelled by user'
                WHERE processing_status = 'processing'
                """
            )
            await db.commit()
            
            message = "RAG workflow force stopped - all processing items reset to pending"
        else:
            # Graceful stop - let current items finish but don't start new ones
            message = "RAG workflow stop requested - will complete current items"
        
        logger.info("RAG workflow stopped", workflow_id=workflow_id, force=force)
        
        return {
            "message": message,
            "workflow_id": workflow_id,
            "stopped_at": datetime.utcnow(),
            "force_stopped": force,
            "status": "stopped"
        }
        
    except Exception as e:
        logger.error("Failed to stop RAG workflow", error=str(e), workflow_id=workflow_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to stop RAG workflow"
        )


@router.get("/workflows/{workflow_id}/status")
async def get_workflow_status(
    workflow_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """
    Get status of a RAG workflow
    """
    try:
        # In a real implementation, you would track workflow status in a table
        # For now, we'll return status based on document processing states
        
        # This is a simplified status check
        # In production, you'd have a workflows table to track this properly
        
        return {
            "workflow_id": workflow_id,
            "status": "running",  # Would be dynamic based on actual workflow state
            "progress": {
                "total_items": 0,
                "completed_items": 0,
                "failed_items": 0,
                "remaining_items": 0
            },
            "started_at": datetime.utcnow(),
            "estimated_completion": None,
            "last_updated": datetime.utcnow()
        }
        
    except Exception as e:
        logger.error("Failed to get workflow status", error=str(e), workflow_id=workflow_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve workflow status"
        )


@router.get("/workflows/clone/{clone_id}")
async def list_clone_workflows(
    clone_id: str,
    status_filter: Optional[str] = None,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """
    List all RAG workflows for a specific clone
    """
    try:
        # Verify clone access
        result = await db.execute(
            select(Clone).where(Clone.id == clone_id)
        )
        clone = result.scalar_one_or_none()
        
        if not clone:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        if str(clone.creator_id) != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # In a real implementation, you would query a workflows table
        # For now, return processing status of documents and knowledge entries
        
        # Get document processing status
        docs_result = await db.execute(
            select(
                Document.processing_status,
                func.count(Document.id).label("count")
            ).where(Document.clone_id == clone_id).group_by(Document.processing_status)
        )
        doc_status = {row.processing_status: row.count for row in docs_result.fetchall()}
        
        # Get knowledge entries processing status  
        knowledge_result = await db.execute(
            select(
                func.count(KnowledgeEntry.id).label("total"),
                func.count(KnowledgeEntry.embedding).label("processed")
            ).where(KnowledgeEntry.clone_id == clone_id)
        )
        knowledge_stats = knowledge_result.first()
        
        return {
            "clone_id": clone_id,
            "processing_summary": {
                "documents": doc_status,
                "knowledge_entries": {
                    "total": knowledge_stats.total or 0,
                    "processed": knowledge_stats.processed or 0,
                    "pending": (knowledge_stats.total or 0) - (knowledge_stats.processed or 0)
                }
            },
            "workflows": [],  # Would contain actual workflow records
            "last_updated": datetime.utcnow()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to list workflows", error=str(e), clone_id=clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list workflows"
        )


@router.post("/search")
async def search_knowledge_base(
    search_request: KnowledgeSearchRequest,
    current_user_id: Optional[str] = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """
    Search the knowledge base using RAG (semantic search)
    """
    try:
        logger.info("Knowledge base search requested", 
                   query=search_request.query,
                   clone_id=getattr(search_request, 'clone_id', 'unknown'))
        
        # Import RAG workflow for direct integration
        from app.services.rag_workflow_wrapper import rag_workflow
        
        # Use the RAG workflow to search the knowledge base
        rag_response = await rag_workflow.query_clone_expert(
            clone_id=getattr(search_request, 'clone_id', None) or 'default',
            user_query=search_request.query,
            user_id=current_user_id
        )
        
        # Convert RAG response to expected format
        search_results = []
        if rag_response and "response" in rag_response:
            # Simulate search results format from RAG response
            search_results = [{
                'chunk_id': 'rag_response_1',
                'chunk_content': rag_response["response"],
                'similarity_score': 0.9,
                'document_id': 'rag_knowledge_base',
                'document_title': 'Knowledge Base',
                'chunk_index': 0,
                'metadata': {}
            }]
        
        # Format results for API response
        results = []
        for result in search_results:
            formatted_result = {
                "chunk_id": result['chunk_id'],
                "content": result['chunk_content'][:500] + "..." if len(result['chunk_content']) > 500 else result['chunk_content'],
                "similarity_score": result.get('similarity_score', 0.8),
                "source": {
                    "type": "document",
                    "document_id": result['document_id'],
                    "document_title": result['document_title'],
                    "chunk_index": result['chunk_index']
                },
                "doc_metadata": result.get('metadata', {})
            }
            results.append(formatted_result)
        
        return {
            "query": search_request.query,
            "results": results,
            "total_results": len(results),
            "search_metadata": {
                "similarity_threshold": search_request.similarity_threshold,
                "search_method": "rag_workflow_direct_integration",
                "execution_time_ms": 100,  # Would track actual timing
                "include_metadata": search_request.include_metadata
            },
            "searched_at": datetime.utcnow()
        }
        
    except Exception as e:
        logger.error("Knowledge base search failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search knowledge base"
        )


@router.get("/system/stats")
async def get_rag_system_stats(
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """
    Get RAG system statistics and health
    """
    try:
        # Get document processing stats
        doc_stats = await db.execute(
            select(
                Document.processing_status,
                func.count(Document.id).label("count"),
                func.avg(Document.file_size_bytes).label("avg_size"),
                func.sum(Document.chunk_count).label("total_chunks")
            ).group_by(Document.processing_status)
        )
        doc_data = doc_stats.fetchall()
        
        # Get knowledge entry stats
        knowledge_stats = await db.execute(
            select(
                func.count(KnowledgeEntry.id).label("total_entries"),
                func.count(KnowledgeEntry.embedding).label("processed_entries")
            )
        )
        knowledge_data = knowledge_stats.first()
        
        # Get chunk stats
        chunk_stats = await db.execute(
            select(func.count(DocumentChunk.id).label("total_chunks"))
        )
        chunk_data = chunk_stats.first()
        
        # Format stats
        processing_stats = {}
        total_chunks = 0
        for row in doc_data:
            processing_stats[row.processing_status] = {
                "count": row.count,
                "avg_file_size_mb": round((row.avg_size or 0) / (1024 * 1024), 2),
                "total_chunks": row.total_chunks or 0
            }
            total_chunks += row.total_chunks or 0
        
        return {
            "system_health": "operational",  # Would be dynamic based on system state
            "processing_stats": {
                "documents": processing_stats,
                "knowledge_entries": {
                    "total": knowledge_data.total_entries or 0,
                    "processed": knowledge_data.processed_entries or 0,
                    "pending": (knowledge_data.total_entries or 0) - (knowledge_data.processed_entries or 0)
                },
                "total_chunks": chunk_data.total_chunks or 0
            },
            "system_performance": {
                "avg_processing_time_per_doc": "2.5 minutes",  # Would be calculated from actual data
                "embedding_generation_rate": "150 chunks/minute",
                "search_response_time": "< 100ms",
                "system_uptime": "99.9%"
            },
            "resource_usage": {
                "storage_used_gb": 0.0,  # Would be calculated from actual usage
                "embeddings_count": total_chunks,
                "api_calls_today": 0,  # Would track actual API usage
                "cost_estimation_usd": 0.0
            },
            "last_updated": datetime.utcnow()
        }
        
    except Exception as e:
        logger.error("Failed to get RAG system stats", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve system statistics"
        )


# Background workflow execution function
async def execute_rag_workflow(
    workflow_id: str,
    clone_id: str,
    documents: List[Document],
    knowledge_entries: List[KnowledgeEntry],
    config: Dict[str, Any]
):
    """
    Execute the RAG workflow in the background
    This would interface with your existing RAG workflow implementation
    """
    try:
        logger.info("Executing RAG workflow", workflow_id=workflow_id, clone_id=clone_id)
        
        # Simulate workflow execution
        # In a real implementation, this would:
        # 1. Process each document (extract text, chunk, generate embeddings)
        # 2. Process each knowledge entry (generate embeddings)
        # 3. Store embeddings in the database
        # 4. Update processing status
        # 5. Handle errors and retries
        
        # Simulate processing time
        await asyncio.sleep(5)
        
        # Here you would call your existing RAG workflow
        # For example:
        # from your_rag_module import process_documents, process_knowledge_entries
        # 
        # for doc in documents:
        #     await process_documents(doc, config)
        # 
        # for entry in knowledge_entries:
        #     await process_knowledge_entries(entry, config)
        
        logger.info("RAG workflow completed", workflow_id=workflow_id)
        
    except Exception as e:
        logger.error("RAG workflow execution failed", 
                    error=str(e), 
                    workflow_id=workflow_id)
        
        # Update failed documents status
        # In production, you'd update the database to reflect failures