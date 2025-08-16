/**
 * RAG Health Check API - Simplified for OpenAI native integration
 */
import { getAuthTokens } from './api-client';
import { RAGHealthCheckResponse } from '@/types/database';

export interface RAGHealthStatus {
  isHealthy: boolean;
  status: 'healthy' | 'unhealthy' | 'error';
  message: string;
  issues: string[];
  solutions: string[];
  openaiConfigured: boolean;
  supabaseConfigured: boolean;
  timestamp: string;
}

export class RAGHealthAPI {
  private async getHeaders() {
    const { accessToken } = getAuthTokens();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    };
  }

  /**
   * Check RAG system health using frontend API route
   */
  async checkHealth(): Promise<RAGHealthStatus> {
    try {
      const response = await fetch('/api/health/rag', {
        method: 'GET',
        headers: await this.getHeaders(),
      });

      const data: RAGHealthCheckResponse = await response.json();

      return {
        isHealthy: data.rag_ready,
        status: data.status,
        message: data.message,
        issues: data.issues || [],
        solutions: data.solutions || [],
        openaiConfigured: data.openai_api_key_configured || false,
        supabaseConfigured: data.supabase_configured || false,
        timestamp: data.timestamp,
      };

    } catch (error) {
      console.error('RAG health check failed:', error);
      return {
        isHealthy: false,
        status: 'error',
        message: 'Failed to check RAG system health',
        issues: [error instanceof Error ? error.message : 'Unknown error'],
        solutions: ['Check network connection', 'Verify API configuration'],
        openaiConfigured: false,
        supabaseConfigured: false,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get user-friendly health status message
   */
  getHealthMessage(status: RAGHealthStatus): string {
    if (status.isHealthy) {
      return '✅ RAG system is ready and operational';
    }

    if (!status.openaiConfigured) {
      return '❌ OpenAI API key is not configured';
    }

    if (!status.supabaseConfigured) {
      return '❌ Database connection is not configured';
    }

    return `❌ ${status.message}`;
  }

  /**
   * Get setup suggestions based on health status
   */
  getSetupSuggestions(status: RAGHealthStatus): string[] {
    if (status.isHealthy) {
      return ['✅ System is ready to process documents'];
    }

    const suggestions: string[] = [];

    if (!status.openaiConfigured) {
      suggestions.push('Configure OpenAI API key in environment variables');
    }

    if (!status.supabaseConfigured) {
      suggestions.push('Configure Supabase connection settings');
    }

    // Add any additional solutions from the response
    suggestions.push(...status.solutions);

    return suggestions;
  }
}

// Export singleton instance
export const ragHealthAPI = new RAGHealthAPI();

// Convenience functions
export const checkRAGHealth = () => ragHealthAPI.checkHealth();
export const getHealthMessage = (status: RAGHealthStatus) => ragHealthAPI.getHealthMessage(status);
export const getSetupSuggestions = (status: RAGHealthStatus) => ragHealthAPI.getSetupSuggestions(status);