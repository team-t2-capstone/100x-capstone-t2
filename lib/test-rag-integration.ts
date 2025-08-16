/**
 * RAG Integration Test Utilities
 * Comprehensive testing suite for debugging RAG workflow issues
 */

import { getAuthTokens } from './api-client'
import { checkRAGHealth } from './rag-health'

export interface RAGTestResults {
  healthCheck: any
  cloneData: any
  knowledgeData: any
  ragQuery: any
  errors: string[]
  suggestions: string[]
  overallStatus: 'healthy' | 'partial' | 'failed'
}

export class RAGIntegrationTester {
  private async getHeaders() {
    const { accessToken } = getAuthTokens()
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    }
  }

  /**
   * Test complete RAG integration for a clone
   */
  async testCloneRAGIntegration(cloneId: string): Promise<RAGTestResults> {
    const results: RAGTestResults = {
      healthCheck: null,
      cloneData: null,
      knowledgeData: null,
      ragQuery: null,
      errors: [],
      suggestions: [],
      overallStatus: 'failed'
    }

    console.log('🧪 Starting comprehensive RAG integration test for clone:', cloneId)

    // Step 1: Health Check
    try {
      console.log('📊 Checking RAG system health...')
      results.healthCheck = await checkRAGHealth()
      
      if (!results.healthCheck.isHealthy) {
        results.errors.push('RAG system health check failed')
        results.suggestions.push(...results.healthCheck.solutions)
      } else {
        console.log('✅ RAG system health check passed')
      }
    } catch (error) {
      results.errors.push(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Step 2: Check Clone Data
    try {
      console.log('👤 Checking clone data...')
      const response = await fetch(`/api/clones/${cloneId}`, {
        headers: await this.getHeaders()
      })

      if (response.ok) {
        results.cloneData = await response.json()
        console.log('✅ Clone data retrieved:', {
          name: results.cloneData.name,
          rag_assistant_id: results.cloneData.rag_assistant_id,
          rag_status: results.cloneData.rag_status,
          document_processing_status: results.cloneData.document_processing_status
        })

        // Check RAG configuration
        if (!results.cloneData.rag_assistant_id) {
          results.errors.push('Clone does not have RAG assistant configured')
          results.suggestions.push('Process knowledge documents for this clone')
        }

        if (results.cloneData.rag_status !== 'completed' && results.cloneData.document_processing_status !== 'completed') {
          results.errors.push('Clone knowledge processing is not completed')
          results.suggestions.push('Complete document processing or retry failed processing')
        }
      } else {
        results.errors.push(`Failed to fetch clone data: ${response.status}`)
      }
    } catch (error) {
      results.errors.push(`Clone data check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Step 3: Check Knowledge Base
    try {
      console.log('📚 Checking knowledge base...')
      const response = await fetch(`/api/knowledge/clones/${cloneId}/documents`, {
        headers: await this.getHeaders()
      })

      if (response.ok) {
        results.knowledgeData = await response.json()
        console.log('✅ Knowledge data retrieved:', {
          total_documents: results.knowledgeData.length,
          completed: results.knowledgeData.filter((doc: any) => doc.processing_status === 'completed').length,
          pending: results.knowledgeData.filter((doc: any) => doc.processing_status === 'pending').length,
          failed: results.knowledgeData.filter((doc: any) => doc.processing_status === 'failed').length
        })

        if (results.knowledgeData.length === 0) {
          results.errors.push('No knowledge documents found for clone')
          results.suggestions.push('Upload and process documents for this clone')
        }

        const completedDocs = results.knowledgeData.filter((doc: any) => doc.processing_status === 'completed').length
        if (completedDocs === 0) {
          results.errors.push('No completed knowledge documents found')
          results.suggestions.push('Process uploaded documents or retry failed processing')
        }
      } else {
        results.errors.push(`Failed to fetch knowledge data: ${response.status}`)
      }
    } catch (error) {
      results.errors.push(`Knowledge check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Step 4: Test RAG Query
    if (results.cloneData?.rag_assistant_id || results.knowledgeData?.length > 0) {
      try {
        console.log('💬 Testing RAG query...')
        const testQuery = "What can you tell me about yourself?"
        
        const response = await fetch(`/api/clones/${cloneId}/query`, {
          method: 'POST',
          headers: await this.getHeaders(),
          body: JSON.stringify({
            query: testQuery,
            memory_type: 'expert'
          })
        })

        if (response.ok) {
          results.ragQuery = await response.json()
          console.log('✅ RAG query successful:', {
            response_length: results.ragQuery.response?.length || 0,
            rag_enabled: results.ragQuery.rag_enabled,
            knowledge_used: results.ragQuery.knowledge_used,
            fallback_reason: results.ragQuery.fallback_reason
          })

          if (!results.ragQuery.rag_enabled) {
            results.errors.push('RAG query fell back to basic LLM mode')
            results.suggestions.push(`Fallback reason: ${results.ragQuery.fallback_reason || 'Unknown'}`)
          }
        } else {
          const errorData = await response.text()
          results.errors.push(`RAG query failed: ${response.status} - ${errorData}`)
        }
      } catch (error) {
        results.errors.push(`RAG query test failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    } else {
      results.errors.push('Cannot test RAG query - no assistant ID or knowledge data')
    }

    // Determine overall status
    if (results.errors.length === 0) {
      results.overallStatus = 'healthy'
    } else if (results.healthCheck?.isHealthy && (results.cloneData || results.knowledgeData)) {
      results.overallStatus = 'partial'
    } else {
      results.overallStatus = 'failed'
    }

    console.log('🏁 RAG integration test completed:', {
      status: results.overallStatus,
      errors: results.errors.length,
      suggestions: results.suggestions.length
    })

    return results
  }

  /**
   * Test backend RAG health directly
   */
  async testBackendRAGHealth(): Promise<any> {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      const response = await fetch(`${backendUrl}/api/v1/rag-health-check`, {
        headers: await this.getHeaders()
      })

      if (response.ok) {
        return await response.json()
      } else {
        throw new Error(`Backend health check failed: ${response.status}`)
      }
    } catch (error) {
      console.error('Backend RAG health check failed:', error)
      throw error
    }
  }

  /**
   * Test knowledge processing status
   */
  async testKnowledgeProcessingStatus(cloneId: string): Promise<any> {
    try {
      const response = await fetch(`/api/clones/${cloneId}/process-knowledge`, {
        method: 'GET',
        headers: await this.getHeaders()
      })

      return response.ok ? await response.json() : null
    } catch (error) {
      console.error('Knowledge processing status check failed:', error)
      return null
    }
  }

  /**
   * Generate comprehensive diagnostic report
   */
  generateDiagnosticReport(results: RAGTestResults): string {
    const report = [
      '# RAG Integration Diagnostic Report',
      `Generated at: ${new Date().toISOString()}`,
      '',
      '## Overall Status',
      `Status: ${results.overallStatus.toUpperCase()}`,
      '',
      '## Health Check',
      results.healthCheck ? 
        `- RAG Ready: ${results.healthCheck.isHealthy ? '✅' : '❌'}` +
        `\n- OpenAI Configured: ${results.healthCheck.openaiConfigured ? '✅' : '❌'}` +
        `\n- Supabase Configured: ${results.healthCheck.supabaseConfigured ? '✅' : '❌'}` :
        '❌ Health check failed',
      '',
      '## Clone Configuration',
      results.cloneData ?
        `- Name: ${results.cloneData.name}` +
        `\n- RAG Assistant ID: ${results.cloneData.rag_assistant_id ? '✅' : '❌'}` +
        `\n- RAG Status: ${results.cloneData.rag_status || 'none'}` +
        `\n- Processing Status: ${results.cloneData.document_processing_status || 'none'}` :
        '❌ Clone data not available',
      '',
      '## Knowledge Base',
      results.knowledgeData ?
        `- Total Documents: ${results.knowledgeData.length}` +
        `\n- Completed: ${results.knowledgeData.filter((doc: any) => doc.processing_status === 'completed').length}` +
        `\n- Pending: ${results.knowledgeData.filter((doc: any) => doc.processing_status === 'pending').length}` +
        `\n- Failed: ${results.knowledgeData.filter((doc: any) => doc.processing_status === 'failed').length}` :
        '❌ Knowledge data not available',
      '',
      '## RAG Query Test',
      results.ragQuery ?
        `- Query Successful: ${results.ragQuery.response ? '✅' : '❌'}` +
        `\n- RAG Enabled: ${results.ragQuery.rag_enabled ? '✅' : '❌'}` +
        `\n- Knowledge Used: ${results.ragQuery.knowledge_used || 0}` +
        `\n- Fallback Reason: ${results.ragQuery.fallback_reason || 'none'}` :
        '❌ RAG query not tested',
      '',
      '## Issues Found',
      results.errors.length > 0 ?
        results.errors.map(error => `- ❌ ${error}`).join('\n') :
        '✅ No issues found',
      '',
      '## Suggested Actions',
      results.suggestions.length > 0 ?
        results.suggestions.map(suggestion => `- 💡 ${suggestion}`).join('\n') :
        '✅ No actions needed'
    ]

    return report.join('\n')
  }
}

// Export singleton instance
export const ragTester = new RAGIntegrationTester()

// Convenience functions
export const testCloneRAG = (cloneId: string) => ragTester.testCloneRAGIntegration(cloneId)
export const testBackendRAGHealth = () => ragTester.testBackendRAGHealth()
export const generateRAGReport = (results: RAGTestResults) => ragTester.generateDiagnosticReport(results)