/**
 * Document API Client
 * Handles document upload and management operations
 */
import { apiClient, parseApiError } from './api-client'

// Document types
export interface Document {
  id: string
  title: string
  file_name: string
  file_type: string
  file_size_bytes: number
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  chunk_count: number
  upload_date: string
  tags: string[]
  description?: string
}

export interface DocumentUploadMetadata {
  title: string
  description?: string
  tags?: string[]
}

export interface DocumentsResponse {
  documents: Document[]
  total: number
  page: number
  per_page: number
}

// Upload progress callback type
export type UploadProgressCallback = (progress: number) => void

/**
 * Upload a document to a clone's knowledge base
 */
export async function uploadDocument(
  cloneId: string,
  file: File,
  metadata: DocumentUploadMetadata,
  onProgress?: UploadProgressCallback
): Promise<Document> {
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('title', metadata.title)
    
    if (metadata.description) {
      formData.append('description', metadata.description)
    }
    
    if (metadata.tags && metadata.tags.length > 0) {
      formData.append('tags_str', metadata.tags.join(','))
    }

    const response = await apiClient.post(
      `/clones/${cloneId}/documents`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            onProgress(progress)
          }
        },
      }
    )

    return response.data
  } catch (error: any) {
    throw parseApiError(error)
  }
}

/**
 * Get documents for a clone
 */
export async function getDocuments(
  cloneId: string,
  page: number = 1,
  perPage: number = 20,
  search?: string,
  status?: string
): Promise<DocumentsResponse> {
  try {
    const params: Record<string, any> = {
      page,
      per_page: perPage,
    }
    
    if (search) {
      params.search = search
    }
    
    if (status && status !== 'all') {
      params.status = status
    }

    const response = await apiClient.get(`/clones/${cloneId}/documents`, { params })
    return response.data
  } catch (error: any) {
    throw parseApiError(error)
  }
}

/**
 * Get a specific document by ID
 */
export async function getDocument(cloneId: string, documentId: string): Promise<Document> {
  try {
    const response = await apiClient.get(`/clones/${cloneId}/documents/${documentId}`)
    return response.data
  } catch (error: any) {
    throw parseApiError(error)
  }
}

/**
 * Delete a document
 */
export async function deleteDocument(cloneId: string, documentId: string): Promise<void> {
  try {
    await apiClient.delete(`/clones/${cloneId}/documents/${documentId}`)
  } catch (error: any) {
    throw parseApiError(error)
  }
}

/**
 * Download a document
 */
export async function downloadDocument(
  cloneId: string, 
  documentId: string
): Promise<Blob> {
  try {
    const response = await apiClient.get(
      `/clones/${cloneId}/documents/${documentId}/download`,
      { responseType: 'blob' }
    )
    return response.data
  } catch (error: any) {
    throw parseApiError(error)
  }
}

/**
 * Update document metadata
 */
export async function updateDocument(
  cloneId: string,
  documentId: string,
  updates: Partial<DocumentUploadMetadata>
): Promise<Document> {
  try {
    const response = await apiClient.patch(
      `/clones/${cloneId}/documents/${documentId}`,
      updates
    )
    return response.data
  } catch (error: any) {
    throw parseApiError(error)
  }
}

/**
 * Get document processing status
 */
export async function getDocumentStatus(
  cloneId: string, 
  documentId: string
): Promise<{
  status: string
  progress: number
  chunk_count: number
  error?: string
}> {
  try {
    const response = await apiClient.get(`/clones/${cloneId}/documents/${documentId}/status`)
    return response.data
  } catch (error: any) {
    throw parseApiError(error)
  }
}

/**
 * Search documents by content
 */
export async function searchDocuments(
  cloneId: string,
  query: string,
  limit: number = 10
): Promise<{
  results: Array<{
    document: Document
    chunks: Array<{
      content: string
      score: number
      chunk_index: number
    }>
  }>
}> {
  try {
    const response = await apiClient.post(`/clones/${cloneId}/documents/search`, {
      query,
      limit,
    })
    return response.data
  } catch (error: any) {
    throw parseApiError(error)
  }
}

/**
 * Bulk upload multiple documents
 */
export async function bulkUploadDocuments(
  cloneId: string,
  files: Array<{ file: File; metadata: DocumentUploadMetadata }>,
  onProgress?: (fileIndex: number, progress: number) => void
): Promise<Document[]> {
  const results: Document[] = []
  
  for (let i = 0; i < files.length; i++) {
    const { file, metadata } = files[i]
    
    try {
      const document = await uploadDocument(
        cloneId,
        file,
        metadata,
        (progress) => onProgress?.(i, progress)
      )
      results.push(document)
    } catch (error) {
      // Continue with other files even if one fails
      console.error(`Failed to upload ${file.name}:`, error)
      // You might want to collect errors and return them as well
    }
  }
  
  return results
}

/**
 * Get document upload statistics
 */
export async function getUploadStats(cloneId: string): Promise<{
  total_documents: number
  total_size_bytes: number
  status_counts: Record<string, number>
  total_chunks: number
  processing_queue_length: number
}> {
  try {
    const response = await apiClient.get(`/clones/${cloneId}/documents/stats`)
    return response.data
  } catch (error: any) {
    throw parseApiError(error)
  }
}

/**
 * Retry failed document processing
 */
export async function retryDocumentProcessing(
  cloneId: string, 
  documentId: string
): Promise<void> {
  try {
    await apiClient.post(`/clones/${cloneId}/documents/${documentId}/retry`)
  } catch (error: any) {
    throw parseApiError(error)
  }
}

/**
 * Validate file before upload
 */
export function validateDocumentFile(file: File): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  // Check file size (10MB limit)
  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) {
    errors.push(`File size must be less than ${maxSize / (1024 * 1024)}MB`)
  }
  
  // Check file type
  const allowedExtensions = ['.pdf', '.txt', '.doc', '.docx', '.md', '.rtf']
  const extension = '.' + file.name.split('.').pop()?.toLowerCase()
  if (!allowedExtensions.includes(extension)) {
    errors.push(`File type not supported. Allowed: ${allowedExtensions.join(', ')}`)
  }
  
  // Check filename
  if (!file.name || file.name.trim() === '') {
    errors.push('Filename is required')
  }
  
  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

/**
 * Get file type icon class
 */
export function getFileTypeIcon(fileType: string): string {
  const iconMap: Record<string, string> = {
    pdf: 'text-red-500',
    doc: 'text-blue-500',
    docx: 'text-blue-500',
    txt: 'text-gray-500',
    md: 'text-green-500',
    rtf: 'text-purple-500',
  }
  
  return iconMap[fileType.toLowerCase()] || 'text-gray-500'
}