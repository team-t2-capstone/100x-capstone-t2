import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(
  request: NextRequest, 
  { params }: { params: { cloneId: string } }
) {
  try {
    const { query, memory_type = 'expert' } = await request.json()
    const { cloneId } = params

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    if (!cloneId) {
      return NextResponse.json(
        { error: 'Clone ID is required' },
        { status: 400 }
      )
    }

    // Get clone information
    const { data: clone, error: cloneError } = await supabaseServer
      .from('clones')
      .select('*')
      .eq('id', cloneId)
      .single()

    if (cloneError || !clone) {
      return NextResponse.json(
        { error: 'Clone not found' },
        { status: 404 }
      )
    }

    // Get knowledge documents for context
    const { data: knowledge, error: knowledgeError } = await supabaseServer
      .from('knowledge')
      .select('*')
      .eq('clone_id', cloneId)
      .eq('vector_store_status', 'completed')
      .limit(5) // Limit to top 5 most relevant documents

    let knowledgeContext = ''
    if (!knowledgeError && knowledge && knowledge.length > 0) {
      knowledgeContext = knowledge.map(k => `
Document: ${k.title}
Content: ${k.content_preview || 'No preview available'}
---`).join('\n')
    }

    // Build system prompt based on clone information
    const systemPrompt = `You are ${clone.name}, an AI clone specializing in ${clone.category}.

Bio: ${clone.bio || 'No bio provided'}

Expertise Areas: ${clone.expertise_areas?.join(', ') || 'General knowledge'}

Personality Traits: ${JSON.stringify(clone.personality_traits || {}, null, 2)}

Communication Style: ${JSON.stringify(clone.communication_style || {}, null, 2)}

${knowledgeContext ? `
KNOWLEDGE BASE CONTEXT:
${knowledgeContext}

When answering questions, prioritize information from the knowledge base above when relevant.
` : ''}

Respond as this clone character, maintaining the personality and expertise described above. Be helpful, accurate, and stay in character.`

    // Generate response using OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Use available model
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    })

    const response = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response."

    // Log usage for analytics
    console.log(`Clone query processed - Clone: ${clone.name}, Query: ${query.substring(0, 100)}...`)

    return NextResponse.json({ 
      response,
      clone: {
        id: clone.id,
        name: clone.name,
        category: clone.category
      },
      knowledge_used: knowledge?.length || 0
    })

  } catch (error) {
    console.error('Clone query error:', error)
    
    if (error instanceof Error && error.message.includes('API key')) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to process clone query' },
      { status: 500 }
    )
  }
}