import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function POST(request: NextRequest) {
  try {
    // Check for OpenAI API key at runtime
    const apiKey = process.env.OPENAI_API_KEY
    console.log('OpenAI API key check:', {
      hasKey: !!apiKey,
      keyPrefix: apiKey ? `${apiKey.substring(0, 7)}...` : 'none'
    })
    
    if (!apiKey) {
      console.error('OpenAI API key not found in environment variables')
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    // Initialize OpenAI client at runtime
    const openai = new OpenAI({
      apiKey: apiKey,
    })

    const { systemPrompt, userMessage, conversationHistory } = await request.json()

    if (!systemPrompt || !userMessage) {
      return NextResponse.json(
        { error: 'System prompt and user message are required' },
        { status: 400 }
      )
    }

    // Build the messages array for OpenAI
    const messages = [
      {
        role: 'system' as const,
        content: systemPrompt
      },
      // Add previous conversation history if provided
      ...(conversationHistory || []),
      {
        role: 'user' as const,
        content: userMessage
      }
    ]

    // Call OpenAI API with available model
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview', 
      messages,
      max_tokens: 4000, 
      temperature: 0.2,
    })

    const response = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response."

    return NextResponse.json({ response })

  } catch (error) {
    console.error('OpenAI API error:', error)
    
    if (error instanceof Error && error.message.includes('API key')) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to generate AI response' },
      { status: 500 }
    )
  }
}