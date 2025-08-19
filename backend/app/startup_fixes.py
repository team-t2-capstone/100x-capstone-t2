"""
Startup fixes for RAG functionality
Ensures database is properly initialized when the application starts
"""
import asyncio
from typing import Optional
from app.database import db_manager, get_supabase
import structlog

logger = structlog.get_logger()

async def ensure_rag_database_ready():
    """Ensure database is ready for RAG operations"""
    try:
        # Initialize database if not already done
        if get_supabase() is None:
            logger.info("Initializing database for RAG operations...")
            success = await db_manager.initialize()
            if not success:
                logger.error("Failed to initialize database for RAG")
                return False
            logger.info("Database initialized successfully for RAG")
        
        # Test connection
        supabase = get_supabase()
        if supabase:
            # Simple test query
            result = supabase.table('clones').select('id').limit(1).execute()
            logger.info("RAG database connection verified")
            return True
        else:
            logger.error("Supabase client is None after initialization")
            return False
    except Exception as e:
        logger.error(f"Failed to ensure RAG database ready: {str(e)}")
        return False

def initialize_rag_on_startup():
    """Synchronous wrapper for startup initialization"""
    try:
        return asyncio.run(ensure_rag_database_ready())
    except Exception as e:
        logger.error(f"Startup RAG initialization failed: {str(e)}")
        return False
