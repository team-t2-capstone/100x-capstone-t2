"""
Configuration settings for CloneAI backend
"""
import os
from typing import List, Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings with environment variable support"""
    
    # Basic app settings
    PROJECT_NAME: str = "CloneAI API"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # API settings
    API_V1_STR: str = "/api/v1"
    
    # Security settings
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Database settings
    DATABASE_URL: Optional[str] = None
    
    # Supabase settings
    SUPABASE_URL: Optional[str] = None
    SUPABASE_KEY: Optional[str] = None  # This should be the anon key
    SUPABASE_ANON_KEY: Optional[str] = None  # Explicit anon key
    SUPABASE_SERVICE_KEY: Optional[str] = None
    SUPABASE_JWT_SECRET: Optional[str] = None  # JWT secret for token verification
    SUPABASE_ACCESS_TOKEN: Optional[str] = None  # Management API access token
    
    # OpenAI settings
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_ORG_ID: Optional[str] = None
    GPT_4_MODEL: str = "gpt-4-turbo-preview"
    GPT_4_MINI_MODEL: str = "gpt-4o-mini"
    
    # LlamaCloud settings
    LLAMAPARSE_API_KEY: Optional[str] = None
    
    # ElevenLabs settings
    ELEVENLABS_API_KEY: Optional[str] = None
    
    # Redis settings (for caching and background tasks)
    REDIS_URL: str = "redis://localhost:6379"
    
    # CORS settings - comma-separated string in .env, parsed to list
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001,http://localhost:8000,http://127.0.0.1:8000,https://cloneai.vercel.app"
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS_ORIGINS string into list"""
        if isinstance(self.CORS_ORIGINS, str):
            return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
        return self.CORS_ORIGINS
    ALLOWED_HOSTS: List[str] = ["*"]
    
    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    
    # File upload settings
    MAX_FILE_SIZE_MB: int = 10
    UPLOAD_FOLDER: str = "uploads"
    ALLOWED_FILE_TYPES: List[str] = ["pdf", "docx", "txt", "md"]
    
    # OpenAI cost controls
    MAX_TOKENS_PER_REQUEST: int = 4000
    MAX_CONTEXT_LENGTH: int = 8000
    DAILY_COST_LIMIT: float = 1000.0
    
    # Session settings
    SESSION_DURATION_MINUTES: int = 60
    FREE_MESSAGES_LIMIT: int = 10
    
    # Expert categories
    EXPERT_TYPES: dict = {
        "life-coaching": "Life & Coaching",
        "business-strategy": "Business & Strategy", 
        "education-learning": "Education & Learning",
        "health-wellness": "Health & Wellness",
        "finance-investment": "Finance & Investment",
        "legal-consulting": "Legal & Consulting"
    }
    
    # RAG System settings
    RAG_API_BASE_URL: str = "http://localhost:8000/api"
    RAG_API_KEY: Optional[str] = None
    RAG_API_TIMEOUT: int = 30
    RAG_MAX_RETRIES: int = 3
    RAG_ENABLED: bool = True
    RAG_INITIALIZATION_TIMEOUT: int = 300
    RAG_CONFIDENCE_THRESHOLD: float = 0.3
    RAG_HIGH_CONFIDENCE_THRESHOLD: float = 0.7
    RAG_MAX_DOCUMENTS: int = 100
    RAG_CHUNK_SIZE: int = 1000
    RAG_CHUNK_OVERLAP: int = 200
    
    # Logging settings
    LOG_LEVEL: str = "INFO"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Create settings instance
settings = Settings()

# Validate required settings
def validate_settings(strict: bool = False):
    """Validate that required environment variables are set"""
    required_vars = [
        "SUPABASE_URL",
        "SUPABASE_KEY", 
        "OPENAI_API_KEY"
    ]
    
    missing_vars = []
    for var in required_vars:
        if not getattr(settings, var):
            missing_vars.append(var)
    
    if missing_vars:
        if strict:
            raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")
        else:
            # Just log warnings for development
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Missing environment variables (will use defaults): {', '.join(missing_vars)}")
            return False
    return True

# Export settings
__all__ = ["settings", "validate_settings"]