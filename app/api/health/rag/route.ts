/**
 * RAG Health Check API Route
 * Provides health status for RAG integration components
 */
import { NextRequest, NextResponse } from 'next/server'

interface RAGHealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  components: {
    frontend_api: {
      status: 'healthy' | 'unhealthy'
      endpoints: {
        process_knowledge: boolean
        retry_processing: boolean
        query: boolean
      }
    }
    backend_api: {
      status: 'healthy' | 'unhealthy'
      url: string
      reachable: boolean
    }
    authentication: {
      status: 'healthy' | 'unhealthy'
      token_validation: boolean
      supabase_integration: boolean
    }
    processing: {
      status: 'healthy' | 'degraded' | 'unhealthy'
      last_processing_attempt?: string
      common_errors: string[]
    }
  }
  issues: string[]
  suggestions: string[]
}

export async function GET(request: NextRequest): Promise<NextResponse<RAGHealthCheck>> {
  const healthCheck: RAGHealthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    components: {
      frontend_api: {
        status: 'healthy',
        endpoints: {
          process_knowledge: true,
          retry_processing: true,
          query: true
        }
      },
      backend_api: {
        status: 'healthy',
        url: process.env.BACKEND_URL || 'http://localhost:8000',
        reachable: false
      },
      authentication: {
        status: 'healthy',
        token_validation: true,
        supabase_integration: true
      },
      processing: {
        status: 'healthy',
        common_errors: []
      }
    },
    issues: [],
    suggestions: []
  }

  try {
    // Test backend connectivity
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000'
    
    try {
      const backendResponse = await fetch(`${backendUrl}/health`, {
        method: 'GET',
        timeout: 5000
      })
      
      if (backendResponse.ok) {
        healthCheck.components.backend_api.reachable = true
        healthCheck.components.backend_api.status = 'healthy'
      } else {
        healthCheck.components.backend_api.status = 'unhealthy'
        healthCheck.issues.push(`Backend API returned ${backendResponse.status}`)
        healthCheck.suggestions.push('Check backend server status and configuration')
      }
    } catch (backendError) {
      healthCheck.components.backend_api.status = 'unhealthy'
      healthCheck.components.backend_api.reachable = false
      healthCheck.issues.push(`Backend API unreachable: ${backendError instanceof Error ? backendError.message : 'Unknown error'}`)
      healthCheck.suggestions.push('Verify backend server is running and BACKEND_URL is correct')
    }

    // Check environment variables
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'BACKEND_URL'
    ]

    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar])
    
    if (missingEnvVars.length > 0) {
      healthCheck.components.authentication.status = 'unhealthy'
      healthCheck.issues.push(`Missing environment variables: ${missingEnvVars.join(', ')}`)
      healthCheck.suggestions.push('Set missing environment variables in .env.local')
    }

    // Test auth endpoints functionality
    try {
      // Test no-auth endpoint
      const noAuthResponse = await fetch(`${backendUrl}/api/v1/clones/test-no-auth`, {
        method: 'GET'
      })
      
      if (!noAuthResponse.ok) {
        healthCheck.components.frontend_api.endpoints.process_knowledge = false
        healthCheck.issues.push('Backend no-auth endpoint not accessible')
      }
    } catch (error) {
      healthCheck.components.authentication.token_validation = false
      healthCheck.issues.push('Cannot test authentication endpoints')
    }

    // Overall status determination
    if (healthCheck.issues.length === 0) {
      healthCheck.status = 'healthy'
    } else if (healthCheck.components.backend_api.status === 'unhealthy') {
      healthCheck.status = 'unhealthy'
    } else {
      healthCheck.status = 'degraded'
    }

    // Add general suggestions
    if (healthCheck.status !== 'healthy') {
      healthCheck.suggestions.push(
        'Check browser console for detailed error messages',
        'Verify authentication tokens are valid',
        'Try refreshing the page or logging out and back in'
      )
    }

  } catch (error) {
    console.error('RAG health check error:', error)
    healthCheck.status = 'unhealthy'
    healthCheck.issues.push(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  const responseStatus = healthCheck.status === 'healthy' ? 200 : 
                        healthCheck.status === 'degraded' ? 206 : 503

  return NextResponse.json(healthCheck, { status: responseStatus })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Extended health check with diagnostics
  try {
    const body = await request.json().catch(() => ({}))
    const { test_auth = false, test_processing = false } = body

    const diagnostics = {
      timestamp: new Date().toISOString(),
      tests_run: [],
      results: {}
    }

    if (test_auth) {
      // Test authentication flow
      const authHeader = request.headers.get('authorization')
      diagnostics.tests_run.push('auth_test')
      diagnostics.results.auth_test = {
        header_present: !!authHeader,
        format_valid: authHeader?.startsWith('Bearer ') || false,
        token_length: authHeader?.replace('Bearer ', '').length || 0
      }
    }

    if (test_processing) {
      // Test processing endpoints availability
      diagnostics.tests_run.push('processing_test')
      // Add processing-specific tests here
    }

    return NextResponse.json({
      status: 'diagnostic_complete',
      diagnostics
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Diagnostic test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}