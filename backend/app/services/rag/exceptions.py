"""
RAG Service Exceptions

Clear, specific exceptions for RAG operations.
"""

class RAGException(Exception):
    """Base exception for RAG operations"""
    pass

class RAGInitializationError(RAGException):
    """Raised when RAG service fails to initialize"""
    pass

class VectorStoreCreationError(RAGException):
    """Raised when vector store creation fails"""
    pass

class DocumentProcessingError(RAGException):
    """Raised when document processing fails"""
    pass

class AssistantCreationError(RAGException):
    """Raised when OpenAI Assistant creation fails"""
    pass

class QueryError(RAGException):
    """Raised when query processing fails"""
    pass

class ConfigurationError(RAGException):
    """Raised when configuration is invalid"""
    pass