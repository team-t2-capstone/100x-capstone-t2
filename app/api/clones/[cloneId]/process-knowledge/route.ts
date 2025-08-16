import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseServer } from '@/lib/supabase-server'

// Types for better error handling
interface ProcessingError {
  type: 'connection' | 'auth' | 'processing' | 'validation' | 'timeout'
  message: string
  details?: string
  retryable: boolean
}

interface ProcessingResult {
  overall_status: 'completed' | 'partial' | 'failed' | 'timeout'
  processed_count: number
  failed_count: number
  total_entries: number
  processing_errors: string[]
  message: string
  clone_id: string
  clone_name: string
  timestamp: string
  rag_assistant_id?: string
  estimated_completion_time?: string
}

// Enhanced error handling utilities
function createProcessingError(type: ProcessingError['type'], message: string, details?: string): ProcessingError {
  const retryableTypes: ProcessingError['type'][] = ['connection', 'timeout', 'processing']
  return {
    type,
    message,
    details,
    retryable: retryableTypes.includes(type)
  }
}

function getUserFriendlyErrorMessage(error: ProcessingError): string {
  switch (error.type) {
    case 'connection':
      return 'Unable to connect to processing service. Please check your internet connection and try again.'
    case 'auth':
      return 'Authentication failed. Please log out and log back in.'
    case 'processing':
      return 'Document processing encountered an issue. This is usually temporary - please retry.'
    case 'validation':
      return 'Invalid request data. Please refresh the page and try again.'
    case 'timeout':
      return 'Processing is taking longer than expected. You can check the status later or retry.'
    default:
      return error.message
  }
}

// Progressive backoff utility
function getBackoffDelay(attempt: number): number {
  // Exponential backoff: 1s, 2s, 4s with jitter
  const baseDelay = Math.pow(2, attempt - 1) * 1000
  const jitter = Math.random() * 500 // Add up to 500ms jitter
  return Math.min(baseDelay + jitter, 10000) // Cap at 10 seconds
}

export async function POST(
  request: NextRequest, 
  { params }: { params: Promise<{ cloneId: string }> }
) {
  let cloneId: string = 'unknown' // Initialize with default value
  const processingTimeout = 300000 // 5 minutes timeout for RAG processing - define at function scope
  
  try {
    const body = await request.json()
    const resolvedParams = await params
    cloneId = resolvedParams.cloneId

    console.log('RAG processing request received:', { cloneId, body })
    console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing')
    console.log('Supabase Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Missing')

    // Get authorization header for backend API calls
    const authHeader = request.headers.get('authorization')
    
    // For RAG processing (administrative operation), use service role to bypass RLS
    // This ensures consistent behavior with the backend service
    const supabase = supabaseServer
    console.log('Using service role client for RAG administrative operations')

    if (!cloneId) {
      return NextResponse.json(
        { error: 'Clone ID is required' },
        { status: 400 }
      )
    }

    // Verify clone exists with enhanced retry logic and progressive backoff
    console.log('Looking for clone with ID:', cloneId)
    
    let clone = null;
    let cloneError = null;
    let attempts = 0;
    const maxAttempts = 3;
    
    // Enhanced retry mechanism with progressive backoff
    while (attempts < maxAttempts && !clone) {
      attempts++;
      console.log(`Attempt ${attempts}/${maxAttempts} to find clone ${cloneId}`)
      
      try {
        const result = await supabase
          .from('clones')
          .select('*')
          .eq('id', cloneId)
          .single()
        
        clone = result.data;
        cloneError = result.error;
        
        console.log(`Attempt ${attempts} result:`, { 
          found: !!clone, 
          error: cloneError?.message || 'none',
          errorCode: cloneError?.code || 'none'
        })
        
        if (!clone && attempts < maxAttempts) {
          const delay = getBackoffDelay(attempts)
          console.log(`Waiting ${delay}ms before retry ${attempts + 1}...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      } catch (error) {
        console.error(`Attempt ${attempts} failed with exception:`, error)
        cloneError = error as any
        
        if (attempts < maxAttempts) {
          const delay = getBackoffDelay(attempts)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    console.log('Final clone query result after retries:', { clone: !!clone, cloneError })

    if (cloneError || !clone) {
      console.error('Clone not found or error occurred:', { cloneError, cloneId, attempts })
      
      // Determine error type for better user feedback
      const processingError = cloneError?.code === 'PGRST116' 
        ? createProcessingError('validation', 'Clone not found', `Clone ID ${cloneId} does not exist`)
        : cloneError?.message?.includes('timeout')
        ? createProcessingError('timeout', 'Database timeout', 'Database query took too long')
        : cloneError?.message?.includes('connection')
        ? createProcessingError('connection', 'Database connection failed', cloneError.message)
        : createProcessingError('processing', 'Failed to retrieve clone', cloneError?.message)
      
      // Additional debugging - let's check if any clones exist
      try {
        const { data: allClones, error: allClonesError } = await supabase
          .from('clones')
          .select('id, name')
          .limit(5) // Reduced limit for debugging
        
        console.log('Available clones for debugging:', { 
          count: allClones?.length || 0, 
          error: allClonesError?.message || 'none' 
        })
      } catch (debugError) {
        console.error('Failed to get debug clone list:', debugError)
      }
      
      return NextResponse.json(
        { 
          status: 'error',
          error: getUserFriendlyErrorMessage(processingError),
          type: processingError.type,
          retryable: processingError.retryable,
          details: processingError.details,
          clone_id: cloneId,
          attempts_made: attempts,
          overall_status: 'failed',
          message: getUserFriendlyErrorMessage(processingError)
        },
        { status: processingError.type === 'validation' ? 400 : 503 }
      )
    }

    // Get all knowledge entries for this clone
    const { data: knowledgeEntries, error: knowledgeError } = await supabase
      .from('knowledge')
      .select('*')
      .eq('clone_id', cloneId)

    if (knowledgeError) {
      console.error('Error fetching knowledge entries:', knowledgeError)
      const processingError = createProcessingError('processing', 'Failed to fetch knowledge entries', knowledgeError.message)
      
      return NextResponse.json(
        { 
          status: 'error',
          error: getUserFriendlyErrorMessage(processingError),
          type: processingError.type,
          retryable: processingError.retryable,
          details: processingError.details,
          overall_status: 'failed',
          clone_id: cloneId,
          message: getUserFriendlyErrorMessage(processingError)
        },
        { status: 503 }
      )
    }

    // REAL RAG PROCESSING: Process documents with OpenAI vector stores and embeddings
    let processedCount = 0
    let failedCount = 0
    const processingErrors: string[] = []

    if (knowledgeEntries && knowledgeEntries.length > 0) {
      console.log(`Starting RAG processing for ${knowledgeEntries.length} knowledge entries`)

      // Collect document URLs for batch processing
      const documentUrls: Record<string, string> = {}
      
      for (const entry of knowledgeEntries) {
        if (entry.file_url) {
          documentUrls[entry.title] = entry.file_url
        } else if (entry.original_url) {
          documentUrls[entry.title] = entry.original_url
        }
      }

      console.log(`Found ${Object.keys(documentUrls).length} documents to process:`, Object.keys(documentUrls))

      if (Object.keys(documentUrls).length > 0) {
        try {
          // Call the backend RAG processing service with enhanced timeout and error handling
          const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000'
          
          console.log(`Starting RAG processing for ${Object.keys(documentUrls).length} documents with ${processingTimeout}ms timeout`)
          
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), processingTimeout)
          
          // Prepare the request body with documents and links data
          const documentsData = knowledgeEntries.map(entry => ({
            name: entry.title,
            url: entry.file_url || entry.original_url || '',
            content_type: entry.content_type || 'document'
          })).filter(doc => doc.url) // Only include entries with URLs
          
          const requestBody = {
            documents: documentsData,
            links: [] // TODO: Add support for links if needed
          }
          
          console.log('Sending RAG processing request:', { clone_id: cloneId, documents_count: documentsData.length })
          
          const ragProcessResponse = await fetch(`${backendUrl}/api/v1/clones/${cloneId}/process-knowledge`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader || ''
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
          })
          
          clearTimeout(timeoutId)

          if (ragProcessResponse.ok) {
            const ragResult = await ragProcessResponse.json()
            console.log('RAG processing response received:', {
              status: ragResult.status,
              assistant_id: ragResult.assistant_id,
              expert_name: ragResult.expert_name,
              domain_name: ragResult.domain_name,
              error: ragResult.error || 'none',
              solution: ragResult.solution || 'none'
            })

            // Check if RAG processing actually succeeded
            if (ragResult.status === 'failed') {
              console.error('RAG processing failed with detailed error:', ragResult)
              
              // Mark all entries as failed with the specific error
              for (const entry of knowledgeEntries) {
                const { error: updateError } = await supabase
                  .from('knowledge')
                  .update({ 
                    vector_store_status: 'failed',
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', entry.id)

                if (!updateError) {
                  failedCount++
                  processingErrors.push(`${entry.title}: ${ragResult.message || ragResult.error}`)
                }
              }
            } else if (ragResult.status === 'success' && ragResult.assistant_id) {
              console.log('RAG processing succeeded with assistant ID:', ragResult.assistant_id)
              
              // Update knowledge entries based on processing results
              for (const entry of knowledgeEntries) {
                try {
                  const { error: updateError } = await supabase
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
                    console.log(`Successfully processed knowledge entry: ${entry.title}`)
                  }
                } catch (error) {
                  console.error(`Error updating ${entry.title}:`, error)
                  failedCount++
                  processingErrors.push(`Failed to update ${entry.title}: ${error instanceof Error ? error.message : 'Unknown error'}`)
                }
              }

              // Store RAG assistant information in clone record
              if (ragResult.assistant_id) {
                const { error: cloneUpdateError } = await supabase
                  .from('clones')
                  .update({
                    rag_assistant_id: ragResult.assistant_id,
                    rag_expert_name: ragResult.expert_name,
                    rag_domain_name: ragResult.domain_name,
                    rag_status: 'completed',
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', cloneId)

                if (cloneUpdateError) {
                  console.error('Failed to update clone with RAG info:', cloneUpdateError)
                } else {
                  console.log('Clone updated with RAG assistant information')
                }
              }
            } else {
              // Handle partial success or other statuses
              console.warn('RAG processing returned non-success status:', ragResult.status)
              console.warn('RAG processing message:', ragResult.message)
              
              // Mark entries based on the status
              const entryStatus = ragResult.status === 'partial' ? 'partial' : 'failed'
              for (const entry of knowledgeEntries) {
                const { error: updateError } = await supabase
                  .from('knowledge')
                  .update({ 
                    vector_store_status: entryStatus,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', entry.id)

                if (!updateError) {
                  if (entryStatus === 'partial') {
                    processedCount++
                  } else {
                    failedCount++
                  }
                  processingErrors.push(`${entry.title}: ${ragResult.message || 'Processing status: ' + ragResult.status}`)
                }
              }
            }

          } else {
            // RAG processing failed - provide detailed error information
            let ragError: string
            let errorType: ProcessingError['type'] = 'processing'
            
            try {
              const errorResponse = await ragProcessResponse.json()
              ragError = errorResponse.detail || errorResponse.error || 'Unknown backend error'
              
              // Categorize backend errors
              if (ragProcessResponse.status === 401 || ragProcessResponse.status === 403) {
                errorType = 'auth'
              } else if (ragProcessResponse.status >= 500) {
                errorType = 'connection'
              }
            } catch {
              ragError = await ragProcessResponse.text() || `Backend responded with status ${ragProcessResponse.status}`
            }
            
            console.error('RAG processing failed:', {
              status: ragProcessResponse.status,
              error: ragError,
              type: errorType
            })
            
            const processingError = createProcessingError(errorType, ragError, `Backend processing failed with status ${ragProcessResponse.status}`)
            
            // Mark all entries as failed with detailed error info
            for (const entry of knowledgeEntries) {
              const { error: updateError } = await supabase
                .from('knowledge')
                .update({ 
                  vector_store_status: 'failed',
                  updated_at: new Date().toISOString()
                })
                .eq('id', entry.id)

              if (!updateError) {
                failedCount++
                processingErrors.push(`${entry.title}: ${getUserFriendlyErrorMessage(processingError)}`)
              }
            }
          }

        } catch (error) {
          let processingError: ProcessingError
          
          if (error instanceof Error) {
            if (error.name === 'AbortError') {
              processingError = createProcessingError('timeout', 'Processing timeout', `RAG processing exceeded ${processingTimeout}ms timeout`)
              console.error('RAG processing timed out after', processingTimeout, 'ms')
            } else if (error.message.includes('fetch')) {
              processingError = createProcessingError('connection', 'Network error', error.message)
              console.error('Network error calling RAG processing service:', error)
            } else {
              processingError = createProcessingError('processing', error.message, error.stack)
              console.error('Error calling RAG processing service:', error)
            }
          } else {
            processingError = createProcessingError('processing', 'Unknown processing error', String(error))
            console.error('Unknown error calling RAG processing service:', error)
          }
          
          // Mark all entries as failed with appropriate error categorization
          for (const entry of knowledgeEntries) {
            const { error: updateError } = await supabase
              .from('knowledge')
              .update({ 
                vector_store_status: 'failed',
                updated_at: new Date().toISOString()
              })
              .eq('id', entry.id)

            if (!updateError) {
              failedCount++
              processingErrors.push(`${entry.title}: ${getUserFriendlyErrorMessage(processingError)}`)
            }
          }
        }
      } else {
        console.log('No document URLs found for processing')
      }
    }

    // Also update any documents in the documents table
    const { data: documents, error: documentsError } = await supabase
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
    
    // Enhanced success messaging
    let statusMessage: string
    let estimatedCompletionTime: string | undefined
    
    switch (overallStatus) {
      case 'completed':
        statusMessage = `Successfully processed all ${processedCount} documents. Your clone is ready for advanced conversations!`
        break
      case 'partial':
        statusMessage = `Processed ${processedCount} of ${knowledgeEntries?.length || 0} documents. Some documents failed but your clone has enhanced knowledge available.`
        estimatedCompletionTime = 'You can retry failed documents or continue with current knowledge'
        break
      case 'failed':
        statusMessage = `Processing failed for all documents. Your clone will use basic conversation mode. You can retry processing.`
        estimatedCompletionTime = 'Retry recommended'
        break
    }

    const response: ProcessingResult = {
      overall_status: overallStatus,
      processed_count: processedCount,
      failed_count: failedCount,
      total_entries: knowledgeEntries?.length || 0,
      processing_errors: processingErrors,
      message: statusMessage,
      clone_id: cloneId,
      clone_name: clone.name,
      timestamp: new Date().toISOString(),
      ...(estimatedCompletionTime && { estimated_completion_time: estimatedCompletionTime })
    }

    console.log('RAG processing completed:', response)

    return NextResponse.json(response)

  } catch (error) {
    console.error('RAG processing error:', error)
    
    let processingError: ProcessingError
    
    // Enhanced error categorization
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      processingError = createProcessingError('validation', 'Invalid request format', error.message)
    } else if (error instanceof Error) {
      if (error.message.includes('timeout') || error.name === 'AbortError') {
        processingError = createProcessingError('timeout', 'Operation timed out', error.message)
      } else if (error.message.includes('fetch') || error.message.includes('network')) {
        processingError = createProcessingError('connection', 'Network error', error.message)
      } else if (error.message.includes('auth') || error.message.includes('unauthorized')) {
        processingError = createProcessingError('auth', 'Authentication failed', error.message)
      } else {
        processingError = createProcessingError('processing', error.message, error.stack)
      }
    } else {
      processingError = createProcessingError('processing', 'Unknown processing error', String(error))
    }
    
    console.error('RAG processing error:', {
      type: processingError.type,
      message: processingError.message,
      details: processingError.details,
      retryable: processingError.retryable
    })

    const errorResponse: ProcessingResult = {
      error: getUserFriendlyErrorMessage(processingError),
      error_type: processingError.type,
      retryable: processingError.retryable,
      details: processingError.details,
      overall_status: 'failed',
      processed_count: 0,
      failed_count: 0,
      total_entries: 0,
      processing_errors: [processingError.message],
      message: 'Processing failed - ' + getUserFriendlyErrorMessage(processingError),
      clone_id: cloneId || 'unknown',
      clone_name: 'unknown',
      timestamp: new Date().toISOString()
    } as any

    return NextResponse.json(
      errorResponse,
      { status: processingError.type === 'validation' ? 400 : processingError.type === 'auth' ? 401 : 503 }
    )
  }
}