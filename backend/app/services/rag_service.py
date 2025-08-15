"""
Unified RAG Service for CloneAI - Simplified single-file solution

This module consolidates all RAG functionality into a single, maintainable service
using modern OpenAI embeddings and vector search approaches.

Key Features:
- Document processing with text-embedding-3-small/large
- Vector storage and similarity search
- Expert management and query processing 
- CloneAI integration with personality-aware responses
- Simplified error handling and health monitoring
"""

import asyncio
import hashlib
import httpx
import json
import logging
import os
import re
import time
import uuid
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
from urllib.parse import urlparse

import numpy as np
from openai import OpenAI
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ===== DATA MODELS =====

class RAGDocument(BaseModel):
    """Document for RAG processing"""
    content: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    chunk_id: Optional[str] = None
    url: Optional[str] = None
    file_type: Optional[str] = None


class RAGChunk(BaseModel):
    """Text chunk with embedding"""
    id: str
    content: str
    embedding: List[float]
    metadata: Dict[str, Any] = Field(default_factory=dict)
    document_id: str
    chunk_index: int


class RAGQuery(BaseModel):
    """Query request"""
    clone_id: str
    query: str
    top_k: int = 5
    similarity_threshold: float = 0.7


class RAGResponse(BaseModel):
    """Query response with sources"""
    answer: str
    sources: List[str] = Field(default_factory=list)
    confidence: float = 0.0
    thread_id: Optional[str] = None
    assistant_id: Optional[str] = None


class RAGProcessingStatus(BaseModel):
    """Processing status tracking"""
    clone_id: str
    status: str  # 'pending', 'processing', 'completed', 'failed'
    processed_documents: int = 0
    total_documents: int = 0
    error_message: Optional[str] = None
    expert_name: Optional[str] = None
    assistant_id: Optional[str] = None


# ===== CORE RAG SERVICE =====

class RAGService:
    """
    Unified RAG service providing document processing, vector search, 
    and query capabilities using modern OpenAI approaches
    """
    
    def __init__(self):
        """Initialize RAG service with OpenAI client and configuration"""
        from ..config import settings
        from ..database import get_supabase, get_service_supabase
        
        self.settings = settings
        self.supabase = get_service_supabase() or get_supabase()
        self.client: Optional[OpenAI] = None
        self.embedding_model = "text-embedding-3-small"  # Modern, cost-effective model
        self.chat_model = "gpt-4o"
        self.max_chunk_size = 1000  # Optimal for embeddings
        self.chunk_overlap = 200
        
        # In-memory storage for embeddings (for prototype - can be moved to vector DB)
        self._embeddings_store: Dict[str, List[RAGChunk]] = {}
        self._documents_store: Dict[str, RAGDocument] = {}
    
    async def __aenter__(self):
        """Async context manager entry"""
        await self.initialize()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        # Nothing to cleanup for current implementation
        pass
    
    async def initialize(self) -> bool:
        """Initialize OpenAI client and validate configuration"""
        try:
            if not self.settings.OPENAI_API_KEY:
                logger.error("OPENAI_API_KEY not configured")
                return False
            
            # Initialize OpenAI client
            self.client = OpenAI(api_key=self.settings.OPENAI_API_KEY)
            
            # Test the connection
            await self._test_openai_connection()
            
            logger.info("RAG service initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize RAG service: {str(e)}")
            return False
    
    async def _test_openai_connection(self) -> bool:
        """Test OpenAI API connection"""
        try:
            # Test with a simple embedding call
            test_response = self.client.embeddings.create(
                model=self.embedding_model,
                input="test connection",
                encoding_format="float"
            )
            return len(test_response.data) > 0
        except Exception as e:
            logger.error(f"OpenAI connection test failed: {str(e)}")
            raise
    
    def validate_configuration(self) -> Dict[str, Any]:
        """Validate RAG service configuration and return detailed status"""
        validation = {
            "valid": False,
            "openai_configured": bool(self.settings.OPENAI_API_KEY),
            "supabase_configured": bool(self.supabase),
            "client_initialized": bool(self.client),
            "errors": [],
            "suggestions": []
        }
        
        if not self.settings.OPENAI_API_KEY:
            validation["errors"].append("OPENAI_API_KEY not configured")
            validation["suggestions"].append("Set OPENAI_API_KEY environment variable")
        
        if not self.supabase:
            validation["errors"].append("Supabase client not available")
            validation["suggestions"].append("Check SUPABASE_URL and SUPABASE_SERVICE_KEY")
        
        if not self.client and self.settings.OPENAI_API_KEY:
            validation["errors"].append("OpenAI client not initialized")
            validation["suggestions"].append("Call initialize() method first")
        
        validation["valid"] = (
            validation["openai_configured"] and 
            validation["supabase_configured"] and 
            validation["client_initialized"]
        )
        
        return validation
    
    # ===== DOCUMENT PROCESSING =====
    
    def _extract_text_from_content(self, content: bytes, file_type: str) -> str:
        """Extract text from document content based on file type"""
        try:
            if file_type.lower() in ['txt', 'md', 'py', 'js', 'html', 'css']:
                return content.decode('utf-8', errors='ignore')
            elif file_type.lower() == 'pdf':
                # For PDF, we'll use a simple text extraction
                # In production, you might want to use PyPDF2 or similar
                return content.decode('utf-8', errors='ignore')
            else:
                # Try to decode as text
                return content.decode('utf-8', errors='ignore')
        except Exception as e:
            logger.warning(f"Failed to extract text from {file_type}: {str(e)}")
            return f"[Content extraction failed for {file_type} file]"
    
    async def _download_document(self, url: str) -> Tuple[bytes, str]:
        """Download document from URL and determine file type"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url)
                response.raise_for_status()
                
                # Determine file type from URL or content-type
                parsed_url = urlparse(url)
                file_ext = Path(parsed_url.path).suffix.lower()
                
                if not file_ext:
                    content_type = response.headers.get('content-type', '')
                    if 'pdf' in content_type:
                        file_ext = '.pdf'
                    elif 'text' in content_type:
                        file_ext = '.txt'
                    else:
                        file_ext = '.txt'  # Default
                
                return response.content, file_ext[1:]  # Remove the dot
                
        except Exception as e:
            logger.error(f"Failed to download document from {url}: {str(e)}")
            raise
    
    def _chunk_text(self, text: str, chunk_size: int = None, overlap: int = None) -> List[str]:
        """Split text into overlapping chunks for embedding"""
        chunk_size = chunk_size or self.max_chunk_size
        overlap = overlap or self.chunk_overlap
        
        if len(text) <= chunk_size:
            return [text]
        
        chunks = []
        start = 0
        
        while start < len(text):
            end = start + chunk_size
            
            # Try to break at sentence boundary
            if end < len(text):
                # Look for sentence ending within last 100 characters
                sentence_end = text.rfind('.', start + chunk_size - 100, end)
                if sentence_end > start:
                    end = sentence_end + 1
            
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            
            start = end - overlap
            if start >= len(text):
                break
        
        return chunks
    
    async def _create_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Create embeddings for text chunks using OpenAI"""
        if not self.client:
            raise Exception("OpenAI client not initialized")
        
        try:
            # Process in batches to avoid rate limits
            batch_size = 100
            all_embeddings = []
            
            for i in range(0, len(texts), batch_size):
                batch = texts[i:i + batch_size]
                
                response = self.client.embeddings.create(
                    model=self.embedding_model,
                    input=batch,
                    encoding_format="float"
                )
                
                batch_embeddings = [data.embedding for data in response.data]
                all_embeddings.extend(batch_embeddings)
                
                # Small delay to respect rate limits
                if i + batch_size < len(texts):
                    await asyncio.sleep(0.1)
            
            return all_embeddings
            
        except Exception as e:
            logger.error(f"Failed to create embeddings: {str(e)}")
            raise
    
    def _cosine_similarity(self, a: List[float], b: List[float]) -> float:
        """Calculate cosine similarity between two embeddings"""
        a_np = np.array(a)
        b_np = np.array(b)
        
        dot_product = np.dot(a_np, b_np)
        norm_a = np.linalg.norm(a_np)
        norm_b = np.linalg.norm(b_np)
        
        if norm_a == 0 or norm_b == 0:
            return 0.0
        
        return float(dot_product / (norm_a * norm_b))
    
    async def process_documents(self, clone_id: str, documents: Dict[str, str]) -> Dict[str, Any]:
        """
        Process documents for a clone - download, chunk, embed, and store
        
        Args:
            clone_id: Clone identifier
            documents: Dict of document_name -> document_url
            
        Returns:
            Processing results with status and metadata
        """
        if not self.client:
            await self.initialize()
        
        processing_results = {
            "clone_id": clone_id,
            "status": "processing",
            "processed_documents": 0,
            "total_documents": len(documents),
            "errors": []
        }
        
        clone_chunks = []
        
        try:
            for doc_name, doc_url in documents.items():
                try:
                    logger.info(f"Processing document: {doc_name}")
                    
                    # Download document
                    content, file_type = await self._download_document(doc_url)
                    
                    # Extract text
                    text = self._extract_text_from_content(content, file_type)
                    
                    if not text or len(text.strip()) < 50:
                        logger.warning(f"Document {doc_name} has insufficient text content")
                        continue
                    
                    # Create document record
                    doc_id = str(uuid.uuid4())
                    document = RAGDocument(
                        content=text,
                        metadata={
                            "name": doc_name,
                            "url": doc_url,
                            "file_type": file_type,
                            "clone_id": clone_id,
                            "processed_at": datetime.utcnow().isoformat()
                        },
                        url=doc_url,
                        file_type=file_type
                    )
                    
                    self._documents_store[doc_id] = document
                    
                    # Chunk the text
                    chunks = self._chunk_text(text)
                    
                    if not chunks:
                        continue
                    
                    # Create embeddings
                    embeddings = await self._create_embeddings(chunks)
                    
                    # Create chunk objects
                    for i, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
                        chunk_id = f"{doc_id}_chunk_{i}"
                        
                        chunk = RAGChunk(
                            id=chunk_id,
                            content=chunk_text,
                            embedding=embedding,
                            metadata={
                                "document_name": doc_name,
                                "document_id": doc_id,
                                "clone_id": clone_id,
                                "chunk_index": i,
                                "file_type": file_type
                            },
                            document_id=doc_id,
                            chunk_index=i
                        )
                        
                        clone_chunks.append(chunk)
                    
                    processing_results["processed_documents"] += 1
                    logger.info(f"Successfully processed {doc_name} into {len(chunks)} chunks")
                    
                except Exception as e:
                    error_msg = f"Failed to process document {doc_name}: {str(e)}"
                    logger.error(error_msg)
                    processing_results["errors"].append(error_msg)
                    continue
            
            # Store chunks for this clone
            if clone_chunks:
                self._embeddings_store[clone_id] = clone_chunks
                
                # Also store in Supabase for persistence
                await self._store_embeddings_in_database(clone_id, clone_chunks)
            
            # Determine final status
            if processing_results["processed_documents"] == processing_results["total_documents"]:
                processing_results["status"] = "completed"
            elif processing_results["processed_documents"] > 0:
                processing_results["status"] = "partial"
            else:
                processing_results["status"] = "failed"
            
            processing_results["total_chunks"] = len(clone_chunks)
            
            logger.info(f"Document processing completed for clone {clone_id}: {processing_results['status']}")
            return processing_results
            
        except Exception as e:
            logger.error(f"Document processing failed for clone {clone_id}: {str(e)}")
            processing_results["status"] = "failed"
            processing_results["errors"].append(str(e))
            return processing_results
    
    async def _store_embeddings_in_database(self, clone_id: str, chunks: List[RAGChunk]):
        """Store embeddings in Supabase for persistence"""
        if not self.supabase:
            logger.warning("Supabase not available - embeddings stored in memory only")
            return
        
        try:
            # Store in a simple JSON format for prototype
            # In production, you might use a dedicated vector database
            embeddings_data = {
                "clone_id": clone_id,
                "chunks": [
                    {
                        "id": chunk.id,
                        "content": chunk.content,
                        "embedding": chunk.embedding,
                        "metadata": chunk.metadata
                    }
                    for chunk in chunks
                ],
                "created_at": datetime.utcnow().isoformat()
            }
            
            # Store in a clone_embeddings table (you may need to create this)
            self.supabase.table("clone_embeddings").upsert({
                "clone_id": clone_id,
                "embeddings_data": embeddings_data,
                "updated_at": datetime.utcnow().isoformat()
            }).execute()
            
            logger.info(f"Stored {len(chunks)} embeddings in database for clone {clone_id}")
            
        except Exception as e:
            logger.error(f"Failed to store embeddings in database: {str(e)}")
    
    # ===== EXPERT MANAGEMENT =====
    
    def _generate_expert_name(self, clone_name: str, clone_id: str) -> str:
        """Generate consistent expert name"""
        clean_name = re.sub(r'[^a-zA-Z0-9_]', '_', clone_name.lower())
        return f"{clean_name}_{clone_id[:8]}"
    
    def _create_expert_context(self, clone_data: Dict[str, Any]) -> str:
        """Create expert context from clone data"""
        context_parts = []
        
        # Basic information
        name = clone_data.get("name", "Assistant")
        context_parts.append(f"You are {name}.")
        
        # Bio/description
        bio = clone_data.get("bio") or clone_data.get("description", "")
        if bio:
            context_parts.append(f"About you: {bio}")
        
        # Professional title and expertise
        professional_title = clone_data.get("professional_title", "")
        if professional_title:
            context_parts.append(f"You work as a {professional_title}.")
        
        # Personality traits
        personality = clone_data.get("personality_traits", {})
        if personality:
            traits = [f"{k}: {v}" for k, v in personality.items() if v]
            if traits:
                context_parts.append(f"Your personality traits: {', '.join(traits)}.")
        
        # Communication style
        comm_style = clone_data.get("communication_style", {})
        if comm_style:
            style = comm_style.get("style", "professional")
            length = comm_style.get("response_length", "medium")
            context_parts.append(f"Communicate in a {style} manner with {length} responses.")
        
        # Knowledge access
        context_parts.append("You have access to specialized knowledge from uploaded documents.")
        context_parts.append("Always provide helpful, accurate, and contextually relevant responses.")
        
        return " ".join(context_parts)
    
    async def initialize_expert(self, clone_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Initialize expert with OpenAI Assistant API
        
        Args:
            clone_data: Clone information including name, bio, personality, etc.
            
        Returns:
            Expert initialization results with assistant_id
        """
        if not self.client:
            await self.initialize()
        
        try:
            clone_id = clone_data["id"]
            expert_name = self._generate_expert_name(clone_data["name"], clone_id)
            
            # Create expert context/instructions
            instructions = self._create_expert_context(clone_data)
            
            # Check if embeddings exist for this clone
            has_embeddings = clone_id in self._embeddings_store or await self._load_embeddings_from_database(clone_id)
            
            # Create OpenAI Assistant
            tools = []
            tool_resources = {}
            
            # For now, we'll use function calling instead of file_search for better control
            if has_embeddings:
                tools.append({
                    "type": "function",
                    "function": {
                        "name": "search_knowledge",
                        "description": "Search the knowledge base for relevant information",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "query": {
                                    "type": "string",
                                    "description": "Search query for finding relevant information"
                                }
                            },
                            "required": ["query"]
                        }
                    }
                })
            
            assistant = self.client.beta.assistants.create(
                name=expert_name,
                instructions=instructions,
                model=self.chat_model,
                tools=tools,
                tool_resources=tool_resources
            )
            
            # Store assistant information
            expert_info = {
                "assistant_id": assistant.id,
                "expert_name": expert_name,
                "clone_id": clone_id,
                "instructions": instructions,
                "has_embeddings": has_embeddings,
                "created_at": datetime.utcnow().isoformat()
            }
            
            # Store in database
            if self.supabase:
                self.supabase.table("clone_assistants").upsert({
                    "clone_id": clone_id,
                    "assistant_id": assistant.id,
                    "expert_name": expert_name,
                    "metadata": expert_info,
                    "updated_at": datetime.utcnow().isoformat()
                }).execute()
            
            logger.info(f"Expert initialized successfully: {expert_name} (Assistant: {assistant.id})")
            return expert_info
            
        except Exception as e:
            logger.error(f"Failed to initialize expert: {str(e)}")
            raise
    
    async def _load_embeddings_from_database(self, clone_id: str) -> bool:
        """Load embeddings from database to memory"""
        if not self.supabase or clone_id in self._embeddings_store:
            return clone_id in self._embeddings_store
        
        try:
            result = self.supabase.table("clone_embeddings").select("*").eq("clone_id", clone_id).execute()
            
            if not result.data:
                return False
            
            embeddings_data = result.data[0]["embeddings_data"]
            chunks = []
            
            for chunk_data in embeddings_data["chunks"]:
                chunk = RAGChunk(
                    id=chunk_data["id"],
                    content=chunk_data["content"],
                    embedding=chunk_data["embedding"],
                    metadata=chunk_data["metadata"],
                    document_id=chunk_data["metadata"].get("document_id", ""),
                    chunk_index=chunk_data["metadata"].get("chunk_index", 0)
                )
                chunks.append(chunk)
            
            self._embeddings_store[clone_id] = chunks
            logger.info(f"Loaded {len(chunks)} embeddings for clone {clone_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load embeddings from database: {str(e)}")
            return False
    
    # ===== QUERY PROCESSING =====
    
    async def _search_similar_chunks(self, clone_id: str, query: str, top_k: int = 5) -> List[RAGChunk]:
        """Find similar chunks using cosine similarity"""
        # Ensure embeddings are loaded
        if clone_id not in self._embeddings_store:
            await self._load_embeddings_from_database(clone_id)
        
        if clone_id not in self._embeddings_store:
            return []
        
        # Create query embedding
        query_embeddings = await self._create_embeddings([query])
        query_embedding = query_embeddings[0]
        
        # Calculate similarities
        chunks = self._embeddings_store[clone_id]
        similarities = []
        
        for chunk in chunks:
            similarity = self._cosine_similarity(query_embedding, chunk.embedding)
            similarities.append((chunk, similarity))
        
        # Sort by similarity and return top_k
        similarities.sort(key=lambda x: x[1], reverse=True)
        return [chunk for chunk, _ in similarities[:top_k] if _ > 0.7]  # Threshold filter
    
    async def _handle_function_call(self, function_call, clone_id: str) -> str:
        """Handle function calls from the assistant"""
        function_name = function_call.function.name
        
        if function_name == "search_knowledge":
            try:
                args = json.loads(function_call.function.arguments)
                query = args.get("query", "")
                
                # Search for similar chunks
                similar_chunks = await self._search_similar_chunks(clone_id, query, top_k=5)
                
                if not similar_chunks:
                    return "No relevant information found in the knowledge base."
                
                # Format results
                results = []
                for i, chunk in enumerate(similar_chunks, 1):
                    doc_name = chunk.metadata.get("document_name", "Unknown Document")
                    results.append(f"Source {i} ({doc_name}): {chunk.content}")
                
                return "\n\n".join(results)
                
            except Exception as e:
                logger.error(f"Function call error: {str(e)}")
                return f"Error searching knowledge base: {str(e)}"
        
        return f"Unknown function: {function_name}"
    
    async def query_expert(self, clone_id: str, query: str, thread_id: Optional[str] = None) -> RAGResponse:
        """
        Query expert using semantic search and GPT responses
        
        Args:
            clone_id: Clone identifier
            query: User query
            thread_id: Optional conversation thread ID
            
        Returns:
            RAG response with answer and sources
        """
        if not self.client:
            await self.initialize()
        
        try:
            # Get or create assistant
            assistant_info = await self._get_assistant_info(clone_id)
            if not assistant_info:
                return RAGResponse(
                    answer="I'm sorry, but I'm not properly configured yet. Please ensure my knowledge base has been processed.",
                    confidence=0.0
                )
            
            assistant_id = assistant_info["assistant_id"]
            
            # Create or use existing thread
            if not thread_id:
                thread = self.client.beta.threads.create()
                thread_id = thread.id
            
            # Add user message
            self.client.beta.threads.messages.create(
                thread_id=thread_id,
                role="user",
                content=query
            )
            
            # Run the assistant
            run = self.client.beta.threads.runs.create(
                thread_id=thread_id,
                assistant_id=assistant_id
            )
            
            # Wait for completion with function call handling
            max_iterations = 10
            for _ in range(max_iterations):
                run_status = self.client.beta.threads.runs.retrieve(
                    thread_id=thread_id,
                    run_id=run.id
                )
                
                if run_status.status == "completed":
                    break
                elif run_status.status == "requires_action":
                    # Handle function calls
                    tool_outputs = []
                    
                    for tool_call in run_status.required_action.submit_tool_outputs.tool_calls:
                        output = await self._handle_function_call(tool_call, clone_id)
                        tool_outputs.append({
                            "tool_call_id": tool_call.id,
                            "output": output
                        })
                    
                    # Submit tool outputs
                    self.client.beta.threads.runs.submit_tool_outputs(
                        thread_id=thread_id,
                        run_id=run.id,
                        tool_outputs=tool_outputs
                    )
                elif run_status.status in ["failed", "cancelled", "expired"]:
                    logger.error(f"Assistant run failed with status: {run_status.status}")
                    return RAGResponse(
                        answer="I'm experiencing technical difficulties. Please try again.",
                        confidence=0.0
                    )
                
                await asyncio.sleep(1)
            
            # Get the response
            messages = self.client.beta.threads.messages.list(
                thread_id=thread_id,
                limit=1
            )
            
            if not messages.data:
                return RAGResponse(
                    answer="I'm sorry, I didn't receive a proper response. Please try again.",
                    confidence=0.0
                )
            
            latest_message = messages.data[0]
            if latest_message.role != "assistant":
                return RAGResponse(
                    answer="I'm sorry, there was an issue with my response. Please try again.",
                    confidence=0.0
                )
            
            # Extract response text
            response_text = ""
            for content_item in latest_message.content:
                if content_item.type == "text":
                    response_text += content_item.text.value
            
            # Extract sources (this could be improved with better tracking)
            sources = []
            if clone_id in self._embeddings_store:
                # Get some source documents
                chunks = self._embeddings_store[clone_id]
                doc_names = set()
                for chunk in chunks[:3]:  # Limit sources
                    doc_name = chunk.metadata.get("document_name")
                    if doc_name:
                        doc_names.add(doc_name)
                sources = list(doc_names)
            
            return RAGResponse(
                answer=response_text,
                sources=sources,
                confidence=0.8,  # Could be calculated based on similarity scores
                thread_id=thread_id,
                assistant_id=assistant_id
            )
            
        except Exception as e:
            logger.error(f"Query processing failed: {str(e)}")
            return RAGResponse(
                answer="I'm experiencing technical difficulties. Please try again later.",
                confidence=0.0
            )
    
    async def _get_assistant_info(self, clone_id: str) -> Optional[Dict[str, Any]]:
        """Get assistant information for a clone"""
        if not self.supabase:
            return None
        
        try:
            result = self.supabase.table("clone_assistants").select("*").eq("clone_id", clone_id).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Failed to get assistant info: {str(e)}")
            return None
    
    async def get_processing_status(self, clone_id: str) -> RAGProcessingStatus:
        """Get processing status for a clone"""
        try:
            # Check embeddings
            has_embeddings = clone_id in self._embeddings_store or await self._load_embeddings_from_database(clone_id)
            
            # Check assistant
            assistant_info = await self._get_assistant_info(clone_id)
            
            if has_embeddings and assistant_info:
                status = "completed"
                chunks_count = len(self._embeddings_store.get(clone_id, []))
            elif has_embeddings or assistant_info:
                status = "partial"
                chunks_count = len(self._embeddings_store.get(clone_id, []))
            else:
                status = "pending"
                chunks_count = 0
            
            return RAGProcessingStatus(
                clone_id=clone_id,
                status=status,
                processed_documents=chunks_count,
                total_documents=chunks_count,
                expert_name=assistant_info.get("expert_name") if assistant_info else None,
                assistant_id=assistant_info.get("assistant_id") if assistant_info else None
            )
            
        except Exception as e:
            logger.error(f"Failed to get processing status: {str(e)}")
            return RAGProcessingStatus(
                clone_id=clone_id,
                status="failed",
                error_message=str(e)
            )


# ===== CONVENIENCE FUNCTIONS =====

async def process_clone_knowledge(
    clone_id: str,
    clone_data: Dict[str, Any],
    documents: Dict[str, str]
) -> Dict[str, Any]:
    """
    Complete clone knowledge processing - documents + expert initialization
    
    Args:
        clone_id: Clone identifier
        clone_data: Clone information (name, bio, personality, etc.)
        documents: Dict of document_name -> document_url
        
    Returns:
        Complete processing results
    """
    try:
        async with RAGService() as rag_service:
            # Process documents
            doc_results = await rag_service.process_documents(clone_id, documents)
            
            # Initialize expert
            expert_results = await rag_service.initialize_expert(clone_data)
            
            return {
                "status": "success" if doc_results["status"] == "completed" else doc_results["status"],
                "clone_id": clone_id,
                "processed_documents": doc_results["processed_documents"],
                "total_documents": doc_results["total_documents"],
                "expert_name": expert_results["expert_name"],
                "assistant_id": expert_results["assistant_id"],
                "errors": doc_results.get("errors", [])
            }
            
    except Exception as e:
        logger.error(f"Clone knowledge processing failed: {str(e)}")
        return {
            "status": "failed",
            "error": str(e),
            "clone_id": clone_id
        }


async def query_clone(clone_id: str, query: str, thread_id: Optional[str] = None) -> RAGResponse:
    """
    Simple query interface for clone
    
    Args:
        clone_id: Clone identifier
        query: User query
        thread_id: Optional conversation thread
        
    Returns:
        RAG response
    """
    try:
        async with RAGService() as rag_service:
            return await rag_service.query_expert(clone_id, query, thread_id)
    except Exception as e:
        logger.error(f"Clone query failed: {str(e)}")
        return RAGResponse(
            answer="I'm experiencing technical difficulties. Please try again later.",
            confidence=0.0
        )


async def validate_rag_configuration() -> Dict[str, Any]:
    """Validate RAG service configuration"""
    try:
        async with RAGService() as rag_service:
            return rag_service.validate_configuration()
    except Exception as e:
        return {
            "valid": False,
            "errors": [str(e)],
            "suggestions": ["Check RAG service initialization"]
        }


# Export main classes and functions
__all__ = [
    "RAGService",
    "RAGDocument", 
    "RAGQuery",
    "RAGResponse",
    "RAGProcessingStatus",
    "process_clone_knowledge",
    "query_clone",
    "validate_rag_configuration"
]