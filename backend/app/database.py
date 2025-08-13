"""
Supabase database connection and session management for CloneAI
"""
import os
from typing import Optional
import structlog

try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = None
    create_client = None

from app.config import settings

logger = structlog.get_logger()

# Global Supabase client
supabase_client: Optional[Client] = None


class DatabaseManager:
    """Simplified database manager using only Supabase"""
    
    def __init__(self):
        self.supabase_client = None
    
    async def initialize(self):
        """Initialize Supabase connection"""
        try:
            if not SUPABASE_AVAILABLE:
                logger.warning("Supabase client not available")
                return False
            
            if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
                logger.warning("Supabase credentials not configured")
                return False
            
            # Initialize Supabase client
            self.supabase_client = create_client(
                settings.SUPABASE_URL,
                settings.SUPABASE_KEY
            )
            
            global supabase_client
            supabase_client = self.supabase_client
            
            logger.info("Supabase client initialized successfully")
            return True
            
        except Exception as e:
            logger.error("Failed to initialize Supabase client", error=str(e))
            return False
    
    def get_supabase(self) -> Optional[Client]:
        """Get Supabase client instance"""
        return self.supabase_client
    
    async def health_check(self) -> bool:
        """Check Supabase connection health"""
        try:
            if not self.supabase_client:
                return False
            
            # Simple query to test connection
            result = self.supabase_client.table('user_profiles').select("id").limit(1).execute()
            return result is not None
            
        except Exception as e:
            logger.error("Supabase health check failed", error=str(e))
            return False
    
    async def close(self):
        """Close database connections (Supabase manages this automatically)"""
        logger.info("Supabase connections closed")


# Global database manager instance
db_manager = DatabaseManager()


async def init_database():
    """Initialize database connections"""
    success = await db_manager.initialize()
    if not success:
        raise Exception("Failed to initialize database connections")


async def close_database():
    """Close database connections"""
    await db_manager.close()


def get_supabase() -> Optional[Client]:
    """Dependency to get Supabase client"""
    return db_manager.get_supabase()


async def get_db_session():
    """Legacy compatibility function - SQLAlchemy sessions no longer used
    
    This function exists for backward compatibility with existing API endpoints.
    All database operations should use get_supabase() instead.
    
    Returns None to avoid breaking dependency injection.
    """
    # Return None - endpoints should use get_supabase() instead
    return None


async def test_all_connections():
    """Test all database connections"""
    results = {}
    
    # Test Supabase
    supabase_health = await db_manager.health_check()
    results['supabase'] = {
        'status': 'healthy' if supabase_health else 'unhealthy',
        'available': SUPABASE_AVAILABLE
    }
    
    return results