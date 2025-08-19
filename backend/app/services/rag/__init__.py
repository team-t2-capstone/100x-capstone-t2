"""
Clean RAG Service Module

Single-responsibility RAG implementation for CloneAI platform.
This module provides a clean, maintainable architecture for:
- Document processing and embedding generation
- Vector store management
- OpenAI Assistant integration
- Knowledge base querying
"""

from .core_service import CleanRAGService, clean_rag_service
from .models import *
from .exceptions import *

__all__ = [
    'CleanRAGService',
    'clean_rag_service'
]