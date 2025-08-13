import { NextResponse } from 'next/server'

export async function GET() {
  try {
    return NextResponse.json({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      message: 'API is working correctly'
    })
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'error',
        message: 'Health check failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST() {
  return GET() // Same response for POST
}