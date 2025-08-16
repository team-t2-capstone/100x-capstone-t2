/**
 * Simplified RAG API integration for CloneAI
 * Replaces complex RAG workflow with OpenAI native approach
 */

export interface SimplifiedRAGResponse {
  status: 'success' | 'failed' | 'processing'
  assistant_id?: string
  processed_documents?: number
  error?: string
  message: string
}

export interface SimplifiedQueryResponse {
  response: string
  sources?: string[]
  confidence?: number
  thread_id?: string
  assistant_id?: string
  timestamp: string
}

export interface RAGStatusResponse {
  clone_id: string
  rag_status: 'pending' | 'processing' | 'completed' | 'failed'
  assistant_id?: string
  total_documents: number
  processed_documents: number
  progress_percentage: number
  is_ready: boolean
  message: string
}

export interface RAGHealthResponse {
  status: 'healthy' | 'unhealthy' | 'error'
  rag_ready: boolean
  openai_configured: boolean
  supabase_configured: boolean
  issues?: string[]
  solutions?: string[]
  service_type: string
  timestamp: string
  message: string
}

/**
 * Process clone knowledge using simplified OpenAI native RAG
 */
export async function processCloneKnowledge(
  cloneId: string,
  cloneData: {
    clone_name: string
    document_urls: Record<string, string>
    bio?: string
    category?: string
    personality_traits?: Record<string, any>
    communication_style?: Record<string, any>
  },
  authToken?: string
): Promise<SimplifiedRAGResponse> {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000'
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`
    }
    
    const response = await fetch(`${backendUrl}/api/v1/process-clone-knowledge`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        clone_id: cloneId,
        ...cloneData
      })
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `HTTP ${response.status}`)
    }
    
    return await response.json()
    
  } catch (error) {
    console.error('Failed to process clone knowledge:', error)
    throw error
  }
}

/**
 * Query clone using simplified OpenAI native RAG
 */
export async function queryClone(
  cloneId: string,
  query: string,
  threadId?: string,
  authToken?: string
): Promise<SimplifiedQueryResponse> {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000'
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`
    }
    
    const response = await fetch(`${backendUrl}/api/v1/query-clone-expert`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        clone_id: cloneId,
        query,
        thread_id: threadId
      })
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `HTTP ${response.status}`)
    }
    
    return await response.json()
    
  } catch (error) {
    console.error('Failed to query clone:', error)
    throw error
  }
}

/**
 * Get RAG status for a clone
 */
export async function getRAGStatus(
  cloneId: string,
  authToken?: string
): Promise<RAGStatusResponse> {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000'
    
    const headers: Record<string, string> = {}
    
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`
    }
    
    const response = await fetch(`${backendUrl}/api/v1/clone/${cloneId}/rag-status`, {
      method: 'GET',
      headers
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `HTTP ${response.status}`)
    }
    
    return await response.json()
    
  } catch (error) {
    console.error('Failed to get RAG status:', error)
    throw error
  }
}

/**
 * Check RAG service health
 */
export async function checkRAGHealth(): Promise<RAGHealthResponse> {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000'
    
    const response = await fetch(`${backendUrl}/api/v1/rag-health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `HTTP ${response.status}`)
    }
    
    return await response.json()
    
  } catch (error) {
    console.error('Failed to check RAG health:', error)
    throw error
  }
}

/**
 * Frontend hook for processing documents with simplified progress tracking
 */
export function useSimplifiedRAGProcessing() {
  const [status, setStatus] = useState<'idle' | 'processing' | 'completed' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SimplifiedRAGResponse | null>(null)
  
  const processDocuments = async (
    cloneId: string,
    cloneData: Parameters<typeof processCloneKnowledge>[1],
    authToken?: string
  ) => {
    try {
      setStatus('processing')
      setProgress(0)
      setError(null)
      
      // Start processing
      setProgress(25)
      
      const response = await processCloneKnowledge(cloneId, cloneData, authToken)
      
      setProgress(75)
      
      if (response.status === 'success') {
        setStatus('completed')
        setProgress(100)
        setResult(response)
      } else {
        throw new Error(response.error || 'Processing failed')
      }
      
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Unknown error')
      setProgress(0)
    }
  }
  
  const reset = () => {
    setStatus('idle')
    setProgress(0)
    setError(null)
    setResult(null)
  }
  
  return {
    status,
    progress,
    error,
    result,
    processDocuments,
    reset,
    isProcessing: status === 'processing',
    isCompleted: status === 'completed',
    hasError: status === 'error'
  }
}

import { useState } from 'react'