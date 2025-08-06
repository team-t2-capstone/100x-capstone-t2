"""
RAG (Retrieval Augmented Generation) Processor
Orchestrates the complete knowledge base processing pipeline
"""
import asyncio
import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple
from uuid import UUID
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, and_
from sqlalchemy.orm import selectinload

import structlog

from app.models.database import Document, DocumentChunk, Clone
from app.utils.text_extraction import extract_text_from_file
from app.services.chunking_service import DocumentChunker, ChunkConfig, ChunkingStrategy
from app.services.openai_service import openai_service
from app.database import get_db_session

logger = structlog.get_logger()

class ProcessingStatus:
    """Processing status constants"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"

class RAGProcessor:
    """Main processor for RAG pipeline operations"""
    
    def __init__(self):
        self.chunker = DocumentChunker()
        
    async def process_document(
        self, 
        document_id: str, 
        file_path: str, 
        clone_id: str,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        Process a document through the complete RAG pipeline
        
        Args:
            document_id: UUID of the document record
            file_path: Path to the uploaded file
            clone_id: UUID of the clone this document belongs to
            db: Database session
            
        Returns:
            Processing result with status and metrics
        """
        start_time = datetime.utcnow()
        
        try:
            logger.info("Starting RAG document processing", 
                       document_id=document_id,
                       clone_id=clone_id,
                       file_path=file_path)
            
            # Update document status to processing
            await self._update_document_status(db, document_id, ProcessingStatus.PROCESSING)
            
            # Step 1: Extract text from document
            text_result = await self._extract_text_step(file_path, document_id, db)
            if not text_result['success']:
                await self._update_document_status(
                    db, document_id, ProcessingStatus.FAILED, 
                    error_message=text_result['error']
                )
                return {
                    'success': False,
                    'error': text_result['error'],
                    'step_failed': 'text_extraction'
                }
            
            # Step 2: Chunk the text
            chunks_result = await self._chunking_step(
                text_result['text'], 
                text_result['metadata'], 
                document_id
            )
            if not chunks_result['success']:
                await self._update_document_status(
                    db, document_id, ProcessingStatus.FAILED,
                    error_message=chunks_result['error']
                )
                return {
                    'success': False,
                    'error': chunks_result['error'],
                    'step_failed': 'chunking'
                }
            
            # Step 3: Generate embeddings for chunks
            embeddings_result = await self._embeddings_step(
                chunks_result['chunks'],
                document_id,
                clone_id
            )
            if not embeddings_result['success']:
                await self._update_document_status(
                    db, document_id, ProcessingStatus.FAILED,
                    error_message=embeddings_result['error']
                )
                return {
                    'success': False,
                    'error': embeddings_result['error'],
                    'step_failed': 'embeddings'
                }
            
            # Step 4: Store chunks and embeddings in database
            storage_result = await self._storage_step(
                embeddings_result['embedded_chunks'],
                document_id,
                db
            )
            if not storage_result['success']:
                await self._update_document_status(
                    db, document_id, ProcessingStatus.FAILED,
                    error_message=storage_result['error']
                )
                return {
                    'success': False,
                    'error': storage_result['error'],
                    'step_failed': 'storage'
                }
            
            # Update document status to completed
            await self._update_document_status(
                db, document_id, ProcessingStatus.COMPLETED,
                chunk_count=len(storage_result['stored_chunks'])
            )
            
            processing_time = (datetime.utcnow() - start_time).total_seconds()
            
            logger.info("RAG document processing completed", 
                       document_id=document_id,
                       processing_time=processing_time,
                       chunks_created=len(storage_result['stored_chunks']))
            
            return {
                'success': True,
                'document_id': document_id,
                'chunks_created': len(storage_result['stored_chunks']),
                'processing_time_seconds': processing_time,
                'text_length': len(text_result['text']),
                'metadata': text_result['metadata']
            }
            
        except Exception as e:
            logger.error("RAG processing failed with exception", 
                        document_id=document_id, 
                        error=str(e),
                        exc_info=True)
            
            await self._update_document_status(
                db, document_id, ProcessingStatus.FAILED,
                error_message=f"Processing exception: {str(e)}"
            )
            
            return {
                'success': False,
                'error': str(e),
                'step_failed': 'exception'
            }
    
    async def _extract_text_step(
        self, 
        file_path: str, 
        document_id: str, 
        db: AsyncSession
    ) -> Dict[str, Any]:
        """Step 1: Extract text from the document"""
        try:
            logger.info("Starting text extraction", document_id=document_id)
            
            # Get document info from database
            doc_query = select(Document).where(Document.id == UUID(document_id))
            result = await db.execute(doc_query)
            document = result.scalar_one_or_none()
            
            if not document:
                return {
                    'success': False,
                    'error': f'Document {document_id} not found in database'
                }
            
            # Extract text using the text extraction service
            extraction_result = await extract_text_from_file(file_path, document.file_type)
            
            if not extraction_result['success']:
                logger.error("Text extraction failed", 
                           document_id=document_id,
                           error=extraction_result['error'])
                return extraction_result
            
            logger.info("Text extraction completed", 
                       document_id=document_id,
                       text_length=len(extraction_result['text']),
                       metadata=extraction_result['metadata'])
            
            return extraction_result
            
        except Exception as e:
            logger.error("Text extraction step failed", 
                        document_id=document_id, 
                        error=str(e))
            return {
                'success': False,
                'error': f'Text extraction failed: {str(e)}'
            }
    
    async def _chunking_step(
        self, 
        text: str, 
        metadata: Dict[str, Any], 
        document_id: str
    ) -> Dict[str, Any]:
        """Step 2: Chunk the extracted text"""
        try:
            logger.info("Starting text chunking", 
                       document_id=document_id,
                       text_length=len(text))
            
            # Determine optimal chunking strategy based on document type
            file_type = metadata.get('file_type', '.txt')
            
            if file_type == '.pdf' and metadata.get('pages', 0) > 10:
                # Large PDFs - use paragraph-aware
                chunk_config = ChunkConfig(
                    chunk_size=1200,
                    chunk_overlap=200,
                    strategy=ChunkingStrategy.PARAGRAPH_AWARE
                )
            elif file_type in ['.docx', '.doc']:
                # Word docs - preserve structure
                chunk_config = ChunkConfig(
                    chunk_size=1000,
                    chunk_overlap=150,
                    strategy=ChunkingStrategy.PARAGRAPH_AWARE,
                    preserve_structure=True
                )
            else:
                # Default for text files and smaller docs
                chunk_config = ChunkConfig(
                    chunk_size=1000,
                    chunk_overlap=200,
                    strategy=ChunkingStrategy.SENTENCE_AWARE
                )
            
            # Create chunker with config
            chunker = DocumentChunker(chunk_config)
            
            # Chunk the document
            chunks = chunker.chunk_document(text, metadata)
            
            if not chunks:
                return {
                    'success': False,
                    'error': 'No valid chunks created from document'
                }
            
            # Optimize chunks for embeddings
            optimized_chunks = chunker.optimize_chunks_for_embeddings(chunks)
            
            logger.info("Text chunking completed",
                       document_id=document_id,
                       chunks_created=len(optimized_chunks),
                       avg_chunk_size=sum(len(c.content) for c in optimized_chunks) // len(optimized_chunks))
            
            return {
                'success': True,
                'chunks': optimized_chunks,
                'total_chunks': len(optimized_chunks)
            }
            
        except Exception as e:
            logger.error("Chunking step failed", 
                        document_id=document_id, 
                        error=str(e))
            return {
                'success': False,
                'error': f'Text chunking failed: {str(e)}'
            }
    
    async def _embeddings_step(
        self, 
        chunks: List, 
        document_id: str, 
        clone_id: str
    ) -> Dict[str, Any]:
        """Step 3: Generate embeddings for text chunks"""
        try:
            logger.info("Starting embeddings generation", 
                       document_id=document_id,
                       chunk_count=len(chunks))
            
            if not openai_service.is_available():
                return {
                    'success': False,
                    'error': 'OpenAI service is not available for embeddings'
                }
            
            embedded_chunks = []
            batch_size = 10  # Process embeddings in batches
            
            for i in range(0, len(chunks), batch_size):
                batch_chunks = chunks[i:i + batch_size]
                batch_texts = [chunk.content for chunk in batch_chunks]
                
                try:
                    # Generate embeddings for batch
                    embeddings_response = await openai_service.create_embeddings(
                        texts=batch_texts,
                        user_id=clone_id  # Use clone_id as user for tracking
                    )
                    
                    if not embeddings_response.get('data'):
                        logger.error("No embeddings data received", 
                                   document_id=document_id,
                                   batch_start=i)
                        continue
                    
                    # Pair chunks with their embeddings
                    for chunk_idx, chunk in enumerate(batch_chunks):
                        embedding_data = embeddings_response['data'][chunk_idx]
                        embedding_vector = embedding_data.get('embedding', [])
                        
                        embedded_chunk = {
                            'chunk': chunk,
                            'embedding': embedding_vector,
                            'embedding_model': embeddings_response.get('model', 'unknown')
                        }
                        embedded_chunks.append(embedded_chunk)
                    
                    # Small delay between batches to respect rate limits
                    if i + batch_size < len(chunks):
                        await asyncio.sleep(0.5)
                        
                except Exception as e:
                    logger.error("Embedding batch failed", 
                               document_id=document_id,
                               batch_start=i,
                               error=str(e))
                    # Continue with other batches
                    continue
            
            if not embedded_chunks:
                return {
                    'success': False,
                    'error': 'Failed to generate any embeddings'
                }
            
            logger.info("Embeddings generation completed",
                       document_id=document_id,
                       embedded_chunks=len(embedded_chunks))
            
            return {
                'success': True,
                'embedded_chunks': embedded_chunks,
                'embeddings_count': len(embedded_chunks)
            }
            
        except Exception as e:
            logger.error("Embeddings step failed", 
                        document_id=document_id, 
                        error=str(e))
            return {
                'success': False,
                'error': f'Embeddings generation failed: {str(e)}'
            }
    
    async def _storage_step(
        self, 
        embedded_chunks: List[Dict], 
        document_id: str, 
        db: AsyncSession
    ) -> Dict[str, Any]:
        """Step 4: Store chunks and embeddings in database"""
        try:
            logger.info("Starting chunk storage", 
                       document_id=document_id,
                       chunks_to_store=len(embedded_chunks))
            
            stored_chunks = []
            
            for embedded_chunk in embedded_chunks:
                chunk = embedded_chunk['chunk']
                embedding = embedded_chunk['embedding']
                
                # Create database chunk record
                db_chunk = DocumentChunk(
                    id=uuid.uuid4(),
                    document_id=UUID(document_id),
                    content=chunk.content,
                    chunk_index=chunk.chunk_index,
                    embedding=json.dumps(embedding),  # Store as JSON for now
                    doc_metadata={
                        **chunk.metadata,
                        'start_char': chunk.start_char,
                        'end_char': chunk.end_char,
                        'token_count': chunk.token_count,
                        'embedding_model': embedded_chunk['embedding_model'],
                        'created_at': datetime.utcnow().isoformat()
                    }
                )
                
                db.add(db_chunk)
                stored_chunks.append(db_chunk)
            
            # Commit all chunks
            await db.commit()
            
            logger.info("Chunk storage completed",
                       document_id=document_id,
                       stored_chunks=len(stored_chunks))
            
            return {
                'success': True,
                'stored_chunks': stored_chunks,
                'chunks_count': len(stored_chunks)
            }
            
        except Exception as e:
            logger.error("Storage step failed", 
                        document_id=document_id, 
                        error=str(e))
            await db.rollback()
            return {
                'success': False,
                'error': f'Chunk storage failed: {str(e)}'
            }
    
    async def _update_document_status(
        self, 
        db: AsyncSession, 
        document_id: str, 
        status: str,
        error_message: str = None,
        chunk_count: int = None
    ):
        """Update document processing status in database"""
        try:
            update_data = {'processing_status': status}
            
            if error_message:
                update_data['doc_metadata'] = {
                    'error_message': error_message,
                    'failed_at': datetime.utcnow().isoformat()
                }
            
            if chunk_count is not None:
                update_data['doc_metadata'] = {
                    'chunk_count': chunk_count,
                    'completed_at': datetime.utcnow().isoformat()
                }
            
            stmt = (
                update(Document)
                .where(Document.id == UUID(document_id))
                .values(**update_data)
            )
            
            await db.execute(stmt)
            await db.commit()
            
        except Exception as e:
            logger.error("Failed to update document status", 
                        document_id=document_id,
                        status=status,
                        error=str(e))
    
    async def search_knowledge_base(
        self, 
        clone_id: str, 
        query: str, 
        limit: int = 10,
        min_similarity: float = 0.7,
        db: AsyncSession = None
    ) -> List[Dict[str, Any]]:
        """
        Search the knowledge base using vector similarity
        """
        try:
            if not db:
                db = await get_db_session()
            
            logger.info("Starting knowledge base search", 
                       clone_id=clone_id,
                       query_length=len(query))
            
            # Generate embedding for the query
            if not openai_service.is_available():
                logger.warning("OpenAI service not available, falling back to text search")
                return await self._fallback_text_search(clone_id, query, limit, db)
            
            # Get query embedding
            query_embedding_response = await openai_service.create_embeddings(
                texts=[query],
                user_id=clone_id
            )
            
            if not query_embedding_response.get('data'):
                logger.warning("Failed to generate query embedding, falling back to text search")
                return await self._fallback_text_search(clone_id, query, limit, db)
            
            query_embedding = query_embedding_response['data'][0]['embedding']
            
            # For now, fall back to text search since we haven't migrated to pgvector yet
            # TODO: Implement proper vector similarity search when pgvector is set up
            logger.info("Vector search not yet implemented, using text fallback")
            return await self._fallback_text_search(clone_id, query, limit, db)
            
        except Exception as e:
            logger.error("Knowledge base search failed", 
                        clone_id=clone_id,
                        query=query,
                        error=str(e))
            return []
    
    async def _fallback_text_search(
        self, 
        clone_id: str, 
        query: str, 
        limit: int, 
        db: AsyncSession
    ) -> List[Dict[str, Any]]:
        """Fallback text-based search when vector search is not available"""
        try:
            # Search for chunks containing query terms
            search_query = (
                select(DocumentChunk, Document)
                .join(Document, DocumentChunk.document_id == Document.id)
                .where(
                    and_(
                        Document.clone_id == UUID(clone_id),
                        DocumentChunk.content.ilike(f'%{query}%')
                    )
                )
                .limit(limit)
            )
            
            result = await db.execute(search_query)
            rows = result.fetchall()
            
            search_results = []
            for chunk, document in rows:
                result_item = {
                    'chunk_id': str(chunk.id),
                    'document_id': str(document.id),
                    'document_title': document.title,
                    'chunk_content': chunk.content,
                    'chunk_index': chunk.chunk_index,
                    'similarity_score': 0.8,  # Placeholder for text match
                    'metadata': chunk.doc_metadata or {}
                }
                search_results.append(result_item)
            
            logger.info("Text fallback search completed",
                       clone_id=clone_id,
                       results_found=len(search_results))
            
            return search_results
            
        except Exception as e:
            logger.error("Fallback text search failed", 
                        clone_id=clone_id,
                        error=str(e))
            return []
    
    async def get_processing_stats(self, clone_id: str, db: AsyncSession) -> Dict[str, Any]:
        """Get processing statistics for a clone's knowledge base"""
        try:
            # Count documents by status
            status_query = (
                select(Document.processing_status, Document.id)
                .where(Document.clone_id == UUID(clone_id))
            )
            result = await db.execute(status_query)
            documents = result.fetchall()
            
            status_counts = {}
            for status, doc_id in documents:
                status_counts[status] = status_counts.get(status, 0) + 1
            
            # Count total chunks
            chunks_query = (
                select(DocumentChunk.id)
                .join(Document, DocumentChunk.document_id == Document.id)
                .where(Document.clone_id == UUID(clone_id))
            )
            chunks_result = await db.execute(chunks_query)
            total_chunks = len(chunks_result.fetchall())
            
            return {
                'total_documents': len(documents),
                'status_counts': status_counts,
                'total_chunks': total_chunks,
                'processing_queue_length': status_counts.get('processing', 0) + status_counts.get('pending', 0)
            }
            
        except Exception as e:
            logger.error("Failed to get processing stats", 
                        clone_id=clone_id, 
                        error=str(e))
            return {
                'total_documents': 0,
                'status_counts': {},
                'total_chunks': 0,
                'processing_queue_length': 0
            }

# Global RAG processor instance
rag_processor = RAGProcessor()

# Background task function for processing documents
async def process_document_background(document_id: str, file_path: str, clone_id: str):
    """Background task to process a document through the RAG pipeline"""
    try:
        async with get_db_session() as db:
            result = await rag_processor.process_document(document_id, file_path, clone_id, db)
            
            if result['success']:
                logger.info("Background document processing completed successfully", 
                           document_id=document_id)
            else:
                logger.error("Background document processing failed", 
                           document_id=document_id,
                           error=result.get('error'))
    
    except Exception as e:
        logger.error("Background document processing crashed", 
                    document_id=document_id,
                    error=str(e),
                    exc_info=True)