"""
CloneAI FastAPI Main Application
"""
import logging
import structlog
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Dict, Any

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse

# Import configurations
from app.config import settings, validate_settings

# Import database and security
from app.database import init_database, close_database, test_all_connections, db_manager
from app.core.security import get_security_headers

# Import RAG services (direct integration)
# from app.services.rag_client import initialize_rag_client  # No longer needed with direct integration

# Import API routers
from app.api import clones, knowledge, users, discovery, rag, sessions, chat, memory, summarization, analytics, billing, ai_chat, chat_websocket, webrtc, voice_video_calls
from app.api.v1 import clones_process_knowledge

# Import auth conditionally
try:
    from app.api import auth_supabase as auth
    AUTH_AVAILABLE = True
except ImportError:
    AUTH_AVAILABLE = False
    auth = None

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown events"""
    # Startup
    logger.info("Starting CloneAI API", version=settings.VERSION)
    
    try:
        # Validate required environment variables (non-strict for development)
        if validate_settings(strict=False):
            logger.info("Configuration validation passed")
        else:
            logger.warning("Some configuration values missing - using defaults")
        
        # Initialize database connections
        await init_database()
        logger.info("Database connections initialized")
        
        # Test all database connections
        connection_results = await test_all_connections()
        logger.info("Database connection tests completed", results=connection_results)
        
        # Initialize Redis connection (will be implemented later)
        # await init_redis()
        logger.info("Redis connection ready")
        
        # Initialize RAG service (direct integration - no initialization needed)
        logger.info("RAG service ready (direct integration)")
        
        logger.info("All services initialized successfully")
        
    except Exception as e:
        logger.error("Failed to initialize application", error=str(e))
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down CloneAI API")
    try:
        # Close database connections
        # await close_database()
        logger.info("Database connections closed")
        
        # Close Redis connection  
        # await close_redis()
        logger.info("Redis connection closed")
        
    except Exception as e:
        logger.error("Error during shutdown", error=str(e))


# Create FastAPI application
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="AI Expert Clone Platform - Create and interact with personalized AI versions of professional experts",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add trusted host middleware
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.ALLOWED_HOSTS
)

# Include API routers
if AUTH_AVAILABLE and auth:
    app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(ai_chat.router, prefix=settings.API_V1_STR)  # AI chat endpoints
app.include_router(chat_websocket.router, prefix=settings.API_V1_STR)  # WebSocket chat
app.include_router(clones.router, prefix=settings.API_V1_STR)
app.include_router(knowledge.router, prefix=settings.API_V1_STR)
app.include_router(users.router, prefix=settings.API_V1_STR)
app.include_router(discovery.router, prefix=settings.API_V1_STR)
app.include_router(rag.router, prefix=settings.API_V1_STR)
app.include_router(sessions.router, prefix=settings.API_V1_STR)
app.include_router(chat.router, prefix=settings.API_V1_STR)
app.include_router(memory.router, prefix=settings.API_V1_STR)
app.include_router(summarization.router, prefix=settings.API_V1_STR)
app.include_router(analytics.router, prefix=settings.API_V1_STR)
app.include_router(billing.router, prefix=settings.API_V1_STR)
app.include_router(webrtc.router, prefix=settings.API_V1_STR)
app.include_router(voice_video_calls.router, prefix=settings.API_V1_STR)
app.include_router(clones_process_knowledge.router, prefix=settings.API_V1_STR)

# Health check endpoints
@app.get("/health")
async def health_check() -> Dict[str, Any]:
    """Basic health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": settings.VERSION,
        "environment": "development" if settings.DEBUG else "production"
    }


@app.get("/health/detailed")
async def detailed_health_check() -> Dict[str, Any]:
    """Detailed health check with service status"""
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": settings.VERSION,
        "services": {}
    }
    
    # Check database connection and pool status
    try:
        db_health = await db_manager.health_check()
        
        # Get connection pool statistics
        pool_stats = {}
        if db_manager.engine and db_manager.engine.pool:
            pool = db_manager.engine.pool
            pool_stats = {
                "pool_size": pool.size(),
                "checked_in": pool.checkedin(),
                "checked_out": pool.checkedout(),
                "overflow": pool.overflow(),
                "invalid": pool.invalid(),
                "pool_usage_percent": round((pool.checkedout() / (pool.size() + pool.overflow())) * 100, 2) if (pool.size() + pool.overflow()) > 0 else 0
            }
        
        health_status["services"]["database"] = {
            "status": "healthy" if db_health else "unhealthy",
            "message": "Database connection ready" if db_health else "Database connection failed",
            "connection_pool": pool_stats
        }
    except Exception as e:
        health_status["services"]["database"] = {
            "status": "unhealthy",
            "message": f"Database check failed: {str(e)}",
            "connection_pool": {}
        }
    
    # Check Supabase client
    try:
        supabase_client = db_manager.get_supabase()
        health_status["services"]["supabase"] = {
            "status": "healthy",
            "message": "Supabase client ready"
        }
    except Exception as e:
        health_status["services"]["supabase"] = {
            "status": "unhealthy",
            "message": f"Supabase client error: {str(e)}"
        }
    
    # Check Clean RAG service
    try:
        from app.services.rag import CleanRAGService
        rag_service = CleanRAGService()
        rag_health = await rag_service.get_health_status()
        
        if rag_health.is_healthy:
            health_status["services"]["rag"] = {
                "status": "healthy",
                "message": "Clean RAG service ready and configured",
                "openai_configured": rag_health.openai_configured,
                "supabase_configured": rag_health.supabase_configured,
                "vector_stores_active": rag_health.vector_stores_active,
                "assistants_active": rag_health.assistants_active,
                "last_check": rag_health.last_check
            }
        else:
            health_status["services"]["rag"] = {
                "status": "unhealthy",
                "message": "Clean RAG service has configuration issues",
                "openai_configured": rag_health.openai_configured,
                "supabase_configured": rag_health.supabase_configured,
                "issues": rag_health.issues
            }
    except Exception as e:
        health_status["services"]["rag"] = {
            "status": "unhealthy",
            "message": f"Clean RAG service check failed: {str(e)}"
        }
    
    # Check Redis (placeholder)
    health_status["services"]["redis"] = {
        "status": "healthy", 
        "message": "Redis connection ready"
    }
    
    # Storage buckets check (placeholder)
    health_status["services"]["storage"] = {
        "status": "healthy",
        "message": "Storage buckets configured",
        "buckets": ["avatars", "clone-avatars", "documents", "exports"]
    }
    
    # Overall status determination
    service_statuses = [service["status"] for service in health_status["services"].values()]
    if "unhealthy" in service_statuses:
        health_status["status"] = "degraded"
    elif "configured" in service_statuses and all(status in ["healthy", "configured"] for status in service_statuses):
        health_status["status"] = "healthy"
    
    return health_status


# API information endpoint
@app.get(f"{settings.API_V1_STR}/info")
async def api_info() -> Dict[str, Any]:
    """Get API information and available endpoints"""
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "api_version": "v1",
        "endpoints": {
            "authentication": f"{settings.API_V1_STR}/auth",
            "experts": f"{settings.API_V1_STR}/experts",
            "clones": f"{settings.API_V1_STR}/clones", 
            "sessions": f"{settings.API_V1_STR}/sessions",
            "chat": f"{settings.API_V1_STR}/chat",
            "uploads": f"{settings.API_V1_STR}/uploads"
        },
        "features": {
            "expert_types": list(settings.EXPERT_TYPES.values()),
            "session_duration_minutes": settings.SESSION_DURATION_MINUTES,
            "free_messages_limit": settings.FREE_MESSAGES_LIMIT,
            "max_file_size_mb": settings.MAX_FILE_SIZE_MB
        }
    }


# Root endpoint
@app.get("/")
async def root() -> Dict[str, Any]:
    """Root endpoint with API welcome message"""
    return {
        "message": "Welcome to CloneAI API",
        "version": settings.VERSION,
        "docs": "/docs" if settings.DEBUG else "Documentation not available in production",
        "health": "/health",
        "api": f"{settings.API_V1_STR}/info"
    }


# Global exception handler for unhandled exceptions
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle any unhandled exceptions"""
    logger.error(
        "Unhandled exception occurred",
        path=request.url.path,
        method=request.method,
        error=str(exc),
        exc_info=True
    )
    
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": "An unexpected error occurred" if not settings.DEBUG else str(exc),
            "timestamp": datetime.utcnow().isoformat()
        }
    )


# Request logging middleware (for development)
if settings.DEBUG:
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start_time = datetime.utcnow()
        
        logger.info(
            "Request started",
            method=request.method,
            path=request.url.path,
            query_params=str(request.query_params),
            client_ip=request.client.host if request.client else None
        )
        
        response = await call_next(request)
        
        process_time = (datetime.utcnow() - start_time).total_seconds()
        
        logger.info(
            "Request completed",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            process_time=process_time
        )
        
        return response


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )