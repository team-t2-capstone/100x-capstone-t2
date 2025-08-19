"""
Legacy RAG Workflow Wrapper

This wrapper provides compatibility for legacy rag_workflow imports
while redirecting to the new CleanRAGService implementation.
"""

import asyncio
from typing import Dict, Any, Optional
import structlog

logger = structlog.get_logger("rag_workflow_wrapper")

class RAGWorkflowWrapper:
    """Wrapper class that mimics the legacy rag_workflow object."""
    
    async def query_clone_expert(
        self, 
        clone_id: str, 
        user_query: str, 
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Legacy wrapper for query_clone_expert function.
        Redirects to new CleanRAGService implementation.
        """
        try:
            from app.services.rag import CleanRAGService
            from app.services.rag.models import QueryRequest
            
            logger.info("Legacy query_clone_expert called, redirecting to CleanRAGService", 
                       clone_id=clone_id, query=user_query[:100])
            
            # Use new clean RAG service
            rag_service = CleanRAGService()
            query_request = QueryRequest(
                clone_id=clone_id,
                query=user_query,
                max_tokens=1000,
                temperature=0.7
            )
            
            result = await rag_service.query_clone(query_request)
            
            # Convert result to legacy format
            return {
                "response": result.response,
                "thread_id": result.thread_id,
                "assistant_id": result.assistant_id,
                "sources": result.sources or [],
                "confidence": result.confidence or 0.8,
                "clone_id": clone_id,
                "query": user_query,
                "timestamp": "2025-08-19T10:20:00Z"
            }
            
        except Exception as e:
            logger.error("Legacy query_clone_expert failed", error=str(e), clone_id=clone_id)
            return {
                "response": f"Sorry, I encountered an error: {str(e)}",
                "error": str(e),
                "clone_id": clone_id,
                "query": user_query
            }

# Create a global instance to mimic the legacy rag_workflow object
rag_workflow = RAGWorkflowWrapper()