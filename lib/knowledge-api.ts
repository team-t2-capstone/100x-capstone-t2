// Knowledge API implementation using backend service
// All operations use service key through backend API

export interface DuplicateCheckResponse {
  isDuplicate: boolean;
  existingDocument?: {
    id: string;
    title: string;
    hash: string;
  };
}

export interface DocumentUpload {
  file: File;
  title: string;
  description?: string;
  tags?: string[];
  hash: string;
}

// Check for document duplicates using backend API
export async function checkDocumentDuplicate(
  cloneId: string,
  documentData: DocumentUpload
): Promise<DuplicateCheckResponse> {
  try {
    // Get user session for authentication
    const { createClient } = await import('@/utils/supabase/client');
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.warn('No session found for duplicate check');
      return { isDuplicate: false };
    }

    const response = await fetch(`http://127.0.0.1:8000/api/v1/clones/${cloneId}/documents/check-duplicate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        filename: documentData.title,
        file_size: documentData.file.size,
        content_hash: documentData.hash
      })
    });

    if (!response.ok) {
      console.warn('Duplicate check failed, assuming no duplicates:', response.status);
      return { isDuplicate: false };
    }

    const result = await response.json();
    return {
      isDuplicate: result.is_duplicate || false,
      existingDocument: result.existing_document ? {
        id: result.existing_document.id,
        title: result.existing_document.filename,
        hash: result.existing_document.content_hash || documentData.hash
      } : undefined
    };
  } catch (error) {
    console.warn('Duplicate check failed:', error);
    return { isDuplicate: false };
  }
}

// Generate file hash for duplicate detection
export async function generateFileHash(file: File): Promise<string> {
  try {
    // Use Web Crypto API to generate SHA-256 hash
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  } catch (error) {
    console.warn('Failed to generate file hash:', error);
    // Fallback to basic hash
    return `fallback_${file.name}_${file.size}_${Date.now()}`;
  }
}

// Upload document using backend API with service key
export async function uploadDocumentWithOverwrite(
  cloneId: string,
  documentData: DocumentUpload,
  forceOverwrite: boolean = false
): Promise<any> {
  try {
    // Get user session for authentication
    const { createClient } = await import('@/utils/supabase/client');
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('Authentication required for document upload');
    }

    // Create FormData for file upload
    const formData = new FormData();
    formData.append('file', documentData.file);
    formData.append('title', documentData.title);
    if (documentData.description) {
      formData.append('description', documentData.description);
    }

    const response = await fetch(`http://127.0.0.1:8000/api/v1/clones/${cloneId}/documents/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Document upload failed:', response.status, errorText);
      throw new Error(`Upload failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Document uploaded successfully via backend:', result);
    
    return {
      id: result.id,
      title: result.title,
      description: result.description || documentData.description,
      tags: documentData.tags || [],
      hash: documentData.hash,
      status: 'pending', // Backend sets this as pending initially
      file_url: result.file_url,
      filename: result.filename
    };
  } catch (error) {
    console.error('Document upload failed:', error);
    throw error;
  }
}