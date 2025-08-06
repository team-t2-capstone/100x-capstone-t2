"""
Document Chunking Service
Intelligently splits documents into chunks for embedding and retrieval
"""
import re
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

import structlog

logger = structlog.get_logger()

class ChunkingStrategy(Enum):
    """Different strategies for chunking text"""
    FIXED_SIZE = "fixed_size"
    SENTENCE_AWARE = "sentence_aware" 
    PARAGRAPH_AWARE = "paragraph_aware"
    SEMANTIC_AWARE = "semantic_aware"

@dataclass
class ChunkConfig:
    """Configuration for text chunking"""
    chunk_size: int = 1000  # Target chunk size in characters
    chunk_overlap: int = 200  # Overlap between chunks
    min_chunk_size: int = 100  # Minimum chunk size
    max_chunk_size: int = 1500  # Maximum chunk size
    strategy: ChunkingStrategy = ChunkingStrategy.SENTENCE_AWARE
    preserve_structure: bool = True  # Keep paragraphs/sections together when possible
    
@dataclass  
class TextChunk:
    """Represents a chunk of text with metadata"""
    content: str
    chunk_index: int
    start_char: int
    end_char: int
    metadata: Dict[str, Any]
    token_count: Optional[int] = None

class DocumentChunker:
    """Handles intelligent text chunking for documents"""
    
    def __init__(self, config: ChunkConfig = None):
        self.config = config or ChunkConfig()
        
    def chunk_document(
        self, 
        text: str, 
        document_metadata: Dict[str, Any] = None
    ) -> List[TextChunk]:
        """
        Chunk a document into smaller pieces for processing
        
        Args:
            text: The full document text
            document_metadata: Metadata about the source document
            
        Returns:
            List of TextChunk objects
        """
        if not text or not text.strip():
            logger.warning("Empty text provided for chunking")
            return []
            
        logger.info("Starting document chunking", 
                   text_length=len(text),
                   strategy=self.config.strategy.value,
                   chunk_size=self.config.chunk_size)
        
        # Choose chunking strategy
        if self.config.strategy == ChunkingStrategy.FIXED_SIZE:
            chunks = self._chunk_fixed_size(text)
        elif self.config.strategy == ChunkingStrategy.SENTENCE_AWARE:
            chunks = self._chunk_sentence_aware(text)
        elif self.config.strategy == ChunkingStrategy.PARAGRAPH_AWARE:
            chunks = self._chunk_paragraph_aware(text)
        elif self.config.strategy == ChunkingStrategy.SEMANTIC_AWARE:
            chunks = self._chunk_semantic_aware(text)
        else:
            chunks = self._chunk_sentence_aware(text)  # Default fallback
            
        # Filter out chunks that are too small
        filtered_chunks = []
        for chunk in chunks:
            if len(chunk.content.strip()) >= self.config.min_chunk_size:
                # Add document metadata to chunk
                chunk.metadata.update(document_metadata or {})
                filtered_chunks.append(chunk)
            else:
                logger.debug("Skipping chunk too small", 
                           chunk_size=len(chunk.content), 
                           min_size=self.config.min_chunk_size)
                
        logger.info("Document chunking completed", 
                   total_chunks=len(filtered_chunks),
                   avg_chunk_size=sum(len(c.content) for c in filtered_chunks) // max(len(filtered_chunks), 1))
        
        return filtered_chunks
    
    def _chunk_fixed_size(self, text: str) -> List[TextChunk]:
        """Simple fixed-size chunking with overlap"""
        chunks = []
        start = 0
        chunk_index = 0
        
        while start < len(text):
            end = start + self.config.chunk_size
            
            # Don't exceed text length
            if end > len(text):
                end = len(text)
            
            chunk_content = text[start:end]
            
            chunk = TextChunk(
                content=chunk_content,
                chunk_index=chunk_index,
                start_char=start,
                end_char=end,
                metadata={
                    'chunking_strategy': 'fixed_size',
                    'overlap': self.config.chunk_overlap if chunk_index > 0 else 0
                }
            )
            
            chunks.append(chunk)
            chunk_index += 1
            
            # Move start position with overlap
            start = end - self.config.chunk_overlap
            
            # Avoid infinite loop
            if start >= end:
                break
                
        return chunks
    
    def _chunk_sentence_aware(self, text: str) -> List[TextChunk]:
        """Chunk text while respecting sentence boundaries"""
        sentences = self._split_into_sentences(text)
        chunks = []
        current_chunk = []
        current_size = 0
        chunk_index = 0
        char_position = 0
        
        for sentence in sentences:
            sentence_size = len(sentence)
            
            # If adding this sentence would exceed chunk size, finalize current chunk
            if (current_size + sentence_size > self.config.chunk_size and 
                current_chunk and 
                current_size >= self.config.min_chunk_size):
                
                chunk_content = ' '.join(current_chunk)
                chunk = TextChunk(
                    content=chunk_content,
                    chunk_index=chunk_index,
                    start_char=char_position - len(chunk_content),
                    end_char=char_position,
                    metadata={
                        'chunking_strategy': 'sentence_aware',
                        'sentence_count': len(current_chunk)
                    }
                )
                chunks.append(chunk)
                chunk_index += 1
                
                # Handle overlap by keeping last few sentences
                overlap_sentences = self._get_overlap_sentences(current_chunk)
                current_chunk = overlap_sentences
                current_size = sum(len(s) for s in overlap_sentences)
            
            current_chunk.append(sentence)
            current_size += sentence_size
            char_position += sentence_size
            
            # Force chunk if it gets too large
            if current_size > self.config.max_chunk_size:
                chunk_content = ' '.join(current_chunk)
                chunk = TextChunk(
                    content=chunk_content,
                    chunk_index=chunk_index,
                    start_char=char_position - len(chunk_content),
                    end_char=char_position,
                    metadata={
                        'chunking_strategy': 'sentence_aware',
                        'sentence_count': len(current_chunk),
                        'forced_split': True
                    }
                )
                chunks.append(chunk)
                chunk_index += 1
                current_chunk = []
                current_size = 0
        
        # Handle remaining sentences
        if current_chunk:
            chunk_content = ' '.join(current_chunk)
            chunk = TextChunk(
                content=chunk_content,
                chunk_index=chunk_index,
                start_char=char_position - len(chunk_content),
                end_char=char_position,
                metadata={
                    'chunking_strategy': 'sentence_aware',
                    'sentence_count': len(current_chunk)
                }
            )
            chunks.append(chunk)
            
        return chunks
    
    def _chunk_paragraph_aware(self, text: str) -> List[TextChunk]:
        """Chunk text while respecting paragraph boundaries"""
        paragraphs = self._split_into_paragraphs(text)
        chunks = []
        current_chunk = []
        current_size = 0
        chunk_index = 0
        char_position = 0
        
        for paragraph in paragraphs:
            paragraph_size = len(paragraph)
            
            # If paragraph alone exceeds chunk size, break it down by sentences
            if paragraph_size > self.config.max_chunk_size:
                # Recursively chunk this paragraph
                para_chunks = self._chunk_sentence_aware(paragraph)
                for para_chunk in para_chunks:
                    para_chunk.chunk_index = chunk_index
                    para_chunk.metadata.update({
                        'chunking_strategy': 'paragraph_aware',
                        'large_paragraph_split': True
                    })
                    chunks.append(para_chunk)
                    chunk_index += 1
                char_position += paragraph_size
                continue
            
            # If adding this paragraph would exceed chunk size, finalize current chunk
            if (current_size + paragraph_size > self.config.chunk_size and 
                current_chunk and 
                current_size >= self.config.min_chunk_size):
                
                chunk_content = '\n\n'.join(current_chunk)
                chunk = TextChunk(
                    content=chunk_content,
                    chunk_index=chunk_index,
                    start_char=char_position - len(chunk_content) - (len(current_chunk) - 1) * 2,  # Account for \n\n
                    end_char=char_position,
                    metadata={
                        'chunking_strategy': 'paragraph_aware',
                        'paragraph_count': len(current_chunk)
                    }
                )
                chunks.append(chunk)
                chunk_index += 1
                
                # Handle overlap by keeping last paragraph if it fits
                if (self.config.chunk_overlap > 0 and 
                    current_chunk and 
                    len(current_chunk[-1]) <= self.config.chunk_overlap):
                    current_chunk = [current_chunk[-1]]
                    current_size = len(current_chunk[-1])
                else:
                    current_chunk = []
                    current_size = 0
            
            current_chunk.append(paragraph)
            current_size += paragraph_size
            char_position += paragraph_size + 2  # Account for \n\n
        
        # Handle remaining paragraphs
        if current_chunk:
            chunk_content = '\n\n'.join(current_chunk)
            chunk = TextChunk(
                content=chunk_content,
                chunk_index=chunk_index,
                start_char=char_position - len(chunk_content) - (len(current_chunk) - 1) * 2,
                end_char=char_position,
                metadata={
                    'chunking_strategy': 'paragraph_aware',
                    'paragraph_count': len(current_chunk)
                }
            )
            chunks.append(chunk)
            
        return chunks
    
    def _chunk_semantic_aware(self, text: str) -> List[TextChunk]:
        """Advanced semantic-aware chunking (simplified implementation)"""
        # For now, fall back to paragraph-aware with some semantic hints
        paragraphs = self._split_into_paragraphs(text)
        
        # Group related paragraphs based on simple heuristics
        semantic_groups = []
        current_group = []
        
        for paragraph in paragraphs:
            # Simple heuristics for semantic grouping
            if self._is_section_break(paragraph):
                if current_group:
                    semantic_groups.append(current_group)
                current_group = [paragraph]
            else:
                current_group.append(paragraph)
        
        if current_group:
            semantic_groups.append(current_group)
        
        # Now chunk each semantic group
        chunks = []
        chunk_index = 0
        
        for group in semantic_groups:
            group_text = '\n\n'.join(group)
            
            if len(group_text) <= self.config.chunk_size:
                # Group fits in one chunk
                chunk = TextChunk(
                    content=group_text,
                    chunk_index=chunk_index,
                    start_char=0,  # Would need to calculate properly
                    end_char=len(group_text),
                    metadata={
                        'chunking_strategy': 'semantic_aware',
                        'semantic_group_size': len(group)
                    }
                )
                chunks.append(chunk)
                chunk_index += 1
            else:
                # Group too large, break it down with paragraph awareness
                group_chunks = self._chunk_paragraph_aware(group_text)
                for group_chunk in group_chunks:
                    group_chunk.chunk_index = chunk_index
                    group_chunk.metadata.update({
                        'chunking_strategy': 'semantic_aware',
                        'semantic_group_split': True
                    })
                    chunks.append(group_chunk)
                    chunk_index += 1
        
        return chunks
    
    def _split_into_sentences(self, text: str) -> List[str]:
        """Split text into sentences"""
        # Enhanced sentence splitting with better handling of abbreviations
        sentence_endings = r'[.!?]+(?:\s|$)'
        sentences = re.split(sentence_endings, text)
        
        # Clean up sentences
        cleaned_sentences = []
        for sentence in sentences:
            sentence = sentence.strip()
            if sentence:
                cleaned_sentences.append(sentence)
        
        return cleaned_sentences
    
    def _split_into_paragraphs(self, text: str) -> List[str]:
        """Split text into paragraphs"""
        paragraphs = re.split(r'\n\s*\n', text)
        
        # Clean up paragraphs
        cleaned_paragraphs = []
        for paragraph in paragraphs:
            paragraph = paragraph.strip()
            if paragraph:
                cleaned_paragraphs.append(paragraph)
        
        return cleaned_paragraphs
    
    def _get_overlap_sentences(self, sentences: List[str]) -> List[str]:
        """Get sentences for overlap based on overlap size"""
        if not sentences or self.config.chunk_overlap <= 0:
            return []
        
        # Calculate how many sentences to include for overlap
        overlap_size = 0
        overlap_sentences = []
        
        for sentence in reversed(sentences):
            if overlap_size + len(sentence) <= self.config.chunk_overlap:
                overlap_sentences.insert(0, sentence)
                overlap_size += len(sentence)
            else:
                break
        
        return overlap_sentences
    
    def _is_section_break(self, paragraph: str) -> bool:
        """Simple heuristic to detect section breaks"""
        if not paragraph:
            return False
            
        # Check for common section indicators
        section_patterns = [
            r'^\d+\.\s',  # Numbered sections
            r'^Chapter\s+\d+',  # Chapters
            r'^Section\s+\d+',  # Sections
            r'^[A-Z\s]{3,}$',  # All caps headers
            r'^#{1,6}\s',  # Markdown headers
        ]
        
        for pattern in section_patterns:
            if re.match(pattern, paragraph, re.IGNORECASE):
                return True
        
        return False
    
    def estimate_token_count(self, text: str) -> int:
        """Rough estimate of token count for a text"""
        # Very rough estimate: ~4 characters per token on average
        return len(text) // 4
    
    def optimize_chunks_for_embeddings(self, chunks: List[TextChunk]) -> List[TextChunk]:
        """Optimize chunks for embedding generation"""
        optimized_chunks = []
        
        for chunk in chunks:
            # Estimate token count
            token_count = self.estimate_token_count(chunk.content)
            chunk.token_count = token_count
            
            # Skip chunks that are too large for embeddings (OpenAI limit ~8000 tokens)
            if token_count > 6000:  # Leave some margin
                logger.warning("Chunk too large for embeddings", 
                             chunk_index=chunk.chunk_index,
                             token_count=token_count)
                
                # Try to split large chunk further
                sub_config = ChunkConfig(
                    chunk_size=self.config.chunk_size // 2,
                    chunk_overlap=self.config.chunk_overlap // 2,
                    strategy=ChunkingStrategy.SENTENCE_AWARE
                )
                sub_chunker = DocumentChunker(sub_config)
                sub_chunks = sub_chunker.chunk_document(chunk.content, chunk.metadata)
                
                for sub_chunk in sub_chunks:
                    sub_chunk.chunk_index = f"{chunk.chunk_index}.{sub_chunk.chunk_index}"
                    sub_chunk.metadata.update({'sub_chunked': True})
                    optimized_chunks.append(sub_chunk)
            else:
                optimized_chunks.append(chunk)
        
        return optimized_chunks

# Global chunking service instance with default configuration
default_chunker = DocumentChunker()

# Convenience functions
def chunk_text(
    text: str, 
    chunk_size: int = 1000, 
    chunk_overlap: int = 200,
    strategy: ChunkingStrategy = ChunkingStrategy.SENTENCE_AWARE
) -> List[TextChunk]:
    """Convenience function for chunking text with custom parameters"""
    config = ChunkConfig(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        strategy=strategy
    )
    chunker = DocumentChunker(config)
    return chunker.chunk_document(text)

def get_optimal_chunk_config(document_type: str = "general") -> ChunkConfig:
    """Get optimized chunk configuration for different document types"""
    configs = {
        "general": ChunkConfig(
            chunk_size=1000,
            chunk_overlap=200,
            strategy=ChunkingStrategy.SENTENCE_AWARE
        ),
        "technical": ChunkConfig(
            chunk_size=1200,
            chunk_overlap=100,
            strategy=ChunkingStrategy.PARAGRAPH_AWARE,
            preserve_structure=True
        ),
        "academic": ChunkConfig(
            chunk_size=800,
            chunk_overlap=150,
            strategy=ChunkingStrategy.SEMANTIC_AWARE,
            preserve_structure=True
        ),
        "legal": ChunkConfig(
            chunk_size=1500,
            chunk_overlap=300,
            strategy=ChunkingStrategy.PARAGRAPH_AWARE,
            preserve_structure=True
        )
    }
    
    return configs.get(document_type, configs["general"])