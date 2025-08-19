/**
 * RAG Health Monitoring
 * Provides health checks and diagnostics for RAG integration
 */

export interface RAGHealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  backend_reachable: boolean
  auth_working: boolean
  processing_available: boolean
  last_check: string
  issues: string[]
  suggestions: string[]
}

export interface ProcessingDiagnostics {
  clone_id?: string
  processing_status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial'
  last_attempt?: string
  retry_count: number
  common_errors: string[]
  auth_errors: number
  validation_errors: number
  timeout_errors: number
}

class RAGHealthChecker {
  private lastCheck: Date | null = null
  private cachedStatus: RAGHealthStatus | null = null
  private readonly CACHE_DURATION = 30000 // 30 seconds

  async checkHealth(): Promise<RAGHealthStatus> {
    try {
      // Return cached result if recent
      if (this.cachedStatus && this.lastCheck && 
          Date.now() - this.lastCheck.getTime() < this.CACHE_DURATION) {
        return this.cachedStatus
      }
    } catch (cacheError) {
      console.warn('Cache check failed:', cacheError)
    }

    const status: RAGHealthStatus = {
      overall: 'healthy',
      timestamp: new Date().toISOString(),
      backend_reachable: false,
      auth_working: false,
      processing_available: false,
      last_check: new Date().toISOString(),
      issues: [],
      suggestions: []
    }

    try {
      // Check backend health via NextJS API
      const healthResponse = await fetch('/api/health/rag', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (healthResponse.ok) {
        const healthData = await healthResponse.json()
        status.backend_reachable = healthData.components?.backend_api?.reachable || false
        status.auth_working = healthData.components?.authentication?.status === 'healthy'
        status.processing_available = healthData.components?.frontend_api?.status === 'healthy'
        
        if (healthData.issues) {
          status.issues.push(...healthData.issues)
        }
        
        if (healthData.suggestions) {
          status.suggestions.push(...healthData.suggestions)
        }

        status.overall = healthData.status
      } else {
        status.overall = 'unhealthy'
        status.issues.push(`Health check endpoint returned ${healthResponse.status}`)
        status.suggestions.push('Check server configuration and try refreshing')
      }

    } catch (error) {
      console.error('RAG health check failed:', error)
      status.overall = 'unhealthy'
      status.issues.push(`Health check failed: ${error instanceof Error ? error.message : 'Network error'}`)
      status.suggestions.push(
        'Check internet connection',
        'Verify server is running',
        'Try refreshing the page'
      )
    }

    // Cache the result
    this.cachedStatus = status
    this.lastCheck = new Date()

    return status
  }

  async diagnoseProcessingIssues(cloneId?: string): Promise<ProcessingDiagnostics> {
    const diagnostics: ProcessingDiagnostics = {
      clone_id: cloneId,
      processing_status: 'pending',
      retry_count: 0,
      common_errors: [],
      auth_errors: 0,
      validation_errors: 0,
      timeout_errors: 0
    }

    try {
      // Get processing history from local storage or session
      const processingHistory = this.getProcessingHistory(cloneId)
      
      if (processingHistory) {
        diagnostics.processing_status = processingHistory.status
        diagnostics.last_attempt = processingHistory.last_attempt
        diagnostics.retry_count = processingHistory.retry_count || 0
        diagnostics.common_errors = processingHistory.errors || []
        
        // Categorize errors
        diagnostics.common_errors.forEach(error => {
          if (error.includes('auth') || error.includes('403') || error.includes('401')) {
            diagnostics.auth_errors++
          } else if (error.includes('validation') || error.includes('400')) {
            diagnostics.validation_errors++
          } else if (error.includes('timeout') || error.includes('408')) {
            diagnostics.timeout_errors++
          }
        })
      }

      // Test processing endpoint availability
      if (cloneId) {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout
          
          const testResponse = await fetch(`/api/clones/${cloneId}/process-knowledge`, {
            method: 'HEAD', // Just check if endpoint exists
            signal: controller.signal
          })
          
          clearTimeout(timeoutId)
          
          if (testResponse.status === 405) {
            // Method not allowed is expected for HEAD, means endpoint exists
            diagnostics.processing_status = 'pending'
          }
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            diagnostics.common_errors.push('Endpoint test timed out')
          } else {
            diagnostics.common_errors.push(`Endpoint test failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
          }
        }
      }

    } catch (error) {
      console.error('Processing diagnostics failed:', error)
      diagnostics.common_errors.push(`Diagnostics failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return diagnostics
  }

  private getProcessingHistory(cloneId?: string): any {
    try {
      if (!cloneId) return null
      
      const historyKey = `rag_processing_${cloneId}`
      const history = localStorage.getItem(historyKey)
      return history ? JSON.parse(history) : null
    } catch (error) {
      console.warn('Failed to get processing history:', error)
      return null
    }
  }

  saveProcessingHistory(cloneId: string, status: string, errors: string[] = []): void {
    try {
      const historyKey = `rag_processing_${cloneId}`
      const history = {
        status,
        last_attempt: new Date().toISOString(),
        retry_count: (this.getProcessingHistory(cloneId)?.retry_count || 0) + (status === 'failed' ? 1 : 0),
        errors: [...(this.getProcessingHistory(cloneId)?.errors || []), ...errors].slice(-10) // Keep last 10 errors
      }
      
      localStorage.setItem(historyKey, JSON.stringify(history))
    } catch (error) {
      console.warn('Failed to save processing history:', error)
    }
  }

  clearProcessingHistory(cloneId: string): void {
    try {
      const historyKey = `rag_processing_${cloneId}`
      localStorage.removeItem(historyKey)
    } catch (error) {
      console.warn('Failed to clear processing history:', error)
    }
  }

  getHealthSummary(status: RAGHealthStatus): string {
    switch (status.overall) {
      case 'healthy':
        return '✅ All systems operational'
      case 'degraded':
        return '⚠️ Some issues detected - functionality may be limited'
      case 'unhealthy':
        return '❌ System issues detected - processing may fail'
      default:
        return '❓ Unknown status'
    }
  }

  getRecommendations(status: RAGHealthStatus): string[] {
    const recommendations: string[] = []

    if (!status.backend_reachable) {
      recommendations.push('🔌 Backend server is not reachable - check server status')
    }

    if (!status.auth_working) {
      recommendations.push('🔐 Authentication issues detected - try logging out and back in')
    }

    if (!status.processing_available) {
      recommendations.push('⚙️ Processing endpoints unavailable - contact support if this persists')
    }

    if (status.issues.length > 0) {
      recommendations.push('📋 Check the issues list for specific problems')
    }

    if (recommendations.length === 0) {
      recommendations.push('🎉 Everything looks good! You can proceed with processing.')
    }

    return recommendations
  }
}

// Export singleton instance
export const ragHealthChecker = new RAGHealthChecker()

// Convenience functions
export const checkRAGHealth = () => ragHealthChecker.checkHealth()
export const diagnoseProcessing = (cloneId?: string) => ragHealthChecker.diagnoseProcessingIssues(cloneId)
export const saveProcessingHistory = (cloneId: string, status: string, errors?: string[]) => 
  ragHealthChecker.saveProcessingHistory(cloneId, status, errors)
export const clearProcessingHistory = (cloneId: string) => ragHealthChecker.clearProcessingHistory(cloneId)
export const getHealthSummary = (status: RAGHealthStatus) => ragHealthChecker.getHealthSummary(status)
export const getRecommendations = (status: RAGHealthStatus) => ragHealthChecker.getRecommendations(status)