"""
Authentication API endpoints for CloneAI
"""
from datetime import datetime, timedelta
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import structlog

from app.core.security import (
    security_manager, get_current_user_id, security,
    validate_password_strength
)
from app.database import get_db_session
from app.models.database import UserProfile, RefreshToken
from app.models.schemas import (
    UserSignup, UserLogin, TokenResponse, UserProfile as UserProfileSchema,
    PasswordReset, PasswordResetConfirm, UserUpdate
)

logger = structlog.get_logger()
router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    user_data: UserSignup,
    db: AsyncSession = Depends(get_db_session)
) -> TokenResponse:
    """
    Create a new user account and return access tokens
    """
    try:
        # Check if user already exists
        existing_user = await db.execute(
            select(UserProfile).where(UserProfile.email == user_data.email)
        )
        if existing_user.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email already exists"
            )
        
        # Validate password strength
        if not validate_password_strength(user_data.password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 8 characters with uppercase, lowercase, and digit"
            )
        
        # Create new user
        hashed_password = security_manager.get_password_hash(user_data.password)
        
        new_user = UserProfile(
            email=user_data.email,
            full_name=user_data.full_name,
            hashed_password=hashed_password,
            role=user_data.role,
            is_active=True,
            is_verified=False  # Will be verified via email later
        )
        
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        
        # Generate tokens
        access_token = security_manager.create_access_token(str(new_user.id))
        refresh_token = security_manager.create_refresh_token(str(new_user.id))
        
        # Store refresh token
        refresh_token_record = RefreshToken(
            user_id=new_user.id,
            token_hash=security_manager.get_password_hash(refresh_token),
            expires_at=datetime.utcnow() + timedelta(days=30)
        )
        db.add(refresh_token_record)
        await db.commit()
        
        logger.info("User signup successful", user_id=str(new_user.id), email=user_data.email)
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=30 * 60  # 30 minutes
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Signup failed", error=str(e))
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user account"
        )


@router.post("/login", response_model=TokenResponse)
async def login(
    credentials: UserLogin,
    db: AsyncSession = Depends(get_db_session)
) -> TokenResponse:
    """
    Authenticate user and return access tokens
    """
    try:
        # Find user by email
        result = await db.execute(
            select(UserProfile).where(UserProfile.email == credentials.email)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        # Check if user is active
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account is deactivated"
            )
        
        # Verify password
        if not security_manager.verify_password(credentials.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        # Update last login
        user.last_login = datetime.utcnow()
        await db.commit()
        
        # Generate tokens
        access_token = security_manager.create_access_token(str(user.id))
        refresh_token = security_manager.create_refresh_token(str(user.id))
        
        # Store refresh token (revoke old ones)
        await db.execute(
            RefreshToken.__table__.update()
            .where(RefreshToken.user_id == user.id)
            .values(is_revoked=True)
        )
        
        refresh_token_record = RefreshToken(
            user_id=user.id,
            token_hash=security_manager.get_password_hash(refresh_token),
            expires_at=datetime.utcnow() + timedelta(days=30)
        )
        db.add(refresh_token_record)
        await db.commit()
        
        logger.info("User login successful", user_id=str(user.id), email=credentials.email)
        
        return TokenResponse(
            access_token=access_token,  
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=30 * 60  # 30 minutes
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Login failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed"
        )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db_session)
) -> TokenResponse:
    """
    Refresh access token using refresh token
    """
    try:
        refresh_token = credentials.credentials
        
        # Verify refresh token
        payload = security_manager.verify_token(refresh_token, "refresh")
        user_id = payload.get("sub")
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        # Check if refresh token exists and is not revoked
        token_hash = security_manager.get_password_hash(refresh_token)
        result = await db.execute(
            select(RefreshToken).where(
                RefreshToken.user_id == user_id,
                RefreshToken.token_hash == token_hash,
                RefreshToken.is_revoked == False,
                RefreshToken.expires_at > datetime.utcnow()
            )
        )
        token_record = result.scalar_one_or_none()
        
        if not token_record:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token"
            )
        
        # Check if user still exists and is active
        result = await db.execute(
            select(UserProfile).where(UserProfile.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account not found or deactivated"
            )
        
        # Generate new access token
        access_token = security_manager.create_access_token(user_id)
        
        logger.info("Token refresh successful", user_id=user_id)
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,  # Return same refresh token
            token_type="bearer",
            expires_in=30 * 60  # 30 minutes
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Token refresh failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token refresh failed"
        )


@router.post("/logout")
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, str]:
    """
    Logout user by revoking refresh tokens
    """
    try:
        # Extract user ID from token
        token = credentials.credentials
        payload = security_manager.verify_token(token, "access")
        user_id = payload.get("sub")
        
        if user_id:
            # Revoke all refresh tokens for this user
            await db.execute(
                RefreshToken.__table__.update()
                .where(RefreshToken.user_id == user_id)
                .values(is_revoked=True)
            )
            await db.commit()
            
            logger.info("User logout successful", user_id=user_id)
        
        return {"message": "Successfully logged out"}
        
    except Exception as e:
        logger.error("Logout failed", error=str(e))
        return {"message": "Logged out"}  # Don't expose errors


@router.get("/me", response_model=UserProfileSchema)
async def get_current_user(
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> UserProfileSchema:
    """
    Get current user's profile information
    """
    try:
        result = await db.execute(
            select(UserProfile).where(UserProfile.id == current_user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        return UserProfileSchema.from_orm(user)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get current user", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user information"
        )


@router.put("/me", response_model=UserProfileSchema)
async def update_current_user(
    update_data: UserUpdate,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> UserProfileSchema:
    """
    Update current user's profile information
    """
    try:
        result = await db.execute(
            select(UserProfile).where(UserProfile.id == current_user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Update fields if provided
        update_dict = update_data.dict(exclude_unset=True)
        for field, value in update_dict.items():
            if hasattr(user, field):
                setattr(user, field, value)
        
        user.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(user)
        
        logger.info("User profile updated", user_id=current_user_id)
        
        return UserProfileSchema.from_orm(user)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to update user profile", error=str(e), user_id=current_user_id)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user profile"
        )


@router.post("/request-password-reset")
async def request_password_reset(
    request_data: PasswordReset,
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, str]:
    """
    Request password reset (send email with reset token)
    """
    try:
        # Check if user exists
        result = await db.execute(
            select(UserProfile).where(UserProfile.email == request_data.email)
        )
        user = result.scalar_one_or_none()
        
        if user and user.is_active:
            # Generate password reset token
            reset_token = security_manager.create_password_reset_token(user.email)
            
            # TODO: Send email with reset token
            # For now, we'll log it (in production, use proper email service)
            logger.info(
                "Password reset requested", 
                user_id=str(user.id), 
                email=user.email,
                reset_token=reset_token
            )
        
        # Always return success to prevent email enumeration
        return {"message": "If the email exists, a password reset link has been sent"}
        
    except Exception as e:
        logger.error("Password reset request failed", error=str(e))
        return {"message": "If the email exists, a password reset link has been sent"}


@router.post("/reset-password")
async def reset_password(
    reset_data: PasswordResetConfirm,
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, str]:
    """
    Reset password using reset token
    """
    try:
        # Verify reset token
        email = security_manager.verify_password_reset_token(reset_data.token)
        
        # Find user by email
        result = await db.execute(
            select(UserProfile).where(UserProfile.email == email)
        )
        user = result.scalar_one_or_none()
        
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid reset token"
            )
        
        # Validate new password
        if not validate_password_strength(reset_data.new_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 8 characters with uppercase, lowercase, and digit"
            )
        
        # Update password
        user.hashed_password = security_manager.get_password_hash(reset_data.new_password)
        user.updated_at = datetime.utcnow()
        
        # Revoke all refresh tokens
        await db.execute(
            RefreshToken.__table__.update()
            .where(RefreshToken.user_id == user.id)
            .values(is_revoked=True)
        )
        
        await db.commit()
        
        logger.info("Password reset successful", user_id=str(user.id), email=email)
        
        return {"message": "Password reset successful"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Password reset failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password reset failed"
        )


@router.delete("/me")
async def delete_account(
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, str]:
    """
    Delete current user's account (soft delete by deactivating)
    """
    try:
        result = await db.execute(
            select(UserProfile).where(UserProfile.id == current_user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Soft delete by deactivating account
        user.is_active = False
        user.updated_at = datetime.utcnow()
        
        # Revoke all refresh tokens
        await db.execute(
            RefreshToken.__table__.update()
            .where(RefreshToken.user_id == user.id)
            .values(is_revoked=True)
        )
        
        await db.commit()
        
        logger.info("Account deletion successful", user_id=current_user_id)
        
        return {"message": "Account deactivated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Account deletion failed", error=str(e), user_id=current_user_id)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete account"
        )