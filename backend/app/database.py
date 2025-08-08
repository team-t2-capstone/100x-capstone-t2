"""
Database connection and session management for CloneAI
"""
import asyncio
import logging
from typing import AsyncGenerator, Optional
from contextlib import asynccontextmanager

import asyncpg
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
import structlog

# Optional Supabase import
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = None
    create_client = None

from app.config import settings

logger = structlog.get_logger()

# SQLAlchemy base class for models
Base = declarative_base()

# Global variables for connections
engine = None
SessionLocal = None
supabase_client: Optional[Client] = None


class DatabaseManager:
    """Database connection manager for both SQLAlchemy and Supabase"""
    
    def __init__(self):
        self.engine = None
        self.SessionLocal = None
        self.supabase_client = None
        self._pool = None
    
    async def initialize(self):
        """Initialize database connections"""
        try:
            # Initialize SQLAlchemy for complex queries
            if settings.DATABASE_URL:
                self.engine = create_async_engine(
                    settings.DATABASE_URL,
                    echo=settings.DEBUG,
                    pool_size=10,
                    max_overflow=20,
                    pool_pre_ping=True,
                    pool_recycle=3600,
                    connect_args={
                        "server_settings": {
                            "application_name": "cloneai_backend",
                            "jit": "off"
                        }
                    }
                )
                
                self.SessionLocal = async_sessionmaker(
                    self.engine,
                    class_=AsyncSession,
                    expire_on_commit=False
                )
                
                logger.info("SQLAlchemy engine initialized")
            
            # Initialize Supabase client for auth and storage
            if SUPABASE_AVAILABLE and settings.SUPABASE_URL and settings.SUPABASE_KEY:
                try:
                    # Create client with minimal configuration for compatibility
                    self.supabase_client = create_client(
                        settings.SUPABASE_URL,
                        settings.SUPABASE_KEY
                    )
                    logger.info("Supabase client initialized")
                except Exception as e:
                    logger.error("Failed to initialize Supabase client", error=str(e))
                    # Continue without Supabase client for now
                    self.supabase_client = None
            else:
                logger.info("Supabase not available or not configured, skipping initialization")
            
            # Initialize raw asyncpg connection pool for vector operations (optional)
            if settings.DATABASE_URL:
                try:
                    # Convert SQLAlchemy URL to asyncpg format
                    asyncpg_url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
                    self._pool = await asyncpg.create_pool(
                        asyncpg_url,
                        min_size=2,
                        max_size=10,
                        command_timeout=60
                    )
                    logger.info("AsyncPG connection pool initialized")
                except Exception as e:
                    logger.warning("AsyncPG connection pool failed, will use SQLAlchemy for all operations", error=str(e))
                    self._pool = None
                
        except Exception as e:
            logger.error("Failed to initialize database connections", error=str(e))
            raise
    
    async def close(self):
        """Close all database connections"""
        try:
            if self.engine:
                await self.engine.dispose()
                logger.info("SQLAlchemy engine disposed")
            
            if self._pool:
                await self._pool.close()
                logger.info("AsyncPG pool closed")
                
        except Exception as e:
            logger.error("Error closing database connections", error=str(e))
    
    async def health_check(self) -> bool:
        """Check database connection health"""
        try:
            if self._pool:
                async with self._pool.acquire() as conn:
                    await conn.execute("SELECT 1")
                    return True
            return False
        except Exception as e:
            logger.error("Database health check failed", error=str(e))
            return False
    
    @asynccontextmanager
    async def get_session(self) -> AsyncGenerator[AsyncSession, None]:
        """Get SQLAlchemy session"""
        if not self.SessionLocal:
            raise RuntimeError("Database not initialized")
        
        async with self.SessionLocal() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()
    
    @asynccontextmanager
    async def get_connection(self) -> AsyncGenerator[asyncpg.Connection, None]:
        """Get raw asyncpg connection for vector operations"""
        if not self._pool:
            raise RuntimeError("Database pool not initialized")
        
        async with self._pool.acquire() as conn:
            yield conn
    
    def get_supabase(self) -> Client:
        """Get Supabase client"""
        if not self.supabase_client:
            raise RuntimeError("Supabase client not initialized")
        return self.supabase_client


# Global database manager instance
db_manager = DatabaseManager()


# Dependency for FastAPI endpoints
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency to get database session in FastAPI endpoints"""
    async with db_manager.get_session() as session:
        yield session


async def get_db_connection() -> AsyncGenerator[asyncpg.Connection, None]:
    """Dependency to get raw database connection in FastAPI endpoints"""
    async with db_manager.get_connection() as conn:
        yield conn


def get_supabase() -> Client:
    """Dependency to get Supabase client in FastAPI endpoints"""
    return db_manager.get_supabase()


# Database initialization functions
async def init_database():
    """Initialize database connections - called on app startup"""
    global engine, SessionLocal, supabase_client
    
    await db_manager.initialize()
    
    # Set global variables for backward compatibility
    engine = db_manager.engine
    SessionLocal = db_manager.SessionLocal
    supabase_client = db_manager.supabase_client


async def close_database():
    """Close database connections - called on app shutdown"""
    await db_manager.close()


# Vector search utilities
async def execute_vector_search(
    query_embedding: list[float],
    table: str,
    embedding_column: str = "embedding",
    similarity_threshold: float = 0.7,
    limit: int = 10,
    additional_filters: str = ""
) -> list[dict]:
    """
    Execute vector similarity search using pgvector
    
    Args:
        query_embedding: The embedding vector to search for
        table: Database table name
        embedding_column: Name of the embedding column
        similarity_threshold: Minimum similarity score
        limit: Maximum number of results
        additional_filters: Additional SQL WHERE conditions
    
    Returns:
        List of matching records with similarity scores
    """
    async with db_manager.get_connection() as conn:
        # Construct the query
        where_clause = f"1 - ({embedding_column} <=> $1) > $2"
        if additional_filters:
            where_clause += f" AND {additional_filters}"
        
        query = f"""
        SELECT *, 1 - ({embedding_column} <=> $1) as similarity_score
        FROM {table}
        WHERE {where_clause}
        ORDER BY {embedding_column} <=> $1
        LIMIT $3
        """
        
        # Execute the query
        results = await conn.fetch(query, query_embedding, similarity_threshold, limit)
        
        # Convert to list of dictionaries
        return [dict(record) for record in results]


# Database utility functions
async def check_pgvector_extension() -> bool:
    """Check if pgvector extension is installed"""
    try:
        async with db_manager.get_connection() as conn:
            result = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector')"
            )
            return bool(result)
    except Exception as e:
        logger.error("Failed to check pgvector extension", error=str(e))
        return False


async def ensure_pgvector_extension():
    """Ensure pgvector extension is installed"""
    try:
        async with db_manager.get_connection() as conn:
            await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
            logger.info("pgvector extension ensured")
    except Exception as e:
        logger.error("Failed to create pgvector extension", error=str(e))
        raise


# Connection test function
async def test_all_connections():
    """Test all database connections"""
    results = {
        "sqlalchemy": False,
        "asyncpg": False,
        "supabase": False,
        "pgvector": False
    }
    
    try:
        # Test SQLAlchemy connection
        if db_manager.engine:
            async with db_manager.get_session() as session:
                from sqlalchemy import text
                await session.execute(text("SELECT 1"))
                results["sqlalchemy"] = True
                logger.info("SQLAlchemy connection test: PASSED")
    except Exception as e:
        logger.error("SQLAlchemy connection test failed", error=str(e))
    
    try:
        # Test AsyncPG connection
        if db_manager._pool:
            async with db_manager.get_connection() as conn:
                await conn.execute("SELECT 1")
                results["asyncpg"] = True
                logger.info("AsyncPG connection test: PASSED")
        else:
            logger.info("AsyncPG connection not available, using SQLAlchemy only")
            results["asyncpg"] = False
    except Exception as e:
        logger.error("AsyncPG connection test failed", error=str(e))
    
    try:
        # Test Supabase connection
        if db_manager.supabase_client:
            # Simple table query to test connection
            response = db_manager.supabase_client.table("user_profiles").select("count").limit(1).execute()
            results["supabase"] = True
            logger.info("Supabase connection test: PASSED")
    except Exception as e:
        logger.error("Supabase connection test failed", error=str(e))
    
    try:
        # Test pgvector extension
        results["pgvector"] = await check_pgvector_extension()
        if results["pgvector"]:
            logger.info("pgvector extension test: PASSED")
        else:
            logger.warning("pgvector extension test: FAILED")
    except Exception as e:
        logger.error("pgvector extension test failed", error=str(e))
    
    return results