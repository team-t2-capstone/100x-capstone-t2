"""
Supabase Authentication API endpoints for CloneAI
Integrates with Supabase Auth for user management
"""
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from supabase import Client
import structlog

from app.core.security import security_manager, validate_password_strength
from app.core.supabase_auth import (
    supabase_auth, SupabaseAuthError, get_current_user_id, 
    get_current_user_with_role, security
)
from app.database import get_db_session, get_supabase
from app.models.database import UserProfile, RefreshToken
from app.models.schemas import (
    UserSignup, UserLogin, TokenResponse, UserProfile as UserProfileSchema,
    PasswordReset, PasswordResetConfirm, UserUpdate, BaseSchema
)

logger = structlog.get_logger()
router = APIRouter(prefix="/auth", tags=["Authentication"])


# Response schemas
class AuthResponse(BaseSchema):
    """Authentication response with user data"""
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int
    user: Dict[str, Any]


class MessageResponse(BaseSchema):
    """Simple message response"""
    message: str
    success: bool = True


class RefreshTokenRequest(BaseSchema):
    """Refresh token request schema"""
    refresh_token: str


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    user_data: UserSignup,
    background_tasks: BackgroundTasks,
    supabase_client: Client = Depends(get_supabase)
) -> AuthResponse:
    """
    Register a new user with Supabase Auth
    """
    try:
        # Validate password strength
        if not validate_password_strength(user_data.password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 8 characters with uppercase, lowercase, and digit"
            )
        
        # Register with Supabase Auth
        auth_result = await supabase_auth.register_user(
            email=user_data.email,
            password=user_data.password,
            full_name=user_data.full_name,
            role=user_data.role,
            supabase_client=supabase_client
        )
        
        # User profile is managed by Supabase Auth
        # Database profile creation will be handled later via background task
        # or when user first accesses features requiring database storage
        if auth_result["user"]:
            logger.info("User registered with Supabase Auth", 
                       user_id=auth_result["user"].id, 
                       email=user_data.email)
        
        # Prepare response
        response_data = {
            "access_token": auth_result["session"].access_token if auth_result["session"] else "",
            "refresh_token": auth_result["session"].refresh_token if auth_result["session"] else "",
            "token_type": "Bearer",
            "expires_in": auth_result["session"].expires_in if auth_result["session"] else 3600,
            "user": {
                "id": auth_result["user"].id,
                "email": auth_result["user"].email,
                "full_name": user_data.full_name,
                "role": user_data.role,
                "email_confirmed": auth_result["user"].email_confirmed_at is not None,
                "created_at": auth_result["user"].created_at
            }
        }
        
        # Queue background tasks
        # background_tasks.add_task(send_welcome_email, user_data.email, user_data.full_name)
        
        return AuthResponse(**response_data)
        
    except SupabaseAuthError as e:
        logger.warning("Signup failed", error=str(e), email=user_data.email)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error("Signup error", error=str(e), email=user_data.email)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )


@router.post("/login", response_model=AuthResponse)
async def login(
    user_credentials: UserLogin,
    supabase_client: Client = Depends(get_supabase)
) -> AuthResponse:
    """
    Authenticate user with Supabase Auth
    """
    try:
        # Authenticate with Supabase
        auth_result = await supabase_auth.authenticate_user(
            email=user_credentials.email,
            password=user_credentials.password,
            supabase_client=supabase_client
        )
        
        # Prepare response using Supabase user data
        user_data = auth_result["user"]
        response_data = {
            "access_token": auth_result["access_token"],
            "refresh_token": auth_result["refresh_token"],
            "token_type": "Bearer",
            "expires_in": auth_result["expires_in"],
            "user": {
                "id": user_data.id,
                "email": user_data.email,
                "full_name": user_data.user_metadata.get("full_name", ""),
                "role": user_data.user_metadata.get("role", "user"),
                "email_confirmed": user_data.email_confirmed_at is not None,
                "subscription_tier": "free",  # Default value
                "credits_remaining": 100,     # Default value
                "last_login": datetime.utcnow().isoformat()
            }
        }
        
        logger.info("User logged in successfully", user_id=user_data.id, email=user_data.email)
        return AuthResponse(**response_data)
        
    except SupabaseAuthError as e:
        logger.warning("Login failed", error=str(e), email=user_credentials.email)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error("Login error", error=str(e), email=user_credentials.email)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed"
        )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: RefreshTokenRequest,
    supabase_client: Client = Depends(get_supabase)
) -> TokenResponse:
    """
    Refresh access token using refresh token
    """
    try:
        token_result = await supabase_auth.refresh_token(
            refresh_token=request.refresh_token,
            supabase_client=supabase_client
        )
        
        logger.info("Token refreshed successfully")
        return TokenResponse(
            access_token=token_result["access_token"],
            refresh_token=token_result["refresh_token"],
            token_type=token_result["token_type"],
            expires_in=token_result["expires_in"]
        )
        
    except SupabaseAuthError as e:
        logger.warning("Token refresh failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except Exception as e:
        logger.error("Token refresh error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token refresh failed"
        )


@router.post("/logout", response_model=MessageResponse)
async def logout(
    current_user_id: str = Depends(get_current_user_id),
    supabase_client: Client = Depends(get_supabase)
) -> MessageResponse:
    """
    Sign out user from Supabase Auth
    """
    try:
        success = await supabase_auth.signout_user(supabase_client)
        
        if success:
            logger.info("User logged out successfully", user_id=current_user_id)
            return MessageResponse(message="Logged out successfully")
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Logout failed"
            )
        
    except Exception as e:
        logger.error("Logout error", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Logout failed"
        )


@router.get("/me", response_model=UserProfileSchema)
async def get_current_user(
    current_user_id: str = Depends(get_current_user_id),
    supabase_client: Client = Depends(get_supabase)
) -> UserProfileSchema:
    """
    Get current user profile information from Supabase
    """
    try:
        # Get user from Supabase Auth
        response = supabase_client.auth.get_user()
        
        if not response.user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user = response.user
        user_metadata = user.user_metadata or {}
        
        return UserProfileSchema(
            id=str(user.id),
            email=user.email,
            full_name=user_metadata.get("full_name", ""),
            avatar_url=user_metadata.get("avatar_url"),
            role=user_metadata.get("role", "user"),
            created_at=user.created_at,
            updated_at=user.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Get current user error", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user profile"
        )


@router.post("/password-reset", response_model=MessageResponse)
async def request_password_reset(
    password_reset: PasswordReset,
    supabase_client: Client = Depends(get_supabase)
) -> MessageResponse:
    """
    Send password reset email via Supabase
    """
    try:
        success = await supabase_auth.reset_password(
            email=password_reset.email,
            supabase_client=supabase_client
        )
        
        if success:
            logger.info("Password reset email sent", email=password_reset.email)
            return MessageResponse(
                message="Password reset email sent. Please check your inbox."
            )
        else:
            # Don't reveal if email exists or not for security
            return MessageResponse(
                message="If the email exists, a password reset link has been sent."
            )
        
    except Exception as e:
        logger.error("Password reset error", error=str(e), email=password_reset.email)
        # Don't reveal internal error details
        return MessageResponse(
            message="If the email exists, a password reset link has been sent."
        )


@router.post("/verify-email", response_model=MessageResponse)
async def verify_email(
    token: str,
    email: str,
    supabase_client: Client = Depends(get_supabase)
) -> MessageResponse:
    """
    Verify email address with Supabase token
    """
    try:
        success = await supabase_auth.verify_email(
            token=token,
            email=email,
            supabase_client=supabase_client
        )
        
        if success:
            # Email verification is handled entirely by Supabase
            logger.info("Email verified successfully", email=email)
            return MessageResponse(message="Email verified successfully")
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification token"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Email verification error", error=str(e), email=email)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Email verification failed"
        )


@router.get("/user-info", response_model=Dict[str, Any])
async def get_user_info(
    user_data: Dict[str, Any] = Depends(get_current_user_with_role)
) -> Dict[str, Any]:
    """
    Get current user information including role and permissions
    """
    try:
        return {
            "user_id": user_data["user_id"],
            "email": user_data["email"],
            "role": user_data["role"],
            "email_verified": user_data["email_verified"],
            "permissions": get_role_permissions(user_data["role"])
        }
        
    except Exception as e:
        logger.error("Get user info error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user information"
        )


def get_role_permissions(role: str) -> Dict[str, bool]:
    """Get permissions based on user role"""
    permissions = {
        "can_create_clones": False,
        "can_access_analytics": False,
        "can_manage_users": False,
        "can_view_all_sessions": False,
        "can_export_data": False
    }
    
    if role == "creator":
        permissions.update({
            "can_create_clones": True,
            "can_access_analytics": True,
            "can_export_data": True
        })
    elif role == "admin":
        permissions.update({
            "can_create_clones": True,
            "can_access_analytics": True,
            "can_manage_users": True,
            "can_view_all_sessions": True,
            "can_export_data": True
        })
    
    return permissions


# Health check for auth service
@router.get("/health")
async def auth_health_check(
    supabase_client: Client = Depends(get_supabase)
) -> Dict[str, Any]:
    """
    Health check for authentication services
    """
    try:
        # Test Supabase connection
        supabase_healthy = True
        try:
            # Simple test - this will work if Supabase client is properly configured
            supabase_client.table("user_profiles").select("count").limit(1).execute()
        except:
            supabase_healthy = False
        
        return {
            "status": "healthy" if supabase_healthy else "degraded",
            "supabase_auth": "healthy" if supabase_healthy else "unhealthy",
            "jwt_secret_configured": bool(supabase_auth.jwt_secret),
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error("Auth health check error", error=str(e))
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }