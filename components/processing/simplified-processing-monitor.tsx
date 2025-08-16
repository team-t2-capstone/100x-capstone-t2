/**
 * Simplified RAG Processing Monitor for CloneAI
 * Streamlined UI for OpenAI native RAG processing
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { useSimplifiedRAGProcessing, getRAGStatus, checkRAGHealth } from '@/lib/simplified-rag-api'
import type { RAGStatusResponse, RAGHealthResponse } from '@/lib/simplified-rag-api'

interface SimplifiedProcessingMonitorProps {
  cloneId: string
  cloneName: string
  documents: Record<string, string>
  cloneData?: {
    bio?: string
    category?: string
    personality_traits?: Record<string, any>
    communication_style?: Record<string, any>
  }
  authToken?: string
  onComplete?: (result: any) => void
  onError?: (error: string) => void
}

export function SimplifiedProcessingMonitor({
  cloneId,
  cloneName,
  documents,
  cloneData = {},
  authToken,
  onComplete,
  onError
}: SimplifiedProcessingMonitorProps) {
  const {
    status,
    progress,
    error,
    result,
    processDocuments,
    reset,
    isProcessing,
    isCompleted,
    hasError
  } = useSimplifiedRAGProcessing()

  const [ragStatus, setRAGStatus] = useState<RAGStatusResponse | null>(null)
  const [ragHealth, setRAGHealth] = useState<RAGHealthResponse | null>(null)
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)

  // Check RAG health on mount
  useEffect(() => {
    checkRAGHealthStatus()
  }, [])

  // Check clone RAG status on mount and after processing
  useEffect(() => {
    if (cloneId) {
      checkCloneStatus()
    }
  }, [cloneId, isCompleted])

  // Call completion callback
  useEffect(() => {
    if (isCompleted && result && onComplete) {
      onComplete(result)
    }
  }, [isCompleted, result, onComplete])

  // Call error callback
  useEffect(() => {
    if (hasError && error && onError) {
      onError(error)
    }
  }, [hasError, error, onError])

  const checkRAGHealthStatus = async () => {
    try {
      const health = await checkRAGHealth()
      setRAGHealth(health)
    } catch (err) {
      console.error('Failed to check RAG health:', err)
    }
  }

  const checkCloneStatus = async () => {
    if (!cloneId) return

    setIsCheckingStatus(true)
    try {
      const status = await getRAGStatus(cloneId, authToken)
      setRAGStatus(status)
    } catch (err) {
      console.error('Failed to get clone RAG status:', err)
    } finally {
      setIsCheckingStatus(false)
    }
  }

  const handleStartProcessing = async () => {
    if (!ragHealth?.rag_ready) {
      onError?.('RAG service is not properly configured')
      return
    }

    if (Object.keys(documents).length === 0) {
      onError?.('No documents available for processing')
      return
    }

    await processDocuments(
      cloneId,
      {
        clone_name: cloneName,
        document_urls: documents,
        ...cloneData
      },
      authToken
    )
  }

  const handleRetry = () => {
    reset()
    handleStartProcessing()
  }

  const getStatusIcon = () => {
    if (isProcessing) return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
    if (isCompleted || ragStatus?.is_ready) return <CheckCircle className="h-5 w-5 text-green-500" />
    if (hasError) return <AlertCircle className="h-5 w-5 text-red-500" />
    return <AlertCircle className="h-5 w-5 text-gray-400" />
  }

  const getStatusText = () => {
    if (isProcessing) return 'Processing documents...'
    if (isCompleted) return 'Processing completed successfully!'
    if (ragStatus?.is_ready) return 'Clone is ready for conversations'
    if (hasError) return `Error: ${error}`
    if (ragStatus?.rag_status === 'pending') return 'Ready to process documents'
    return 'Checking status...'
  }

  return (
    <div className="space-y-6">
      {/* RAG Health Status */}
      {ragHealth && !ragHealth.rag_ready && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p><strong>RAG Service Not Ready:</strong> {ragHealth.message}</p>
              {ragHealth.issues && ragHealth.issues.length > 0 && (
                <div>
                  <p className="font-medium">Issues:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {ragHealth.issues.map((issue, index) => (
                      <li key={index} className="text-sm">{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              {ragHealth.solutions && ragHealth.solutions.length > 0 && (
                <div>
                  <p className="font-medium">Solutions:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {ragHealth.solutions.map((solution, index) => (
                      <li key={index} className="text-sm">{solution}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Processing Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getStatusIcon()}
            Simplified RAG Processing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Display */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{getStatusText()}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={checkCloneStatus}
              disabled={isCheckingStatus}
            >
              <RefreshCw className={`h-4 w-4 ${isCheckingStatus ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Progress Bar */}
          {isProcessing && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-gray-600">
                Processing {Object.keys(documents).length} documents using OpenAI native RAG...
              </p>
            </div>
          )}

          {/* Current Status */}
          {ragStatus && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Status:</span> {ragStatus.rag_status}
              </div>
              <div>
                <span className="font-medium">Documents:</span> {ragStatus.processed_documents}/{ragStatus.total_documents}
              </div>
              <div>
                <span className="font-medium">Progress:</span> {ragStatus.progress_percentage.toFixed(1)}%
              </div>
              <div>
                <span className="font-medium">Ready:</span> {ragStatus.is_ready ? 'Yes' : 'No'}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {!isProcessing && !isCompleted && !ragStatus?.is_ready && (
              <Button 
                onClick={handleStartProcessing}
                disabled={!ragHealth?.rag_ready || Object.keys(documents).length === 0}
                className="flex-1"
              >
                Start Processing
              </Button>
            )}

            {hasError && (
              <Button onClick={handleRetry} variant="outline" className="flex-1">
                Retry Processing
              </Button>
            )}

            {(isCompleted || ragStatus?.is_ready) && (
              <div className="flex-1 text-center">
                <p className="text-green-600 font-medium">
                  ✓ Clone is ready for conversations with enhanced knowledge!
                </p>
              </div>
            )}
          </div>

          {/* Document List */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Documents to Process:</h4>
            <div className="space-y-1">
              {Object.entries(documents).map(([title, url]) => (
                <div key={title} className="flex items-center justify-between text-sm">
                  <span className="truncate">{title}</span>
                  <span className="text-xs text-gray-500">
                    {isCompleted || ragStatus?.is_ready ? '✓ Processed' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Service Information */}
          {ragHealth && (
            <div className="pt-4 border-t text-xs text-gray-500">
              <p>Service: {ragHealth.service_type}</p>
              <p>Using OpenAI native file_search capabilities</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}