"""
RAG Integration API endpoints
Handles RAG initialization, querying, and management for CloneAI
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from typing import List, Optional, Dict, Any
from datetime import datetime
import structlog

from app.core.supabase_auth import get_current_user_id
from app.models.schemas import (
    RAGInitializationRequest, RAGInitializationResponse, RAGStatusResponse,
    RAGQueryRequestEnhanced, EnhancedChatResponse, RAGUpdateRequest, RAGUpdateResponse,
    InitializationStatusResponse, SuccessResponse
)
from app.services.rag_integration_service import rag_integration_service

logger = structlog.get_logger()
router = APIRouter(prefix="/rag", tags=["RAG Integration"])


@router.post("/clones/{clone_id}/initialize", response_model=RAGInitializationResponse)
async def initialize_clone_rag(
    clone_id: str,
    request: RAGInitializationRequest,
    current_user_id: str = Depends(get_current_user_id)
) -> RAGInitializationResponse:
    """
    Initialize RAG memory layer for a clone
    
    This endpoint starts the process of creating a RAG expert for the specified clone
    using its uploaded documents. The process runs in the background and can be
    monitored using the status endpoint.
    """
    try:
        # Verify clone ownership
        await _verify_clone_ownership(clone_id, current_user_id)
        
        logger.info("Starting RAG initialization", clone_id=clone_id, user_id=current_user_id)
        
        response = await rag_integration_service.initialize_clone_rag(
            clone_id=clone_id,
            user_id=current_user_id,
            force_reinitialize=request.force_reinitialize
        )
        
        return response
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Failed to initialize clone RAG", clone_id=clone_id, error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to initialize RAG system: {str(e)}")


@router.get("/clones/{clone_id}/status", response_model=RAGStatusResponse)
async def get_clone_rag_status(
    clone_id: str,
    current_user_id: str = Depends(get_current_user_id)
) -> RAGStatusResponse:
    """
    Get RAG system status for a clone
    
    Returns the current status of the RAG system including whether it's ready,
    document count, last initialization time, and any error messages.
    """
    try:
        await _verify_clone_ownership(clone_id, current_user_id)
        
        status = await rag_integration_service.get_clone_rag_status(clone_id)
        return status
        
    except Exception as e:
        logger.error("Failed to get RAG status", clone_id=clone_id, error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to get RAG status: {str(e)}")


@router.post("/clones/{clone_id}/query", response_model=EnhancedChatResponse)
async def query_clone_rag(
    clone_id: str,
    request: RAGQueryRequestEnhanced,
    current_user_id: str = Depends(get_current_user_id)
) -> EnhancedChatResponse:
    """
    Query clone using RAG system
    
    Sends a query to the clone's RAG system. The system will attempt to use
    the memory layer first, with fallback to standard LLM if needed.
    """
    try:
        # Extract parameters from request body
        query = request.query
        session_id = getattr(request, 'session_id', None)
        context = getattr(request, 'context', {})
        
        # Debug logging
        logger.info("RAG query endpoint called", clone_id=clone_id, query=query, 
                   session_id=session_id, context=context, user_id=current_user_id)
        
        # Note: We don't verify clone ownership here since users can query clones they don't own
        # during chat sessions
        
        response = await rag_integration_service.query_clone_rag(
            clone_id=clone_id,
            query=query,
            user_id=current_user_id,
            session_id=session_id,
            context=context or {}
        )
        
        return response
        
    except Exception as e:
        logger.error("Failed to query RAG system", clone_id=clone_id, error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to process query: {str(e)}")


@router.put("/clones/{clone_id}/update", response_model=RAGUpdateResponse)
async def update_clone_rag_documents(
    clone_id: str,
    knowledge_ids: List[str],
    operation: str = "add",
    current_user_id: str = Depends(get_current_user_id)
) -> RAGUpdateResponse:
    """
    Update RAG system with new documents
    
    Add, update, or remove documents from the clone's RAG system.
    Operation can be 'add', 'update', or 'delete'.
    """
    try:
        await _verify_clone_ownership(clone_id, current_user_id)
        
        if operation not in ['add', 'update', 'delete']:
            raise HTTPException(status_code=400, detail="Invalid operation. Must be 'add', 'update', or 'delete'")
        
        result = await rag_integration_service.update_clone_rag_documents(
            clone_id=clone_id,
            knowledge_ids=knowledge_ids,
            operation=operation
        )
        
        return RAGUpdateResponse(
            status=result["status"],
            documents_processed=result["documents_processed"],
            documents_added=result["documents_added"],
            documents_updated=result["documents_updated"], 
            documents_failed=result["documents_failed"],
            update_time=result["update_time"]
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Failed to update RAG documents", clone_id=clone_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to update RAG documents")


@router.get("/initializations/{initialization_id}/status", response_model=InitializationStatusResponse)
async def get_initialization_status(
    initialization_id: str,
    current_user_id: str = Depends(get_current_user_id)
) -> InitializationStatusResponse:
    """
    Get initialization process status
    
    Returns the current status of a RAG initialization process including
    progress percentage, current phase, and any errors.
    """
    try:
        status = await rag_integration_service.get_initialization_status(initialization_id)
        
        # Don't raise 404 - service now returns valid responses for all cases
        
        return InitializationStatusResponse(
            id=status["id"],
            status=status["status"],
            progress=status["progress"],
            phase=status["phase"],
            processedDocuments=status["processedDocuments"],
            totalDocuments=status["totalDocuments"],
            failedDocuments=status["failedDocuments"],
            error=status["error"],
            completed=status["completed"],
            success=status["success"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get initialization status", init_id=initialization_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to get initialization status")


@router.post("/clones/{clone_id}/enable", response_model=SuccessResponse)
async def enable_clone_rag(
    clone_id: str,
    current_user_id: str = Depends(get_current_user_id)
) -> SuccessResponse:
    """
    Enable RAG for a clone
    
    Marks the clone as RAG-enabled in the database.
    """
    try:
        await _verify_clone_ownership(clone_id, current_user_id)
        
        # Update clone to enable RAG
        from app.services.rag_integration_service import rag_integration_service
        supabase = rag_integration_service.supabase
        
        supabase.table("clones").update({
            "rag_enabled": True,
            "rag_status": "disabled"  # Will be changed to ready when initialized
        }).eq("id", clone_id).execute()
        
        logger.info("RAG enabled for clone", clone_id=clone_id, user_id=current_user_id)
        
        return SuccessResponse(message="RAG enabled successfully")
        
    except Exception as e:
        logger.error("Failed to enable RAG", clone_id=clone_id, error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to enable RAG: {str(e)}")


@router.post("/clones/{clone_id}/disable", response_model=SuccessResponse)
async def disable_clone_rag(
    clone_id: str,
    current_user_id: str = Depends(get_current_user_id)
) -> SuccessResponse:
    """
    Disable RAG for a clone
    
    Marks the clone as RAG-disabled in the database.
    """
    try:
        await _verify_clone_ownership(clone_id, current_user_id)
        
        # Update clone to disable RAG
        from app.services.rag_integration_service import rag_integration_service
        supabase = rag_integration_service.supabase
        
        supabase.table("clones").update({
            "rag_enabled": False,
            "rag_status": "disabled"
        }).eq("id", clone_id).execute()
        
        logger.info("RAG disabled for clone", clone_id=clone_id, user_id=current_user_id)
        
        return SuccessResponse(message="RAG disabled successfully")
        
    except Exception as e:
        logger.error("Failed to disable RAG", clone_id=clone_id, error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to disable RAG: {str(e)}")


@router.get("/clones/{clone_id}/analytics")
async def get_clone_rag_analytics(
    clone_id: str,
    days: int = Query(default=7, ge=1, le=90, description="Number of days to analyze"),
    current_user_id: str = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """
    Get RAG analytics for a clone
    
    Returns usage statistics, performance metrics, and success rates
    for the specified time period.
    """
    try:
        await _verify_clone_ownership(clone_id, current_user_id)
        
        # Get RAG query statistics
        from app.services.rag_integration_service import rag_integration_service
        supabase = rag_integration_service.supabase
        
        # Calculate date range
        from datetime import datetime, timedelta
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Get query statistics
        queries_result = supabase.table("rag_query_sessions").select(
            "confidence_score, response_time_ms, tokens_used, used_memory_layer, query_type"
        ).eq("clone_id", clone_id).gte("created_at", start_date.isoformat()).execute()
        
        queries = queries_result.data or []
        
        if not queries:
            return {
                "clone_id": clone_id,
                "period_days": days,
                "total_queries": 0,
                "average_confidence": 0.0,
                "average_response_time_ms": 0.0,
                "memory_layer_usage_rate": 0.0,
                "query_type_distribution": {},
                "success_rate": 0.0
            }
        
        # Calculate metrics
        total_queries = len(queries)
        avg_confidence = sum(q.get("confidence_score", 0) for q in queries) / total_queries
        avg_response_time = sum(q.get("response_time_ms", 0) for q in queries) / total_queries
        memory_usage_rate = sum(1 for q in queries if q.get("used_memory_layer")) / total_queries
        
        query_types = {}
        for query in queries:
            qt = query.get("query_type", "unknown")
            query_types[qt] = query_types.get(qt, 0) + 1
        
        success_rate = sum(1 for q in queries if q.get("confidence_score", 0) >= 0.5) / total_queries
        
        return {
            "clone_id": clone_id,
            "period_days": days,
            "total_queries": total_queries,
            "average_confidence": round(avg_confidence, 3),
            "average_response_time_ms": round(avg_response_time, 1),
            "memory_layer_usage_rate": round(memory_usage_rate, 3),
            "query_type_distribution": query_types,
            "success_rate": round(success_rate, 3)
        }
        
    except Exception as e:
        logger.error("Failed to get RAG analytics", clone_id=clone_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to get RAG analytics")


# Helper functions
async def _verify_clone_ownership(clone_id: str, user_id: str):
    """Verify that the user owns the specified clone"""
    from app.services.rag_integration_service import rag_integration_service
    supabase = rag_integration_service.supabase
    
    result = supabase.table("clones").select("id").eq("id", clone_id).eq("creator_id", user_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Clone not found or access denied")


@router.get("/debug/initialization/{initialization_id}")
async def debug_initialization_status(
    initialization_id: str,
    current_user_id: str = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """
    Debug endpoint for detailed RAG initialization monitoring
    Provides real-time status, logs, and diagnostics
    """
    try:
        # Get initialization details
        status = await rag_integration_service.get_initialization_status(initialization_id)
        
        # Get additional debug information
        from app.services.rag_integration_service import rag_integration_service
        supabase = rag_integration_service.supabase
        
        # Get clone information
        if status.get("id"):
            init_result = supabase.table("rag_initializations").select("*").eq("id", initialization_id).execute()
            init_data = init_result.data[0] if init_result.data else {}
            
            clone_id = init_data.get("clone_id")
            if clone_id:
                # Get clone details
                clone_result = supabase.table("clones").select("name, rag_enabled, rag_status").eq("id", clone_id).execute()
                clone_data = clone_result.data[0] if clone_result.data else {}
                
                # Get document count for this clone
                docs_result = supabase.table("knowledge").select("id, title, file_url, content_preview").eq("clone_id", clone_id).execute()
                documents = docs_result.data or []
                
                # Check OpenAI integration status
                openai_status = "unknown"
                vector_store_info = None
                assistant_info = None
                
                try:
                    from app.services.rag_core_service import rag_core_service
                    
                    # Check if expert exists in RAG system
                    rag_expert_result = rag_core_service.rag_supabase.table("experts").select("*").eq("name", clone_id).execute()
                    expert_data = rag_expert_result.data[0] if rag_expert_result.data else None
                    
                    if expert_data:
                        # Check vector store
                        vector_result = rag_core_service.rag_supabase.table("vector_stores").select("*").eq("expert_name", clone_id).execute()
                        vector_store_info = vector_result.data[0] if vector_result.data else None
                        
                        # Check assistant
                        assistant_result = rag_core_service.rag_supabase.table("assistants").select("*").eq("expert_name", clone_id).execute()
                        assistant_info = assistant_result.data[0] if assistant_result.data else None
                        
                        openai_status = "configured" if (vector_store_info and assistant_info) else "partial"
                    else:
                        openai_status = "not_created"
                        
                except Exception as openai_error:
                    logger.warning("Failed to check OpenAI status", error=str(openai_error))
                    openai_status = f"error: {str(openai_error)}"
                
                return {
                    "initialization": status,
                    "debug_info": {
                        "clone_id": clone_id,
                        "clone_name": clone_data.get("name"),
                        "clone_rag_enabled": clone_data.get("rag_enabled"),
                        "clone_rag_status": clone_data.get("rag_status"),
                        "document_count": len(documents),
                        "documents": [
                            {
                                "id": doc.get("id"),
                                "title": doc.get("title"),
                                "has_file_url": bool(doc.get("file_url")),
                                "has_content": bool(doc.get("content_preview")),
                                "content_length": len(doc.get("content_preview", "") or "")
                            } for doc in documents
                        ],
                        "openai_integration": {
                            "status": openai_status,
                            "vector_store": {
                                "exists": bool(vector_store_info),
                                "id": vector_store_info.get("vector_id") if vector_store_info else None,
                                "file_count": len(vector_store_info.get("file_ids", [])) if vector_store_info else 0
                            } if vector_store_info else {"exists": False},
                            "assistant": {
                                "exists": bool(assistant_info),
                                "id": assistant_info.get("assistant_id") if assistant_info else None,
                                "memory_type": assistant_info.get("memory_type") if assistant_info else None
                            } if assistant_info else {"exists": False}
                        },
                        "initialization_details": {
                            "created_at": init_data.get("created_at"),
                            "started_at": init_data.get("started_at"),
                            "completed_at": init_data.get("completed_at"),
                            "total_documents": init_data.get("total_documents"),
                            "processed_documents": init_data.get("processed_documents"),
                            "progress_percentage": init_data.get("progress_percentage"),
                            "current_phase": init_data.get("current_phase"),
                            "error_message": init_data.get("error_message")
                        }
                    },
                    "timestamp": datetime.utcnow().isoformat(),
                    "recommendations": _get_debug_recommendations(status, openai_status, len(documents))
                }
            else:
                return {
                    "error": "Clone ID not found in initialization record",
                    "initialization": status,
                    "timestamp": datetime.utcnow().isoformat()
                }
        else:
            return {
                "error": "Initialization record not found",
                "initialization": status,
                "timestamp": datetime.utcnow().isoformat()
            }
            
    except Exception as e:
        logger.error("Debug initialization status failed", init_id=initialization_id, error=str(e))
        return {
            "error": f"Failed to get debug information: {str(e)}",
            "timestamp": datetime.utcnow().isoformat()
        }

def _get_debug_recommendations(status: Dict, openai_status: str, doc_count: int) -> List[str]:
    """Generate recommendations based on current status"""
    recommendations = []
    
    if status.get("status") == "failed":
        recommendations.append("Check the error message and retry initialization")
        if "OpenAI" in str(status.get("error", "")):
            recommendations.append("Verify OpenAI API key is configured correctly")
        if doc_count == 0:
            recommendations.append("Upload documents to the clone before initializing RAG")
    
    elif status.get("status") in ["analyzing", "embedding", "pending"]:
        if status.get("progress", 0) < 50 and doc_count > 5:
            recommendations.append("Large document sets may take several minutes to process")
        recommendations.append("Monitor the progress percentage and phase for updates")
    
    elif status.get("status") == "completed":
        if openai_status != "configured":
            recommendations.append("RAG marked complete but OpenAI integration may need verification")
        else:
            recommendations.append("RAG initialization successful - memory layer is ready")
    
    if doc_count == 0:
        recommendations.append("Upload documents to enable knowledge-based responses")
    elif doc_count > 20:
        recommendations.append("Consider chunking large document sets for better performance")
    
    return recommendations


@router.get("/debug/clone/{clone_id}/rag-health")
async def debug_clone_rag_health(
    clone_id: str,
    current_user_id: str = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """
    Comprehensive RAG health check for a specific clone
    """
    try:
        await _verify_clone_ownership(clone_id, current_user_id)
        
        # Get RAG status
        rag_status = await rag_integration_service.get_clone_rag_status(clone_id)
        
        # Get documents
        from app.services.rag_integration_service import rag_integration_service
        supabase = rag_integration_service.supabase
        docs_result = supabase.table("knowledge").select("*").eq("clone_id", clone_id).execute()
        documents = docs_result.data or []
        
        # Check recent initializations
        recent_inits = supabase.table("rag_initializations").select("*").eq("clone_id", clone_id).order("created_at", desc=True).limit(5).execute()
        
        # OpenAI integration check
        openai_health = {"status": "unknown", "details": {}}
        try:
            from app.services.rag_core_service import rag_core_service
            expert_status = await rag_core_service.get_expert_status(clone_id)
            openai_health = {
                "status": expert_status.get("status"),
                "details": expert_status
            }
        except Exception as e:
            openai_health = {"status": "error", "error": str(e)}
        
        # RAG client health
        rag_client_health = {"status": "unknown"}
        try:
            from app.services.rag_client import rag_client
            rag_client_health = {
                "status": "available" if rag_client.is_available() else "unavailable",
                "base_url": rag_client.base_url,
                "timeout": rag_client.timeout
            }
        except Exception as e:
            rag_client_health = {"status": "error", "error": str(e)}
        
        return {
            "clone_id": clone_id,
            "rag_status": {
                "is_ready": rag_status.is_ready,
                "status": rag_status.status,
                "document_count": rag_status.document_count,
                "last_initialized": rag_status.last_initialized,
                "error_message": rag_status.error_message
            },
            "document_analysis": {
                "total_documents": len(documents),
                "documents_with_content": len([d for d in documents if d.get("content_preview")]),
                "documents_with_urls": len([d for d in documents if d.get("file_url")]),
                "average_content_length": sum(len(d.get("content_preview", "") or "") for d in documents) / max(len(documents), 1),
                "rag_processing_status": {
                    status: len([d for d in documents if d.get("rag_processing_status") == status])
                    for status in ["pending", "processing", "completed", "failed"]
                }
            },
            "recent_initializations": [
                {
                    "id": init.get("id"),
                    "status": init.get("status"),
                    "progress": init.get("progress_percentage"),
                    "created_at": init.get("created_at"),
                    "completed_at": init.get("completed_at"),
                    "error": init.get("error_message")
                } for init in recent_inits.data or []
            ],
            "integration_health": {
                "openai": openai_health,
                "rag_client": rag_client_health
            },
            "recommendations": _get_health_recommendations(rag_status, len(documents), openai_health),
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error("RAG health check failed", clone_id=clone_id, error=str(e))
        return {
            "error": f"Health check failed: {str(e)}",
            "timestamp": datetime.utcnow().isoformat()
        }

def _get_health_recommendations(rag_status, doc_count: int, openai_health: Dict) -> List[str]:
    """Generate health-based recommendations"""
    recommendations = []
    
    if not rag_status.is_ready:
        if rag_status.status == "not_initialized":
            recommendations.append("Initialize RAG memory layer to enable knowledge-based responses")
        elif rag_status.status == "error":
            recommendations.append(f"Fix RAG error: {rag_status.error_message}")
        elif rag_status.status in ["analyzing", "embedding"]:
            recommendations.append("RAG initialization in progress - wait for completion")
    
    if doc_count == 0:
        recommendations.append("Upload documents to provide knowledge base for RAG")
    elif doc_count < 3:
        recommendations.append("Consider adding more documents for better RAG performance")
    
    if openai_health.get("status") == "error":
        recommendations.append("Check OpenAI API configuration and connection")
    elif openai_health.get("status") == "partial":
        recommendations.append("OpenAI integration partially configured - may need re-initialization")
    
    if not recommendations:
        recommendations.append("RAG system appears healthy and ready for use")
    
    return recommendations


@router.get("/debug/test-init-status/{init_id}")
async def debug_test_init_status(init_id: str):
    """Debug endpoint to test initialization status without auth (temporary)"""
    try:
        logger.info("Debug: Testing initialization status", init_id=init_id)
        
        status = await rag_integration_service.get_initialization_status(init_id)
        
        return {
            "message": "Debug initialization status retrieved", 
            "status": status,
            "init_id": init_id,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error("Debug initialization status failed", init_id=init_id, error=str(e))
        return {
            "error": f"Debug initialization status failed: {str(e)}",
            "init_id": init_id,
            "timestamp": datetime.utcnow().isoformat()
        }


@router.get("/debug/test-status/{clone_id}")
async def debug_test_status(clone_id: str):
    """Debug endpoint to test RAG status without auth (temporary)"""
    try:
        logger.info("Debug: Testing RAG status", clone_id=clone_id)
        
        status = await rag_integration_service.get_clone_rag_status(clone_id)
        
        return {
            "message": "Debug status retrieved",
            "status": {
                "is_ready": status.is_ready,
                "status": status.status,
                "document_count": status.document_count,
                "last_initialized": status.last_initialized,
                "error_message": status.error_message
            },
            "clone_id": clone_id,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error("Debug status failed", clone_id=clone_id, error=str(e))
        return {
            "error": f"Debug status failed: {str(e)}",
            "clone_id": clone_id,
            "timestamp": datetime.utcnow().isoformat()
        }


@router.post("/debug/test-init/{clone_id}")
async def debug_test_initialization(clone_id: str):
    """Debug endpoint to test RAG initialization without auth (temporary)"""
    try:
        # Create a test initialization
        request = RAGInitializationRequest(force_reinitialize=True)
        
        logger.info("Debug: Testing RAG initialization", clone_id=clone_id)
        
        response = await rag_integration_service.initialize_clone_rag(
            clone_id=clone_id,
            user_id="00000000-0000-0000-0000-000000000000",  # Dummy UUID for testing
            force_reinitialize=request.force_reinitialize
        )
        
        return {
            "message": "Debug initialization started",
            "initialization_id": response.initialization_id,
            "status": response.status,
            "clone_id": clone_id,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error("Debug initialization failed", clone_id=clone_id, error=str(e))
        return {
            "error": f"Debug initialization failed: {str(e)}",
            "clone_id": clone_id,
            "timestamp": datetime.utcnow().isoformat()
        }


@router.get("/health")
async def rag_health_check():
    """Health check for RAG system"""
    try:
        from app.services.rag_client import rag_client
        is_available = rag_client.is_available()
        
        return {
            "status": "healthy" if is_available else "degraded",
            "rag_enabled": is_available,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error("RAG health check failed", error=str(e))
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }