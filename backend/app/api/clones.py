"""
Clone Management API endpoints for CloneAI - Supabase Integration
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.security import HTTPAuthorizationCredentials
import structlog
import tempfile
import os

from app.database import get_supabase, get_service_supabase
from app.core.supabase_auth import get_current_user_id, security
from app.models.schemas import (
    CloneCreate, CloneUpdate, CloneResponse, CloneListResponse,
    PaginationInfo, DocumentProcessingRequest, KnowledgeProcessingStatus
)

logger = structlog.get_logger()
router = APIRouter(prefix="/clones", tags=["Clone Management"])


@router.get("/test-no-auth")
async def test_no_auth():
    """
    Simple endpoint without authentication to test basic connectivity
    """
    return {"message": "No auth test successful", "timestamp": datetime.utcnow().isoformat()}


@router.get("/test-auth")
async def test_auth(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Simple endpoint to test authentication - returns user ID and token info if auth succeeds
    """
    token = credentials.credentials
    return {
        "user_id": current_user_id, 
        "message": "Authentication successful",
        "token_length": len(token),
        "token_prefix": token[:50] + "..." if len(token) > 50 else token
    }


@router.get("/", response_model=CloneListResponse)
async def list_clones(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    category: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    price_min: Optional[float] = Query(default=None, ge=0),
    price_max: Optional[float] = Query(default=None, ge=0),
    creator_id: Optional[str] = Query(default=None),
    current_user_id: str = Depends(get_current_user_id),
    supabase_client = Depends(get_supabase)
) -> CloneListResponse:
    """
    Get paginated list of published clones
    """
    try:
        # Build query for published clones only
        query = supabase_client.table("clones").select("*").eq("is_published", True).eq("is_active", True)
        
        # Apply filters
        if category:
            query = query.eq("category", category)
        
        if creator_id:
            query = query.eq("creator_id", creator_id)
            
        if price_min is not None:
            query = query.gte("base_price", price_min)
            
        if price_max is not None:
            query = query.lte("base_price", price_max)
        
        if search:
            # Search in name, description, and bio
            query = query.or_(f"name.ilike.%{search}%,description.ilike.%{search}%,bio.ilike.%{search}%")
        
        # Get total count for pagination
        count_response = query.execute()
        total_count = len(count_response.data) if count_response.data else 0
        
        # Apply pagination
        offset = (page - 1) * limit
        paginated_query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
        
        response = paginated_query.execute()
        
        if not response.data:
            response.data = []
        
        # Convert to CloneResponse objects
        clones = []
        for clone_data in response.data:
            clones.append(CloneResponse(
                id=clone_data["id"],
                creator_id=clone_data["creator_id"],
                name=clone_data["name"],
                description=clone_data.get("bio", ""),  # Use bio column instead of description
                category=clone_data["category"],
                expertise_areas=clone_data.get("expertise_areas", []),
                avatar_url=clone_data.get("avatar_url"),
                base_price=float(clone_data["base_price"]),
                bio=clone_data.get("bio"),
                personality_traits=clone_data.get("personality_traits", {}),
                communication_style=clone_data.get("communication_style", {}),
                languages=clone_data.get("languages", ["English"]),
                average_rating=float(clone_data.get("average_rating", 0.0)),
                total_sessions=int(clone_data.get("total_sessions", 0)),
                total_earnings=float(clone_data.get("total_earnings", 0.0)),
                is_published=clone_data["is_published"],
                is_active=clone_data["is_active"],
                voice_id=clone_data.get("voice_id"),
                created_at=datetime.fromisoformat(clone_data["created_at"].replace('Z', '+00:00')),
                updated_at=datetime.fromisoformat(clone_data["updated_at"].replace('Z', '+00:00')),
                published_at=datetime.fromisoformat(clone_data["published_at"].replace('Z', '+00:00')) if clone_data.get("published_at") else None
            ))
        
        # Calculate pagination info
        total_pages = (total_count + limit - 1) // limit
        has_next = page < total_pages
        has_prev = page > 1
        
        pagination = PaginationInfo(
            page=page,
            limit=limit,
            total=total_count,
            pages=total_pages,
            has_next=has_next,
            has_prev=has_prev
        )
        
        return CloneListResponse(
            clones=clones,
            pagination=pagination
        )
        
    except Exception as e:
        logger.error("Failed to list clones", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve clones"
        )


@router.get("/{clone_id}", response_model=CloneResponse)
async def get_clone(
    clone_id: str,
    current_user_id: str = Depends(get_current_user_id)
) -> CloneResponse:
    """
    Get a specific clone by ID
    """
    try:
        # Use service role client to ensure clone access
        service_supabase = get_service_supabase()
        if not service_supabase:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Service role client not available"
            )
        
        # Fetch clone from Supabase
        response = service_supabase.table("clones").select("*").eq("id", clone_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        clone_data = response.data[0]
        
        # Check if clone is published or if user is the creator
        if not clone_data["is_published"] and clone_data["creator_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        return CloneResponse(
            id=clone_data["id"],
            creator_id=clone_data["creator_id"],
            name=clone_data["name"],
            description=clone_data.get("bio", ""),  # Use bio column instead of description
            category=clone_data["category"],
            expertise_areas=clone_data.get("expertise_areas", []),
            avatar_url=clone_data.get("avatar_url"),
            base_price=float(clone_data["base_price"]),
            bio=clone_data.get("bio"),
            personality_traits=clone_data.get("personality_traits", {}),
            communication_style=clone_data.get("communication_style", {}),
            languages=clone_data.get("languages", ["English"]),
            average_rating=float(clone_data.get("average_rating", 0.0)),
            total_sessions=int(clone_data.get("total_sessions", 0)),
            total_earnings=float(clone_data.get("total_earnings", 0.0)),
            is_published=clone_data["is_published"],
            is_active=clone_data["is_active"],
            voice_id=clone_data.get("voice_id"),
            created_at=datetime.fromisoformat(clone_data["created_at"].replace('Z', '+00:00')),
            updated_at=datetime.fromisoformat(clone_data["updated_at"].replace('Z', '+00:00')),
            published_at=datetime.fromisoformat(clone_data["published_at"].replace('Z', '+00:00')) if clone_data.get("published_at") and clone_data["published_at"] is not None else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get clone", error=str(e), clone_id=clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve clone"
        )


@router.get("/my-clones", response_model=CloneListResponse)
async def get_my_clones(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    published_only: Optional[bool] = Query(default=None),
    current_user_id: str = Depends(get_current_user_id),
    supabase_client = Depends(get_supabase)
) -> CloneListResponse:
    """
    Get current user's clones
    """
    try:
        # Build query for user's clones
        query = supabase_client.table("clones").select("*").eq("creator_id", current_user_id)
        
        # Filter by published status if specified
        if published_only is not None:
            query = query.eq("is_published", published_only)
        
        # Get total count for pagination
        count_response = query.execute()
        total_count = len(count_response.data) if count_response.data else 0
        
        # Apply pagination
        offset = (page - 1) * limit
        paginated_query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
        
        response = paginated_query.execute()
        
        if not response.data:
            response.data = []
        
        # Convert to CloneResponse objects
        clones = []
        for clone_data in response.data:
            clones.append(CloneResponse(
                id=clone_data["id"],
                creator_id=clone_data["creator_id"],
                name=clone_data["name"],
                description=clone_data.get("bio", ""),  # Use bio column instead of description
                category=clone_data["category"],
                expertise_areas=clone_data.get("expertise_areas", []),
                avatar_url=clone_data.get("avatar_url"),
                base_price=float(clone_data["base_price"]),
                bio=clone_data.get("bio"),
                personality_traits=clone_data.get("personality_traits", {}),
                communication_style=clone_data.get("communication_style", {}),
                languages=clone_data.get("languages", ["English"]),
                average_rating=float(clone_data.get("average_rating", 0.0)),
                total_sessions=int(clone_data.get("total_sessions", 0)),
                total_earnings=float(clone_data.get("total_earnings", 0.0)),
                is_published=clone_data["is_published"],
                is_active=clone_data["is_active"],
                voice_id=clone_data.get("voice_id"),
                created_at=datetime.fromisoformat(clone_data["created_at"].replace('Z', '+00:00')),
                updated_at=datetime.fromisoformat(clone_data["updated_at"].replace('Z', '+00:00')),
                published_at=datetime.fromisoformat(clone_data["published_at"].replace('Z', '+00:00')) if clone_data.get("published_at") else None
            ))
        
        # Calculate pagination info
        total_pages = (total_count + limit - 1) // limit
        has_next = page < total_pages
        has_prev = page > 1
        
        pagination = PaginationInfo(
            page=page,
            limit=limit,
            total=total_count,
            pages=total_pages,
            has_next=has_next,
            has_prev=has_prev
        )
        
        return CloneListResponse(
            clones=clones,
            pagination=pagination
        )
        
    except Exception as e:
        logger.error("Failed to get user clones", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user clones"
        )


@router.post("/", response_model=CloneResponse, status_code=status.HTTP_201_CREATED)
async def create_clone(
    clone_data: CloneCreate,
    current_user_id: str = Depends(get_current_user_id),
    supabase_client = Depends(get_supabase)
) -> CloneResponse:
    """
    Create a new AI expert clone using Supabase
    """
    try:
        # Create clone data for Supabase
        clone_id = str(uuid4())
        clone_data_dict = {
            "id": clone_id,
            "creator_id": current_user_id,
            "name": clone_data.name,
            "description": clone_data.description,
            "category": clone_data.category,
            "expertise_areas": clone_data.expertise_areas,
            "base_price": float(clone_data.base_price),
            "bio": clone_data.bio,
            "personality_traits": clone_data.personality_traits,
            "communication_style": clone_data.communication_style,
            "languages": clone_data.languages,
            "is_published": False,
            "is_active": True,
            "average_rating": 0.0,
            "total_sessions": 0,
            "total_earnings": 0.0,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Insert into Supabase clones table
        response = supabase_client.table("clones").insert(clone_data_dict).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create clone in database"
            )
        
        created_clone = response.data[0]
        
        logger.info("Clone created successfully in Supabase", 
                   clone_id=clone_id, 
                   creator_id=current_user_id)
        
        # Return response using created data
        return CloneResponse(
            id=created_clone["id"],
            creator_id=created_clone["creator_id"],
            name=created_clone["name"],
            description=created_clone["description"],
            category=created_clone["category"],
            expertise_areas=created_clone["expertise_areas"],
            avatar_url=created_clone.get("avatar_url"),
            base_price=created_clone["base_price"],
            bio=created_clone["bio"],
            personality_traits=created_clone["personality_traits"],
            communication_style=created_clone["communication_style"],
            languages=created_clone["languages"],
            average_rating=created_clone["average_rating"],
            total_sessions=created_clone["total_sessions"],
            total_earnings=created_clone["total_earnings"],
            is_published=created_clone["is_published"],
            is_active=created_clone["is_active"],
            created_at=datetime.fromisoformat(created_clone["created_at"].replace('Z', '+00:00')),
            updated_at=datetime.fromisoformat(created_clone["updated_at"].replace('Z', '+00:00')),
            published_at=datetime.fromisoformat(created_clone["published_at"].replace('Z', '+00:00')) if created_clone.get("published_at") else None
        )
        
    except Exception as e:
        logger.error("Clone creation failed", error=str(e), creator_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create clone"
        )


@router.put("/{clone_id}", response_model=CloneResponse)
async def update_clone(
    clone_id: str,
    clone_data: CloneUpdate,
    current_user_id: str = Depends(get_current_user_id),
    supabase_client = Depends(get_supabase)
) -> CloneResponse:
    """
    Update an existing clone (only by creator)
    """
    try:
        # First check if clone exists and user owns it
        response = supabase_client.table("clones").select("*").eq("id", clone_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        existing_clone = response.data[0]
        
        # Check if user is the creator
        if existing_clone["creator_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the creator can update this clone"
            )
        
        # Build update data
        update_dict = clone_data.dict(exclude_unset=True)
        update_dict["updated_at"] = datetime.utcnow().isoformat()
        
        # If publishing for the first time, set published_at
        if clone_data.is_published and not existing_clone.get("published_at"):
            update_dict["published_at"] = datetime.utcnow().isoformat()
        
        # Update in Supabase
        update_response = supabase_client.table("clones").update(update_dict).eq("id", clone_id).execute()
        
        if not update_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update clone"
            )
        
        updated_clone = update_response.data[0]
        
        logger.info("Clone updated successfully", 
                   clone_id=clone_id, 
                   creator_id=current_user_id)
        
        return CloneResponse(
            id=updated_clone["id"],
            creator_id=updated_clone["creator_id"],
            name=updated_clone["name"],
            description=updated_clone["description"],
            category=updated_clone["category"],
            expertise_areas=updated_clone.get("expertise_areas", []),
            avatar_url=updated_clone.get("avatar_url"),
            base_price=float(updated_clone["base_price"]),
            bio=updated_clone.get("bio"),
            personality_traits=updated_clone.get("personality_traits", {}),
            communication_style=updated_clone.get("communication_style", {}),
            languages=updated_clone.get("languages", ["English"]),
            average_rating=float(updated_clone.get("average_rating", 0.0)),
            total_sessions=int(updated_clone.get("total_sessions", 0)),
            total_earnings=float(updated_clone.get("total_earnings", 0.0)),
            is_published=updated_clone["is_published"],
            is_active=updated_clone["is_active"],
            created_at=datetime.fromisoformat(updated_clone["created_at"].replace('Z', '+00:00')),
            updated_at=datetime.fromisoformat(updated_clone["updated_at"].replace('Z', '+00:00')),
            published_at=datetime.fromisoformat(updated_clone["published_at"].replace('Z', '+00:00')) if updated_clone.get("published_at") else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Clone update failed", error=str(e), clone_id=clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update clone"
        )


@router.delete("/{clone_id}")
async def delete_clone(
    clone_id: str,
    current_user_id: str = Depends(get_current_user_id),
    supabase_client = Depends(get_supabase)
) -> dict:
    """
    Delete a clone with comprehensive cleanup across all systems
    Handles OpenAI resources, storage files, and database records
    """
    try:
        # Import the comprehensive cleanup service
        from app.services.clone_cleanup_service import cleanup_clone_comprehensive
        
        logger.info("Starting comprehensive clone deletion", 
                   clone_id=clone_id, 
                   user_id=current_user_id)
        
        # Use the comprehensive cleanup service
        cleanup_result = await cleanup_clone_comprehensive(clone_id, current_user_id)
        
        if cleanup_result["success"]:
            logger.info("Clone deletion completed successfully", 
                       clone_id=clone_id,
                       cleanup_details=cleanup_result["cleanup_details"])
            
            # Return success response with detailed cleanup info
            response = {
                "message": cleanup_result["message"],
                "clone_id": clone_id,
                "success": True,
                "timestamp": cleanup_result["timestamp"],
                "cleanup_details": {
                    "database_records_deleted": cleanup_result["cleanup_details"].get("database", {}).get("tables_cleaned", {}),
                    "openai_resources_deleted": {
                        "vector_stores": len(cleanup_result["cleanup_details"].get("openai", {}).get("vector_stores_deleted", [])),
                        "assistants": len(cleanup_result["cleanup_details"].get("openai", {}).get("assistants_deleted", [])),
                        "files": len(cleanup_result["cleanup_details"].get("openai", {}).get("files_deleted", []))
                    },
                    "storage_files_deleted": len(cleanup_result["cleanup_details"].get("storage", {}).get("files_deleted", [])),
                    "verification_results": cleanup_result["cleanup_details"].get("verification", {})
                }
            }
            
            # Include warnings if any
            warnings = cleanup_result["cleanup_details"].get("warnings", [])
            if warnings:
                response["warnings"] = warnings
                response["message"] += f" (with {len(warnings)} non-critical warnings)"
            
            return response
        else:
            # Cleanup failed
            logger.error("Clone deletion failed during cleanup", 
                        clone_id=clone_id,
                        error=cleanup_result["error"],
                        recoverable=cleanup_result.get("recoverable", False))
            
            # Determine appropriate HTTP status code
            if "not found" in cleanup_result["error"].lower():
                status_code = status.HTTP_404_NOT_FOUND
            elif "not authorized" in cleanup_result["error"].lower():
                status_code = status.HTTP_403_FORBIDDEN
            elif "active sessions" in cleanup_result["error"].lower():
                status_code = status.HTTP_400_BAD_REQUEST
            else:
                status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
            
            raise HTTPException(
                status_code=status_code,
                detail=cleanup_result["error"]
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Unexpected error during clone deletion", 
                    error=str(e), 
                    clone_id=clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error during clone deletion: {str(e)}"
        )


@router.get("/cleanup/health")
async def check_cleanup_health(
    current_user_id: str = Depends(get_current_user_id)
) -> dict:
    """
    Check the health and capabilities of the comprehensive cleanup system
    Returns status of all required services (OpenAI, Supabase, Storage)
    """
    try:
        from app.services.clone_cleanup_service import verify_cleanup_capability
        
        logger.info("Checking cleanup system health", user_id=current_user_id)
        
        capabilities = await verify_cleanup_capability()
        
        return {
            "cleanup_ready": capabilities["ready"],
            "services": {
                "supabase": {
                    "status": "healthy" if capabilities["supabase"] else "unhealthy",
                    "capabilities": ["database_operations", "storage_operations"] if capabilities["supabase"] else []
                },
                "openai": {
                    "status": "healthy" if capabilities["openai"] else "unhealthy",
                    "capabilities": ["vector_store_cleanup", "assistant_cleanup", "file_cleanup"] if capabilities["openai"] else []
                },
                "storage": {
                    "status": "healthy" if capabilities["storage"] else "unhealthy",
                    "capabilities": ["file_deletion"] if capabilities["storage"] else []
                }
            },
            "errors": capabilities["errors"],
            "message": "All cleanup services operational" if capabilities["ready"] else "Some cleanup services unavailable",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error("Failed to check cleanup health", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check cleanup system health: {str(e)}"
        )


@router.delete("/{clone_id}/force")
async def force_delete_clone(
    clone_id: str,
    current_user_id: str = Depends(get_current_user_id),
    supabase_client = Depends(get_supabase)
) -> dict:
    """
    Force delete a clone even if there are active sessions
    Use with caution - this will terminate active sessions
    """
    try:
        from app.services.clone_cleanup_service import CloneCleanupService
        
        logger.warning("Force delete initiated", 
                      clone_id=clone_id, 
                      user_id=current_user_id)
        
        async with CloneCleanupService() as cleanup_service:
            # First validate ownership (skip active session check for force delete)
            try:
                response = supabase_client.table("clones").select("*").eq("id", clone_id).execute()
                
                if not response.data:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Clone {clone_id} not found"
                    )
                
                clone_data = response.data[0]
                
                # Check user permission
                if clone_data["creator_id"] != current_user_id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"User {current_user_id} not authorized to delete clone {clone_id}"
                    )
                
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to validate clone access: {str(e)}"
                )
            
            # Force terminate any active sessions
            terminated_sessions = 0
            try:
                # First get count of active sessions
                active_sessions_response = supabase_client.table("sessions").select("id").eq("clone_id", clone_id).eq("status", "active").execute()
                active_sessions_count = len(active_sessions_response.data) if active_sessions_response.data else 0
                
                if active_sessions_count > 0:
                    # Terminate active sessions
                    sessions_response = supabase_client.table("sessions").update({
                        "status": "force_terminated",
                        "end_time": datetime.utcnow().isoformat(),
                        "updated_at": datetime.utcnow().isoformat()
                    }).eq("clone_id", clone_id).eq("status", "active").execute()
                    
                    terminated_sessions = len(sessions_response.data) if sessions_response.data else 0
                    logger.warning(f"Force terminated {terminated_sessions} active sessions", 
                                  clone_id=clone_id)
                
            except Exception as e:
                logger.error("Failed to terminate active sessions", error=str(e))
                # Continue with deletion anyway - this shouldn't block cleanup
            
            # Now proceed with comprehensive cleanup
            cleanup_result = await cleanup_service.cleanup_clone(clone_id, current_user_id)
            
            if cleanup_result["success"]:
                response = {
                    "message": "Clone force deleted successfully",
                    "clone_id": clone_id,
                    "terminated_sessions": terminated_sessions,
                    "success": True,
                    "timestamp": cleanup_result["timestamp"],
                    "cleanup_details": {
                        "database_records_deleted": cleanup_result["cleanup_details"].get("database", {}).get("tables_cleaned", {}),
                        "openai_resources_deleted": {
                            "vector_stores": len(cleanup_result["cleanup_details"].get("openai", {}).get("vector_stores_deleted", [])),
                            "assistants": len(cleanup_result["cleanup_details"].get("openai", {}).get("assistants_deleted", [])),
                            "files": len(cleanup_result["cleanup_details"].get("openai", {}).get("files_deleted", []))
                        },
                        "storage_files_deleted": len(cleanup_result["cleanup_details"].get("storage", {}).get("files_deleted", [])),
                        "verification_results": cleanup_result["cleanup_details"].get("verification", {})
                    }
                }
                
                warnings = cleanup_result["cleanup_details"].get("warnings", [])
                if warnings:
                    response["warnings"] = warnings
                
                return response
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=cleanup_result["error"]
                )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Force delete failed", error=str(e), clone_id=clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Force delete failed: {str(e)}"
        )


@router.get("/{clone_id}/deletion-preview")
async def get_clone_deletion_preview(
    clone_id: str,
    current_user_id: str = Depends(get_current_user_id),
    supabase_client = Depends(get_supabase)
) -> dict:
    """
    Get a preview of what will be deleted when a clone is removed
    Shows database records, storage files, and OpenAI resources
    """
    try:
        from app.services.clone_cleanup_service import CloneCleanupService
        
        logger.info("Generating clone deletion preview", 
                   clone_id=clone_id, 
                   user_id=current_user_id)
        
        async with CloneCleanupService() as cleanup_service:
            # Validate clone access first
            clone_data = await cleanup_service._validate_clone_access(clone_id, current_user_id)
            
            # Gather resources that would be deleted
            resources = await cleanup_service._gather_clone_resources(clone_id, clone_data)
            
            # Format preview data
            preview = {
                "clone": {
                    "id": clone_id,
                    "name": clone_data.get("name", ""),
                    "created_at": clone_data.get("created_at", ""),
                    "category": clone_data.get("category", ""),
                    "is_published": clone_data.get("is_published", False)
                },
                "database_records": {
                    "sessions": len(resources["database_tables"].get("sessions", [])),
                    "knowledge": len(resources["database_tables"].get("knowledge", [])),
                    "clone_qa_training": len(resources["database_tables"].get("clone_qa_training", [])),
                    "documents": len(resources["database_tables"].get("documents", [])),
                    "experts": len(resources["database_tables"].get("experts", [])),
                    "assistants": len(resources["database_tables"].get("assistants", [])),
                    "vector_stores": len(resources["database_tables"].get("vector_stores", []))
                },
                "storage_files": {
                    "total_count": len(resources.get("storage_files", [])),
                    "knowledge_documents": len([f for f in resources.get("storage_files", []) if f.get("type") == "knowledge_document"]),
                    "avatar": 1 if clone_data.get("avatar_url") else 0,
                    "file_urls": [f.get("url") for f in resources.get("storage_files", [])]
                },
                "openai_resources": {
                    "vector_stores": len(resources.get("vector_store_ids", [])),
                    "assistants": len(resources.get("assistant_ids", [])),
                    "estimated_files": len(resources.get("file_ids", [])),
                    "expert_name": resources.get("expert_name", "")
                },
                "impact_assessment": {
                    "has_active_sessions": False,
                    "total_database_records": sum(len(resources["database_tables"].get(table, [])) for table in resources["database_tables"]),
                    "total_storage_files": len(resources.get("storage_files", [])),
                    "total_openai_resources": len(resources.get("vector_store_ids", [])) + len(resources.get("assistant_ids", [])),
                    "deletion_complexity": "simple"  # Can be simple, moderate, complex
                }
            }
            
            # Check for active sessions
            sessions_response = supabase_client.table("sessions").select("id").eq("clone_id", clone_id).eq("status", "active").execute()
            active_sessions_count = len(sessions_response.data) if sessions_response.data else 0
            
            preview["impact_assessment"]["has_active_sessions"] = active_sessions_count > 0
            preview["impact_assessment"]["active_sessions_count"] = active_sessions_count
            
            # Determine deletion complexity
            total_resources = (
                preview["impact_assessment"]["total_database_records"] +
                preview["impact_assessment"]["total_storage_files"] +
                preview["impact_assessment"]["total_openai_resources"]
            )
            
            if total_resources > 50:
                preview["impact_assessment"]["deletion_complexity"] = "complex"
            elif total_resources > 10:
                preview["impact_assessment"]["deletion_complexity"] = "moderate"
            
            # Estimate deletion time
            estimated_time_seconds = max(5, total_resources * 0.5)  # Rough estimate
            preview["impact_assessment"]["estimated_deletion_time_seconds"] = int(estimated_time_seconds)
            
            logger.info("Clone deletion preview generated", 
                       clone_id=clone_id,
                       total_resources=total_resources,
                       complexity=preview["impact_assessment"]["deletion_complexity"])
            
            return {
                "success": True,
                "clone_id": clone_id,
                "preview": preview,
                "timestamp": datetime.utcnow().isoformat()
            }
        
    except Exception as e:
        logger.error("Failed to generate deletion preview", error=str(e), clone_id=clone_id)
        
        # Return basic preview even if detailed gathering fails
        basic_preview = {
            "clone": {
                "id": clone_id,
                "name": "Unknown",
                "created_at": "",
                "category": "",
                "is_published": False
            },
            "database_records": {},
            "storage_files": {"total_count": 0},
            "openai_resources": {"vector_stores": 0, "assistants": 0, "estimated_files": 0},
            "impact_assessment": {
                "has_active_sessions": False,
                "total_database_records": 0,
                "total_storage_files": 0,
                "total_openai_resources": 0,
                "deletion_complexity": "unknown",
                "estimated_deletion_time_seconds": 10
            }
        }
        
        return {
            "success": False,
            "clone_id": clone_id,
            "preview": basic_preview,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


@router.post("/{clone_id}/publish")
async def publish_clone(
    clone_id: str,
    current_user_id: str = Depends(get_current_user_id),
    supabase_client = Depends(get_supabase)
) -> dict:
    """
    Publish a clone to make it publicly available
    """
    try:
        # First check if clone exists and user owns it
        response = supabase_client.table("clones").select("*").eq("id", clone_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        existing_clone = response.data[0]
        
        # Check if user is the creator
        if existing_clone["creator_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the creator can publish this clone"
            )
        
        # Validate clone has required fields for publishing
        if not existing_clone.get("name") or not existing_clone.get("description") or not existing_clone.get("category"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Clone must have name, description, and category to be published"
            )
        
        # Update to published status
        update_data = {
            "is_published": True,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Set published_at if not already set
        if not existing_clone.get("published_at"):
            update_data["published_at"] = datetime.utcnow().isoformat()
        
        update_response = supabase_client.table("clones").update(update_data).eq("id", clone_id).execute()
        
        if not update_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to publish clone"
            )
        
        logger.info("Clone published successfully", 
                   clone_id=clone_id, 
                   creator_id=current_user_id)
        
        return {"message": "Clone published successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Clone publishing failed", error=str(e), clone_id=clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to publish clone"
        )


@router.post("/{clone_id}/unpublish")
async def unpublish_clone(
    clone_id: str,
    current_user_id: str = Depends(get_current_user_id),
    supabase_client = Depends(get_supabase)
) -> dict:
    """
    Unpublish a clone to make it private/draft
    """
    try:
        # First check if clone exists and user owns it
        response = supabase_client.table("clones").select("*").eq("id", clone_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        existing_clone = response.data[0]
        
        # Check if user is the creator
        if existing_clone["creator_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the creator can unpublish this clone"
            )
        
        # Check if clone has active sessions
        sessions_response = supabase_client.table("sessions").select("id").eq("clone_id", clone_id).eq("status", "active").execute()
        
        if sessions_response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot unpublish clone with active sessions"
            )
        
        # Update to unpublished status
        update_data = {
            "is_published": False,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        update_response = supabase_client.table("clones").update(update_data).eq("id", clone_id).execute()
        
        if not update_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to unpublish clone"
            )
        
        logger.info("Clone unpublished successfully", 
                   clone_id=clone_id, 
                   creator_id=current_user_id)
        
        return {"message": "Clone unpublished successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Clone unpublishing failed", error=str(e), clone_id=clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to unpublish clone"
        )


@router.get("/{clone_id}/stats")
async def get_clone_stats(
    clone_id: str,
    current_user_id: str = Depends(get_current_user_id),
    supabase_client = Depends(get_supabase)
) -> dict:
    """
    Get statistics for a clone (only by creator)
    """
    try:
        # First check if clone exists and user owns it
        response = supabase_client.table("clones").select("*").eq("id", clone_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        clone_data = response.data[0]
        
        # Check if user is the creator
        if clone_data["creator_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the creator can view clone statistics"
            )
        
        # Get session statistics from sessions table
        sessions_response = supabase_client.table("sessions").select("*").eq("clone_id", clone_id).execute()
        
        sessions = sessions_response.data or []
        
        # Calculate stats
        total_sessions = len(sessions)
        total_minutes = sum(session.get("duration_minutes", 0) for session in sessions)
        total_earnings = sum(session.get("total_cost", 0) for session in sessions)
        
        # Calculate average rating
        ratings = [session.get("user_rating") for session in sessions if session.get("user_rating") is not None]
        avg_rating = sum(ratings) / len(ratings) if ratings else 0.0
        
        return {
            "total_sessions": total_sessions,
            "total_duration_minutes": total_minutes,
            "total_earnings": float(total_earnings),
            "average_rating": float(avg_rating),
            "is_published": clone_data["is_published"],
            "created_at": clone_data["created_at"],
            "published_at": clone_data.get("published_at")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get clone stats", error=str(e), clone_id=clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve clone statistics"
        )


# RAG Integration Endpoints

@router.post("/{clone_id}/process-knowledge", response_model=KnowledgeProcessingStatus)
async def process_clone_knowledge(
    clone_id: str,
    request: DocumentProcessingRequest,
    use_enhanced_rag: bool = Query(default=False, description="Use enhanced RAG processing with hybrid search"),
    chunking_strategy: str = Query(default="sentence_boundary", description="Chunking strategy: fixed_size, sentence_boundary, or semantic"),
    current_user_id: str = Depends(get_current_user_id)
) -> KnowledgeProcessingStatus:
    """
    Process knowledge documents for a clone using RAG workflow with optional enhanced features
    """
    try:
        # Import here to avoid circular imports
        from app.services.rag_integration_wrapper import process_clone_knowledge
        
        # Use service role client for administrative operations
        service_supabase = get_service_supabase()
        if not service_supabase:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Service role client not available"
            )
        
        # First check if clone exists and user owns it
        response = service_supabase.table("clones").select("*").eq("id", clone_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        clone_data = response.data[0]
        
        # Check if user is the creator
        if clone_data["creator_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the creator can process clone knowledge"
            )
        
        # Extract clone information
        clone_name = clone_data.get("name", "Unknown Clone")
        clone_expertise = clone_data.get("expertise_areas", ["General Knowledge"])
        clone_expertise_str = ", ".join(clone_expertise) if isinstance(clone_expertise, list) else str(clone_expertise)
        clone_background = clone_data.get("bio", "")
        personality_traits = str(clone_data.get("personality_traits", {}))
        
        # Use enhanced RAG if requested
        if use_enhanced_rag:
            try:
                from app.services.rag import clean_rag_service
                from app.services.rag.models import DocumentInfo
                
                # Combine documents and links into a document list for CleanRAGService
                document_list = []
                if request.documents:
                    for doc_name, doc_url in request.documents.items():
                        document_list.append(DocumentInfo(name=doc_name, url=doc_url, content_type="document"))
                if request.links:
                    for i, link in enumerate(request.links):
                        document_list.append(DocumentInfo(name=f"Link_{i+1}", url=link, content_type="link"))
                
                logger.info(f"Using CleanRAG processing for clone {clone_id}")
                
                # Process using CleanRAGService
                enhanced_result_obj = await clean_rag_service.process_clone_documents(
                    clone_id=clone_id,
                    documents=document_list
                )
                
                # Convert to expected format
                enhanced_result = {
                    "status": "success" if enhanced_result_obj.status.value == "completed" else "failed",
                    "assistant_id": enhanced_result_obj.assistant_id,
                    "processed_documents": enhanced_result_obj.processed_documents,
                    "error": enhanced_result_obj.error_message if hasattr(enhanced_result_obj, 'error_message') else None
                }
                
                if enhanced_result.get("status") == "success":
                    # Update clone with enhanced RAG status
                    rag_update_data = {
                        "rag_status": "completed",
                        "document_processing_status": "completed", 
                        "rag_assistant_id": enhanced_result.get("assistant_id"),
                        "updated_at": datetime.utcnow().isoformat()
                    }
                    
                    service_supabase.table("clones").update(rag_update_data).eq("id", clone_id).execute()
                    
                    # Return enhanced processing status
                    return KnowledgeProcessingStatus(
                        expert_name=f"{clone_name} (CleanRAG)",
                        domain_name=clone_expertise_str,
                        overall_status="completed",
                        rag_assistant_id=enhanced_result.get("assistant_id"),
                        processing_details={
                            "rag_type": "enhanced",
                            "chunks_processed": enhanced_result.get("chunks_processed", 0),
                            "documents_processed": enhanced_result.get("documents_processed", 0),
                            "chunking_strategy": strategy.value
                        }
                    )
                else:
                    logger.warning(f"Enhanced RAG processing failed for clone {clone_id}, falling back to standard RAG")
                    use_enhanced_rag = False
                    
            except Exception as e:
                logger.warning(f"Enhanced RAG processing failed for clone {clone_id}: {str(e)}, falling back to standard RAG")
                use_enhanced_rag = False
        
        # Standard RAG processing (fallback or default)
        processing_status = await process_clone_knowledge(
            clone_id=clone_id,
            clone_name=clone_name,
            clone_expertise=clone_expertise_str,
            clone_background=clone_background,
            personality_traits=personality_traits,
            documents=request.documents,
            links=request.links
        )
        
        # Update clone with RAG information
        rag_update_data = {
            "rag_expert_name": processing_status.expert_name,
            "rag_domain_name": processing_status.domain_name,
            "document_processing_status": processing_status.overall_status,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        if processing_status.rag_assistant_id:
            rag_update_data["rag_assistant_id"] = processing_status.rag_assistant_id
        
        service_supabase.table("clones").update(rag_update_data).eq("id", clone_id).execute()
        
        logger.info("Clone knowledge processing completed", 
                   clone_id=clone_id, 
                   status=processing_status.overall_status)
        
        return processing_status
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Clone knowledge processing failed", error=str(e), clone_id=clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process clone knowledge: {str(e)}"
        )


@router.get("/{clone_id}/processing-status", response_model=KnowledgeProcessingStatus)
async def get_processing_status(
    clone_id: str,
    current_user_id: str = Depends(get_current_user_id)
) -> KnowledgeProcessingStatus:
    """
    Get the current processing status for a clone's knowledge
    """
    try:
        # Use service role client for administrative operations
        service_supabase = get_service_supabase()
        if not service_supabase:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Service role client not available"
            )
        
        # First check if clone exists and user owns it
        response = service_supabase.table("clones").select("*").eq("id", clone_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        clone_data = response.data[0]
        
        # Check if user is the creator
        if clone_data["creator_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the creator can view processing status"
            )
        
        # Get RAG information from clone data
        processing_status = KnowledgeProcessingStatus(
            clone_id=clone_id,
            expert_name=clone_data.get("rag_expert_name", ""),
            domain_name=clone_data.get("rag_domain_name", ""),
            overall_status=clone_data.get("document_processing_status", "pending"),
            rag_assistant_id=clone_data.get("rag_assistant_id"),
            processing_started=clone_data.get("updated_at"),
            processing_completed=clone_data.get("updated_at") if clone_data.get("document_processing_status") == "completed" else None
        )
        
        return processing_status
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get processing status", error=str(e), clone_id=clone_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve processing status"
        )




@router.post("/cleanup/orphaned-data")
async def cleanup_orphaned_data(
    current_user_id: str = Depends(get_current_user_id),
    supabase_client = Depends(get_supabase)
) -> dict:
    """
    Find and clean up orphaned data across the system
    This includes RAG resources without corresponding clones, etc.
    """
    try:
        from app.services.clone_cleanup_service import CloneCleanupService
        
        logger.info("Starting orphaned data cleanup", user_id=current_user_id)
        
        orphaned_data = {
            "found": {},
            "cleaned": {},
            "warnings": [],
            "errors": []
        }
        
        # Find orphaned database records
        try:
            # Get all valid clone IDs
            valid_clones_response = supabase_client.table("clones").select("id, name").execute()
            valid_clone_ids = [clone["id"] for clone in valid_clones_response.data] if valid_clones_response.data else []
            valid_clone_names = [clone["name"] for clone in valid_clones_response.data] if valid_clones_response.data else []
            
            # Check for orphaned sessions
            all_sessions = supabase_client.table("sessions").select("id, clone_id").execute()
            orphaned_sessions = []
            if all_sessions.data:
                for session in all_sessions.data:
                    if session["clone_id"] not in valid_clone_ids:
                        orphaned_sessions.append(session["id"])
            
            # Check for orphaned knowledge entries
            all_knowledge = supabase_client.table("knowledge").select("id, clone_id").execute()
            orphaned_knowledge = []
            if all_knowledge.data:
                for knowledge in all_knowledge.data:
                    if knowledge["clone_id"] not in valid_clone_ids:
                        orphaned_knowledge.append(knowledge["id"])
            
            # Check for orphaned documents
            all_documents = supabase_client.table("documents").select("id, client_name").execute()
            orphaned_documents = []
            if all_documents.data:
                for doc in all_documents.data:
                    if doc.get("client_name") and doc["client_name"] not in valid_clone_names:
                        orphaned_documents.append(doc["id"])
            
            orphaned_data["found"] = {
                "sessions": len(orphaned_sessions),
                "knowledge": len(orphaned_knowledge),
                "documents": len(orphaned_documents)
            }
            
            # Clean up orphaned records if requested
            # For safety, we'll just report what was found in this version
            # In production, you might want to add an auto_cleanup parameter
            
            logger.info("Orphaned data scan completed", 
                       orphaned_sessions=len(orphaned_sessions),
                       orphaned_knowledge=len(orphaned_knowledge),
                       orphaned_documents=len(orphaned_documents))
            
            return {
                "success": True,
                "message": "Orphaned data scan completed",
                "orphaned_data": orphaned_data,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            error_msg = f"Failed to scan for orphaned data: {str(e)}"
            logger.error(error_msg)
            orphaned_data["errors"].append(error_msg)
            
            return {
                "success": False,
                "message": "Orphaned data scan failed",
                "orphaned_data": orphaned_data,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
        
    except Exception as e:
        logger.error("Orphaned data cleanup failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Orphaned data cleanup failed: {str(e)}"
        )


@router.post("/{clone_id}/retry-processing")
async def retry_failed_processing(
    clone_id: str,
    current_user_id: str = Depends(get_current_user_id)
) -> dict:
    """
    Retry processing for failed documents by fetching existing documents and triggering RAG processing
    """
    try:
        # Import necessary modules for RAG processing
        from app.services.rag import clean_rag_service
        from app.services.rag.models import DocumentInfo
        
        # Use service role client for administrative operations
        service_supabase = get_service_supabase()
        if not service_supabase:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Service role client not available"
            )
        
        logger.info("Starting retry processing workflow", 
                   clone_id=clone_id, 
                   user_id=current_user_id)
        
        # First check if clone exists and user owns it
        response = service_supabase.table("clones").select("*").eq("id", clone_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        clone_data = response.data[0]
        
        # Check if user is the creator
        if clone_data["creator_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the creator can retry processing"
            )
        
        # Check if there are failed documents to retry
        current_status = clone_data.get("document_processing_status")
        logger.info("Retry processing requested", 
                   clone_id=clone_id, 
                   current_status=current_status,
                   clone_name=clone_data.get("name"))
        
        # Allow retry for failed, partial, or even completed/pending states
        # This provides more flexibility for users experiencing issues
        if current_status == "processing":
            # Already processing, return current status
            return {
                "status": "in_progress",
                "message": "Processing is already in progress. Please wait for completion.",
                "clone_id": clone_id
            }
        
        # Step 1: Fetch documents from the knowledge table for this clone_id
        logger.debug("Fetching documents from knowledge table", clone_id=clone_id)
        
        knowledge_response = service_supabase.table("knowledge").select(
            "id, title, file_url, original_url, content_type, file_name, description, content_preview, metadata"
        ).eq("clone_id", clone_id).execute()
        
        if not knowledge_response.data:
            logger.warning("No documents found in knowledge table for clone", 
                          clone_id=clone_id)
            
            # Still reset status to pending in case user wants to re-upload documents
            update_data = {
                "document_processing_status": "pending",
                "rag_status": "pending",
                "updated_at": datetime.utcnow().isoformat()
            }
            service_supabase.table("clones").update(update_data).eq("id", clone_id).execute()
            
            return {
                "status": "no_documents",
                "message": "No documents found to retry processing. Please upload documents first.",
                "clone_id": clone_id,
                "documents_found": 0
            }
        
        documents_found = len(knowledge_response.data)
        logger.info("Documents found for retry processing", 
                   clone_id=clone_id, 
                   documents_count=documents_found)
        
        # Step 2: Convert knowledge records to DocumentInfo objects
        document_list = []
        url_based_items = 0
        content_based_items = 0
        
        for knowledge_item in knowledge_response.data:
            # Check for URL-based content first
            document_url = knowledge_item.get("file_url") or knowledge_item.get("original_url")
            content_preview = knowledge_item.get("content_preview")
            
            doc_name = knowledge_item.get("title") or knowledge_item.get("file_name") or f"Document_{knowledge_item.get('id')[:8]}"
            content_type = knowledge_item.get("content_type", "document")
            
            if document_url:
                # URL-based knowledge item (existing logic)
                document_info = DocumentInfo(
                    name=doc_name,
                    url=document_url,
                    content_type=content_type
                )
                document_list.append(document_info)
                url_based_items += 1
                
                logger.debug("Added URL-based document for processing", 
                            name=doc_name,
                            url=document_url[:100] + "..." if len(document_url) > 100 else document_url,
                            content_type=content_type)
                            
            elif content_preview:
                # Content-based knowledge item - upload to Supabase storage for processing
                try:
                    import time
                    from uuid import uuid4
                    
                    # Create unique temporary filename in Supabase storage
                    temp_filename = f"temp_content_{knowledge_item.get('id')[:8]}_{int(time.time())}_{uuid4().hex[:8]}.txt"
                    temp_path = f"temp-documents/{clone_id}/{temp_filename}"
                    
                    logger.debug("Uploading content to Supabase storage for processing", 
                                name=doc_name,
                                content_length=len(content_preview),
                                temp_path=temp_path)
                    
                    # Upload content to Supabase storage as temporary file
                    storage_response = service_supabase.storage.from_("knowledge-documents").upload(
                        temp_path, 
                        content_preview.encode('utf-8'), 
                        file_options={"content-type": "text/plain"}
                    )
                    
                    if storage_response:
                        # Get public URL for processing
                        temp_url = service_supabase.storage.from_("knowledge-documents").get_public_url(temp_path)
                        
                        document_info = DocumentInfo(
                            name=doc_name,
                            url=temp_url,
                            content_type="text"
                        )
                        # Track temporary storage path for cleanup
                        document_info._temp_storage_path = temp_path
                        document_list.append(document_info)
                        content_based_items += 1
                        
                        logger.debug("Added content-based document for processing", 
                                    name=doc_name,
                                    content_length=len(content_preview),
                                    temp_url=temp_url[:100] + "..." if len(temp_url) > 100 else temp_url)
                    else:
                        logger.warning("Failed to upload content to Supabase storage", 
                                      knowledge_id=knowledge_item.get("id"),
                                      title=doc_name)
                        continue
                    
                except Exception as temp_error:
                    logger.warning("Failed to create temporary content in Supabase storage", 
                                  knowledge_id=knowledge_item.get("id"),
                                  title=doc_name,
                                  error=str(temp_error))
                    continue
            else:
                logger.warning("Knowledge item has no URL or content, skipping", 
                              knowledge_id=knowledge_item.get("id"),
                              title=doc_name,
                              has_url=bool(document_url),
                              has_content=bool(content_preview))
                continue
        
        if not document_list:
            logger.error("No valid documents found with URLs or content", clone_id=clone_id)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid documents found with accessible URLs or content for processing"
            )
        
        logger.info("Prepared documents for RAG processing", 
                   clone_id=clone_id, 
                   valid_documents=len(document_list),
                   url_based_items=url_based_items,
                   content_based_items=content_based_items)
        
        # Initialize cleanup tracking before processing
        temp_storage_paths = []
        for doc_info in document_list:
            if hasattr(doc_info, '_temp_storage_path'):
                temp_storage_paths.append(doc_info._temp_storage_path)
        
        # Step 3: Reset processing status to pending and processing
        update_data = {
            "document_processing_status": "processing",
            "rag_status": "processing",
            "updated_at": datetime.utcnow().isoformat()
        }
        service_supabase.table("clones").update(update_data).eq("id", clone_id).execute()
        logger.info("Clone status updated to processing", clone_id=clone_id)
        
        # Step 4: Trigger CleanRAGService processing
        try:
            logger.info("Starting CleanRAG document processing", 
                       clone_id=clone_id,
                       documents_to_process=len(document_list))
            
            # Process using CleanRAGService
            processing_result = await clean_rag_service.process_clone_documents(
                clone_id=clone_id,
                documents=document_list
            )
            
            # Clean up temporary storage files after processing
            for temp_path in temp_storage_paths:
                try:
                    cleanup_response = service_supabase.storage.from_("knowledge-documents").remove([temp_path])
                    logger.debug("Cleaned up temporary storage file", temp_path=temp_path)
                except Exception as cleanup_error:
                    logger.warning("Failed to cleanup temporary storage file", 
                                 temp_path=temp_path,
                                 error=str(cleanup_error))
            
            logger.info("CleanRAG processing completed", 
                       clone_id=clone_id,
                       status=processing_result.status.value,
                       processed_docs=processing_result.processed_documents,
                       failed_docs=processing_result.failed_documents)
            
            # Step 5: Update clone status based on processing result
            if processing_result.status.value == "completed":
                final_update_data = {
                    "document_processing_status": "completed",
                    "rag_status": "completed",
                    "rag_assistant_id": processing_result.assistant_id,
                    "updated_at": datetime.utcnow().isoformat()
                }
                
                success_message = f"Processing retry completed successfully. Processed {processing_result.processed_documents} documents."
                
                if processing_result.failed_documents > 0:
                    success_message += f" {processing_result.failed_documents} documents failed processing."
                    final_update_data["document_processing_status"] = "partial"
                    
            else:
                # Processing failed
                final_update_data = {
                    "document_processing_status": "failed",
                    "rag_status": "failed", 
                    "updated_at": datetime.utcnow().isoformat()
                }
                success_message = f"Processing retry failed: {processing_result.error_message or 'Unknown error'}"
            
            service_supabase.table("clones").update(final_update_data).eq("id", clone_id).execute()
            
            logger.info("Clone processing retry completed", 
                       clone_id=clone_id,
                       previous_status=current_status,
                       final_status=final_update_data["document_processing_status"])
            
            return {
                "status": "success" if processing_result.status.value == "completed" else "failed",
                "message": success_message,
                "clone_id": clone_id,
                "previous_status": current_status,
                "new_status": final_update_data["document_processing_status"],
                "documents_found": documents_found,
                "url_based_documents": url_based_items,
                "content_based_documents": content_based_items,
                "documents_processed": processing_result.processed_documents,
                "documents_failed": processing_result.failed_documents,
                "assistant_id": processing_result.assistant_id,
                "processing_time_seconds": processing_result.processing_time_seconds
            }
            
        except Exception as processing_error:
            # If processing fails, update clone status to failed
            logger.error("RAG processing failed during retry", 
                        error=str(processing_error), 
                        clone_id=clone_id)
            
            # Clean up any temporary storage files on failure
            if 'temp_storage_paths' in locals():
                for temp_path in temp_storage_paths:
                    try:
                        service_supabase.storage.from_("knowledge-documents").remove([temp_path])
                        logger.debug("Cleaned up temporary storage file on failure", temp_path=temp_path)
                    except Exception as cleanup_error:
                        logger.debug("Failed to cleanup temporary storage file", 
                                   temp_path=temp_path, error=str(cleanup_error))
            
            failed_update_data = {
                "document_processing_status": "failed",
                "rag_status": "failed",
                "updated_at": datetime.utcnow().isoformat()
            }
            service_supabase.table("clones").update(failed_update_data).eq("id", clone_id).execute()
            
            return {
                "status": "failed",
                "message": f"Processing retry failed due to RAG processing error: {str(processing_error)}",
                "clone_id": clone_id,
                "previous_status": current_status,
                "new_status": "failed",
                "documents_found": documents_found,
                "url_based_documents": url_based_items,
                "content_based_documents": content_based_items,
                "error": str(processing_error)
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to retry processing", error=str(e), clone_id=clone_id)
        
        # Try to reset clone status to failed if possible
        try:
            service_supabase = get_service_supabase()
            if service_supabase:
                service_supabase.table("clones").update({
                    "document_processing_status": "failed",
                    "rag_status": "failed",
                    "updated_at": datetime.utcnow().isoformat()
                }).eq("id", clone_id).execute()
        except:
            pass  # Don't fail on status update failure
            
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retry processing: {str(e)}"
        )


@router.post("/{clone_id}/voice/upload")
async def upload_voice_sample(
    clone_id: str,
    file: UploadFile = File(...),
    voice_name: Optional[str] = None,
    description: Optional[str] = None,
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Upload voice sample for clone voice cloning with ElevenLabs
    """
    try:
        logger.info("Starting voice upload", 
                   clone_id=clone_id, 
                   filename=file.filename,
                   content_type=file.content_type,
                   user_id=current_user_id)
        
        # Get service client for all database operations
        service_supabase = get_service_supabase()
        if not service_supabase:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Service client not available"
            )
        
        # Verify clone exists and user has access
        clone_result = service_supabase.table("clones").select("id, creator_id, name").eq("id", clone_id).execute()
        if not clone_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        clone = clone_result.data[0]
        if clone["creator_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Only clone creator can upload voice samples"
            )
        
        # Validate file
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No filename provided"
            )
        
        # Check file type - audio files only
        audio_content_types = [
            "audio/wav", "audio/wave", "audio/x-wav",
            "audio/mpeg", "audio/mp3", "audio/x-mp3",
            "audio/mp4", "audio/m4a", "audio/x-m4a",
            "audio/aac", "audio/ogg", "audio/flac"
        ]
        
        if file.content_type not in audio_content_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file type. Please upload audio files only. Supported formats: WAV, MP3, M4A, AAC, OGG, FLAC"
            )
        
        # Check file size (limit to 25MB for audio)
        MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB
        file_content = await file.read()
        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File too large. Maximum size is {MAX_FILE_SIZE / (1024*1024):.1f}MB"
            )
        
        # Reset file pointer
        await file.seek(0)
        
        # Use ElevenLabs service to clone voice
        from app.services.elevenlabs_service import get_elevenlabs_service
        
        elevenlabs_service = get_elevenlabs_service()
        
        # Prepare voice name
        clone_voice_name = voice_name or f"{clone['name']} Voice Clone"
        voice_description = description or f"AI voice clone for {clone['name']}"
        
        logger.info("Cloning voice with ElevenLabs", 
                   clone_id=clone_id,
                   voice_name=clone_voice_name,
                   file_size=len(file_content))
        
        # Clone voice using ElevenLabs
        voice_id = await elevenlabs_service.clone_voice(
            name=clone_voice_name,
            audio_files=[file_content],
            description=voice_description
        )
        
        logger.info("Voice cloned successfully", 
                   clone_id=clone_id,
                   voice_id=voice_id)
        
        # Update clone with voice_id
        update_data = {
            "voice_id": voice_id,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        update_result = service_supabase.table("clones").update(update_data).eq("id", clone_id).execute()
        
        if not update_result.data:
            # Voice was cloned but database update failed - log warning
            logger.warning("Voice cloned but failed to update database", 
                          clone_id=clone_id, voice_id=voice_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Voice cloned but failed to update clone record"
            )
        
        logger.info("Clone updated with voice_id", 
                   clone_id=clone_id,
                   voice_id=voice_id)
        
        return {
            "clone_id": clone_id,
            "voice_id": voice_id,
            "voice_name": clone_voice_name,
            "filename": file.filename,
            "file_type": file.content_type,
            "file_size_bytes": len(file_content),
            "message": "Voice sample uploaded and cloned successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Voice upload failed", 
                    clone_id=clone_id, 
                    filename=file.filename if file else "unknown",
                    error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload voice sample: {str(e)}"
        )


@router.post("/{clone_id}/voice/test")
async def test_voice_synthesis(
    clone_id: str,
    text: str = Query(..., min_length=1, max_length=1000, description="Text to synthesize"),
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Test voice synthesis for a clone using ElevenLabs text-to-speech
    """
    try:
        logger.info("Testing voice synthesis", 
                   clone_id=clone_id, 
                   text_length=len(text),
                   user_id=current_user_id)
        
        # Get service client for database operations
        service_supabase = get_service_supabase()
        if not service_supabase:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Service client not available"
            )
        
        # Verify clone exists and user has access
        clone_result = service_supabase.table("clones").select("id, creator_id, voice_id, name").eq("id", clone_id).execute()
        if not clone_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        clone = clone_result.data[0]
        if clone["creator_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Only clone creator can test voice synthesis"
            )
        
        # Check if clone has voice_id
        voice_id = clone.get("voice_id")
        if not voice_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Clone does not have a voice. Please upload a voice sample first."
            )
        
        # Use ElevenLabs service to generate speech
        from app.services.elevenlabs_service import get_elevenlabs_service
        
        elevenlabs_service = get_elevenlabs_service()
        
        logger.info("Generating speech with ElevenLabs", 
                   clone_id=clone_id,
                   voice_id=voice_id,
                   text_length=len(text))
        
        # Generate speech
        audio_bytes = await elevenlabs_service.generate_speech(
            text=text,
            voice_id=voice_id
        )
        
        logger.info("Speech generated successfully", 
                   clone_id=clone_id,
                   voice_id=voice_id,
                   audio_size=len(audio_bytes))
        
        # Return audio as response
        from fastapi.responses import Response
        
        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": f"attachment; filename=\"{clone['name']}_voice_test.mp3\"",
                "Content-Length": str(len(audio_bytes))
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Voice synthesis test failed", 
                    clone_id=clone_id, 
                    error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to test voice synthesis: {str(e)}"
        )


@router.post("/{clone_id}/documents/upload")
async def upload_document(
    clone_id: str,
    file: UploadFile = File(...),
    title: Optional[str] = None,
    description: Optional[str] = None,
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Upload a document to a clone's knowledge base
    """
    try:
        logger.info("Starting document upload", 
                   clone_id=clone_id, 
                   filename=file.filename,
                   content_type=file.content_type,
                   user_id=current_user_id)
        
        # Get service client for all database operations
        service_supabase = get_service_supabase()
        if not service_supabase:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Service client not available"
            )
        
        # Verify clone exists and user has access
        clone_result = service_supabase.table("clones").select("id, creator_id").eq("id", clone_id).execute()
        if not clone_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        clone = clone_result.data[0]
        if clone["creator_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Only clone creator can upload documents"
            )
        
        # Validate file
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No filename provided"
            )
        
        # Check file size (limit to 10MB)
        MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
        file_content = await file.read()
        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File too large. Maximum size is {MAX_FILE_SIZE / (1024*1024):.1f}MB"
            )
        
        # Reset file pointer
        await file.seek(0)
        
        # Generate unique file path in storage
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid4().hex}{file_extension}"
        storage_path = f"{clone_id}/documents/{unique_filename}"
        
        logger.info("Uploading file to storage", 
                   clone_id=clone_id,
                   storage_path=storage_path,
                   file_size=len(file_content))
        
        # Upload file to Supabase Storage using service client
        storage_result = service_supabase.storage.from_("knowledge-documents").upload(
            path=storage_path,
            file=file_content,
            file_options={
                "content-type": file.content_type or "application/octet-stream"
            }
        )
        
        if not storage_result:
            logger.error("Storage upload failed", clone_id=clone_id, filename=file.filename)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to upload file to storage"
            )
        
        # Get public URL for the uploaded file
        file_url = service_supabase.storage.from_("knowledge-documents").get_public_url(storage_path)
        
        # Create knowledge entry in database using service client
        document_title = title or file.filename
        document_description = description or f"Uploaded document: {file.filename}"
        
        knowledge_data = {
            "clone_id": clone_id,
            "title": document_title,
            "description": document_description,
            "content_type": "document",
            "file_name": file.filename,
            "file_url": file_url,
            "file_type": file.content_type or "application/octet-stream",
            "file_size_bytes": len(file_content),
            "vector_store_status": "pending",
            "rag_processing_status": "pending",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        logger.info("Creating knowledge entry", clone_id=clone_id, title=document_title)
        
        knowledge_result = service_supabase.table("knowledge").insert(knowledge_data).execute()
        
        if not knowledge_result.data:
            # Clean up uploaded file if database insert fails
            try:
                service_supabase.storage.from_("knowledge-documents").remove([storage_path])
            except Exception as cleanup_error:
                logger.warning("Failed to cleanup storage file after database failure", 
                             storage_path=storage_path, error=str(cleanup_error))
            
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create knowledge entry"
            )
        
        knowledge_entry = knowledge_result.data[0]
        
        logger.info("Document uploaded successfully", 
                   clone_id=clone_id,
                   knowledge_id=knowledge_entry["id"],
                   filename=file.filename)
        
        return {
            "id": knowledge_entry["id"],
            "clone_id": clone_id,
            "title": document_title,
            "filename": file.filename,
            "file_url": file_url,
            "file_type": file.content_type,
            "file_size_bytes": len(file_content),
            "rag_processing_status": "pending",
            "vector_store_status": "pending",
            "created_at": knowledge_entry["created_at"],
            "message": "Document uploaded successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Document upload failed", 
                    clone_id=clone_id, 
                    filename=file.filename if file else "unknown",
                    error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload document: {str(e)}"
        )


@router.delete("/{clone_id}/documents/{document_id}")
async def delete_document(
    clone_id: str,
    document_id: str,
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Delete a document from a clone's knowledge base and clean up all associated resources
    """
    try:
        logger.info("Starting document deletion", 
                   clone_id=clone_id, 
                   document_id=document_id,
                   user_id=current_user_id)
        
        # Get service client for all database operations
        service_supabase = get_service_supabase()
        if not service_supabase:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Service client not available"
            )
        
        # Verify clone exists and user has access
        clone_result = service_supabase.table("clones").select("id, creator_id").eq("id", clone_id).execute()
        if not clone_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clone not found"
            )
        
        clone = clone_result.data[0]
        if clone["creator_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Only clone creator can delete documents"
            )
        
        # Get document information
        knowledge_result = service_supabase.table("knowledge").select("*").eq("id", document_id).eq("clone_id", clone_id).execute()
        if not knowledge_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
        
        document = knowledge_result.data[0]
        
        # 1. Delete file from storage if it exists
        if document.get("file_url"):
            try:
                # Extract storage path from file_url
                storage_path = document["file_url"].replace(f"{service_supabase.url}/storage/v1/object/public/knowledge-documents/", "")
                if storage_path:
                    cleanup_response = service_supabase.storage.from_("knowledge-documents").remove([storage_path])
                    logger.info("File deleted from storage", path=storage_path, response=cleanup_response)
            except Exception as storage_error:
                logger.warning("Failed to delete file from storage", error=str(storage_error), path=storage_path)
        
        # 2. Delete OpenAI resources (vector store and assistants) if they exist
        if document.get("openai_vector_store_id") or document.get("openai_assistant_id"):
            try:
                from app.services.rag_client import RAGClient
                rag_client = RAGClient()
                
                # Delete vector store
                if document.get("openai_vector_store_id"):
                    try:
                        await rag_client.delete_vector_store(document["openai_vector_store_id"])
                        logger.info("Vector store deleted", vector_store_id=document["openai_vector_store_id"])
                    except Exception as vs_error:
                        logger.warning("Failed to delete vector store", error=str(vs_error), vector_store_id=document["openai_vector_store_id"])
                
                # Delete assistant
                if document.get("openai_assistant_id"):
                    try:
                        await rag_client.delete_assistant(document["openai_assistant_id"])
                        logger.info("Assistant deleted", assistant_id=document["openai_assistant_id"])
                    except Exception as assistant_error:
                        logger.warning("Failed to delete assistant", error=str(assistant_error), assistant_id=document["openai_assistant_id"])
                        
            except Exception as rag_error:
                logger.warning("Failed to delete RAG resources", error=str(rag_error))
        
        # 3. Delete any related documents table entries (for RAG system)
        try:
            from app.services.rag_core_service import get_rag_supabase
            rag_supabase = get_rag_supabase()
            if rag_supabase:
                # Delete from documents table where the name matches
                delete_result = rag_supabase.table("documents").delete().eq("name", document.get("title", "")).execute()
                logger.info("Related documents deleted from RAG system", count=len(delete_result.data))
        except Exception as rag_db_error:
            logger.warning("Failed to delete from RAG documents table", error=str(rag_db_error))
        
        # 4. Delete from knowledge table (main record)
        delete_result = service_supabase.table("knowledge").delete().eq("id", document_id).execute()
        if not delete_result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete document record"
            )
        
        logger.info("Document deleted successfully", 
                   clone_id=clone_id,
                   document_id=document_id,
                   title=document.get("title", "Unknown"))
        
        return {
            "id": document_id,
            "clone_id": clone_id,
            "title": document.get("title", "Unknown"),
            "message": "Document and all associated resources deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Document deletion failed", 
                    clone_id=clone_id, 
                    document_id=document_id,
                    error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete document: {str(e)}"
        )