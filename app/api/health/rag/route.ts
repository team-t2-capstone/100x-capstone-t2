import { NextRequest, NextResponse } from 'next/server'
import { RAGHealthCheckResponse } from '@/types/database'

export async function GET(request: NextRequest) {
  try {
    console.log('RAG health check requested')
    
    // Get authorization header for backend API calls
    const authHeader = request.headers.get('authorization')
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000'
    
    console.log('Calling backend health check:', `${backendUrl}/api/v1/rag-health-check`)
    
    // Call backend health check endpoint
    const response = await fetch(`${backendUrl}/api/v1/rag-health-check`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { 'Authorization': authHeader })
      }
    })
    
    let healthData: RAGHealthCheckResponse
    
    if (response.ok) {
      healthData = await response.json()
      console.log('Backend health check response:', {
        rag_ready: healthData.rag_ready,
        status: healthData.status,
        issues: healthData.issues?.length || 0
      })
    } else {
      const errorText = await response.text()
      console.error('Backend health check failed:', {
        status: response.status,
        error: errorText
      })
      
      healthData = {
        rag_ready: false,
        status: 'error',
        message: 'Backend health check failed',
        issues: [`Backend returned ${response.status}`, errorText || 'Unknown error'],
        solutions: ['Check backend service status', 'Verify API endpoint configuration'],
        timestamp: new Date().toISOString()
      }
    }
    
    return NextResponse.json(healthData)
    
  } catch (error) {
    console.error('Health check error:', error)
    
    const errorResponse: RAGHealthCheckResponse = {
      rag_ready: false,
      status: 'error',
      message: 'Health check failed',
      issues: [error instanceof Error ? error.message : 'Unknown error'],
      solutions: ['Check network connectivity', 'Verify backend URL configuration'],
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }
    
    return NextResponse.json(errorResponse, { status: 503 })
  }
}