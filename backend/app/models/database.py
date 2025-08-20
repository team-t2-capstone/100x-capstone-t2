"""
Legacy SQLAlchemy models compatibility layer

This module provides dummy classes for backward compatibility with existing imports.
All database operations should use Supabase directly instead of these SQLAlchemy models.
"""

# Dummy classes for backward compatibility
class UserProfile:
    """Legacy SQLAlchemy UserProfile model - no longer used"""
    pass

class Clone:
    """Legacy SQLAlchemy Clone model - no longer used"""  
    pass

class Session:
    """Legacy SQLAlchemy Session model - no longer used"""
    pass

class UserAnalytics:
    """Legacy SQLAlchemy UserAnalytics model - no longer used"""
    pass

class Document:
    """Legacy SQLAlchemy Document model - no longer used"""
    pass

class KnowledgeEntry:
    """Legacy SQLAlchemy KnowledgeEntry model - no longer used"""
    pass

class CloneRating:
    """Legacy SQLAlchemy CloneRating model - no longer used"""
    pass

class Message:
    """Legacy SQLAlchemy Message model - no longer used"""
    pass

class ChatSession:
    """Legacy SQLAlchemy ChatSession model - no longer used"""
    pass

class BillingTransaction:
    """Legacy SQLAlchemy BillingTransaction model - no longer used"""
    pass

class Subscription:
    """Legacy SQLAlchemy Subscription model - no longer used"""
    pass

class ConversationMemory:
    """Legacy SQLAlchemy ConversationMemory model - no longer used"""
    pass

class UserMemoryContext:
    """Legacy SQLAlchemy UserMemoryContext model - no longer used"""
    pass

class CloneLearning:
    """Legacy SQLAlchemy CloneLearning model - no longer used"""
    pass

class DocumentChunk:
    """Legacy SQLAlchemy DocumentChunk model - no longer used"""
    pass

class SessionSummary:
    """Legacy SQLAlchemy SessionSummary model - no longer used"""
    pass

class SummaryTemplate:
    """Legacy SQLAlchemy SummaryTemplate model - no longer used"""
    pass

class MemoryPolicy:
    """Legacy SQLAlchemy MemoryPolicy model - no longer used"""
    pass

class MemoryUsageStats:
    """Legacy SQLAlchemy MemoryUsageStats model - no longer used"""
    pass

class BulkSummarizationJob:
    """Legacy SQLAlchemy BulkSummarizationJob model - no longer used"""
    pass

class RefreshToken:
    """Legacy SQLAlchemy RefreshToken model - no longer used"""
    pass

class CreatorAnalytics:
    """Legacy SQLAlchemy CreatorAnalytics model - no longer used"""
    pass

class ChatMessage:
    """Legacy SQLAlchemy ChatMessage model - no longer used"""
    pass

# Export all classes for compatibility
__all__ = [
    'UserProfile', 'Clone', 'Session', 'UserAnalytics', 'Document', 
    'KnowledgeEntry', 'CloneRating', 'Message', 'ChatSession',
    'BillingTransaction', 'Subscription', 'ConversationMemory',
    'UserMemoryContext', 'CloneLearning', 'DocumentChunk',
    'SessionSummary', 'SummaryTemplate', 'MemoryPolicy', 
    'MemoryUsageStats', 'BulkSummarizationJob', 'RefreshToken',
    'CreatorAnalytics', 'ChatMessage'
]