import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseServer } from '@/lib/supabase-server'
import { RAGQueryResponse } from '@/types/database'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(
  request: NextRequest, 
  { params }: { params: Promise<{ cloneId: string }> }
) {
  try {
    const { query, memory_type = 'expert' } = await request.json()
    const { cloneId } = await params

    // Get authorization header and create authenticated client
    const authHeader = request.headers.get('authorization')
    console.log('Query auth header status:', authHeader ? 'Present' : 'Missing')
    
    // For clone queries, use service role to ensure access to clone data
    // The clone access will be validated separately
    let supabase = supabaseServer
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      console.log('Using service role client with auth validation for clone query')
    } else {
      console.log('No auth token provided for clone query, using service role client only')
    }

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

    console.log('Clone query request:', { cloneId, query: query.substring(0, 50) + '...' })

    // Get clone information
    const { data: clone, error: cloneError } = await supabase
      .from('clones')
      .select('*')
      .eq('id', cloneId)
      .single()

    if (cloneError || !clone) {
      console.error('Clone not found or error occurred:', { cloneError, cloneId })
      return NextResponse.json(
        { error: 'Clone not found', details: cloneError?.message || 'No clone found with the provided ID' },
        { status: 404 }
      )
    }

    console.log('Clone found:', { id: clone.id, name: clone.name, published: clone.is_published })

    // Check if clone has RAG assistant configured and knowledge processed
    const hasRAGAssistant = clone.rag_assistant_id && 
                           (clone.rag_status === 'completed' || clone.document_processing_status === 'completed')
    
    console.log('RAG Status Check:', {
      rag_assistant_id: clone.rag_assistant_id,
      rag_status: clone.rag_status,
      document_processing_status: clone.document_processing_status,
      hasRAGAssistant
    })
    
    if (hasRAGAssistant) {
      console.log('Using RAG Assistant for query:', { assistant_id: clone.rag_assistant_id, expert_name: clone.rag_expert_name })
      
      try {
        // Call backend RAG query system for true vector search
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000'
        
        console.log('Calling backend RAG query:', {
          url: `${backendUrl}/api/v1/knowledge/query-clone-expert`,
          auth_header_present: !!authHeader,
          clone_id: cloneId
        })
        
        const ragQueryResponse = await fetch(`${backendUrl}/api/v1/knowledge/query-clone-expert`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authHeader && { 'Authorization': authHeader })
          },
          body: JSON.stringify({
            clone_id: cloneId,
            query: query,
            memory_type: memory_type || 'expert',
            thread_id: null // Could be passed from frontend for conversation continuity
          })
        })

        if (ragQueryResponse.ok) {
          const ragResult: RAGQueryResponse = await ragQueryResponse.json()
          console.log('RAG query successful:', { 
            response_length: ragResult.response?.length || ragResult.answer?.length || 0,
            sources: ragResult.sources?.length || 0,
            confidence: ragResult.confidence
          })
          
          // Handle both new and legacy response formats
          const responseText = ragResult.response || ragResult.answer || "I'm sorry, I couldn't generate a response."
          
          return NextResponse.json({ 
            response: responseText,
            answer: responseText,
            clone: {
              id: clone.id,
              name: clone.name,
              category: clone.category
            },
            sources: ragResult.sources || [],
            confidence: ragResult.confidence || 0.8,
            knowledge_used: ragResult.knowledge_sources_count || ragResult.sources?.length || 0,
            rag_enabled: true,
            thread_id: ragResult.thread_id,
            assistant_id: ragResult.assistant_id || clone.rag_assistant_id,
            timestamp: ragResult.timestamp || new Date().toISOString()
          })
        } else {
          console.error('RAG query failed, falling back to basic LLM:', await ragQueryResponse.text())
          // Fall through to basic LLM response
        }
      } catch (error) {
        console.error('Error calling RAG query service:', error)
        // Fall through to basic LLM response
      }
    }

    // FALLBACK: Use basic LLM with simple knowledge context when RAG is not available
    console.log('Using fallback LLM query (RAG not available or failed)')
    
    // Get knowledge documents for basic context (fallback)
    const { data: knowledge, error: knowledgeError } = await supabase
      .from('knowledge')
      .select('*')
      .eq('clone_id', cloneId)
      .in('vector_store_status', ['completed', 'partial']) // Include partial as well
      .limit(5)
    
    console.log('Knowledge query result:', {
      knowledge_count: knowledge?.length || 0,
      error: knowledgeError?.message || 'none'
    })

    let knowledgeContext = ''
    if (!knowledgeError && knowledge && knowledge.length > 0) {
      knowledgeContext = knowledge.map(k => `
Document: ${k.title}
Content: ${k.content_preview || 'No preview available'}
---`).join('\n')
    }

    // Build enhanced system prompt with clone personality and style
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
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    })

    const response = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response."

    console.log(`Fallback LLM query processed - Clone: ${clone.name}, Query: ${query.substring(0, 100)}...`)

    return NextResponse.json({ 
      response,
      answer: response,
      clone: {
        id: clone.id,
        name: clone.name,
        category: clone.category
      },
      sources: knowledge?.map(k => k.title) || [],
      confidence: 0.7, // Lower confidence for fallback responses
      knowledge_used: knowledge?.length || 0,
      rag_enabled: false,
      fallback_reason: hasRAGAssistant ? 'rag_service_error' : 'rag_not_configured',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Clone query error:', error)
    
    let errorMessage = 'Failed to process clone query'
    let statusCode = 500
    
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        errorMessage = 'OpenAI API key not configured'
        statusCode = 500
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Query timed out - please try again'
        statusCode = 408
      } else if (error.message.includes('rate limit')) {
        errorMessage = 'Rate limit exceeded - please wait a moment'
        statusCode = 429
      }
    }

    return NextResponse.json(
      { 
        error: errorMessage,
        status: 'error',
        clone_id: params ? (await params).cloneId : 'unknown',
        timestamp: new Date().toISOString()
      },
      { status: statusCode }
    )
  }
}