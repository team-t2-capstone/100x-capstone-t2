import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function POST(request: NextRequest) {
  console.log('=== test-clone API route called ===');
  console.log('Request URL:', request.url);
  console.log('Request method:', request.method);
  
  try {
    const { systemPrompt, userMessage, conversationHistory, cloneId } = await request.json()

    if (!systemPrompt || !userMessage) {
      return NextResponse.json(
        { error: 'System prompt and user message are required' },
        { status: 400 }
      )
    }

    console.log('Processing request:', { cloneId, userMessage: userMessage.substring(0, 100) + '...' });

    let response: string = '';

    // First, try RAG if cloneId is provided
    if (cloneId) {
      try {
        console.log('Attempting RAG query first...');
        
        // Call our RAG endpoint
        const ragResponse = await fetch('http://localhost:8000/api/query_expert_with_assistant', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: userMessage,
            expert_name: cloneId,
            memory_type: 'expert',
            thread_id: null
          })
        });

        if (ragResponse.ok) {
          const ragData = await ragResponse.json();
          console.log('RAG response received:', { hasResponse: !!ragData.response });
          
          // Handle nested response format
          let ragResponseContent = '';
          if (typeof ragData.response === 'object' && ragData.response.text) {
            ragResponseContent = ragData.response.text;
          } else if (typeof ragData.response === 'string') {
            ragResponseContent = ragData.response;
          }
          
          if (ragResponseContent && ragResponseContent.trim().length > 0) {
            response = ragResponseContent;
            console.log('Using RAG response');
            return NextResponse.json({ 
              response, 
              source: 'rag',
              thread_id: ragData.thread_id 
            });
          }
        } else {
          console.log('RAG endpoint failed:', ragResponse.status, await ragResponse.text());
        }
      } catch (ragError) {
        console.log('RAG query failed, falling back to LLM:', ragError);
      }
    }

    // Fallback to normalized LLM if RAG failed or no cloneId
    console.log('Falling back to normalized LLM...');
    
    // Check for OpenAI API key at runtime
    const apiKey = process.env.OPENAI_API_KEY
    console.log('OpenAI API key check:', {
      hasKey: !!apiKey,
      keyPrefix: apiKey ? `${apiKey.substring(0, 7)}...` : 'none',
      keyLength: apiKey ? apiKey.length : 0,
      envNodeEnv: process.env.NODE_ENV,
      allEnvKeys: Object.keys(process.env).filter(k => k.includes('OPENAI')).join(', ')
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

    response = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response."
    console.log('Using normalized LLM response');
    
    return NextResponse.json({ 
      response, 
      source: 'llm' 
    });

  } catch (error) {
    console.error('API error:', error)
    
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