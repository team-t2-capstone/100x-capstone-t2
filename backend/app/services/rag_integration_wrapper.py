"""
Legacy RAG Integration Wrapper

This wrapper provides compatibility for legacy rag_integration imports
while redirecting to the new CleanRAGService implementation.
"""

import asyncio
from typing import Dict, Any, List
import structlog

logger = structlog.get_logger("rag_integration_wrapper")

# Legacy exception classes for compatibility
class RAGServiceError(Exception):
    """Legacy RAG service error for compatibility"""
    pass

class RAGIntegrationService:
    """Legacy RAG integration service wrapper"""
    
    def __init__(self):
        self.initialized = False
    
    async def initialize(self):
        """Initialize service"""
        self.initialized = True
        return True
    
    async def process_clone_knowledge(self, clone_id: str, documents: Dict[str, str]) -> Dict[str, Any]:
        """Process clone knowledge using new CleanRAGService"""
        try:
            from app.services.rag import CleanRAGService
            from app.services.rag.models import DocumentInfo
            
            # Convert to new format
            documents_list = [
                DocumentInfo(name=name, url=url, content_type="document")
                for name, url in documents.items()
            ]
            
            # Use new service
            rag_service = CleanRAGService()
            result = await rag_service.process_clone_documents(clone_id, documents_list)
            
            return {
                "status": "success" if result.status.value == "completed" else "failed",
                "message": f"Processed {result.processed_documents} documents",
                "assistant_id": result.assistant_id
            }
            
        except Exception as e:
            logger.error("RAG integration processing failed", error=str(e))
            raise RAGServiceError(f"Processing failed: {str(e)}")

async def process_clone_knowledge_simple(clone_id: str, clone_data: Dict[str, Any], documents: Dict[str, str]) -> Dict[str, Any]:
    """Legacy wrapper function - now uses CleanRAGService"""
    try:
        from app.services.rag import clean_rag_service
        from app.services.rag.models import DocumentInfo
        
        # Convert to new format
        documents_list = [
            DocumentInfo(name=name, url=url, content_type="document")
            for name, url in documents.items()
        ]
        
        # Use new service
        result = await clean_rag_service.process_clone_documents(clone_id, documents_list)
        
        return {
            "status": "success" if result.status.value == "completed" else "failed",
            "message": f"Processed {result.processed_documents} documents",
            "assistant_id": result.assistant_id,
            "processed_documents": result.processed_documents,
            "error": result.error_message if hasattr(result, 'error_message') else None
        }
    except Exception as e:
        logger.error("Simple knowledge processing failed", error=str(e))
        return {"status": "failed", "error": str(e)}

async def query_clone_expert_simple(clone_id: str, query: str, user_id: str = None) -> Dict[str, Any]:
    """Legacy wrapper function for querying - now uses CleanRAGService"""
    try:
        from app.services.rag import clean_rag_service
        from app.services.rag.models import QueryRequest
        
        query_request = QueryRequest(
            clone_id=clone_id,
            query=query,
            max_tokens=1000,
            temperature=0.7
        )
        
        result = await clean_rag_service.query_clone(query_request)
        
        return {
            "response": {"text": result.response},
            "thread_id": result.thread_id,
            "assistant_id": result.assistant_id,
            "sources": getattr(result, 'sources', []),
            "confidence": getattr(result, 'confidence', 0.8)
        }
    except Exception as e:
        logger.error("Simple query failed", error=str(e))
        return {"response": {"text": f"Error: {str(e)}"}, "error": str(e)}

# Legacy function wrapper for direct imports
async def process_clone_knowledge(clone_id: str, clone_data: Dict[str, Any], documents: Dict[str, str]) -> Dict[str, Any]:
    """Direct legacy wrapper function - now uses CleanRAGService"""
    return await process_clone_knowledge_simple(clone_id, clone_data, documents)