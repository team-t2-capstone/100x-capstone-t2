/**
 * RAG (Retrieval-Augmented Generation) Hook
 * Custom hook for managing RAG state and operations
 */
import { useState, useEffect, useCallback } from 'react';
import { 
  ragApiClient,
  RAGStatusResponse, 
  RAGInitializationResponse,
  InitializationStatus,
  RAGQueryResponse
} from '@/lib/rag-api-client';

export interface RAGState {
  isInitialized: boolean;
  isInitializing: boolean;
  status: 'disabled' | 'initializing' | 'ready' | 'error';
  error: string | null;
  documentCount: number;
  lastInitialized: Date | null;
  initializationId: string | null;
}

export interface RAGMetrics {
  totalQueries: number;
  successRate: number;
  averageConfidence: number;
  averageResponseTime: number;
  memoryLayerUsage: number;
}

export function useRAG(cloneId: string) {
  const [state, setState] = useState<RAGState>({
    isInitialized: false,
    isInitializing: false,
    status: 'disabled',
    error: null,
    documentCount: 0,
    lastInitialized: null,
    initializationId: null
  });

  const [metrics, setMetrics] = useState<RAGMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  // Check RAG status by querying database for existing assistant/vector store
  const checkStatus = useCallback(async () => {
    if (!cloneId) return;

    try {
      // Check if assistant and vector store already exist using a direct database query
      // We'll use the simplified RAG status endpoint when available
      const { createClient } = await import('@/utils/supabase/client');
      const supabase = createClient();
      
      // Check if vector store exists for this clone
      const { data: vectorData } = await supabase
        .from('vector_stores')
        .select('*')
        .eq('expert_name', cloneId)
        .single();
      
      // Check if assistant exists for this clone  
      const { data: assistantData } = await supabase
        .from('assistants')
        .select('*')
        .eq('expert_name', cloneId)
        .eq('memory_type', 'expert')
        .single();

      if (vectorData && assistantData) {
        // Get actual knowledge count from knowledge table
        const { data: knowledgeData } = await supabase
          .from('knowledge')
          .select('id')
          .eq('clone_id', cloneId);
        
        // Memory layer already exists and is ready
        setState(prev => ({
          ...prev,
          isInitialized: true,
          isInitializing: false,
          status: 'ready',
          error: null,
          documentCount: knowledgeData?.length || 0,
          lastInitialized: new Date(vectorData.updated_at),
          initializationId: null
        }));
      } else {
        // Memory layer not initialized
        setState(prev => ({
          ...prev,
          isInitialized: false,
          isInitializing: false,
          status: 'disabled',
          error: null,
          documentCount: 0,
          lastInitialized: null,
          initializationId: null
        }));
      }
    } catch (error) {
      console.error('Failed to check RAG status:', error);
      // Don't set error state for status check failures
      setState(prev => ({
        ...prev,
        isInitialized: false,
        isInitializing: false,
        status: 'disabled',
        error: null
      }));
    }
  }, [cloneId]);

  // Initialize RAG using simplified approach
  const initializeRAG = useCallback(async (options: { force_reinitialize?: boolean } = {}) => {
    if (!cloneId) throw new Error('Clone ID is required');

    try {
      setLoading(true);
      setState(prev => ({ ...prev, isInitializing: true, status: 'initializing', error: null }));

      // Start initialization using simplified endpoint
      const response = await ragApiClient.initializeCloneRAG(cloneId, {
        force_reinitialize: options.force_reinitialize || false
      });

      setState(prev => ({
        ...prev,
        initializationId: response.initialization_id,
        documentCount: response.document_count || 0
      }));

      // Success - memory layer initialized
      setState(prev => ({
        ...prev,
        isInitialized: true,
        isInitializing: false,
        status: 'ready',
        error: null,
        documentCount: response.document_count,
        lastInitialized: new Date(),
        initializationId: null
      }));
      
      return { success: true, error: null };

    } catch (error) {
      console.log('RAG initialization failed:', error);
      setState(prev => ({
        ...prev,
        isInitializing: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'Memory layer initialization failed'
      }));
      
      return { success: false, error: error instanceof Error ? error.message : 'Initialization failed' };
    } finally {
      setLoading(false);
    }
  }, [cloneId]);

  // Query RAG
  const queryRAG = useCallback(async (
    query: string, 
    sessionId?: string, 
    context?: any
  ): Promise<RAGQueryResponse> => {
    if (!cloneId) throw new Error('Clone ID is required');

    try {
      const response = await ragApiClient.queryCloneRAG(cloneId, query, sessionId, context);
      return response;
    } catch (error) {
      console.error('RAG query failed:', error);
      throw error;
    }
  }, [cloneId]);

  // Enable RAG
  const enableRAG = useCallback(async () => {
    if (!cloneId) throw new Error('Clone ID is required');

    try {
      await ragApiClient.enableCloneRAG(cloneId);
      setState(prev => ({
        ...prev,
        status: 'ready',
        isInitialized: true,
        error: null
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to enable RAG'
      }));
      throw error;
    }
  }, [cloneId]);

  // Disable RAG
  const disableRAG = useCallback(async () => {
    if (!cloneId) throw new Error('Clone ID is required');

    try {
      await ragApiClient.disableCloneRAG(cloneId);
      setState(prev => ({
        ...prev,
        isInitialized: false,
        status: 'disabled',
        error: null
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to disable RAG'
      }));
      throw error;
    }
  }, [cloneId]);

  // Get analytics
  const getAnalytics = useCallback(async (days: number = 7) => {
    if (!cloneId) return;

    try {
      const analytics = await ragApiClient.getCloneRAGAnalytics(cloneId, days);
      
      setMetrics({
        totalQueries: analytics.total_queries || 0,
        successRate: analytics.success_rate || 0,
        averageConfidence: analytics.average_confidence || 0,
        averageResponseTime: analytics.average_response_time_ms || 0,
        memoryLayerUsage: analytics.memory_layer_usage_rate || 0
      });

      return analytics;
    } catch (error) {
      console.error('Failed to get RAG analytics:', error);
    }
  }, [cloneId]);

  // Check system health
  const checkSystemHealth = useCallback(async () => {
    try {
      return await ragApiClient.checkRAGHealth();
    } catch (error) {
      console.error('Failed to check RAG health:', error);
      return { status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, []);

  // Check status on component mount
  useEffect(() => {
    if (cloneId) {
      checkStatus();
    }
  }, [cloneId, checkStatus]);

  return {
    // State
    ...state,
    loading,
    metrics,

    // Actions
    initializeRAG,
    queryRAG,
    enableRAG,
    disableRAG,
    getAnalytics,
    checkSystemHealth,
    checkStatus,

    // Computed values
    canInitialize: !state.isInitializing && !state.isInitialized && state.status !== 'error',
    isReady: state.isInitialized && state.status === 'ready',
    hasError: state.status === 'error' || !!state.error
  };
}

export default useRAG;