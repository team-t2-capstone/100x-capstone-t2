import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function POST(
  request: NextRequest, 
  { params }: { params: { cloneId: string } }
) {
  try {
    const body = await request.json()
    const { cloneId } = params

    console.log('RAG processing request received:', { cloneId, body })
    console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing')
    console.log('Supabase Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Missing')

    if (!cloneId) {
      return NextResponse.json(
        { error: 'Clone ID is required' },
        { status: 400 }
      )
    }

    // Verify clone exists with detailed debugging and retry logic
    console.log('Looking for clone with ID:', cloneId)
    
    let clone = null;
    let cloneError = null;
    let attempts = 0;
    const maxAttempts = 3;
    
    // Retry mechanism in case of database timing issues
    while (attempts < maxAttempts && !clone) {
      attempts++;
      console.log(`Attempt ${attempts} to find clone ${cloneId}`)
      
      const result = await supabaseServer
        .from('clones')
        .select('*')
        .eq('id', cloneId)
        .single()
      
      clone = result.data;
      cloneError = result.error;
      
      console.log(`Attempt ${attempts} result:`, { clone: !!clone, cloneError })
      
      if (!clone && attempts < maxAttempts) {
        // Wait 1 second before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('Final clone query result after retries:', { clone: !!clone, cloneError })

    if (cloneError || !clone) {
      console.error('Clone not found or error occurred:', { cloneError, cloneId })
      
      // Additional debugging - let's check if any clones exist
      const { data: allClones, error: allClonesError } = await supabaseServer
        .from('clones')
        .select('id, name')
        .limit(10)
      
      console.log('Available clones for debugging:', { allClones, allClonesError })
      
      return NextResponse.json(
        { 
          error: 'Clone not found',
          details: cloneError?.message || 'No clone found with the provided ID',
          cloneId: cloneId,
          availableClones: allClones?.map(c => ({ id: c.id, name: c.name })) || []
        },
        { status: 404 }
      )
    }

    // Get all knowledge entries for this clone
    const { data: knowledgeEntries, error: knowledgeError } = await supabaseServer
      .from('knowledge')
      .select('*')
      .eq('clone_id', cloneId)

    if (knowledgeError) {
      console.error('Error fetching knowledge entries:', knowledgeError)
      return NextResponse.json(
        { error: 'Failed to fetch knowledge entries' },
        { status: 500 }
      )
    }

    // Simulate RAG processing
    // In a real implementation, this would:
    // 1. Process documents with OpenAI/LlamaParse
    // 2. Generate embeddings
    // 3. Store in vector database
    // 4. Create OpenAI Assistant
    
    let processedCount = 0
    let failedCount = 0
    const processingErrors: string[] = []

    if (knowledgeEntries && knowledgeEntries.length > 0) {
      for (const entry of knowledgeEntries) {
        try {
          // Simulate processing time
          await new Promise(resolve => setTimeout(resolve, 100))
          
          // Update status to completed (in real implementation, this would happen after actual processing)
          const { error: updateError } = await supabaseServer
            .from('knowledge')
            .update({ 
              vector_store_status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', entry.id)

          if (updateError) {
            console.error(`Failed to update knowledge entry ${entry.id}:`, updateError)
            failedCount++
            processingErrors.push(`Failed to update ${entry.title}: ${updateError.message}`)
          } else {
            processedCount++
            console.log(`Processed knowledge entry: ${entry.title}`)
          }
        } catch (error) {
          console.error(`Error processing ${entry.title}:`, error)
          failedCount++
          processingErrors.push(`Failed to process ${entry.title}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    }

    // Also update any documents in the documents table
    const { data: documents, error: documentsError } = await supabaseServer
      .from('documents')
      .select('*')
      .eq('client_name', clone.name) // Assuming client_name matches clone name

    if (!documentsError && documents && documents.length > 0) {
      console.log(`Found ${documents.length} documents to process for clone ${clone.name}`)
      
      // In a real implementation, you would process these documents too
      // For now, we'll just log them
      documents.forEach(doc => {
        console.log(`Document available for processing: ${doc.name}`)
      })
    }

    const overallStatus = failedCount === 0 ? 'completed' : (processedCount > 0 ? 'partial' : 'failed')

    const response = {
      overall_status: overallStatus,
      processed_count: processedCount,
      failed_count: failedCount,
      total_entries: knowledgeEntries?.length || 0,
      processing_errors: processingErrors,
      message: `RAG processing ${overallStatus}. Processed ${processedCount} entries.`,
      clone_id: cloneId,
      clone_name: clone.name,
      timestamp: new Date().toISOString()
    }

    console.log('RAG processing completed:', response)

    return NextResponse.json(response)

  } catch (error) {
    console.error('RAG processing error:', error)
    
    // Handle JSON parsing errors
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      return NextResponse.json(
        { 
          error: 'Invalid JSON in request body',
          details: error.message,
          overall_status: 'failed',
          processed_count: 0,
          failed_count: 0,
          processing_errors: ['Invalid request format']
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Failed to process knowledge',
        details: error instanceof Error ? error.message : 'Unknown error',
        overall_status: 'failed',
        processed_count: 0,
        failed_count: 0,
        processing_errors: [error instanceof Error ? error.message : 'Unknown processing error']
      },
      { status: 500 }
    )
  }
}