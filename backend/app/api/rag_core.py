"""
Core RAG API endpoints integrated into main backend
Based on the standalone RAG service implementation
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional
from datetime import datetime
import json
import os
import structlog

from app.core.supabase_auth import get_current_user_id
from app.database import get_supabase
from app.services.rag_core_service import rag_core_service

logger = structlog.get_logger()
router = APIRouter(prefix="/api", tags=["RAG Core"])


@router.post("/memory/expert/initialize")
async def initialize_expert_memory(
    request: Dict[str, Any],
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Initialize an expert's memory by:
    1. Creating domain if it doesn't exist
    2. Adding files to domain vector from config file
    3. Generating persona from QA data
    4. Creating expert with generated persona
    5. Adding files to expert vector
    
    This is the core endpoint that the RAG client calls.
    """
    try:
        expert_name = request.get("expert_name")
        
        if not expert_name:
            raise HTTPException(status_code=400, detail="expert_name is required")
        
        # Fetch clone data to get the actual category
        from app.database import get_service_supabase
        supabase = get_service_supabase()
        clone_result = supabase.table("clones").select("*").eq("id", expert_name).execute()
        
        if not clone_result.data:
            raise HTTPException(status_code=404, detail=f"Clone {expert_name} not found")
        
        clone = clone_result.data[0]
        domain_name = clone.get("category", "general")
        
        logger.info("Initializing RAG expert memory", 
                   expert_name=expert_name, 
                   domain_name=domain_name,
                   user_id=current_user_id)
        
        # Process the request using our integrated service
        result = await rag_core_service.initialize_expert_memory(
            expert_name=expert_name,
            domain_name=domain_name,
            documents=request.get("documents", []),
            config=request.get("config", {}),
            user_id=current_user_id
        )
        
        return {
            "status": "initialized",
            "expert_id": result["expert_id"],
            "document_count": result["document_count"],
            "initialization_time": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        error_msg = str(e) if str(e) else f"{type(e).__name__}: {repr(e)}"
        logger.error("Failed to initialize expert memory", 
                    expert_name=request.get("expert_name"), 
                    error=error_msg,
                    error_type=type(e).__name__)
        raise HTTPException(status_code=500, detail=error_msg)


@router.post("/memory/expert/{expert_name}/query")
async def query_expert_memory(
    expert_name: str,
    request: Dict[str, Any],
    current_user_id: str = Depends(get_current_user_id)
):
    """Query an expert's memory using the integrated RAG system with assistant and LLM fallback"""
    try:
        query = request.get("query")
        if not query:
            raise HTTPException(status_code=400, detail="query is required")
        
        memory_type = request.get("memory_type", "expert")
        thread_id = request.get("thread_id")
        
        logger.info("Querying RAG expert memory", 
                   expert_name=expert_name, 
                   memory_type=memory_type,
                   has_thread_id=bool(thread_id))
        
        result = await rag_core_service.query_expert(
            expert_name=expert_name,
            query=query,
            context=request.get("context", {}),
            options=request.get("options", {}),
            memory_type=memory_type,
            thread_id=thread_id
        )
        
        return result
        
    except Exception as e:
        logger.error("Failed to query expert memory", 
                    expert_name=expert_name, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/memory/expert/{expert_name}/status")
async def get_expert_status(
    expert_name: str,
    current_user_id: str = Depends(get_current_user_id)
):
    """Get status of an expert's memory initialization"""
    try:
        status = await rag_core_service.get_expert_status(expert_name)
        return status
        
    except Exception as e:
        logger.error("Failed to get expert status", 
                    expert_name=expert_name, error=str(e))
        return {"status": "error", "message": str(e)}


@router.post("/memory/expert/{expert_name}/update")
async def update_expert_memory(
    expert_name: str,
    request: Dict[str, Any],
    current_user_id: str = Depends(get_current_user_id)
):
    """Update an expert's memory with new documents"""
    try:
        documents = request.get("documents", [])
        operation = request.get("operation", "add")
        
        result = await rag_core_service.update_expert(
            expert_name=expert_name,
            documents=documents,
            operation=operation
        )
        
        return result
        
    except Exception as e:
        logger.error("Failed to update expert memory", 
                    expert_name=expert_name, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))