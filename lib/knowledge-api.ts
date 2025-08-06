/**
 * Knowledge API Client - Manages document upload and processing for AI clones
 */
import { getAuthTokens } from './api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

export interface DocumentUploadRequest {
  file: File;
  title: string;
  description?: string;
  tags?: string[];
}

export interface DocumentResponse {
  id: string;
  clone_id: string;
  title: string;
  description?: string;
  filename: string;
  file_size: number;
  file_type: string;
  upload_url: string;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  tags: string[];
  created_at: string;
  updated_at: string;
  processed_at?: string;
  error_message?: string;
  chunk_count?: number;
}

export interface KnowledgeEntryRequest {
  clone_id: string;
  question: string;
  answer: string;
  category?: string;
  tags?: string[];
  confidence?: number;
}

export interface KnowledgeEntryResponse {
  id: string;
  clone_id: string;
  question: string;
  answer: string;
  category?: string;
  tags: string[];
  confidence: number;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeSearchResult {
  entries: Array<{
    id: string;
    question: string;
    answer: string;
    similarity_score: number;
    category?: string;
    tags: string[];
  }>;
  total_results: number;
  search_time_ms: number;
}

export class KnowledgeApi {
  private getHeaders(includeContentType = true) {
    const { accessToken } = getAuthTokens();
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
    };

    if (includeContentType) {
      headers['Content-Type'] = 'application/json';
    }

    return headers;
  }

  async uploadDocument(cloneId: string, data: DocumentUploadRequest): Promise<DocumentResponse> {
    const formData = new FormData();
    formData.append('file', data.file);
    formData.append('title', data.title);
    if (data.description) {
      formData.append('description', data.description);
    }
    if (data.tags && data.tags.length > 0) {
      formData.append('tags_str', data.tags.join(', '));
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/clones/${cloneId}/documents`, {
      method: 'POST',
      headers: this.getHeaders(false), // Don't include Content-Type for FormData
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `Failed to upload document: ${response.status}`);
    }

    return response.json();
  }

  async getDocuments(cloneId: string): Promise<DocumentResponse[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/clones/${cloneId}/documents`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `Failed to fetch documents: ${response.status}`);
    }

    const data = await response.json();
    return data.documents || data; // Handle different response formats
  }

  async getDocument(cloneId: string, documentId: string): Promise<DocumentResponse> {
    const response = await fetch(`${API_BASE_URL}/api/v1/clones/${cloneId}/documents/${documentId}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `Failed to fetch document: ${response.status}`);
    }

    return response.json();
  }

  async deleteDocument(cloneId: string, documentId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/v1/clones/${cloneId}/documents/${documentId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `Failed to delete document: ${response.status}`);
    }
  }

  async createKnowledgeEntry(data: KnowledgeEntryRequest): Promise<KnowledgeEntryResponse> {
    const response = await fetch(`${API_BASE_URL}/api/v1/clones/${data.clone_id}/knowledge`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        question: data.question,
        answer: data.answer,
        category: data.category,
        tags: data.tags || [],
        confidence: data.confidence || 0.9,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `Failed to create knowledge entry: ${response.status}`);
    }

    return response.json();
  }

  async getKnowledgeEntries(cloneId: string, params?: {
    category?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<{ entries: KnowledgeEntryResponse[]; total: number }> {
    const searchParams = new URLSearchParams();
    
    if (params) {
      if (params.category) searchParams.append('category', params.category);
      if (params.tags) params.tags.forEach(tag => searchParams.append('tags', tag));
      if (params.limit) searchParams.append('limit', params.limit.toString());
      if (params.offset) searchParams.append('offset', params.offset.toString());
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/clones/${cloneId}/knowledge?${searchParams}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `Failed to fetch knowledge entries: ${response.status}`);
    }

    return response.json();
  }

  async searchKnowledge(cloneId: string, query: string, limit: number = 10): Promise<KnowledgeSearchResult> {
    const response = await fetch(`${API_BASE_URL}/api/v1/clones/${cloneId}/knowledge/search`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        query,
        limit,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `Failed to search knowledge: ${response.status}`);
    }

    return response.json();
  }

  async updateKnowledgeEntry(
    cloneId: string, 
    entryId: string, 
    data: Partial<Omit<KnowledgeEntryRequest, 'clone_id'>>
  ): Promise<KnowledgeEntryResponse> {
    const response = await fetch(`${API_BASE_URL}/api/v1/clones/${cloneId}/knowledge/${entryId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `Failed to update knowledge entry: ${response.status}`);
    }

    return response.json();
  }

  async deleteKnowledgeEntry(cloneId: string, entryId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/v1/clones/${cloneId}/knowledge/${entryId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `Failed to delete knowledge entry: ${response.status}`);
    }
  }

  async processUrlContent(cloneId: string, url: string, title?: string): Promise<DocumentResponse> {
    const response = await fetch(`${API_BASE_URL}/api/v1/clones/${cloneId}/process-url`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        url,
        title: title || `Content from ${new URL(url).hostname}`,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `Failed to process URL: ${response.status}`);
    }

    return response.json();
  }
}

// Export singleton instance
export const knowledgeApi = new KnowledgeApi();

// Convenience functions
export const uploadDocument = (cloneId: string, data: DocumentUploadRequest) => 
  knowledgeApi.uploadDocument(cloneId, data);

export const createKnowledgeEntry = (data: KnowledgeEntryRequest) => 
  knowledgeApi.createKnowledgeEntry(data);

export const searchKnowledge = (cloneId: string, query: string, limit?: number) => 
  knowledgeApi.searchKnowledge(cloneId, query, limit);

export const getDocuments = (cloneId: string) => 
  knowledgeApi.getDocuments(cloneId);

export const processUrl = (cloneId: string, url: string, title?: string) => 
  knowledgeApi.processUrlContent(cloneId, url, title);