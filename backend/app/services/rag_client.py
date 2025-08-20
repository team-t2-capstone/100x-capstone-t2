"""
RAG Client Service
Handles communication with the external RAG system API
"""
import asyncio
import aiohttp
import json
import time
from typing import Dict, List, Any, Optional
from datetime import datetime
import structlog

from app.config import settings
from app.models.schemas import (
    RAGDocument, RAGQueryRequestEnhanced, RAGQueryResponseEnhanced, 
    RAGSource, RAGInitializationResponse, RAGUpdateResponse
)

logger = structlog.get_logger()

class RAGClient:
    def __init__(self):
        self.base_url = settings.RAG_API_BASE_URL
        self.api_key = settings.RAG_API_KEY
        self.timeout = settings.RAG_API_TIMEOUT
        self.max_retries = settings.RAG_MAX_RETRIES
        self.session: Optional[aiohttp.ClientSession] = None
        
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session"""
        if self.session is None or self.session.closed:
            headers = {"Content-Type": "application/json"}
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"
            
            timeout = aiohttp.ClientTimeout(total=self.timeout)
            self.session = aiohttp.ClientSession(
                headers=headers,
                timeout=timeout,
                connector=aiohttp.TCPConnector(limit=100)
            )
        return self.session
    
    async def close(self):
        """Close the HTTP session"""
        if self.session and not self.session.closed:
            await self.session.close()
    
    async def _make_request(
        self, 
        method: str, 
        endpoint: str, 
        data: Optional[Dict] = None,
        params: Optional[Dict] = None,
        retry_count: int = 0
    ) -> Dict:
        """Make HTTP request with retry logic"""
        session = await self._get_session()
        url = f"{self.base_url}{endpoint}"
        
        try:
            async with session.request(
                method=method,
                url=url,
                json=data,
                params=params
            ) as response:
                response_data = await response.json()
                
                if response.status == 200:
                    return response_data
                else:
                    error_msg = response_data.get('detail', f'HTTP {response.status}')
                    raise RAGServiceError(f"RAG API error: {error_msg}", response.status)
                    
        except asyncio.TimeoutError:
            if retry_count < self.max_retries:
                wait_time = 2 ** retry_count
                logger.warning(f"RAG API timeout, retrying in {wait_time}s", endpoint=endpoint, retry=retry_count + 1)
                await asyncio.sleep(wait_time)
                return await self._make_request(method, endpoint, data, params, retry_count + 1)
            raise RAGTimeoutError(f"RAG API timeout after {self.max_retries} retries")
        
        except aiohttp.ClientError as e:
            if retry_count < self.max_retries:
                wait_time = 2 ** retry_count
                logger.warning(f"RAG API error, retrying in {wait_time}s", error=str(e), retry=retry_count + 1)
                await asyncio.sleep(wait_time)
                return await self._make_request(method, endpoint, data, params, retry_count + 1)
            raise RAGServiceUnavailableError(f"RAG service unavailable: {str(e)}")
        
        except Exception as e:
            logger.error("Unexpected error in RAG API request", error=str(e), endpoint=endpoint)
            raise RAGServiceError(f"Unexpected error: {str(e)}")
    
    async def initialize_expert(
        self,
        expert_name: str,
        documents: List[RAGDocument],
        config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Initialize RAG expert using the /memory/expert/initialize endpoint"""
        
        # Format documents for RAG API
        formatted_docs = []
        for doc in documents:
            formatted_docs.append({
                "name": doc.name,
                "url": doc.url,
                "content": doc.content,
                "metadata": doc.metadata
            })
        
        # Use default config if not provided
        if config is None:
            config = {
                "embedding_model": "text-embedding-3-small",
                "chunk_size": settings.RAG_CHUNK_SIZE,
                "chunk_overlap": settings.RAG_CHUNK_OVERLAP,
                "max_documents": settings.RAG_MAX_DOCUMENTS
            }
        
        request_data = {
            "expert_name": expert_name,
            "documents": formatted_docs,
            "config": config
        }
        
        logger.info("Initializing RAG expert", expert_name=expert_name, doc_count=len(documents))
        
        try:
            response = await self._make_request("POST", "/memory/expert/initialize", request_data)
            
            return {
                "status": "initialized",
                "expert_id": response.get("expert_id", expert_name),
                "document_count": len(documents),
                "initialization_time": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error("Failed to initialize RAG expert", expert_name=expert_name, error=str(e))
            raise
    
    async def query_expert_with_assistant(
        self,
        request: RAGQueryRequestEnhanced
    ) -> RAGQueryResponseEnhanced:
        """Query RAG expert using the /query_expert_with_assistant endpoint"""
        
        request_data = {
            "expert_name": request.expert_name,
            "query": request.query,
            "memory_type": "expert",
            "client_name": request.context.get("clone_name") if request.context else None,
            "context": request.context,
            "options": request.options,
            "personality_config": request.personality_config
        }
        
        start_time = time.time()
        
        try:
            response = await self._make_request("POST", "/query_expert_with_assistant", request_data)
            
            response_time_ms = int((time.time() - start_time) * 1000)
            
            # Parse response and format sources
            sources = []
            if response.get("sources"):
                for source in response["sources"]:
                    sources.append(RAGSource(
                        document_name=source.get("document_name", "Unknown"),
                        content_snippet=source.get("content_snippet", ""),
                        relevance_score=source.get("relevance_score", 0.0),
                        page=source.get("page")
                    ))
            
            return RAGQueryResponseEnhanced(
                response=response.get("response", ""),
                confidence_score=response.get("confidence_score", 0.0),
                sources=sources,
                used_memory_layer=response.get("used_memory_layer", True),
                used_llm_fallback=response.get("used_llm_fallback", False),
                used_personality_enhancement=response.get("used_personality_enhancement", True),
                tokens_used=response.get("tokens_used", 0),
                response_time_ms=response_time_ms,
                query_type="memory"
            )
            
        except Exception as e:
            logger.error("Failed to query RAG expert", expert_name=request.expert_name, error=str(e))
            raise
    
    async def update_expert(
        self,
        expert_name: str,
        operation: str,
        documents: List[RAGDocument],
        update_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Update RAG expert using the /expert/update endpoint"""
        
        formatted_docs = []
        for doc in documents:
            formatted_docs.append({
                "name": doc.name,
                "url": doc.url,
                "content": doc.content,
                "metadata": doc.metadata
            })
        
        request_data = {
            "expert_name": expert_name,
            "operation": operation,
            "documents": formatted_docs,
            "update_config": update_config or {
                "merge_strategy": "append",
                "reindex_on_update": True,
                "preserve_existing": True
            }
        }
        
        try:
            response = await self._make_request("PUT", "/expert/update", request_data)
            
            return {
                "status": "updated",
                "documents_processed": len(documents),
                "documents_added": response.get("documents_added", len(documents)),
                "documents_updated": response.get("documents_updated", 0),
                "documents_failed": response.get("documents_failed", 0),
                "update_time": datetime.utcnow()
            }
            
        except Exception as e:
            logger.error("Failed to update RAG expert", expert_name=expert_name, error=str(e))
            raise
    
    async def check_expert_status(self, expert_name: str) -> Dict[str, Any]:
        """Check status of RAG expert"""
        try:
            response = await self._make_request("GET", f"/expert/{expert_name}/status")
            return response
        except Exception as e:
            logger.error("Failed to check expert status", expert_name=expert_name, error=str(e))
            return {"status": "error", "message": str(e)}
    
    async def delete_vector_store(self, vector_store_id: str) -> Dict[str, Any]:
        """Delete a vector store from OpenAI"""
        try:
            import openai
            from app.config import settings
            
            client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            await client.beta.vector_stores.delete(vector_store_id)
            
            logger.info("Vector store deleted successfully", vector_store_id=vector_store_id)
            return {"status": "success", "message": "Vector store deleted"}
        except Exception as e:
            logger.error("Failed to delete vector store", vector_store_id=vector_store_id, error=str(e))
            raise RAGServiceError(f"Failed to delete vector store: {str(e)}")
    
    async def delete_assistant(self, assistant_id: str) -> Dict[str, Any]:
        """Delete an assistant from OpenAI"""
        try:
            import openai
            from app.config import settings
            
            client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            await client.beta.assistants.delete(assistant_id)
            
            logger.info("Assistant deleted successfully", assistant_id=assistant_id)
            return {"status": "success", "message": "Assistant deleted"}
        except Exception as e:
            logger.error("Failed to delete assistant", assistant_id=assistant_id, error=str(e))
            raise RAGServiceError(f"Failed to delete assistant: {str(e)}")
    
    def is_available(self) -> bool:
        """Check if RAG service is available"""
        return bool(self.base_url and settings.RAG_ENABLED)


# Custom exceptions for RAG service errors
class RAGServiceError(Exception):
    """Base RAG service error"""
    def __init__(self, message: str, status_code: int = None):
        super().__init__(message)
        self.status_code = status_code

class RAGTimeoutError(RAGServiceError):
    """RAG service timeout error"""
    pass

class RAGServiceUnavailableError(RAGServiceError):
    """RAG service unavailable error"""
    pass

class RAGAuthenticationError(RAGServiceError):
    """RAG authentication error"""
    pass


# Global RAG client instance
rag_client = RAGClient()

# Cleanup function
async def cleanup_rag_client():
    """Cleanup RAG client on shutdown"""
    await rag_client.close()