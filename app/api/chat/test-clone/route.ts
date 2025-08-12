import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
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

    // Call OpenAI API with GPT-5 (latest flagship model)
    const completion = await openai.chat.completions.create({
      model: 'gpt-5', // Use GPT-5 for best performance and quality
      messages,
      max_tokens: 1000, // Increased for better responses
      temperature: 0.7,
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