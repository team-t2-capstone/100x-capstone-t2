"""
RAG Client Service - HTTP client for external RAG API
Handles all communication with the external RAG service based on the API documentation
"""
import asyncio
import json
from typing import Dict, List, Optional, Any
from datetime import datetime
import httpx
import structlog

from app.config import settings
from app.models.schemas import (
    RAGDocumentUpload, RAGVectorStoreUpdate, RAGExpertQuery, 
    RAGExpertResponse, RAGProcessingStatus
)

logger = structlog.get_logger()


class RAGClientError(Exception):
    """Base exception for RAG client errors"""
    pass


class RAGClient:
    """HTTP client for external RAG API"""
    
    def __init__(self, base_url: str = None, api_key: str = None):
        self.base_url = base_url or getattr(settings, 'RAG_API_BASE_URL', None)
        self.api_key = api_key or getattr(settings, 'RAG_API_KEY', None)
        
        if not self.base_url:
            logger.warning("RAG API base URL not configured")
        if not self.api_key:
            logger.warning("RAG API key not configured")
        
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=httpx.Timeout(30.0),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}" if self.api_key else None
            }
        )
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
    
    def is_available(self) -> bool:
        """Check if RAG client is properly configured"""
        return bool(self.base_url and self.api_key)
    
    async def _make_request(
        self, 
        method: str, 
        endpoint: str, 
        data: Optional[Dict] = None,
        params: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Make HTTP request to RAG API"""
        if not self.is_available():
            raise RAGClientError("RAG API client not properly configured")
        
        try:
            url = endpoint.lstrip('/')
            
            if method.upper() == "GET":
                response = await self.client.get(url, params=params)
            elif method.upper() == "POST":
                response = await self.client.post(url, json=data)
            elif method.upper() == "PUT":
                response = await self.client.put(url, json=data)
            elif method.upper() == "DELETE":
                response = await self.client.delete(url)
            else:
                raise RAGClientError(f"Unsupported HTTP method: {method}")
            
            response.raise_for_status()
            return response.json()
            
        except httpx.HTTPStatusError as e:
            logger.error("RAG API HTTP error", 
                        status_code=e.response.status_code,
                        response_text=e.response.text,
                        endpoint=endpoint)
            raise RAGClientError(f"RAG API error {e.response.status_code}: {e.response.text}")
        except httpx.RequestError as e:
            logger.error("RAG API request error", error=str(e), endpoint=endpoint)
            raise RAGClientError(f"RAG API request failed: {str(e)}")
    
    # Domain Management
    async def get_all_domains(self) -> List[Dict[str, Any]]:
        """Get all domains from RAG API"""
        return await self._make_request("GET", "/domains")
    
    # Expert Management
    async def get_all_experts(self) -> List[Dict[str, Any]]:
        """Get all experts from RAG API"""
        return await self._make_request("GET", "/experts")
    
    async def get_expert_context(self, expert_name: str) -> Dict[str, Any]:
        """Get context for a specific expert"""
        return await self._make_request("GET", f"/experts/{expert_name}/context")
    
    async def get_expert_domain(self, expert_name: str) -> Dict[str, Any]:
        """Get domain name for a specific expert"""
        return await self._make_request("GET", f"/experts/{expert_name}/domain")
    
    async def update_expert_persona(
        self, 
        expert_name: str, 
        qa_pairs: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """Update expert persona from QA data"""
        data = {
            "expert_name": expert_name,
            "qa_pairs": qa_pairs
        }
        return await self._make_request("PUT", "/experts/persona/update", data)
    
    # Document Management
    async def get_documents(
        self, 
        domain: str = None, 
        created_by: str = None, 
        client_name: str = None
    ) -> List[Dict[str, Any]]:
        """Get documents filtered by domain, expert, and client"""
        params = {}
        if domain:
            params["domain"] = domain
        if created_by:
            params["created_by"] = created_by
        if client_name:
            params["client_name"] = client_name
        
        return await self._make_request("GET", "/documents", params=params)
    
    # Vector Store Management
    async def update_vector_store(
        self,
        domain_name: str = None,
        expert_name: str = None,
        document_urls: Dict[str, str] = None
    ) -> RAGProcessingStatus:
        """Update vector store with new documents"""
        data = {
            "document_urls": document_urls or {}
        }
        if domain_name:
            data["domain_name"] = domain_name
        if expert_name:
            data["expert_name"] = expert_name
        
        response = await self._make_request("POST", "/vectors/update", data)
        return RAGProcessingStatus(**response)
    
    # Memory Management
    async def initialize_expert_memory(
        self,
        expert_name: str,
        domain_name: str,
        qa_pairs: List[Dict[str, str]],
        document_urls: Dict[str, str] = None
    ) -> Dict[str, Any]:
        """Initialize expert memory with domain, persona, and documents"""
        data = {
            "expert_name": expert_name,
            "domain_name": domain_name,
            "qa_pairs": qa_pairs,
            "document_urls": document_urls or {}
        }
        return await self._make_request("POST", "/memory/expert/initialize", data)
    
    # Query and Chat
    async def query_expert_with_assistant(
        self,
        expert_name: str,
        query: str,
        memory_type: str = "expert",
        client_name: str = None,
        thread_id: str = None
    ) -> RAGExpertResponse:
        """Query expert using OpenAI Assistant API (simplified)"""
        data = {
            "expert_name": expert_name,
            "query": query,
            "memory_type": memory_type
        }
        if client_name:
            data["client_name"] = client_name
        if thread_id:
            data["thread_id"] = thread_id
        
        response = await self._make_request("POST", "/query_expert_with_assistant", data)
        return RAGExpertResponse(**response)
    
    # OpenAI Assistant Integration
    async def create_assistant(
        self,
        expert_name: str,
        memory_type: str = "expert",
        client_name: str = None,
        model: str = "gpt-4o"
    ) -> Dict[str, Any]:
        """Create OpenAI Assistant for expert"""
        data = {
            "expert_name": expert_name,
            "memory_type": memory_type,
            "model": model
        }
        if client_name:
            data["client_name"] = client_name
        
        return await self._make_request("POST", "/create_assistant", data)
    
    async def create_thread(
        self,
        expert_name: str,
        memory_type: str = "expert",
        client_name: str = None
    ) -> Dict[str, Any]:
        """Create conversation thread"""
        data = {
            "expert_name": expert_name,
            "memory_type": memory_type
        }
        if client_name:
            data["client_name"] = client_name
        
        return await self._make_request("POST", "/create_thread", data)
    
    async def add_message(
        self,
        thread_id: str,
        content: str,
        role: str = "user"
    ) -> Dict[str, Any]:
        """Add message to thread"""
        data = {
            "thread_id": thread_id,
            "content": content,
            "role": role
        }
        return await self._make_request("POST", "/add_message", data)
    
    async def run_thread(
        self,
        thread_id: str,
        assistant_id: str
    ) -> Dict[str, Any]:
        """Run thread with assistant"""
        data = {
            "thread_id": thread_id,
            "assistant_id": assistant_id
        }
        return await self._make_request("POST", "/run_thread", data)
    
    async def get_run_status(
        self,
        thread_id: str,
        run_id: str
    ) -> Dict[str, Any]:
        """Get status of a run"""
        data = {
            "thread_id": thread_id,
            "run_id": run_id
        }
        return await self._make_request("POST", "/get_run_status", data)
    
    async def get_thread_messages(
        self,
        thread_id: str,
        limit: int = None,
        order: str = "desc",
        after: str = None,
        before: str = None
    ) -> Dict[str, Any]:
        """Get messages from thread"""
        data = {
            "thread_id": thread_id,
            "order": order
        }
        if limit:
            data["limit"] = limit
        if after:
            data["after"] = after
        if before:
            data["before"] = before
        
        return await self._make_request("POST", "/get_thread_messages", data)


# Global RAG client instance
rag_client = RAGClient()


async def get_rag_client() -> RAGClient:
    """Dependency to get RAG client"""
    return rag_client


# Convenience functions
async def check_rag_availability() -> bool:
    """Check if RAG service is available"""
    try:
        async with RAGClient() as client:
            if not client.is_available():
                return False
            # Try a simple API call
            await client.get_all_domains()
            return True
    except Exception as e:
        logger.warning("RAG service not available", error=str(e))
        return False


async def initialize_rag_client():
    """Initialize RAG client on startup"""
    if not rag_client.is_available():
        logger.warning("RAG client not properly configured")
        return False
    
    try:
        # Test connection
        await check_rag_availability()
        logger.info("RAG client initialized successfully")
        return True
    except Exception as e:
        logger.error("Failed to initialize RAG client", error=str(e))
        return False