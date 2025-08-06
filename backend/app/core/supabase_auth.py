"""
Supabase Authentication integration for CloneAI
Handles JWT token validation and Supabase Auth operations
"""
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
import jwt
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import Client

import structlog

from app.config import settings
from app.database import get_supabase
from app.core.security import security_manager

logger = structlog.get_logger()

# JWT token scheme
security = HTTPBearer()


class SupabaseAuthError(Exception):
    """Custom exception for Supabase Auth errors"""
    pass


class SupabaseAuthManager:
    """Handles Supabase Auth operations"""
    
    def __init__(self):
        self.jwt_secret = settings.SUPABASE_JWT_SECRET
    
    def verify_supabase_jwt(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Verify Supabase JWT token
        Uses Supabase's JWT secret to validate tokens
        """
        try:
            if not self.jwt_secret:
                logger.error("Supabase JWT secret not configured")
                return None
            
            # Verify and decode the JWT token
            payload = jwt.decode(
                token, 
                self.jwt_secret, 
                algorithms=["HS256"],
                audience="authenticated"
            )
            
            # Check if token is expired
            if "exp" in payload:
                exp_timestamp = payload["exp"]
                if datetime.utcnow().timestamp() > exp_timestamp:
                    logger.warning("JWT token expired")
                    return None
            
            # Validate required fields
            if "sub" not in payload:
                logger.warning("JWT token missing user ID")
                return None
            
            return payload
            
        except jwt.ExpiredSignatureError:
            logger.warning("JWT token expired")
            return None
        except jwt.InvalidTokenError as e:
            logger.warning("Invalid JWT token", error=str(e))
            return None
        except Exception as e:
            logger.error("JWT verification error", error=str(e))
            return None
    
    async def authenticate_user(
        self, 
        email: str, 
        password: str, 
        supabase_client: Client
    ) -> Dict[str, Any]:
        """
        Authenticate user with Supabase Auth
        Returns user data and tokens
        """
        try:
            # Sign in with Supabase
            response = supabase_client.auth.sign_in_with_password({
                "email": email,
                "password": password
            })
            
            if response.user and response.session:
                logger.info("User authenticated successfully", user_id=response.user.id)
                return {
                    "user": response.user,
                    "session": response.session,
                    "access_token": response.session.access_token,
                    "refresh_token": response.session.refresh_token,
                    "expires_in": response.session.expires_in
                }
            else:
                logger.warning("Authentication failed - invalid credentials", email=email)
                raise SupabaseAuthError("Invalid credentials")
                
        except Exception as e:
            logger.error("Supabase authentication error", error=str(e), email=email)
            if "Invalid login credentials" in str(e):
                raise SupabaseAuthError("Invalid email or password")
            elif "Email not confirmed" in str(e):
                raise SupabaseAuthError("Email not verified. Please check your email and verify your account.")
            else:
                raise SupabaseAuthError(f"Authentication failed: {str(e)}")
    
    async def register_user(
        self, 
        email: str, 
        password: str, 
        full_name: str,
        role: str = "user",
        supabase_client: Client = None
    ) -> Dict[str, Any]:
        """
        Register new user with Supabase Auth
        Returns user data
        """
        try:
            # Sign up with Supabase
            response = supabase_client.auth.sign_up({
                "email": email,
                "password": password,
                "options": {
                    "data": {
                        "full_name": full_name,
                        "role": role
                    }
                }
            })
            
            if response.user:
                logger.info("User registered successfully", user_id=response.user.id, email=email)
                return {
                    "user": response.user,
                    "session": response.session,
                    "message": "Registration successful. Please check your email to verify your account.",
                    "email_confirmation_sent": True
                }
            else:
                logger.warning("Registration failed", email=email)
                raise SupabaseAuthError("Registration failed")
                
        except Exception as e:
            logger.error("Supabase registration error", error=str(e), email=email)
            if "User already registered" in str(e):
                raise SupabaseAuthError("Email already registered")
            elif "Password should be at least" in str(e):
                raise SupabaseAuthError("Password must be at least 6 characters long")
            elif "Signup is disabled" in str(e):
                raise SupabaseAuthError("User registration is currently disabled")
            else:
                raise SupabaseAuthError(f"Registration failed: {str(e)}")
    
    async def refresh_token(
        self, 
        refresh_token: str,
        supabase_client: Client
    ) -> Dict[str, Any]:
        """Refresh Supabase access token"""
        try:
            response = supabase_client.auth.refresh_session(refresh_token)
            
            if response.session:
                logger.info("Token refreshed successfully")
                return {
                    "access_token": response.session.access_token,
                    "refresh_token": response.session.refresh_token,
                    "expires_in": response.session.expires_in,
                    "token_type": "Bearer"
                }
            else:
                raise SupabaseAuthError("Token refresh failed")
                
        except Exception as e:
            logger.error("Token refresh error", error=str(e))
            raise SupabaseAuthError(f"Token refresh failed: {str(e)}")
    
    async def reset_password(
        self, 
        email: str,
        supabase_client: Client
    ) -> bool:
        """Send password reset email via Supabase"""
        try:
            response = supabase_client.auth.reset_password_email(email)
            logger.info("Password reset email sent", email=email)
            return True
            
        except Exception as e:
            logger.error("Password reset error", error=str(e), email=email)
            return False
    
    async def verify_email(
        self, 
        token: str,
        email: str,
        supabase_client: Client
    ) -> bool:
        """Verify email with Supabase token"""
        try:
            response = supabase_client.auth.verify_otp({
                "email": email,
                "token": token,
                "type": "email"
            })
            
            if response.user:
                logger.info("Email verified successfully", email=email)
                return True
            return False
            
        except Exception as e:
            logger.error("Email verification error", error=str(e), email=email)
            return False
    
    async def signout_user(
        self, 
        supabase_client: Client
    ) -> bool:
        """Sign out user from Supabase"""
        try:
            supabase_client.auth.sign_out()
            logger.info("User signed out successfully")
            return True
            
        except Exception as e:
            logger.error("Sign out error", error=str(e))
            return False
    
    async def get_user_by_jwt(
        self, 
        jwt_token: str,
        supabase_client: Client
    ) -> Optional[Dict[str, Any]]:
        """Get user info from JWT token"""
        try:
            # Set the session with the JWT token
            supabase_client.auth.set_session(jwt_token, "")
            
            # Get current user
            user = supabase_client.auth.get_user()
            
            if user and user.user:
                return {
                    "id": user.user.id,
                    "email": user.user.email,
                    "user_metadata": user.user.user_metadata,
                    "app_metadata": user.user.app_metadata,
                    "created_at": user.user.created_at,
                    "email_confirmed_at": user.user.email_confirmed_at
                }
            return None
            
        except Exception as e:
            logger.error("Get user by JWT error", error=str(e))
            return None


# Global Supabase Auth manager
supabase_auth = SupabaseAuthManager()


# FastAPI Dependencies
async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    supabase_client: Client = Depends(get_supabase)
) -> str:
    """
    Get current user ID from JWT token
    Supports both Supabase Auth tokens and internal tokens
    """
    token = credentials.credentials
    
    # First try to verify as Supabase JWT
    payload = supabase_auth.verify_supabase_jwt(token)
    
    # If Supabase JWT fails, try internal JWT (for development/testing)
    if payload is None:
        try:
            payload = security_manager.verify_token(token)
        except HTTPException:
            pass
    
    if payload is None:
        logger.warning("Authentication failed - invalid token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    if user_id is None:
        logger.warning("Authentication failed - missing user ID in token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    logger.debug("User authenticated", user_id=user_id)
    return user_id


async def get_current_user_with_role(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    supabase_client: Client = Depends(get_supabase)
) -> Dict[str, Any]:
    """Get current user ID and role from JWT token"""
    token = credentials.credentials
    
    # First try to verify as Supabase JWT
    payload = supabase_auth.verify_supabase_jwt(token)
    
    # If Supabase JWT fails, try internal JWT
    if payload is None:
        try:
            payload = security_manager.verify_token(token)
        except HTTPException:
            pass
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get role from token metadata or default to 'user'
    role = payload.get("user_metadata", {}).get("role", "user")
    if not role:
        role = payload.get("role", "user")
        if not role:
            role = payload.get("app_metadata", {}).get("role", "user")
    
    return {
        "user_id": user_id,
        "role": role,
        "email": payload.get("email"),
        "email_verified": payload.get("email_confirmed_at") is not None
    }


def require_role(allowed_roles: List[str]):
    """Decorator to require specific user roles"""
    async def role_checker(
        credentials: HTTPAuthorizationCredentials = Depends(security),
        supabase_client: Client = Depends(get_supabase)
    ) -> str:
        user_data = await get_current_user_with_role(credentials, supabase_client)
        
        user_role = user_data.get("role", "user")
        if user_role not in allowed_roles:
            logger.warning("Insufficient permissions", 
                         user_id=user_data["user_id"], 
                         user_role=user_role, 
                         required_roles=allowed_roles)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required roles: {allowed_roles}",
            )
        
        return user_data["user_id"]
    
    return role_checker


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    supabase_client: Client = Depends(get_supabase)
) -> Optional[str]:
    """
    Get current user ID optionally (returns None if no token or invalid)
    """
    if not credentials:
        return None
    
    try:
        return await get_current_user_id(credentials, supabase_client)
    except HTTPException:
        return None


async def get_current_user_id_from_token(token: str) -> str:
    """
    Get current user ID from JWT token (for WebSocket authentication)
    """
    try:
        user_id = await verify_websocket_token(token, get_supabase())
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        return user_id
    except Exception as e:
        logger.error("Token verification failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed"
        )

async def verify_websocket_token(
    token: str,
    supabase_client: Client
) -> Optional[str]:
    """
    Verify JWT token for WebSocket connections
    Returns user_id if valid, None otherwise
    """
    try:
        # Try Supabase JWT first
        payload = supabase_auth.verify_supabase_jwt(token)
        
        # Fallback to internal JWT
        if payload is None:
            try:
                payload = security_manager.verify_token(token)
            except:
                return None
        
        user_id = payload.get("sub") if payload else None
        return user_id if user_id else None
    except Exception as e:
        logger.warning("WebSocket token verification failed", error=str(e))
        return None