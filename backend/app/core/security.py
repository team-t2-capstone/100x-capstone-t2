"""
Security utilities for authentication and authorization
"""
from datetime import datetime, timedelta
from typing import Any, Optional, Union
from pathlib import Path

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Depends
import structlog

from app.config import settings

logger = structlog.get_logger()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Bearer token
security = HTTPBearer()

# Token types
ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"


class SecurityManager:
    """Handles all security operations"""
    
    def __init__(self):
        self.pwd_context = pwd_context
        self.algorithm = settings.ALGORITHM
        self.secret_key = settings.SECRET_KEY
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash"""
        try:
            return self.pwd_context.verify(plain_password, hashed_password)
        except Exception as e:
            logger.error("Password verification failed", error=str(e))
            return False
    
    def get_password_hash(self, password: str) -> str:
        """Hash a password"""
        return self.pwd_context.hash(password)
    
    def create_access_token(
        self, 
        subject: Union[str, Any], 
        expires_delta: Optional[timedelta] = None,
        additional_claims: Optional[dict] = None
    ) -> str:
        """Create JWT access token"""
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        
        to_encode = {
            "exp": expire,
            "sub": str(subject),
            "type": ACCESS_TOKEN_TYPE,
            "iat": datetime.utcnow()
        }
        
        if additional_claims:
            to_encode.update(additional_claims)
        
        try:
            encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
            return encoded_jwt
        except Exception as e:
            logger.error("Failed to create access token", error=str(e))
            raise
    
    def create_refresh_token(
        self, 
        subject: Union[str, Any], 
        expires_delta: Optional[timedelta] = None
    ) -> str:
        """Create JWT refresh token"""
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        
        to_encode = {
            "exp": expire,
            "sub": str(subject),
            "type": REFRESH_TOKEN_TYPE,
            "iat": datetime.utcnow()
        }
        
        try:
            encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
            return encoded_jwt
        except Exception as e:
            logger.error("Failed to create refresh token", error=str(e))
            raise
    
    def verify_token(self, token: str, token_type: Optional[str] = None) -> dict:
        """Verify JWT token and return payload"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            
            # Check token type if specified
            if token_type and payload.get("type") != token_type:
                raise JWTError(f"Invalid token type. Expected {token_type}")
            
            # Check expiration
            exp = payload.get("exp")
            if exp and datetime.utcnow() > datetime.fromtimestamp(exp):
                raise JWTError("Token has expired")
            
            return payload
            
        except JWTError as e:
            logger.warning("Token verification failed", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except Exception as e:
            logger.error("Unexpected error during token verification", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication error",
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    def get_user_id_from_token(self, token: str) -> str:
        """Extract user ID from JWT token"""
        payload = self.verify_token(token, ACCESS_TOKEN_TYPE)
        user_id = payload.get("sub")
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: no user ID found",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return user_id
    
    def create_password_reset_token(self, email: str) -> str:
        """Create password reset token"""
        expire = datetime.utcnow() + timedelta(hours=24)  # 24 hour expiry
        
        to_encode = {
            "exp": expire,
            "sub": email,
            "type": "password_reset",
            "iat": datetime.utcnow()
        }
        
        try:
            encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
            return encoded_jwt
        except Exception as e:
            logger.error("Failed to create password reset token", error=str(e))
            raise
    
    def verify_password_reset_token(self, token: str) -> str:
        """Verify password reset token and return email"""
        payload = self.verify_token(token, "password_reset")
        email = payload.get("sub")
        
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid password reset token",
            )
        
        return email
    
    def create_email_verification_token(self, email: str) -> str:
        """Create email verification token"""
        expire = datetime.utcnow() + timedelta(days=7)  # 7 day expiry
        
        to_encode = {
            "exp": expire,
            "sub": email,
            "type": "email_verification",
            "iat": datetime.utcnow()
        }
        
        try:
            encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
            return encoded_jwt
        except Exception as e:
            logger.error("Failed to create email verification token", error=str(e))
            raise
    
    def verify_email_verification_token(self, token: str) -> str:
        """Verify email verification token and return email"""
        payload = self.verify_token(token, "email_verification")
        email = payload.get("sub")
        
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid email verification token",
            )
        
        return email


# Global security manager instance
security_manager = SecurityManager()


# FastAPI dependencies
async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> str:
    """
    FastAPI dependency to get current user ID from JWT token
    """
    try:
        token = credentials.credentials
        user_id = security_manager.get_user_id_from_token(token)
        return user_id
    except Exception as e:
        logger.warning("Failed to get current user", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
) -> Optional[str]:
    """
    FastAPI dependency to optionally get current user ID from JWT token
    Returns None if no token provided or invalid
    """
    if not credentials:
        return None
    
    try:
        token = credentials.credentials
        user_id = security_manager.get_user_id_from_token(token)
        return user_id
    except:
        return None


async def verify_websocket_token(token: str) -> Optional[str]:
    """
    Verify JWT token for WebSocket connections
    Returns user_id if valid, None otherwise
    """
    try:
        payload = security_manager.verify_token(token, ACCESS_TOKEN_TYPE)
        user_id = payload.get("sub")
        return user_id if user_id else None
    except Exception as e:
        logger.warning("WebSocket token verification failed", error=str(e))
        return None


# Utility functions
def validate_password_strength(password: str) -> bool:
    """
    Validate password strength
    Requirements:
    - At least 8 characters
    - Contains at least one uppercase letter
    - Contains at least one lowercase letter  
    - Contains at least one digit
    """
    if len(password) < 8:
        return False
    
    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    
    return has_upper and has_lower and has_digit


def generate_api_key() -> str:
    """Generate a secure API key"""
    import secrets
    return secrets.token_urlsafe(32)


# Role-based access control
class RoleChecker:
    """Check if user has required role"""
    
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles
    
    def __call__(self, current_user_id: str = Depends(get_current_user_id)):
        # This would typically fetch user role from database
        # For now, we'll implement basic role checking
        # TODO: Implement proper role fetching from database
        return current_user_id


# Common role checkers
require_admin = RoleChecker(["admin"])
require_creator = RoleChecker(["creator", "admin"])
require_user = RoleChecker(["user", "creator", "admin"])


# Rate limiting utilities
class RateLimitter:
    """Simple in-memory rate limiter"""
    
    def __init__(self):
        self.requests = {}
    
    def is_allowed(self, key: str, limit: int, window: int) -> bool:
        """
        Check if request is allowed based on rate limit
        
        Args:
            key: Unique identifier (e.g., user_id, IP address)
            limit: Maximum requests allowed
            window: Time window in seconds
        
        Returns:
            True if request is allowed, False otherwise
        """
        import time
        
        now = time.time()
        
        if key not in self.requests:
            self.requests[key] = []
        
        # Remove old requests outside the window
        self.requests[key] = [
            req_time for req_time in self.requests[key] 
            if now - req_time < window
        ]
        
        # Check if under limit
        if len(self.requests[key]) < limit:
            self.requests[key].append(now)
            return True
        
        return False


# Global rate limiter instance
rate_limiter = RateLimitter()


# CORS and security headers
def get_security_headers() -> dict:
    """Get security headers for responses"""
    return {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        "Referrer-Policy": "strict-origin-when-cross-origin"
    }