"""
Supabase Storage utility functions for CloneAI
Handles file uploads, downloads, and storage management
"""
import logging
import mimetypes
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple
from pathlib import Path
import uuid

from supabase import Client

import structlog

logger = structlog.get_logger()


class StorageManager:
    """Handles all file storage operations with Supabase Storage"""
    
    def __init__(self, supabase_client: Client):
        self.client = supabase_client
    
    async def upload_avatar(
        self, 
        user_id: str, 
        file_data: bytes, 
        filename: str,
        content_type: Optional[str] = None
    ) -> Tuple[bool, str, Optional[str]]:
        """
        Upload user avatar to storage
        
        Returns:
            (success: bool, url_or_error: str, file_path: Optional[str])
        """
        try:
            # Validate file type
            if not content_type:
                content_type, _ = mimetypes.guess_type(filename)
            
            allowed_types = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
            if content_type not in allowed_types:
                return False, f"Invalid file type: {content_type}. Allowed types: {allowed_types}", None
            
            # Validate file size (5MB limit)
            if len(file_data) > 5 * 1024 * 1024:
                return False, "File size exceeds 5MB limit", None
            
            # Generate unique filename
            file_extension = Path(filename).suffix.lower()
            unique_filename = f"{uuid.uuid4()}{file_extension}"
            file_path = f"{user_id}/{unique_filename}"
            
            # Upload to Supabase Storage
            result = self.client.storage.from_("avatars").upload(
                path=file_path,
                file=file_data,
                file_options={
                    "content-type": content_type,
                    "cache-control": "3600"
                }
            )
            
            if result.status_code == 200:
                # Get public URL
                public_url = self.client.storage.from_("avatars").get_public_url(file_path)
                logger.info("Avatar uploaded successfully", 
                           user_id=user_id, file_path=file_path)
                return True, public_url, file_path
            else:
                logger.error("Avatar upload failed", 
                           user_id=user_id, error=result.json())
                return False, f"Upload failed: {result.json()}", None
                
        except Exception as e:
            logger.error("Avatar upload error", user_id=user_id, error=str(e))
            return False, f"Upload error: {str(e)}", None
    
    async def upload_clone_avatar(
        self,
        clone_id: str,
        file_data: bytes,
        filename: str,
        content_type: Optional[str] = None
    ) -> Tuple[bool, str, Optional[str]]:
        """Upload clone avatar to storage"""
        try:
            if not content_type:
                content_type, _ = mimetypes.guess_type(filename)
            
            allowed_types = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
            if content_type not in allowed_types:
                return False, f"Invalid file type: {content_type}", None
            
            if len(file_data) > 5 * 1024 * 1024:
                return False, "File size exceeds 5MB limit", None
            
            file_extension = Path(filename).suffix.lower()
            unique_filename = f"{uuid.uuid4()}{file_extension}"
            file_path = f"{clone_id}/{unique_filename}"
            
            result = self.client.storage.from_("clone-avatars").upload(
                path=file_path,
                file=file_data,
                file_options={
                    "content-type": content_type,
                    "cache-control": "3600"
                }
            )
            
            if result.status_code == 200:
                public_url = self.client.storage.from_("clone-avatars").get_public_url(file_path)
                logger.info("Clone avatar uploaded", clone_id=clone_id, file_path=file_path)
                return True, public_url, file_path
            else:
                logger.error("Clone avatar upload failed", 
                           clone_id=clone_id, error=result.json())
                return False, f"Upload failed: {result.json()}", None
                
        except Exception as e:
            logger.error("Clone avatar upload error", clone_id=clone_id, error=str(e))
            return False, f"Upload error: {str(e)}", None
    
    async def upload_document(
        self,
        clone_id: str,
        file_data: bytes,
        filename: str,
        content_type: Optional[str] = None
    ) -> Tuple[bool, str, Optional[str]]:
        """Upload document to storage"""
        try:
            if not content_type:
                content_type, _ = mimetypes.guess_type(filename)
            
            allowed_types = [
                'application/pdf',
                'text/plain',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/msword',
                'text/markdown'
            ]
            if content_type not in allowed_types:
                return False, f"Invalid file type: {content_type}", None
            
            # 50MB limit for documents
            if len(file_data) > 50 * 1024 * 1024:
                return False, "File size exceeds 50MB limit", None
            
            file_extension = Path(filename).suffix.lower()
            unique_filename = f"{uuid.uuid4()}_{filename}"
            file_path = f"{clone_id}/{unique_filename}"
            
            result = self.client.storage.from_("knowledge-documents").upload(
                path=file_path,
                file=file_data,
                file_options={"content-type": content_type}
            )
            
            if result.status_code == 200:
                logger.info("Document uploaded", clone_id=clone_id, 
                           filename=filename, file_path=file_path)
                return True, file_path, file_path
            else:
                logger.error("Document upload failed", 
                           clone_id=clone_id, error=result.json())
                return False, f"Upload failed: {result.json()}", None
                
        except Exception as e:
            logger.error("Document upload error", clone_id=clone_id, error=str(e))
            return False, f"Upload error: {str(e)}", None
    
    async def delete_file(self, bucket: str, file_path: str) -> Tuple[bool, str]:
        """Delete file from storage"""
        try:
            result = self.client.storage.from_(bucket).remove([file_path])
            
            if result:
                logger.info("File deleted", bucket=bucket, file_path=file_path)
                return True, "File deleted successfully"
            else:
                logger.error("File deletion failed", bucket=bucket, file_path=file_path)
                return False, "File deletion failed"
                
        except Exception as e:
            logger.error("File deletion error", bucket=bucket, file_path=file_path, error=str(e))
            return False, f"Deletion error: {str(e)}"
    
    async def get_file_info(self, bucket: str, file_path: str) -> Optional[Dict[str, Any]]:
        """Get file information from storage"""
        try:
            result = self.client.storage.from_(bucket).list(
                path=str(Path(file_path).parent),
                search=Path(file_path).name
            )
            
            if result and len(result) > 0:
                return result[0]
            return None
            
        except Exception as e:
            logger.error("Get file info error", bucket=bucket, file_path=file_path, error=str(e))
            return None
    
    async def generate_signed_url(
        self, 
        bucket: str, 
        file_path: str, 
        expires_in: int = 3600
    ) -> Optional[str]:
        """Generate signed URL for private file access"""
        try:
            result = self.client.storage.from_(bucket).create_signed_url(
                path=file_path,
                expires_in=expires_in
            )
            
            if result:
                return result.get('signedURL')
            return None
            
        except Exception as e:
            logger.error("Signed URL generation error", 
                        bucket=bucket, file_path=file_path, error=str(e))
            return None
    
    async def list_user_files(
        self, 
        bucket: str, 
        user_folder: str, 
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """List files in user's folder"""
        try:
            result = self.client.storage.from_(bucket).list(
                path=user_folder,
                limit=limit
            )
            
            return result or []
            
        except Exception as e:
            logger.error("List files error", 
                        bucket=bucket, user_folder=user_folder, error=str(e))
            return []
    
    async def cleanup_expired_exports(self) -> int:
        """Clean up expired export files"""
        try:
            # List all files in exports bucket
            all_files = self.client.storage.from_("exports").list()
            
            deleted_count = 0
            cutoff_date = datetime.utcnow() - timedelta(days=7)
            
            for file_info in all_files:
                # Check if file is older than 7 days
                created_at = datetime.fromisoformat(file_info['created_at'].replace('Z', '+00:00'))
                
                if created_at < cutoff_date:
                    success, _ = await self.delete_file("exports", file_info['name'])
                    if success:
                        deleted_count += 1
            
            logger.info("Cleaned up expired exports", deleted_count=deleted_count)
            return deleted_count
            
        except Exception as e:
            logger.error("Export cleanup error", error=str(e))
            return 0


# Storage configuration
STORAGE_CONFIG = {
    'avatars': {
        'max_size': 5 * 1024 * 1024,  # 5MB
        'allowed_types': ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        'public': True
    },
    'clone-avatars': {
        'max_size': 5 * 1024 * 1024,  # 5MB
        'allowed_types': ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        'public': True
    },
    'knowledge-documents': {
        'max_size': 50 * 1024 * 1024,  # 50MB
        'allowed_types': [
            'application/pdf',
            'text/plain',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword',
            'text/markdown'
        ],
        'public': True
    },
    'exports': {
        'max_size': 100 * 1024 * 1024,  # 100MB
        'allowed_types': [
            'application/json',
            'text/csv',
            'application/pdf',
            'application/zip'
        ],
        'public': False,
        'ttl_days': 7
    }
}


def get_storage_manager(supabase_client: Client) -> StorageManager:
    """Get StorageManager instance"""
    return StorageManager(supabase_client)