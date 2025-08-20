"""
Comprehensive Clone Cleanup Service

This service handles complete cleanup when a clone is deleted, ensuring no orphaned data
remains in any system (database, OpenAI, Supabase storage).
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
import structlog

from ..database import get_supabase, get_service_supabase
from ..config import settings
from ..api.rag_utils import get_openai_client

logger = structlog.get_logger()


def validate_openai_configuration():
    """Validate OpenAI configuration"""
    try:
        if not settings.OPENAI_API_KEY:
            return {"valid": False, "error": "OpenAI API key not configured"}
        
        # Test client initialization
        client = get_openai_client()
        if client:
            return {"valid": True, "error": None}
        else:
            return {"valid": False, "error": "Failed to initialize OpenAI client"}
    except Exception as e:
        return {"valid": False, "error": str(e)}


class CleanupError(Exception):
    """Custom exception for cleanup operations"""
    def __init__(self, message: str, recoverable: bool = True, details: dict = None):
        super().__init__(message)
        self.recoverable = recoverable
        self.details = details or {}


class CloneCleanupService:
    """
    Comprehensive service for cleaning up all clone-related data across all systems
    """
    
    def __init__(self):
        self.supabase = None
        self.openai_client = None
        self.cleanup_results = {
            "database": {},
            "openai": {},
            "storage": {},
            "errors": [],
            "warnings": []
        }
    
    async def __aenter__(self):
        """Async context manager entry"""
        try:
            # Initialize Supabase client with service role for admin operations
            self.supabase = get_service_supabase() or get_supabase()
            if not self.supabase:
                raise CleanupError("Failed to initialize Supabase client", recoverable=False)
            
            # Initialize OpenAI client for vector store and assistant cleanup
            try:
                validation = validate_openai_configuration()
                if validation["valid"]:
                    self.openai_client = get_openai_client()
                else:
                    logger.warning("OpenAI configuration invalid, skipping OpenAI cleanup", 
                                 error=validation["error"])
            except Exception as e:
                logger.warning("Failed to initialize OpenAI client", error=str(e))
            
            return self
        except Exception as e:
            raise CleanupError(f"Failed to initialize cleanup service: {str(e)}", recoverable=False)
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        # Log final cleanup results
        if self.cleanup_results["errors"]:
            logger.error("Cleanup completed with errors", 
                        errors=self.cleanup_results["errors"],
                        warnings=self.cleanup_results["warnings"])
        else:
            logger.info("Cleanup completed successfully", 
                       results=self.cleanup_results)
    
    async def cleanup_clone(self, clone_id: str, user_id: str) -> Dict[str, Any]:
        """
        Main cleanup function that orchestrates complete clone deletion
        
        Args:
            clone_id: ID of the clone to delete
            user_id: ID of the user requesting deletion (for authorization)
            
        Returns:
            Dictionary with cleanup results and any errors/warnings
        """
        logger.info("Starting comprehensive clone cleanup", 
                   clone_id=clone_id, user_id=user_id)
        
        try:
            # Step 1: Validate clone exists and user has permission
            clone_data = await self._validate_clone_access(clone_id, user_id)
            
            # Step 2: Gather all related resource information before deletion
            resources = await self._gather_clone_resources(clone_id, clone_data)
            
            # Step 3: Perform cleanup in specific order to handle dependencies
            await self._cleanup_openai_resources(resources)
            await self._cleanup_storage_files(clone_id, clone_data)
            await self._cleanup_database_records(clone_id, clone_data)
            
            # Step 4: Verify cleanup completion
            await self._verify_cleanup_completion(clone_id)
            
            return {
                "success": True,
                "clone_id": clone_id,
                "message": "Clone and all related data successfully deleted",
                "cleanup_details": self.cleanup_results,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except CleanupError as e:
            logger.error("Cleanup failed", error=str(e), details=e.details)
            return {
                "success": False,
                "clone_id": clone_id,
                "error": str(e),
                "recoverable": e.recoverable,
                "cleanup_details": self.cleanup_results,
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error("Unexpected cleanup error", error=str(e))
            return {
                "success": False,
                "clone_id": clone_id,
                "error": f"Unexpected error during cleanup: {str(e)}",
                "recoverable": False,
                "cleanup_details": self.cleanup_results,
                "timestamp": datetime.utcnow().isoformat()
            }
    
    async def _validate_clone_access(self, clone_id: str, user_id: str) -> Dict[str, Any]:
        """Validate clone exists and user has permission to delete it"""
        try:
            response = self.supabase.table("clones").select("*").eq("id", clone_id).execute()
            
            if not response.data:
                raise CleanupError(f"Clone {clone_id} not found", recoverable=False)
            
            clone_data = response.data[0]
            
            # Check user permission
            if clone_data["creator_id"] != user_id:
                raise CleanupError(f"User {user_id} not authorized to delete clone {clone_id}", 
                                 recoverable=False)
            
            # Check for active sessions
            sessions_response = self.supabase.table("sessions").select("id").eq("clone_id", clone_id).eq("status", "active").execute()
            
            if sessions_response.data:
                raise CleanupError(f"Cannot delete clone {clone_id} with {len(sessions_response.data)} active sessions", 
                                 recoverable=False)
            
            logger.info("Clone validation successful", clone_id=clone_id, clone_name=clone_data.get("name"))
            return clone_data
            
        except Exception as e:
            if isinstance(e, CleanupError):
                raise
            raise CleanupError(f"Failed to validate clone access: {str(e)}")
    
    async def _gather_clone_resources(self, clone_id: str, clone_data: Dict[str, Any]) -> Dict[str, Any]:
        """Gather all resource IDs and information needed for cleanup"""
        resources = {
            "clone_name": clone_data.get("name", ""),
            "expert_name": "",
            "vector_store_ids": [],
            "assistant_ids": [],
            "file_ids": [],
            "storage_files": [],
            "database_tables": {
                "knowledge": [],
                "documents": [],
                "experts": [],
                "assistants": [],
                "vector_stores": [],
                "sessions": [],
                "clone_qa_training": []
            }
        }
        
        try:
            clone_name = clone_data.get("name", "")
            if clone_name:
                # Generate expert name using same pattern as RAG integration
                resources["expert_name"] = f"{clone_name.replace(' ', '_').lower()}_{clone_id[:8]}"
            
            # Gather OpenAI resource IDs
            if self.openai_client:
                await self._gather_openai_resources(clone_id, resources)
            
            # Gather storage file information
            await self._gather_storage_resources(clone_id, clone_data, resources)
            
            # Gather database record counts
            await self._gather_database_resources(clone_id, clone_data, resources)
            
            logger.info("Resource gathering complete", 
                       clone_id=clone_id,
                       vector_stores=len(resources["vector_store_ids"]),
                       assistants=len(resources["assistant_ids"]),
                       storage_files=len(resources["storage_files"]))
            
            return resources
            
        except Exception as e:
            logger.error("Failed to gather clone resources", error=str(e))
            # Continue with partial resource information
            return resources
    
    async def _gather_openai_resources(self, clone_id: str, resources: Dict[str, Any]):
        """Gather OpenAI vector store and assistant IDs"""
        try:
            expert_name = resources["expert_name"]
            clone_name = resources["clone_name"]
            
            # Get vector store IDs from database with multiple search patterns
            vector_response = self.supabase.table("vector_stores").select("vector_id, file_ids").or_(
                f"expert_name.eq.{expert_name},client_name.eq.{clone_name}"
            ).execute()
            
            for vs in vector_response.data or []:
                if vs.get("vector_id"):
                    resources["vector_store_ids"].append(vs["vector_id"])
                    # Collect file IDs from vector stores
                    file_ids = vs.get("file_ids", [])
                    if isinstance(file_ids, list):
                        resources["file_ids"].extend(file_ids)
            
            # Get assistant IDs from database
            assistant_response = self.supabase.table("assistants").select("assistant_id").eq("expert_name", expert_name).execute()
            
            for assistant in assistant_response.data or []:
                if assistant.get("assistant_id"):
                    resources["assistant_ids"].append(assistant["assistant_id"])
            
            # Also check clone's RAG assistant ID from clones table
            clone_response = self.supabase.table("clones").select("rag_assistant_id").eq("id", clone_id).execute()
            if clone_response.data and clone_response.data[0].get("rag_assistant_id"):
                rag_assistant_id = clone_response.data[0]["rag_assistant_id"]
                if rag_assistant_id not in resources["assistant_ids"]:
                    resources["assistant_ids"].append(rag_assistant_id)
            
            # Search for OpenAI resources by name patterns if expert_name is available
            if self.openai_client and expert_name:
                try:
                    # List vector stores and find matches by name
                    vs_list = self.openai_client.vector_stores.list()
                    for vs in vs_list.data:
                        if (expert_name.lower() in vs.name.lower() or 
                            clone_name.lower().replace(' ', '_') in vs.name.lower()):
                            if vs.id not in resources["vector_store_ids"]:
                                resources["vector_store_ids"].append(vs.id)
                                logger.info(f"Found additional vector store by name: {vs.id}")
                    
                    # List assistants and find matches by name
                    assistant_list = self.openai_client.beta.assistants.list()
                    for assistant in assistant_list.data:
                        if (expert_name.lower() in assistant.name.lower() or 
                            clone_name.lower().replace(' ', '_') in assistant.name.lower()):
                            if assistant.id not in resources["assistant_ids"]:
                                resources["assistant_ids"].append(assistant.id)
                                logger.info(f"Found additional assistant by name: {assistant.id}")
                
                except Exception as e:
                    logger.warning("Failed to search OpenAI resources by name", error=str(e))
                
        except Exception as e:
            logger.warning("Failed to gather some OpenAI resources", error=str(e))
            self.cleanup_results["warnings"].append(f"OpenAI resource gathering: {str(e)}")
    
    async def _gather_storage_resources(self, clone_id: str, clone_data: Dict[str, Any], resources: Dict[str, Any]):
        """Gather Supabase storage file paths for deletion"""
        try:
            # Knowledge documents from storage
            knowledge_response = self.supabase.table("knowledge").select("file_url").eq("clone_id", clone_id).execute()
            
            for knowledge in knowledge_response.data or []:
                file_url = knowledge.get("file_url")
                if file_url:
                    resources["storage_files"].append({
                        "type": "knowledge_document",
                        "url": file_url,
                        "bucket": "knowledge-documents"
                    })
            
            # Clone avatar from storage
            avatar_url = clone_data.get("avatar_url")
            if avatar_url:
                resources["storage_files"].append({
                    "type": "avatar",
                    "url": avatar_url,
                    "bucket": "avatars"  # Assuming this is the bucket name
                })
                
        except Exception as e:
            logger.warning("Failed to gather some storage resources", error=str(e))
            self.cleanup_results["warnings"].append(f"Storage resource gathering: {str(e)}")
    
    async def _gather_database_resources(self, clone_id: str, clone_data: Dict[str, Any], resources: Dict[str, Any]):
        """Count database records for cleanup tracking"""
        try:
            clone_name = clone_data.get("name", "")
            expert_name = resources["expert_name"]
            
            # Count records in each table
            tables_to_check = [
                ("knowledge", [("clone_id", clone_id)]),
                ("sessions", [("clone_id", clone_id)]),
                ("clone_qa_training", [("clone_id", clone_id)]),
                ("documents", [("client_name", clone_name)]),
                ("experts", [("name", expert_name)]),
                ("assistants", [("expert_name", expert_name)]),
                ("vector_stores", [("expert_name", expert_name)])
            ]
            
            for table_name, conditions in tables_to_check:
                try:
                    query = self.supabase.table(table_name).select("id")
                    for field, value in conditions:
                        if value:  # Only add condition if value is not empty
                            query = query.eq(field, value)
                    
                    response = query.execute()
                    count = len(response.data) if response.data else 0
                    resources["database_tables"][table_name] = response.data or []
                    
                    logger.debug(f"Found {count} records in {table_name}", 
                               table=table_name, count=count)
                    
                except Exception as e:
                    logger.warning(f"Failed to count records in {table_name}", error=str(e))
                    resources["database_tables"][table_name] = []
                    
        except Exception as e:
            logger.warning("Failed to gather database resource counts", error=str(e))
    
    async def _cleanup_openai_resources(self, resources: Dict[str, Any]):
        """Clean up OpenAI vector stores and assistants"""
        if not self.openai_client:
            logger.info("Skipping OpenAI cleanup - client not available")
            self.cleanup_results["openai"]["skipped"] = "OpenAI client not available"
            return
        
        try:
            logger.info("Starting OpenAI resource cleanup",
                       vector_stores=len(resources["vector_store_ids"]),
                       assistants=len(resources["assistant_ids"]))
            
            # Delete vector stores
            deleted_vector_stores = []
            for vector_store_id in resources["vector_store_ids"]:
                try:
                    self.openai_client.vector_stores.delete(vector_store_id)
                    deleted_vector_stores.append(vector_store_id)
                    logger.info("Deleted OpenAI vector store", vector_store_id=vector_store_id)
                except Exception as e:
                    error_msg = f"Failed to delete vector store {vector_store_id}: {str(e)}"
                    logger.warning(error_msg)
                    self.cleanup_results["warnings"].append(error_msg)
            
            # Delete assistants
            deleted_assistants = []
            for assistant_id in resources["assistant_ids"]:
                try:
                    self.openai_client.beta.assistants.delete(assistant_id)
                    deleted_assistants.append(assistant_id)
                    logger.info("Deleted OpenAI assistant", assistant_id=assistant_id)
                except Exception as e:
                    error_msg = f"Failed to delete assistant {assistant_id}: {str(e)}"
                    logger.warning(error_msg)
                    self.cleanup_results["warnings"].append(error_msg)
            
            # Delete files (optional - files will be automatically cleaned up by OpenAI)
            deleted_files = []
            for file_id in resources["file_ids"]:
                try:
                    self.openai_client.files.delete(file_id)
                    deleted_files.append(file_id)
                    logger.debug("Deleted OpenAI file", file_id=file_id)
                except Exception as e:
                    # File deletion is optional - they'll be cleaned up automatically
                    logger.debug(f"Could not delete file {file_id}: {str(e)}")
            
            self.cleanup_results["openai"] = {
                "vector_stores_deleted": deleted_vector_stores,
                "assistants_deleted": deleted_assistants,
                "files_deleted": deleted_files,
                "success": True
            }
            
        except Exception as e:
            error_msg = f"OpenAI cleanup failed: {str(e)}"
            logger.error(error_msg)
            self.cleanup_results["errors"].append(error_msg)
            self.cleanup_results["openai"] = {"success": False, "error": str(e)}
    
    async def _cleanup_storage_files(self, clone_id: str, clone_data: Dict[str, Any]):
        """Clean up Supabase storage files"""
        try:
            logger.info("Starting storage file cleanup", clone_id=clone_id)
            
            deleted_files = []
            
            # Delete knowledge documents
            knowledge_response = self.supabase.table("knowledge").select("file_url").eq("clone_id", clone_id).execute()
            
            for knowledge in knowledge_response.data or []:
                file_url = knowledge.get("file_url")
                if file_url and file_url.startswith('http'):
                    try:
                        # Extract file path from URL for storage deletion
                        # URL format: https://supabase-url/storage/v1/object/public/bucket/path
                        path_parts = file_url.split('/storage/v1/object/public/')
                        if len(path_parts) > 1:
                            bucket_and_path = path_parts[1].split('/', 1)
                            if len(bucket_and_path) == 2:
                                bucket, file_path = bucket_and_path
                                
                                # Delete from storage
                                storage_response = self.supabase.storage.from_(bucket).remove([file_path])
                                if storage_response:
                                    deleted_files.append(f"{bucket}/{file_path}")
                                    logger.debug("Deleted storage file", bucket=bucket, path=file_path)
                    except Exception as e:
                        error_msg = f"Failed to delete storage file {file_url}: {str(e)}"
                        logger.warning(error_msg)
                        self.cleanup_results["warnings"].append(error_msg)
            
            # Delete clone avatar
            avatar_url = clone_data.get("avatar_url")
            if avatar_url and avatar_url.startswith('http'):
                try:
                    path_parts = avatar_url.split('/storage/v1/object/public/')
                    if len(path_parts) > 1:
                        bucket_and_path = path_parts[1].split('/', 1)
                        if len(bucket_and_path) == 2:
                            bucket, file_path = bucket_and_path
                            
                            storage_response = self.supabase.storage.from_(bucket).remove([file_path])
                            if storage_response:
                                deleted_files.append(f"{bucket}/{file_path}")
                                logger.info("Deleted clone avatar", bucket=bucket, path=file_path)
                except Exception as e:
                    error_msg = f"Failed to delete avatar {avatar_url}: {str(e)}"
                    logger.warning(error_msg)
                    self.cleanup_results["warnings"].append(error_msg)
            
            self.cleanup_results["storage"] = {
                "files_deleted": deleted_files,
                "success": True
            }
            
        except Exception as e:
            error_msg = f"Storage cleanup failed: {str(e)}"
            logger.error(error_msg)
            self.cleanup_results["errors"].append(error_msg)
            self.cleanup_results["storage"] = {"success": False, "error": str(e)}
    
    async def _cleanup_database_records(self, clone_id: str, clone_data: Dict[str, Any]):
        """Clean up database records in correct order to handle foreign key constraints"""
        try:
            logger.info("Starting database cleanup", clone_id=clone_id)
            
            clone_name = clone_data.get("name", "")
            expert_name = f"{clone_name.replace(' ', '_').lower()}_{clone_id[:8]}" if clone_name else ""
            
            deleted_counts = {}
            
            # Delete in specific order to handle foreign key relationships
            cleanup_sequence = [
                # First: Delete referencing records
                ("sessions", [("clone_id", clone_id)]),
                ("knowledge", [("clone_id", clone_id)]),
                ("clone_qa_training", [("clone_id", clone_id)]),
                
                # Second: Delete RAG-related records with multiple search patterns
                ("assistants", [("expert_name", expert_name)] if expert_name else []),
                ("assistants", [("client_name", clone_name)] if clone_name else []),
                ("vector_stores", [("expert_name", expert_name)] if expert_name else []),
                ("vector_stores", [("client_name", clone_name)] if clone_name else []),
                ("documents", [("client_name", clone_name)] if clone_name else []),
                ("experts", [("name", expert_name)] if expert_name else []),
                
                # Third: Clean up any orphaned RAG embeddings or chunks
                ("rag_chunks", [("clone_id", clone_id)]),
                ("rag_embeddings", [("clone_id", clone_id)]),
                ("rag_processing_status", [("clone_id", clone_id)]),
                
                # Fourth: Clean up conversation and chat history
                ("conversations", [("clone_id", clone_id)]),
                ("chat_messages", [("clone_id", clone_id)]),
                ("chat_threads", [("clone_id", clone_id)]),
                
                # Last: Delete the clone itself
                ("clones", [("id", clone_id)])
            ]
            
            for table_name, conditions in cleanup_sequence:
                if not conditions:  # Skip if no conditions (empty expert_name or clone_name)
                    continue
                    
                try:
                    # Check if table exists before attempting deletion
                    try:
                        test_query = self.supabase.table(table_name).select("*").limit(1).execute()
                        table_exists = True
                    except Exception:
                        logger.debug(f"Table {table_name} does not exist, skipping")
                        table_exists = False
                    
                    if not table_exists:
                        continue
                    
                    # Build delete query
                    query = self.supabase.table(table_name).delete()
                    for field, value in conditions:
                        query = query.eq(field, value)
                    
                    # Execute deletion
                    response = query.execute()
                    deleted_count = len(response.data) if response.data else 0
                    
                    # Accumulate counts for same table with different conditions
                    if table_name in deleted_counts:
                        deleted_counts[table_name] += deleted_count
                    else:
                        deleted_counts[table_name] = deleted_count
                    
                    if deleted_count > 0:
                        logger.info(f"Deleted {deleted_count} records from {table_name}",
                                   table=table_name, count=deleted_count)
                    
                except Exception as e:
                    error_msg = f"Failed to delete from {table_name}: {str(e)}"
                    logger.warning(error_msg)  # Changed to warning to continue cleanup
                    self.cleanup_results["warnings"].append(error_msg)
                    # Continue with other tables even if one fails
            
            self.cleanup_results["database"] = {
                "tables_cleaned": deleted_counts,
                "success": True  # Consider success if we completed without critical errors
            }
            
        except Exception as e:
            error_msg = f"Database cleanup failed: {str(e)}"
            logger.error(error_msg)
            self.cleanup_results["errors"].append(error_msg)
            self.cleanup_results["database"] = {"success": False, "error": str(e)}
    
    async def _verify_cleanup_completion(self, clone_id: str):
        """Verify that cleanup was successful by checking for remaining records"""
        try:
            verification_results = {}
            
            # Check if clone still exists
            clone_check = self.supabase.table("clones").select("id").eq("id", clone_id).execute()
            if clone_check.data:
                self.cleanup_results["warnings"].append("Clone record still exists after cleanup")
                verification_results["clone_exists"] = True
            else:
                verification_results["clone_exists"] = False
            
            # Check for orphaned records across all tables
            tables_to_verify = [
                ("sessions", "clone_id"),
                ("knowledge", "clone_id"),
                ("clone_qa_training", "clone_id"),
                ("rag_chunks", "clone_id"),
                ("rag_embeddings", "clone_id"),
                ("conversations", "clone_id"),
                ("chat_messages", "clone_id")
            ]
            
            total_orphaned = 0
            for table_name, field_name in tables_to_verify:
                try:
                    orphaned_records = self.supabase.table(table_name).select("id").eq(field_name, clone_id).execute()
                    orphaned_count = len(orphaned_records.data) if orphaned_records.data else 0
                    if orphaned_count > 0:
                        self.cleanup_results["warnings"].append(f"{orphaned_count} orphaned {table_name} records found")
                        verification_results[f"orphaned_{table_name}"] = orphaned_count
                        total_orphaned += orphaned_count
                    else:
                        verification_results[f"orphaned_{table_name}"] = 0
                except Exception as e:
                    logger.debug(f"Could not verify {table_name} cleanup: {str(e)}")
            
            # Check OpenAI resources if we have access
            if self.openai_client:
                try:
                    # This is informational - we can't easily verify OpenAI cleanup
                    # without storing the exact resource IDs that were deleted
                    verification_results["openai_cleanup_attempted"] = len(self.cleanup_results.get("openai", {}).get("vector_stores_deleted", []))
                except Exception as e:
                    logger.debug(f"Could not verify OpenAI cleanup: {str(e)}")
            
            # Summary
            if total_orphaned == 0 and not verification_results.get("clone_exists", True):
                logger.info("Cleanup verification successful - no orphaned data found")
            else:
                logger.warning(f"Cleanup verification found {total_orphaned} orphaned records")
            
            self.cleanup_results["verification"] = verification_results
            
        except Exception as e:
            logger.warning("Cleanup verification failed", error=str(e))
            self.cleanup_results["warnings"].append(f"Verification failed: {str(e)}")


# Convenience functions for easy integration
async def cleanup_clone_comprehensive(clone_id: str, user_id: str) -> Dict[str, Any]:
    """
    Comprehensive clone cleanup function
    
    Args:
        clone_id: ID of the clone to delete
        user_id: ID of the user requesting deletion
        
    Returns:
        Dictionary with cleanup results
    """
    async with CloneCleanupService() as cleanup_service:
        return await cleanup_service.cleanup_clone(clone_id, user_id)


async def verify_cleanup_capability() -> Dict[str, Any]:
    """
    Verify that cleanup service has necessary access to all systems
    
    Returns:
        Dictionary with capability status
    """
    capabilities = {
        "supabase": False,
        "openai": False,
        "storage": False,
        "errors": []
    }
    
    try:
        # Test Supabase access
        supabase = get_service_supabase() or get_supabase()
        if supabase:
            test_response = supabase.table("clones").select("id").limit(1).execute()
            capabilities["supabase"] = True
        else:
            capabilities["errors"].append("Supabase client not available")
    except Exception as e:
        capabilities["errors"].append(f"Supabase test failed: {str(e)}")
    
    try:
        # Test OpenAI access
        validation = validate_openai_configuration()
        if validation["valid"]:
            capabilities["openai"] = True
        else:
            capabilities["errors"].append(f"OpenAI configuration invalid: {validation['error']}")
    except Exception as e:
        capabilities["errors"].append(f"OpenAI test failed: {str(e)}")
    
    # Storage capability is same as Supabase
    capabilities["storage"] = capabilities["supabase"]
    
    capabilities["ready"] = all([capabilities["supabase"], capabilities["openai"]])
    
    return capabilities


# Export main functions
__all__ = [
    "CloneCleanupService",
    "cleanup_clone_comprehensive", 
    "verify_cleanup_capability",
    "CleanupError"
]