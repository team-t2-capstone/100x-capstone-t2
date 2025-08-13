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
    SUPABASE_KEY: Optional[str] = None
    SUPABASE_SERVICE_KEY: Optional[str] = None
    SUPABASE_JWT_SECRET: Optional[str] = None  # JWT secret for token verification
    
    # OpenAI settings
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_ORG_ID: Optional[str] = None
    GPT_4_MODEL: str = "gpt-4-turbo-preview"
    GPT_4_MINI_MODEL: str = "gpt-4o-mini"
    EMBEDDING_MODEL: str = "text-embedding-3-large"
    
    # RAG API settings - direct integration 
    RAG_API_BASE_URL: Optional[str] = None
    RAG_API_KEY: Optional[str] = None
    LLAMAPARSE_API_KEY: Optional[str] = None  # LlamaParse for document processing
    
    # Redis settings (for caching and background tasks)
    REDIS_URL: str = "redis://localhost:6379"
    
    # CORS settings - comma-separated string in .env, parsed to list
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001,https://cloneai.vercel.app"
    
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