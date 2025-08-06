"""
SQLAlchemy database models for CloneAI
"""
from datetime import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy import (
    Column, String, Text, Integer, Float, Boolean, DateTime, 
    ForeignKey, JSON, Index, UniqueConstraint
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, ARRAY
import uuid

from app.database import Base

# User Models
class UserProfile(Base):
    """User profile table"""
    __tablename__ = "user_profiles"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    avatar_url = Column(String(500), nullable=True)
    role = Column(String(20), default="user", index=True)  # user, creator, admin
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    
    # Authentication
    hashed_password = Column(String(128), nullable=False)
    
    # Preferences and settings
    preferences = Column(JSON, default=dict)
    timezone = Column(String(50), default="UTC")
    language = Column(String(10), default="en")
    
    # Billing and subscription
    subscription_tier = Column(String(20), default="free")  # free, pro, enterprise
    credits_remaining = Column(Integer, default=100)
    total_spent = Column(Float, default=0.0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
    
    # Relationships
    clones = relationship("Clone", back_populates="creator", cascade="all, delete-orphan")
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<UserProfile(id={self.id}, email={self.email})>"


class RefreshToken(Base):
    """Refresh token storage for JWT authentication"""
    __tablename__ = "refresh_tokens"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=False)
    token_hash = Column(String(128), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    is_revoked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index('ix_refresh_tokens_user_token', 'user_id', 'token_hash'),
    )


# Clone Models
class Clone(Base):
    """AI Expert Clone table"""
    __tablename__ = "clones"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    creator_id = Column(UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=False)
    
    # Basic information
    name = Column(String(100), nullable=False)
    description = Column(String(500), nullable=False)
    bio = Column(Text, nullable=True)
    avatar_url = Column(String(500), nullable=True)
    
    # Categorization
    category = Column(String(50), nullable=False, index=True)
    expertise_areas = Column(ARRAY(String), default=[])
    languages = Column(ARRAY(String), default=["English"])
    
    # Pricing
    base_price = Column(Float, nullable=False)  # Price per minute
    currency = Column(String(3), default="USD")
    
    # AI Configuration
    personality_traits = Column(JSON, default=dict)
    communication_style = Column(JSON, default=dict)
    system_prompt = Column(Text, nullable=True)
    temperature = Column(Float, default=0.7)
    max_tokens = Column(Integer, default=1000)
    
    # Status and visibility
    is_published = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    # Analytics
    total_sessions = Column(Integer, default=0)
    total_earnings = Column(Float, default=0.0)
    average_rating = Column(Float, default=0.0)
    total_ratings = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    published_at = Column(DateTime, nullable=True)
    
    # Relationships
    creator = relationship("UserProfile", back_populates="clones")
    sessions = relationship("Session", back_populates="clone", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="clone", cascade="all, delete-orphan")
    knowledge_entries = relationship("KnowledgeEntry", back_populates="clone", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('ix_clones_category_published', 'category', 'is_published'),
        Index('ix_clones_creator_active', 'creator_id', 'is_active'),
    )
    
    def __repr__(self):
        return f"<Clone(id={self.id}, name={self.name})>"


# Document and Knowledge Models
class Document(Base):
    """Uploaded documents for knowledge base"""
    __tablename__ = "documents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clone_id = Column(UUID(as_uuid=True), ForeignKey("clones.id"), nullable=False)
    
    # File information
    title = Column(String(200), nullable=False)
    description = Column(String(1000), nullable=True)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(10), nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    
    # Processing status
    processing_status = Column(String(20), default="pending")  # pending, processing, completed, failed
    processing_error = Column(Text, nullable=True)
    chunk_count = Column(Integer, default=0)
    
    # Metadata
    tags = Column(ARRAY(String), default=[])
    doc_metadata = Column(JSON, default=dict)
    
    # Timestamps
    upload_date = Column(DateTime, default=datetime.utcnow)
    processed_date = Column(DateTime, nullable=True)
    
    # Relationships
    clone = relationship("Clone", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('ix_documents_clone_status', 'clone_id', 'processing_status'),
    )
    
    def __repr__(self):
        return f"<Document(id={self.id}, title={self.title})>"


class DocumentChunk(Base):
    """Document chunks for RAG system"""
    __tablename__ = "document_chunks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False)
    
    # Content
    content = Column(Text, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    
    # Embedding vector (pgvector)
    embedding = Column("embedding", Text)  # Store as text initially, pgvector integration comes later
    
    # Metadata
    doc_metadata = Column(JSON, default=dict)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    document = relationship("Document", back_populates="chunks")
    
    __table_args__ = (
        Index('ix_document_chunks_document_index', 'document_id', 'chunk_index'),
        UniqueConstraint('document_id', 'chunk_index', name='uq_document_chunk_index'),
    )


class KnowledgeEntry(Base):
    """Direct knowledge entries (not from documents)"""
    __tablename__ = "knowledge_entries"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clone_id = Column(UUID(as_uuid=True), ForeignKey("clones.id"), nullable=False)
    
    # Content
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String(50), nullable=True)
    
    # Embedding vector (pgvector)
    embedding = Column("embedding", Text)  # Store as text initially, pgvector integration comes later
    
    # Metadata
    tags = Column(ARRAY(String), default=[])
    doc_metadata = Column(JSON, default=dict)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    clone = relationship("Clone", back_populates="knowledge_entries")
    
    __table_args__ = (
        Index('ix_knowledge_entries_clone_category', 'clone_id', 'category'),
    )


# Chat Models
class ChatSession(Base):
    """Real-time chat sessions between users and AI clones"""
    __tablename__ = "chat_sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=False)
    clone_id = Column(UUID(as_uuid=True), ForeignKey("clones.id"), nullable=False)
    
    # Session details
    title = Column(String(200), nullable=True)
    is_active = Column(Boolean, default=True)
    message_count = Column(Integer, default=0)
    
    # Session metadata
    session_metadata = Column(JSON, default=dict)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("UserProfile", backref="chat_sessions")
    clone = relationship("Clone", backref="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('ix_chat_sessions_user_clone', 'user_id', 'clone_id'),
        Index('ix_chat_sessions_updated', 'updated_at'),
    )


class ChatMessage(Base):
    """Individual messages in chat sessions"""
    __tablename__ = "chat_messages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id"), nullable=False)
    
    # Message content
    sender_type = Column(String(20), nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    message_type = Column(String(20), default="text")  # text, image, file, system
    
    # Message metadata
    message_metadata = Column(JSON, default=dict)  # RAG context, sources, model info, etc.
    
    # Message status
    is_edited = Column(Boolean, default=False)
    edited_at = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    session = relationship("ChatSession", back_populates="messages")
    
    __table_args__ = (
        Index('ix_chat_messages_session_created', 'session_id', 'created_at'),
        Index('ix_chat_messages_sender_type', 'sender_type'),
    )


# Session Models
class Session(Base):
    """User sessions with AI clones"""
    __tablename__ = "sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=False)
    clone_id = Column(UUID(as_uuid=True), ForeignKey("clones.id"), nullable=False)
    
    # Session details
    session_type = Column(String(20), default="chat")  # chat, voice, video
    status = Column(String(20), default="active")  # active, paused, ended
    demo_mode = Column(Boolean, default=False)
    
    # Timing
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, default=0)
    
    # Billing
    rate_per_minute = Column(Float, nullable=False)
    total_cost = Column(Float, default=0.0)
    
    # Analytics
    message_count = Column(Integer, default=0)
    user_rating = Column(Integer, nullable=True)  # 1-5 stars
    user_feedback = Column(Text, nullable=True)
    
    # Session metadata
    session_metadata = Column(JSON, default=dict)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("UserProfile", back_populates="sessions")
    clone = relationship("Clone", back_populates="sessions")
    messages = relationship("Message", back_populates="session", cascade="all, delete-orphan")
    summaries = relationship("SessionSummary", back_populates="session", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('ix_sessions_user_status', 'user_id', 'status'),
        Index('ix_sessions_clone_status', 'clone_id', 'status'),
    )
    
    def __repr__(self):
        return f"<Session(id={self.id}, user_id={self.user_id}, clone_id={self.clone_id})>"


class Message(Base):
    """Messages within sessions"""
    __tablename__ = "messages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False)
    
    # Message content
    sender_type = Column(String(10), nullable=False)  # 'user' or 'ai'
    content = Column(Text, nullable=False)
    
    # RAG context (for AI messages)
    sources = Column(JSON, default=[])  # References to knowledge base
    context_used = Column(Text, nullable=True)
    
    # Cost tracking
    cost_increment = Column(Float, default=0.0)
    tokens_used = Column(Integer, default=0)
    
    # Attachments
    attachments = Column(JSON, default=[])
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    session = relationship("Session", back_populates="messages")
    
    __table_args__ = (
        Index('ix_messages_session_created', 'session_id', 'created_at'),
    )
    
    def __repr__(self):
        return f"<Message(id={self.id}, session_id={self.session_id}, sender={self.sender_type})>"


class SessionSummary(Base):
    """AI-generated session summaries"""
    __tablename__ = "session_summaries"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False)
    
    # Summary content
    summary_text = Column(Text, nullable=False)
    key_insights = Column(JSON, default=[])
    action_items = Column(JSON, default=[])
    recommendations = Column(JSON, default=[])
    next_session_topics = Column(JSON, default=[])
    
    # Enhanced summarization fields
    emotional_tone = Column(String(50), nullable=True)  # positive, neutral, negative, mixed
    main_topics = Column(ARRAY(String), default=[])
    user_satisfaction_indicators = Column(JSON, default={})
    learning_outcomes = Column(JSON, default=[])
    conversation_quality_score = Column(Float, default=0.0)
    
    # Summary metadata
    summary_type = Column(String(20), default="detailed")  # brief, detailed, action_items, custom
    confidence_score = Column(Float, default=0.0)
    template_id = Column(UUID(as_uuid=True), ForeignKey("summary_templates.id"), nullable=True)
    word_count = Column(Integer, default=0)
    processing_time_ms = Column(Integer, default=0)
    
    # AI model information
    ai_model_used = Column(String(50), default="gpt-3.5-turbo")
    prompt_version = Column(String(20), default="v1.0")
    
    # Timestamps
    generated_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    session = relationship("Session", back_populates="summaries")
    template = relationship("SummaryTemplate", foreign_keys=[template_id])
    
    __table_args__ = (
        Index('ix_session_summaries_session_type', 'session_id', 'summary_type'),
        Index('ix_session_summaries_generated', 'generated_at'),
    )
    
    def __repr__(self):
        return f"<SessionSummary(id={self.id}, session_id={self.session_id}, type={self.summary_type})>"


class SummaryTemplate(Base):
    """Templates for session summaries"""
    __tablename__ = "summary_templates"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    
    # Template configuration
    template_type = Column(String(20), nullable=False)  # brief, detailed, action_items, custom
    prompt_template = Column(Text, nullable=False)
    output_format = Column(JSON, default={})  # Structure definition
    
    # Template settings
    max_length = Column(Integer, default=500)
    include_insights = Column(Boolean, default=True)
    include_action_items = Column(Boolean, default=True)
    include_recommendations = Column(Boolean, default=True)
    include_emotional_analysis = Column(Boolean, default=False)
    
    # Access control
    is_public = Column(Boolean, default=False)
    creator_id = Column(UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    creator = relationship("UserProfile", foreign_keys=[creator_id])
    summaries = relationship("SessionSummary", back_populates="template")
    
    __table_args__ = (
        Index('ix_summary_templates_type', 'template_type'),
        Index('ix_summary_templates_public', 'is_public'),
    )
    
    def __repr__(self):
        return f"<SummaryTemplate(id={self.id}, name={self.name}, type={self.template_type})>"


class BulkSummarizationJob(Base):
    """Bulk summarization job tracking"""
    __tablename__ = "bulk_summarization_jobs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=False)
    
    # Job configuration
    job_name = Column(String(100), nullable=False)
    session_filters = Column(JSON, default={})  # Filters used to select sessions
    template_id = Column(UUID(as_uuid=True), ForeignKey("summary_templates.id"), nullable=True)
    summary_type = Column(String(20), default="detailed")
    
    # Job status
    status = Column(String(20), default="pending")  # pending, processing, completed, failed
    total_sessions = Column(Integer, default=0)
    processed_sessions = Column(Integer, default=0)
    failed_sessions = Column(Integer, default=0)
    
    # Progress tracking
    progress_percentage = Column(Float, default=0.0)
    estimated_completion = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Results
    output_format = Column(String(20), default="json")  # json, csv, pdf
    download_url = Column(String(500), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)  # When download expires
    
    # Relationships
    user = relationship("UserProfile", foreign_keys=[user_id])
    template = relationship("SummaryTemplate", foreign_keys=[template_id])
    
    __table_args__ = (
        Index('ix_bulk_jobs_user_status', 'user_id', 'status'),
        Index('ix_bulk_jobs_created', 'created_at'),
    )
    
    def __repr__(self):
        return f"<BulkSummarizationJob(id={self.id}, name={self.job_name}, status={self.status})>"


# Analytics Models
class UserAnalytics(Base):
    """User analytics and usage tracking"""
    __tablename__ = "user_analytics"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=False)
    
    # Date tracking
    date = Column(DateTime, nullable=False)
    
    # Usage metrics
    sessions_count = Column(Integer, default=0)
    messages_sent = Column(Integer, default=0)
    total_duration_minutes = Column(Integer, default=0)
    total_spent = Column(Float, default=0.0)
    
    # Content metrics
    documents_uploaded = Column(Integer, default=0)
    knowledge_entries_added = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index('ix_user_analytics_user_date', 'user_id', 'date'),
        UniqueConstraint('user_id', 'date', name='uq_user_analytics_date'),
    )


class CreatorAnalytics(Base):
    """Creator analytics and earnings tracking"""
    __tablename__ = "creator_analytics"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    creator_id = Column(UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=False)
    clone_id = Column(UUID(as_uuid=True), ForeignKey("clones.id"), nullable=True)
    
    # Date tracking
    date = Column(DateTime, nullable=False)
    
    # Earnings metrics
    total_earnings = Column(Float, default=0.0)
    sessions_count = Column(Integer, default=0)
    total_duration_minutes = Column(Integer, default=0)
    
    # Performance metrics
    average_rating = Column(Float, default=0.0)
    ratings_count = Column(Integer, default=0)
    user_retention_rate = Column(Float, default=0.0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index('ix_creator_analytics_creator_date', 'creator_id', 'date'),
        Index('ix_creator_analytics_clone_date', 'clone_id', 'date'),
    )


# Memory Management Models
class UserMemoryContext(Base):
    """Long-term user context and memory across sessions"""
    __tablename__ = "user_memory_contexts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=False)
    
    # Context summary
    context_summary = Column(Text, nullable=True)
    key_preferences = Column(JSON, default=dict)
    communication_patterns = Column(JSON, default=dict)
    topics_of_interest = Column(ARRAY(String), default=[])
    personality_insights = Column(JSON, default=dict)
    
    # Memory metadata
    total_interactions = Column(Integer, default=0)
    context_version = Column(Integer, default=1)
    confidence_score = Column(Float, default=0.0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_interaction = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("UserProfile", foreign_keys=[user_id])
    
    __table_args__ = (
        Index('ix_user_memory_contexts_user_updated', 'user_id', 'updated_at'),
    )


class ConversationMemory(Base):
    """Compressed conversation memory for semantic retrieval"""
    __tablename__ = "conversation_memories"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=False)
    clone_id = Column(UUID(as_uuid=True), ForeignKey("clones.id"), nullable=False)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=True)
    
    # Memory content
    memory_summary = Column(Text, nullable=False)
    key_points = Column(JSON, default=[])
    emotional_context = Column(JSON, default=dict)
    topics_discussed = Column(ARRAY(String), default=[])
    
    # Memory importance and retrieval
    importance_score = Column(Float, default=0.5)
    relevance_tags = Column(ARRAY(String), default=[])
    embedding = Column(Text, nullable=True)  # Vector embedding for semantic search
    
    # Memory metadata
    memory_type = Column(String(20), default="conversation")  # conversation, insight, preference
    access_count = Column(Integer, default=0)
    last_accessed = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("UserProfile", foreign_keys=[user_id])
    clone = relationship("Clone", foreign_keys=[clone_id])
    session = relationship("Session", foreign_keys=[session_id])
    
    __table_args__ = (
        Index('ix_conversation_memories_user_clone', 'user_id', 'clone_id'),
        Index('ix_conversation_memories_importance', 'importance_score'),
        Index('ix_conversation_memories_topics', 'topics_discussed'),
    )


class CloneLearning(Base):
    """Clone learning and adaptation from user interactions"""
    __tablename__ = "clone_learning"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clone_id = Column(UUID(as_uuid=True), ForeignKey("clones.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=False)
    
    # Learning content
    learned_preferences = Column(JSON, default=dict)
    successful_patterns = Column(JSON, default=dict)
    adaptive_traits = Column(JSON, default=dict)
    communication_adjustments = Column(JSON, default=dict)
    
    # Learning metadata
    learning_confidence = Column(Float, default=0.0)
    interaction_count = Column(Integer, default=0)
    success_rate = Column(Float, default=0.0)
    last_feedback_rating = Column(Float, nullable=True)
    
    # Custom system prompt modifications
    custom_system_prompt_additions = Column(Text, nullable=True)
    personality_adjustments = Column(JSON, default=dict)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_learning_event = Column(DateTime, nullable=True)
    
    # Relationships
    clone = relationship("Clone", foreign_keys=[clone_id])
    user = relationship("UserProfile", foreign_keys=[user_id])
    
    __table_args__ = (
        Index('ix_clone_learning_clone_user', 'clone_id', 'user_id'),
        UniqueConstraint('clone_id', 'user_id', name='uq_clone_learning_pair'),
    )


class MemoryPolicy(Base):
    """Memory management policies and configuration"""
    __tablename__ = "memory_policies"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    policy_name = Column(String(100), unique=True, nullable=False)
    
    # Retention policies
    retention_days = Column(Integer, default=30)
    max_context_tokens = Column(Integer, default=4000)
    importance_threshold = Column(Float, default=0.3)
    
    # Compression and archival
    compression_algorithm = Column(String(50), default="summary")
    archival_threshold_days = Column(Integer, default=90)
    auto_cleanup_enabled = Column(Boolean, default=True)
    
    # Context window management
    max_conversation_memories = Column(Integer, default=50)
    semantic_similarity_threshold = Column(Float, default=0.7)
    memory_decay_factor = Column(Float, default=0.95)
    
    # Policy configuration
    policy_config = Column(JSON, default=dict)
    is_active = Column(Boolean, default=True)
    applies_to_user_tier = Column(String(20), default="all")  # free, pro, enterprise, all
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<MemoryPolicy(name={self.policy_name}, active={self.is_active})>"


class MemoryUsageStats(Base):
    """Memory usage statistics and analytics"""
    __tablename__ = "memory_usage_stats"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=False)
    date = Column(DateTime, nullable=False)
    
    # Memory usage metrics
    total_memories_stored = Column(Integer, default=0)
    context_retrievals = Column(Integer, default=0)
    memory_searches_performed = Column(Integer, default=0)
    average_retrieval_time_ms = Column(Float, default=0.0)
    
    # Storage metrics
    total_memory_size_kb = Column(Float, default=0.0)
    compressed_memories_count = Column(Integer, default=0)
    archived_memories_count = Column(Integer, default=0)
    
    # Performance metrics
    memory_hit_rate = Column(Float, default=0.0)
    context_relevance_score = Column(Float, default=0.0)
    user_satisfaction_score = Column(Float, default=0.0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("UserProfile", foreign_keys=[user_id])
    
    __table_args__ = (
        Index('ix_memory_usage_stats_user_date', 'user_id', 'date'),
        UniqueConstraint('user_id', 'date', name='uq_memory_usage_stats_date'),
    )