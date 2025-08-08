"""
Pydantic schemas for API request/response models
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, ConfigDict, Field
from enum import Enum


# Base schemas
class BaseSchema(BaseModel):
    """Base schema with common configuration"""
    model_config = ConfigDict(
        from_attributes=True,
        use_enum_values=True,
        arbitrary_types_allowed=True
    )


# Enums
class UserRole(str, Enum):
    USER = "user"
    CREATOR = "creator"
    ADMIN = "admin"


class SessionType(str, Enum):
    CHAT = "chat"
    VOICE = "voice"
    VIDEO = "video"


class SessionStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    ENDED = "ended"


class ProcessingStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


# Authentication schemas
class UserSignup(BaseSchema):
    """User signup request"""
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    full_name: str = Field(..., min_length=1, max_length=100)
    role: UserRole = UserRole.USER


class UserLogin(BaseSchema):
    """User login request"""
    email: EmailStr
    password: str


class TokenResponse(BaseSchema):
    """Token response"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class PasswordReset(BaseSchema):
    """Password reset request"""
    email: EmailStr


class PasswordResetConfirm(BaseSchema):
    """Password reset confirmation"""
    token: str
    new_password: str = Field(..., min_length=8, max_length=100)


# User schemas
class UserProfile(BaseSchema):
    """User profile response"""
    id: str
    email: EmailStr
    full_name: str
    avatar_url: Optional[str] = None
    role: UserRole
    created_at: datetime
    updated_at: datetime


class UserUpdate(BaseSchema):
    """User profile update request"""
    full_name: Optional[str] = Field(None, min_length=1, max_length=100)
    avatar_url: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None


# Pagination schemas
class PaginationInfo(BaseSchema):
    """Pagination information"""
    page: int
    limit: int
    total: int
    pages: int
    has_next: bool
    has_prev: bool


# Clone schemas
class CloneCreate(BaseSchema):
    """Clone creation request"""
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1, max_length=500)
    category: str = Field(..., min_length=1, max_length=50)
    expertise_areas: List[str] = Field(default_factory=list)
    base_price: float = Field(..., ge=0, le=1000)
    bio: Optional[str] = Field(None, max_length=2000)
    personality_traits: Optional[Dict[str, Any]] = None
    communication_style: Optional[Dict[str, Any]] = None
    languages: List[str] = Field(default_factory=lambda: ["English"])


class CloneUpdate(BaseSchema):
    """Clone update request"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, min_length=1, max_length=500)
    expertise_areas: Optional[List[str]] = None
    base_price: Optional[float] = Field(None, ge=0, le=1000)
    bio: Optional[str] = Field(None, max_length=2000)
    personality_traits: Optional[Dict[str, Any]] = None
    communication_style: Optional[Dict[str, Any]] = None
    is_published: Optional[bool] = None


class CloneResponse(BaseSchema):
    """Clone response"""
    id: str
    name: str
    description: str
    category: str
    expertise_areas: List[str]
    avatar_url: Optional[str] = None
    base_price: float
    bio: Optional[str] = None
    personality_traits: Optional[Dict[str, Any]] = None
    communication_style: Optional[Dict[str, Any]] = None
    languages: List[str] = Field(default_factory=lambda: ["English"])
    average_rating: float
    total_sessions: int
    total_earnings: float
    is_published: bool
    is_active: bool
    creator_id: str
    created_at: datetime
    updated_at: datetime
    published_at: Optional[datetime] = None


class CloneListResponse(BaseSchema):
    """Clone list response with pagination"""
    clones: List[CloneResponse]
    pagination: PaginationInfo


# Document schemas
class DocumentUpload(BaseSchema):
    """Document upload metadata"""
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    tags: List[str] = Field(default_factory=list)


class DocumentResponse(BaseSchema):
    """Document response"""
    id: str
    title: str
    description: Optional[str] = None
    file_name: str
    file_type: str
    file_size_bytes: int
    processing_status: ProcessingStatus
    chunk_count: int
    upload_date: datetime
    tags: List[str]


class KnowledgeEntryCreate(BaseSchema):
    """Direct knowledge entry creation"""
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1, max_length=10000)
    category: Optional[str] = Field(None, max_length=50)
    tags: List[str] = Field(default_factory=list)


class KnowledgeEntryResponse(BaseSchema):
    """Knowledge entry response"""
    id: str
    title: str
    content: str
    category: Optional[str] = None
    tags: List[str]
    created_at: datetime
    updated_at: datetime


# Session schemas
class SessionCreate(BaseSchema):
    """Session creation request"""
    expert_id: str
    session_type: SessionType
    demo_mode: bool = False
    initial_message: Optional[str] = None


class SessionResponse(BaseSchema):
    """Session response"""
    id: str
    expert_id: str
    session_type: SessionType
    status: SessionStatus
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_minutes: int
    total_cost: float
    rate_per_minute: float
    message_count: int
    rating: Optional[int] = None


class MessageCreate(BaseSchema):
    """Message creation request"""
    content: str = Field(..., min_length=1, max_length=10000)
    attachments: List[str] = Field(default_factory=list)


class MessageResponse(BaseSchema):
    """Message response"""
    id: str
    session_id: str
    sender_type: str  # 'user' or 'ai'
    content: str
    sources: List[Dict[str, Any]] = Field(default_factory=list)
    cost_increment: float
    created_at: datetime


# Session summary schemas
class SessionSummaryRequest(BaseSchema):
    """Session summary request"""
    summary_type: str = Field(default="detailed", pattern="^(brief|detailed|action_items)$")
    include_sources: bool = True


class SessionSummaryResponse(BaseSchema):
    """Session summary response"""
    id: str
    session_id: str
    summary_text: str
    key_insights: List[str] = Field(default_factory=list)
    action_items: List[Dict[str, Any]] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    next_session_topics: List[str] = Field(default_factory=list)
    generated_at: datetime


# Search and filtering schemas
class ExpertSearchRequest(BaseSchema):
    """Expert search request"""
    query: Optional[str] = None
    category: Optional[str] = None
    price_min: Optional[float] = Field(None, ge=0)
    price_max: Optional[float] = Field(None, ge=0)
    rating_min: Optional[float] = Field(None, ge=0, le=5)
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=20, ge=1, le=100)
    sort: Optional[str] = Field(default="rating", pattern="^(rating|price|popularity|created_at)$")


class KnowledgeSearchRequest(BaseSchema):
    """Knowledge base search request"""
    query: str = Field(..., min_length=1, max_length=1000)
    limit: int = Field(default=10, ge=1, le=50)
    similarity_threshold: float = Field(default=0.7, ge=0, le=1)
    include_metadata: bool = True


class KnowledgeSearchResult(BaseSchema):
    """Knowledge search result"""
    chunk_id: str
    content: str
    similarity_score: float
    source: Dict[str, Any]
    doc_metadata: Dict[str, Any] = Field(default_factory=dict)


# Analytics schemas
class UserAnalytics(BaseSchema):
    """User analytics response"""
    total_sessions: int
    total_duration_minutes: int
    total_spent: float
    average_rating: float
    favorite_experts: List[Dict[str, Any]]
    category_breakdown: Dict[str, int]


class CreatorAnalytics(BaseSchema):
    """Creator analytics response"""
    total_earnings: float
    total_sessions: int
    average_rating: float
    user_retention_rate: float
    popular_topics: List[str]
    monthly_trends: Dict[str, List[float]]


# Error schemas
class ErrorResponse(BaseSchema):
    """Error response"""
    error: str
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime


class ValidationErrorResponse(BaseSchema):
    """Validation error response"""
    error: str = "validation_error"
    message: str
    field_errors: List[Dict[str, Any]]
    timestamp: datetime


# Health check schemas
class HealthCheckResponse(BaseSchema):
    """Health check response"""
    status: str
    timestamp: datetime
    version: str
    environment: str


class DetailedHealthCheckResponse(BaseSchema):
    """Detailed health check response"""
    status: str
    timestamp: datetime
    version: str
    services: Dict[str, Dict[str, Any]]


# File upload schemas
class FileUploadResponse(BaseSchema):
    """File upload response"""
    file_id: str
    file_name: str
    file_size: int
    file_url: str
    upload_date: datetime


# Webhook schemas
class WebhookEvent(BaseSchema):
    """Webhook event"""
    event: str
    data: Dict[str, Any]
    timestamp: datetime
    webhook_id: str


# API Info schemas
class APIInfo(BaseSchema):
    """API information response"""
    name: str
    version: str
    api_version: str
    endpoints: Dict[str, str]
    features: Dict[str, Any]


# Memory Management Schemas
class UserMemoryContextCreate(BaseSchema):
    """Create user memory context"""
    context_summary: Optional[str] = None
    key_preferences: Dict[str, Any] = {}
    communication_patterns: Dict[str, Any] = {}
    topics_of_interest: List[str] = []
    personality_insights: Dict[str, Any] = {}


class UserMemoryContextUpdate(BaseSchema):
    """Update user memory context"""
    context_summary: Optional[str] = None
    key_preferences: Optional[Dict[str, Any]] = None
    communication_patterns: Optional[Dict[str, Any]] = None
    topics_of_interest: Optional[List[str]] = None
    personality_insights: Optional[Dict[str, Any]] = None


class UserMemoryContextResponse(BaseSchema):
    """User memory context response"""
    id: str
    user_id: str
    context_summary: Optional[str]
    key_preferences: Dict[str, Any]
    communication_patterns: Dict[str, Any]
    topics_of_interest: List[str]
    personality_insights: Dict[str, Any]
    total_interactions: int
    context_version: int
    confidence_score: float
    created_at: datetime
    updated_at: datetime
    last_interaction: Optional[datetime]


class ConversationMemoryCreate(BaseSchema):
    """Create conversation memory"""
    clone_id: str
    session_id: Optional[str] = None
    memory_summary: str
    key_points: List[str] = []
    emotional_context: Dict[str, Any] = {}
    topics_discussed: List[str] = []
    importance_score: float = Field(default=0.5, ge=0.0, le=1.0)
    relevance_tags: List[str] = []
    memory_type: str = "conversation"


class ConversationMemoryUpdate(BaseSchema):
    """Update conversation memory"""
    memory_summary: Optional[str] = None
    key_points: Optional[List[str]] = None
    emotional_context: Optional[Dict[str, Any]] = None
    topics_discussed: Optional[List[str]] = None
    importance_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    relevance_tags: Optional[List[str]] = None


class ConversationMemoryResponse(BaseSchema):
    """Conversation memory response"""
    id: str
    user_id: str
    clone_id: str
    session_id: Optional[str]
    memory_summary: str
    key_points: List[str]
    emotional_context: Dict[str, Any]
    topics_discussed: List[str]
    importance_score: float
    relevance_tags: List[str]
    memory_type: str
    access_count: int
    last_accessed: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    expires_at: Optional[datetime]


class MemorySearchRequest(BaseSchema):
    """Memory search request"""
    query: str = Field(..., min_length=1, max_length=500)
    clone_id: Optional[str] = None
    memory_types: List[str] = ["conversation", "insight", "preference"]
    importance_threshold: float = Field(default=0.3, ge=0.0, le=1.0)
    max_results: int = Field(default=10, ge=1, le=50)
    include_context: bool = True
    time_range_days: Optional[int] = Field(None, ge=1, le=365)


class MemorySearchResult(BaseSchema):
    """Memory search result"""
    memory_id: str
    memory_summary: str
    relevance_score: float
    memory_type: str
    topics_discussed: List[str]
    importance_score: float
    created_at: datetime
    clone_name: Optional[str] = None
    session_context: Optional[Dict[str, Any]] = None


class CloneLearningCreate(BaseSchema):
    """Create clone learning record"""
    clone_id: str
    learned_preferences: Dict[str, Any] = {}
    successful_patterns: Dict[str, Any] = {}
    adaptive_traits: Dict[str, Any] = {}
    communication_adjustments: Dict[str, Any] = {}
    custom_system_prompt_additions: Optional[str] = None
    personality_adjustments: Dict[str, Any] = {}


class CloneLearningUpdate(BaseSchema):
    """Update clone learning"""
    learned_preferences: Optional[Dict[str, Any]] = None
    successful_patterns: Optional[Dict[str, Any]] = None
    adaptive_traits: Optional[Dict[str, Any]] = None
    communication_adjustments: Optional[Dict[str, Any]] = None
    custom_system_prompt_additions: Optional[str] = None
    personality_adjustments: Optional[Dict[str, Any]] = None


class CloneLearningResponse(BaseSchema):
    """Clone learning response"""
    id: str
    clone_id: str
    user_id: str
    learned_preferences: Dict[str, Any]
    successful_patterns: Dict[str, Any]
    adaptive_traits: Dict[str, Any]
    communication_adjustments: Dict[str, Any]
    learning_confidence: float
    interaction_count: int
    success_rate: float
    last_feedback_rating: Optional[float]
    custom_system_prompt_additions: Optional[str]
    personality_adjustments: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    last_learning_event: Optional[datetime]


class MemoryPolicyCreate(BaseSchema):
    """Create memory policy"""
    policy_name: str = Field(..., min_length=1, max_length=100)
    retention_days: int = Field(default=30, ge=1, le=365)
    max_context_tokens: int = Field(default=4000, ge=100, le=32000)
    importance_threshold: float = Field(default=0.3, ge=0.0, le=1.0)
    compression_algorithm: str = "summary"
    archival_threshold_days: int = Field(default=90, ge=1, le=1000)
    auto_cleanup_enabled: bool = True
    max_conversation_memories: int = Field(default=50, ge=1, le=500)
    semantic_similarity_threshold: float = Field(default=0.7, ge=0.0, le=1.0)
    memory_decay_factor: float = Field(default=0.95, ge=0.1, le=1.0)
    applies_to_user_tier: str = "all"
    policy_config: Dict[str, Any] = {}


class MemoryPolicyResponse(BaseSchema):
    """Memory policy response"""
    id: str
    policy_name: str
    retention_days: int
    max_context_tokens: int
    importance_threshold: float
    compression_algorithm: str
    archival_threshold_days: int
    auto_cleanup_enabled: bool
    max_conversation_memories: int
    semantic_similarity_threshold: float
    memory_decay_factor: float
    policy_config: Dict[str, Any]
    is_active: bool
    applies_to_user_tier: str
    created_at: datetime
    updated_at: datetime


class MemoryAnalyticsResponse(BaseSchema):
    """Memory analytics response"""
    user_id: str
    total_memories: int
    memories_by_type: Dict[str, int]
    average_importance_score: float
    memory_retention_rate: float
    context_retrieval_frequency: float
    storage_usage_mb: float
    performance_metrics: Dict[str, Any]
    trending_topics: List[str]
    memory_effectiveness_score: float
    generated_at: datetime


class MemoryCleanupRequest(BaseSchema):
    """Memory cleanup request"""
    policy_name: Optional[str] = None
    dry_run: bool = True
    force_cleanup: bool = False
    cleanup_types: List[str] = ["expired", "low_importance", "old"]
    user_id: Optional[str] = None
    days_threshold: Optional[int] = None


class MemoryCleanupResponse(BaseSchema):
    """Memory cleanup response"""
    cleanup_id: str
    memories_cleaned: int
    memories_archived: int
    storage_freed_mb: float
    cleanup_summary: Dict[str, Any]
    executed_at: datetime
    next_cleanup_scheduled: Optional[datetime]


# Session Summarization Schemas
class SummaryTemplateCreate(BaseSchema):
    """Create summary template"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    template_type: str = Field(..., pattern="^(brief|detailed|action_items|custom)$")
    prompt_template: str = Field(..., min_length=10)
    output_format: Dict[str, Any] = {}
    max_length: int = Field(default=500, ge=50, le=5000)
    include_insights: bool = True
    include_action_items: bool = True
    include_recommendations: bool = True
    include_emotional_analysis: bool = False
    is_public: bool = False


class SummaryTemplateUpdate(BaseSchema):
    """Update summary template"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    prompt_template: Optional[str] = Field(None, min_length=10)
    output_format: Optional[Dict[str, Any]] = None
    max_length: Optional[int] = Field(None, ge=50, le=5000)
    include_insights: Optional[bool] = None
    include_action_items: Optional[bool] = None
    include_recommendations: Optional[bool] = None
    include_emotional_analysis: Optional[bool] = None
    is_public: Optional[bool] = None


class SummaryTemplateResponse(BaseSchema):
    """Summary template response"""
    id: str
    name: str
    description: Optional[str]
    template_type: str
    prompt_template: str
    output_format: Dict[str, Any]
    max_length: int
    include_insights: bool
    include_action_items: bool
    include_recommendations: bool
    include_emotional_analysis: bool
    is_public: bool
    creator_id: Optional[str]
    created_at: datetime
    updated_at: datetime


class SessionSummaryCreate(BaseSchema):
    """Create session summary"""
    session_id: str
    summary_type: str = Field(default="detailed", pattern="^(brief|detailed|action_items|custom)$")
    template_id: Optional[str] = None
    custom_prompt: Optional[str] = None
    include_emotional_analysis: bool = False
    max_length: Optional[int] = Field(None, ge=50, le=5000)


class SessionSummaryUpdate(BaseSchema):
    """Update session summary"""
    summary_text: Optional[str] = None
    key_insights: Optional[List[str]] = None
    action_items: Optional[List[Dict[str, Any]]] = None
    recommendations: Optional[List[str]] = None
    next_session_topics: Optional[List[str]] = None
    emotional_tone: Optional[str] = None
    main_topics: Optional[List[str]] = None


class SessionSummaryResponse(BaseSchema):
    """Session summary response"""
    id: str
    session_id: str
    summary_text: str
    key_insights: List[str]
    action_items: List[Dict[str, Any]]
    recommendations: List[str]
    next_session_topics: List[str]
    emotional_tone: Optional[str]
    main_topics: List[str]
    user_satisfaction_indicators: Dict[str, Any]
    learning_outcomes: List[Dict[str, Any]]
    conversation_quality_score: float
    summary_type: str
    confidence_score: float
    template_id: Optional[str]
    word_count: int
    processing_time_ms: int
    ai_model_used: str
    prompt_version: str
    generated_at: datetime
    updated_at: datetime


class BulkSummarizationRequest(BaseSchema):
    """Bulk summarization request"""
    job_name: str = Field(..., min_length=1, max_length=100)
    session_filters: Dict[str, Any] = {}
    template_id: Optional[str] = None
    summary_type: str = Field(default="detailed", pattern="^(brief|detailed|action_items|custom)$")
    output_format: str = Field(default="json", pattern="^(json|csv|pdf)$")
    clone_ids: Optional[List[str]] = None
    date_range: Optional[Dict[str, str]] = None  # {"start": "2024-01-01", "end": "2024-12-31"}
    min_duration: Optional[int] = None  # Minimum session duration in minutes
    min_rating: Optional[float] = None  # Minimum user rating


class BulkSummarizationJobResponse(BaseSchema):
    """Bulk summarization job response"""
    id: str
    job_name: str
    status: str
    total_sessions: int
    processed_sessions: int
    failed_sessions: int
    progress_percentage: float
    estimated_completion: Optional[datetime]
    error_message: Optional[str]
    output_format: str
    download_url: Optional[str]
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    expires_at: Optional[datetime]


class SummaryAnalyticsResponse(BaseSchema):
    """Summary analytics response"""
    user_id: str
    total_summaries: int
    summaries_by_type: Dict[str, int]
    average_confidence_score: float
    average_processing_time_ms: float
    most_common_topics: List[str]
    emotional_tone_distribution: Dict[str, int]
    quality_score_trends: List[Dict[str, Any]]
    template_usage_stats: Dict[str, int]
    generated_at: datetime


class SummarySearchRequest(BaseSchema):
    """Summary search request"""
    query: str = Field(..., min_length=1, max_length=500)
    summary_types: List[str] = ["brief", "detailed", "action_items"]
    clone_ids: Optional[List[str]] = None
    date_range: Optional[Dict[str, str]] = None
    min_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    max_results: int = Field(default=20, ge=1, le=100)
    include_content: bool = True


class SummarySearchResult(BaseSchema):
    """Summary search result"""
    summary_id: str
    session_id: str
    summary_text: str
    relevance_score: float
    summary_type: str
    main_topics: List[str]
    confidence_score: float
    generated_at: datetime
    clone_name: Optional[str]
    session_duration: Optional[int]