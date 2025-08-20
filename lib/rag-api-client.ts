/**
 * RAG API Client - Handles RAG-specific API calls
 * Reuses existing API client patterns and authentication
 */
import { apiClient, parseApiError } from './api-client';
import { AxiosError } from 'axios';
import { createClient } from '@/utils/supabase/client';

// Helper function to get auth token
async function getAuthToken(): Promise<string> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || '';
}

// RAG Types
export interface RAGInitializationRequest {
  documents?: any[];
  config?: any;
  force_reinitialize?: boolean;
}

export interface RAGInitializationResponse {
  initialization_id: string;
  status: string;
  estimated_duration_seconds?: number;
  document_count: number;
  message: string;
}

export interface RAGStatusResponse {
  is_ready: boolean;
  status: string;
  initialization_id?: string;
  document_count: number;
  last_initialized?: string;
  error_message?: string;
}

export interface RAGSource {
  document_name: string;
  content_snippet: string;
  relevance_score: number;
  page?: number;
}

export interface RAGQueryResponse {
  content: string;
  query_type: string;
  rag_data?: {
    response: string;
    confidence_score: number;
    sources: RAGSource[];
    used_memory_layer: boolean;
    used_llm_fallback: boolean;
    used_personality_enhancement: boolean;
    tokens_used: number;
    response_time_ms: number;
  };
  confidence_score: number;
  response_time_ms: number;
  tokens_used: number;
}

export interface InitializationStatus {
  id: string;
  status: string;
  progress: number;
  phase: string;
  processedDocuments: number;
  totalDocuments: number;
  failedDocuments: string[];
  error?: string;
  completed: boolean;
  success: boolean;
}

export class RAGApiClient {
  
  // Initialize RAG for a clone using the original RAG API initialize endpoint
  async initializeCloneRAG(
    cloneId: string, 
    options: RAGInitializationRequest = {}
  ): Promise<RAGInitializationResponse> {
    try {
      // Call the RAG memory initialize endpoint directly
      // The backend will handle fetching clone data, QA data, and knowledge internally  
      // Use axios directly with full URL since the endpoint is not under /api/v1
      const baseURL = 'http://127.0.0.1:8000';
      const response = await fetch(`${baseURL}/api/memory/expert/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}` // Get auth token
        },
        body: JSON.stringify({
          expert_name: cloneId,
          domain_name: "general", // Backend will fetch actual category from database
          qa_pairs: [], // Backend will fetch from clone_qa_data table
          document_urls: {}, // Backend will fetch from knowledge table
          pdf_documents: {} // Backend will fetch and process from knowledge table
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const responseData = await response.json();
      
      return {
        initialization_id: responseData.results?.expert?.id || cloneId,
        status: responseData.status === "success" ? "ready" : responseData.status,
        document_count: responseData.results?.expert_files?.document_count || 0,
        message: responseData.message || "Memory layer initialization completed"
      };
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(`Failed to initialize RAG: ${apiError.message}`);
    }
  }

  // Get RAG status for a clone using new simplified endpoints
  async getCloneRAGStatus(cloneId: string): Promise<RAGStatusResponse> {
    try {
      const response = await apiClient.get(`/rag-simple/clones/${cloneId}/status`);
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(`Failed to get RAG status: ${apiError.message}`);
    }
  }

  // Query RAG system using new simplified endpoint
  async queryCloneRAG(
    cloneId: string,
    query: string,
    sessionId?: string,
    context?: any
  ): Promise<RAGQueryResponse> {
    try {
      // Send data in request body using new simplified endpoint
      const response = await apiClient.post(`/rag-simple/clones/${cloneId}/query`, {
        query,
        session_id: sessionId,
        file_name: null, // Optional specific file to search
        max_results: 5,
        context
      });
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(`Failed to query RAG: ${apiError.message}`);
    }
  }

  // Get initialization status
  async getInitializationStatus(initializationId: string): Promise<InitializationStatus> {
    try {
      const response = await apiClient.get(`/rag/initializations/${initializationId}/status`);
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(`Failed to get initialization status: ${apiError.message}`);
    }
  }

  // Enable RAG for clone (same as initialize in simplified version)
  async enableCloneRAG(cloneId: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.post(`/rag-simple/clones/${cloneId}/enable-memory`, {
        force_reinitialize: false
      });
      return { message: response.data.message || "Memory layer initialization started" };
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(`Failed to enable RAG: ${apiError.message}`);
    }
  }

  // Disable RAG for clone
  async disableCloneRAG(cloneId: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.post(`/rag/clones/${cloneId}/disable`);
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(`Failed to disable RAG: ${apiError.message}`);
    }
  }

  // Get RAG analytics
  async getCloneRAGAnalytics(cloneId: string, days: number = 7): Promise<any> {
    try {
      const response = await apiClient.get(`/rag/clones/${cloneId}/analytics?days=${days}`);
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(`Failed to get RAG analytics: ${apiError.message}`);
    }
  }

  // Update RAG documents
  async updateCloneRAGDocuments(
    cloneId: string,
    knowledgeIds: string[],
    operation: string = 'add'
  ): Promise<any> {
    try {
      const response = await apiClient.put(`/rag/clones/${cloneId}/update`, {
        knowledge_ids: knowledgeIds,
        operation
      });
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(`Failed to update RAG documents: ${apiError.message}`);
    }
  }

  // Poll initialization status with callback
  async pollInitializationStatus(
    initializationId: string,
    callback: (status: InitializationStatus) => void,
    intervalMs: number = 2000
  ): Promise<InitializationStatus> {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const status = await this.getInitializationStatus(initializationId);
          callback(status);
          
          if (status.completed) {
            resolve(status);
          } else {
            setTimeout(poll, intervalMs);
          }
        } catch (error) {
          reject(error);
        }
      };
      
      poll();
    });
  }

  // Health check
  async checkRAGHealth(): Promise<any> {
    try {
      const response = await apiClient.get('/rag/health');
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(`Failed to check RAG health: ${apiError.message}`);
    }
  }
}

// Export singleton instance
export const ragApiClient = new RAGApiClient();

// Convenience functions
export const initializeCloneRAG = (cloneId: string, options?: RAGInitializationRequest) =>
  ragApiClient.initializeCloneRAG(cloneId, options);

export const getCloneRAGStatus = (cloneId: string) =>
  ragApiClient.getCloneRAGStatus(cloneId);

export const queryCloneRAG = (cloneId: string, query: string, sessionId?: string, context?: any) =>
  ragApiClient.queryCloneRAG(cloneId, query, sessionId, context);

export const enableCloneRAG = (cloneId: string) =>
  ragApiClient.enableCloneRAG(cloneId);

export const disableCloneRAG = (cloneId: string) =>
  ragApiClient.disableCloneRAG(cloneId);