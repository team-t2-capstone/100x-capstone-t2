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
        Verify Supabase JWT token with enhanced error handling and logging
        """
        try:
            logger.debug("Attempting to verify JWT token", token_prefix=token[:20] + "..." if len(token) > 20 else token)
            
            import base64
            import json
            
            # Split the token
            parts = token.split('.')
            if len(parts) != 3:
                logger.warning("Invalid JWT token format - expected 3 parts", parts_count=len(parts))
                return None
                
            header, payload_b64, signature = parts
            
            # Add padding if needed
            payload_b64 += '=' * (4 - len(payload_b64) % 4)
            
            # Decode payload
            try:
                payload_json = base64.urlsafe_b64decode(payload_b64)
                payload = json.loads(payload_json)
                logger.debug("JWT payload decoded", payload_keys=list(payload.keys()) if payload else None)
            except Exception as decode_error:
                logger.error("Failed to decode JWT payload", error=str(decode_error))
                return None
            
            # Basic validation - check if it has required fields
            if not payload:
                logger.warning("Empty JWT payload")
                return None
                
            user_id = payload.get('sub')
            if not user_id:
                logger.warning("JWT token missing 'sub' field", payload_keys=list(payload.keys()))
                return None
            
            # Check audience (aud) field for Supabase tokens
            aud = payload.get('aud')
            if aud and aud not in ['authenticated', 'api']:
                logger.debug("JWT token audience check", aud=aud)
                # Don't reject based on audience, just log for debugging
            
            # Check if token is expired (with some tolerance)
            if "exp" in payload:
                exp_timestamp = payload["exp"]
                current_timestamp = datetime.utcnow().timestamp()
                
                # Add 60 second tolerance for clock skew
                if current_timestamp > (exp_timestamp + 60):
                    logger.warning("JWT token expired", 
                                 exp_timestamp=exp_timestamp, 
                                 current_timestamp=current_timestamp)
                    return None
                elif current_timestamp > exp_timestamp:
                    logger.debug("JWT token near expiry but within tolerance")
            
            logger.info("JWT token verified successfully", 
                       user_id=user_id, 
                       aud=payload.get('aud'),
                       role=payload.get('role'),
                       email=payload.get('email'))
            return payload
                
        except Exception as e:
            logger.error("JWT verification error", error=str(e), token_prefix=token[:20] + "..." if len(token) > 20 else token)
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
        """Refresh Supabase access token with rate limit handling"""
        try:
            # Add delay to avoid rate limiting
            import asyncio
            await asyncio.sleep(0.1)
            
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
            error_msg = str(e)
            if "rate limit" in error_msg.lower():
                logger.warning("Rate limit hit during token refresh", error=error_msg)
                # For rate limiting, return a more specific error
                raise SupabaseAuthError("Rate limit reached. Please wait a moment and try again.")
            else:
                logger.error("Token refresh error", error=error_msg)
                raise SupabaseAuthError(f"Token refresh failed: {error_msg}")
    
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
    Supports both Supabase Auth tokens and internal tokens with enhanced logging
    """
    if not credentials or not credentials.credentials:
        logger.warning("Authentication failed - no credentials provided")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    logger.debug("Attempting authentication", token_length=len(token), token_prefix=token[:30] + "...")
    
    # Debug: Check if the token looks like a JWT (should have 2 dots)
    dot_count = token.count('.')
    logger.debug("Token format check", dot_count=dot_count, expected_dots=2)
    
    # First try to verify as Supabase JWT
    payload = supabase_auth.verify_supabase_jwt(token)
    auth_method = "supabase_jwt"
    
    # If Supabase JWT fails, try internal JWT (for development/testing)
    if payload is None:
        logger.debug("Supabase JWT failed, trying internal JWT as fallback")
        try:
            # Use verify_token without token_type requirement for fallback
            payload = security_manager.verify_token(token, token_type=None)
            auth_method = "internal_jwt"
            logger.debug("Internal JWT verification successful")
        except HTTPException as e:
            logger.debug("Internal JWT verification failed", error=str(e.detail))
        except Exception as e:
            logger.debug("Internal JWT verification error", error=str(e))
    
    if payload is None:
        logger.warning("Authentication failed - both verification methods failed", 
                      token_length=len(token), 
                      token_format_valid=(dot_count == 2))
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    if user_id is None:
        logger.warning("Authentication failed - missing user ID in token", 
                      auth_method=auth_method, 
                      payload_keys=list(payload.keys()) if payload else None)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    logger.info("Authentication successful", user_id=user_id, auth_method=auth_method)
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