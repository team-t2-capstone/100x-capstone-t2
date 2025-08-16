import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// Types for enhanced error handling
interface RetryProcessingError {
  type: 'connection' | 'auth' | 'processing' | 'validation' | 'timeout'
  message: string
  details?: string
  retryable: boolean
}

interface RetryResult {
  status: 'success' | 'failed' | 'in_progress'
  message: string
  clone_id: string
  retry_count?: number
  estimated_completion?: string
  error_type?: string
  retryable?: boolean
}

// Error handling utilities
function createRetryError(type: RetryProcessingError['type'], message: string, details?: string): RetryProcessingError {
  const retryableTypes: RetryProcessingError['type'][] = ['connection', 'timeout', 'processing']
  return {
    type,
    message,
    details,
    retryable: retryableTypes.includes(type)
  }
}

function getUserFriendlyRetryMessage(error: RetryProcessingError): string {
  switch (error.type) {
    case 'connection':
      return 'Unable to connect to processing service. Please check your connection and try again.'
    case 'auth':
      return 'Authentication failed. Please refresh the page and try again.'
    case 'processing':
      return 'Processing service is currently busy. Please try again in a few minutes.'
    case 'validation':
      return 'Invalid retry request. Please refresh the page.'
    case 'timeout':
      return 'Retry request timed out. The service may be busy - please try again later.'
    default:
      return error.message
  }
}

export async function POST(
  request: NextRequest, 
  { params }: { params: Promise<{ cloneId: string }> }
) {
  try {
    const { cloneId } = await params

    console.log('Retry processing request received for clone:', cloneId)

    // Get authorization header and create authenticated client
    const authHeader = request.headers.get('authorization')
    console.log('Retry processing auth header status:', authHeader ? 'Present' : 'Missing')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Invalid or missing authorization header for retry processing')
      return NextResponse.json(
        { 
          error: 'Valid authorization header required',
          status: 'failed',
          message: 'Authentication required for retry processing',
          clone_id: cloneId,
          error_type: 'auth',
          retryable: false
        },
        { status: 401 }
      )
    }

    if (!cloneId) {
      return NextResponse.json(
        { error: 'Clone ID is required' },
        { status: 400 }
      )
    }

    // Call the backend retry endpoint with timeout handling
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000'
    const retryTimeout = 120000 // 2 minutes timeout for retry requests
    
    console.log(`Starting retry processing for clone ${cloneId} with ${retryTimeout}ms timeout`)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), retryTimeout)
    
    console.log('Sending retry request to backend:', {
      url: `${backendUrl}/api/v1/clones/${cloneId}/retry-processing`,
      auth_header_present: !!authHeader
    })
    
    const retryResponse = await fetch(`${backendUrl}/api/v1/clones/${cloneId}/retry-processing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({}), // Send empty body to ensure proper request format
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)

    const responseText = await retryResponse.text()
    console.log('Retry processing response:', retryResponse.status, responseText)

    if (!retryResponse.ok) {
      let errorData
      let retryError: RetryProcessingError
      
      try {
        errorData = JSON.parse(responseText)
      } catch {
        errorData = { detail: responseText }
      }
      
      // Categorize the error based on status code and message
      if (retryResponse.status === 401 || retryResponse.status === 403) {
        retryError = createRetryError('auth', 'Authentication failed', errorData.detail)
      } else if (retryResponse.status === 400) {
        retryError = createRetryError('validation', 'Invalid retry request', errorData.detail)
      } else if (retryResponse.status >= 500) {
        retryError = createRetryError('processing', 'Processing service error', errorData.detail)
      } else {
        retryError = createRetryError('processing', errorData.detail || 'Retry processing failed')
      }
      
      console.error('Retry processing failed:', {
        status: retryResponse.status,
        error: retryError.message,
        type: retryError.type
      })
      
      const errorResponse: RetryResult = {
        status: 'failed',
        message: getUserFriendlyRetryMessage(retryError),
        clone_id: cloneId,
        error_type: retryError.type,
        retryable: retryError.retryable
      }
      
      return NextResponse.json(
        errorResponse,
        { status: retryResponse.status }
      )
    }

    let result
    try {
      result = JSON.parse(responseText)
    } catch {
      const parseError = createRetryError('processing', 'Invalid response from backend', 'Failed to parse backend response')
      return NextResponse.json(
        {
          status: 'failed',
          message: getUserFriendlyRetryMessage(parseError),
          clone_id: cloneId,
          error_type: parseError.type,
          retryable: parseError.retryable
        },
        { status: 502 }
      )
    }

    // Enhance the result with user-friendly messaging
    const enhancedResult: RetryResult = {
      ...result,
      clone_id: cloneId,
      message: result.status === 'success' 
        ? 'Processing retry initiated successfully. Your documents are being reprocessed.'
        : result.status === 'in_progress'
        ? 'Processing is currently in progress. Please check back in a few minutes.'
        : result.message || 'Retry processing completed'
    }

    console.log('Retry processing completed:', {
      status: enhancedResult.status,
      clone_id: cloneId,
      retry_count: enhancedResult.retry_count
    })
    
    return NextResponse.json(enhancedResult)

  } catch (error) {
    let retryError: RetryProcessingError
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        retryError = createRetryError('timeout', 'Retry request timed out', 'The retry request took too long to complete')
        console.error('Retry processing timed out after 2 minutes')
      } else if (error.message.includes('fetch') || error.message.includes('network')) {
        retryError = createRetryError('connection', 'Network error', error.message)
        console.error('Network error during retry processing:', error)
      } else {
        retryError = createRetryError('processing', error.message, error.stack)
        console.error('Retry processing error:', error)
      }
    } else {
      retryError = createRetryError('processing', 'Unknown error occurred', String(error))
      console.error('Unknown retry processing error:', error)
    }
    
    const errorResponse: RetryResult = {
      status: 'failed',
      message: getUserFriendlyRetryMessage(retryError),
      clone_id: cloneId || 'unknown',
      error_type: retryError.type,
      retryable: retryError.retryable
    }

    return NextResponse.json(
      errorResponse,
      { status: retryError.type === 'auth' ? 401 : retryError.type === 'timeout' ? 408 : 503 }
    )
  }
}