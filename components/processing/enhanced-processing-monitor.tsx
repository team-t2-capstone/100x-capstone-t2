"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle, Clock, RefreshCw, FileText, Zap, Bot, AlertTriangle } from 'lucide-react'
import { RAGProcessingResponse, ProcessingStatus } from '@/types/database'
import { checkRAGHealth, RAGHealthStatus } from '@/lib/rag-health'
import { cn } from '@/lib/utils'

interface EnhancedProcessingMonitorProps {
  cloneId?: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial'
  processedCount: number
  totalCount: number
  failedCount?: number
  errors?: string[]
  expertName?: string
  assistantId?: string
  processingTime?: string
  onRetry?: () => void
  showHealthCheck?: boolean
  isRetrying?: boolean
  retryCount?: number
}

interface ProcessingStage {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress?: number
}

export function EnhancedProcessingMonitor({
  cloneId,
  status,
  processedCount,
  totalCount,
  failedCount = 0,
  errors = [],
  expertName,
  assistantId,
  processingTime,
  onRetry,
  showHealthCheck = false,
  isRetrying = false,
  retryCount = 0
}: EnhancedProcessingMonitorProps) {
  const [healthStatus, setHealthStatus] = useState<RAGHealthStatus | null>(null)
  const [showHealthDetails, setShowHealthDetails] = useState(false)

  // Calculate overall progress
  const overallProgress = totalCount > 0 ? (processedCount / totalCount) * 100 : 0
  const hasErrors = errors.length > 0 || failedCount > 0

  // Simplified processing stages for OpenAI native RAG
  const getProcessingStages = (): ProcessingStage[] => {
    const stages: ProcessingStage[] = [
      {
        id: 'upload',
        label: 'Upload to OpenAI',
        description: 'Uploading documents to OpenAI file storage',
        icon: <FileText className="h-4 w-4" />,
        status: status === 'pending' ? 'pending' : status === 'processing' && processedCount === 0 ? 'processing' : 'completed'
      },
      {
        id: 'vectorstore',
        label: 'Create Vector Store',
        description: 'Creating OpenAI vector store with documents',
        icon: <Zap className="h-4 w-4" />,
        status: status === 'pending' ? 'pending' : status === 'processing' ? 'processing' : status === 'completed' ? 'completed' : 'failed',
        progress: status === 'processing' ? overallProgress : undefined
      },
      {
        id: 'assistant',
        label: 'Create Assistant',
        description: 'Setting up OpenAI Assistant with file_search capability',
        icon: <Bot className="h-4 w-4" />,
        status: status === 'completed' && assistantId ? 'completed' : status === 'processing' && processedCount === totalCount ? 'processing' : status === 'failed' ? 'failed' : 'pending'
      }
    ]

    return stages
  }

  const stages = getProcessingStages()

  // Check health on mount if requested
  useEffect(() => {
    if (showHealthCheck) {
      checkRAGHealth().then(setHealthStatus)
    }
  }, [showHealthCheck])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'processing': return 'bg-blue-500'
      case 'failed': return 'bg-red-500'
      default: return 'bg-gray-300'
    }
  }

  const getStatusIcon = (stageStatus: string) => {
    switch (stageStatus) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'processing': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-500" />
      default: return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getOverallStatusBadge = () => {
    if (isRetrying) {
      return <Badge variant="default" className="bg-orange-500">Retrying</Badge>
    }
    
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500">Completed</Badge>
      case 'processing':
        return <Badge variant="default" className="bg-blue-500">Processing</Badge>
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      case 'partial':
        return <Badge variant="default" className="bg-yellow-500">Partial Success</Badge>
      default:
        return <Badge variant="secondary">Pending</Badge>
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Knowledge Processing Status</CardTitle>
          {getOverallStatusBadge()}
        </div>
        
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Overall Progress</span>
            <span>{processedCount}/{totalCount} documents</span>
          </div>
          <Progress value={overallProgress} className="w-full" />
          {processingTime && (
            <p className="text-xs text-muted-foreground">Processing time: {processingTime}</p>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Processing Stages */}
        <div className="space-y-4">
          <h4 className="font-medium">Processing Stages</h4>
          {stages.map((stage, index) => (
            <div key={stage.id} className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-1">
                {getStatusIcon(stage.status)}
              </div>
              <div className="flex-grow min-w-0">
                <div className="flex items-center justify-between">
                  <h5 className="font-medium text-sm">{stage.label}</h5>
                  <Badge variant="outline" className="text-xs">
                    {stage.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{stage.description}</p>
                {stage.progress !== undefined && stage.status === 'processing' && (
                  <Progress value={stage.progress} className="w-full mt-2" />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Success Information */}
        {status === 'completed' && (
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-start space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div className="space-y-2">
                <h4 className="font-medium text-green-800 dark:text-green-200">
                  Processing Complete
                </h4>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Your clone now has knowledge capabilities powered by OpenAI's native RAG.
                </p>
                {expertName && (
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Expert: {expertName}
                  </p>
                )}
                {assistantId && (
                  <p className="text-xs font-mono text-green-600 dark:text-green-400">
                    Assistant ID: {assistantId}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Error Information */}
        {hasErrors && (
          <div className={cn(
            "p-4 rounded-lg border",
            status === 'failed' 
              ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
              : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
          )}>
            <div className="flex items-start space-x-2">
              <AlertTriangle className={cn(
                "h-5 w-5 mt-0.5",
                status === 'failed' ? "text-red-500" : "text-yellow-500"
              )} />
              <div className="space-y-3 flex-1">
                <div>
                  <h4 className={cn(
                    "font-medium",
                    status === 'failed' 
                      ? "text-red-800 dark:text-red-200"
                      : "text-yellow-800 dark:text-yellow-200"
                  )}>
                    Processing Issues ({failedCount + errors.length})
                    {retryCount > 0 && (
                      <span className={cn(
                        "text-xs ml-2",
                        status === 'failed'
                          ? "text-red-600 dark:text-red-400"
                          : "text-yellow-600 dark:text-yellow-400"
                      )}>
                        (Retry attempt: {retryCount})
                      </span>
                    )}
                  </h4>
                  {status === 'failed' && (
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                      {retryCount > 0 
                        ? 'Retry failed. The documents may have format issues or the service is temporarily unavailable.'
                        : 'Some documents could not be processed. You can retry or continue with basic mode.'}
                    </p>
                  )}
                </div>
                {errors.length > 0 && (
                  <div className="bg-white/50 dark:bg-black/20 p-3 rounded border">
                    <h5 className={cn(
                      "text-xs font-medium mb-2",
                      status === 'failed'
                        ? "text-red-800 dark:text-red-200"
                        : "text-yellow-800 dark:text-yellow-200"
                    )}>Error Details:</h5>
                    <ul className={cn(
                      "text-sm space-y-1",
                      status === 'failed'
                        ? "text-red-700 dark:text-red-300"
                        : "text-yellow-700 dark:text-yellow-300"
                    )}>
                      {errors.slice(0, 3).map((error, index) => (
                        <li key={index} className="flex items-start space-x-2">
                          <span className={cn(
                            "mt-1",
                            status === 'failed' ? "text-red-500" : "text-yellow-500"
                          )}>•</span>
                          <span className="font-mono text-xs">{error}</span>
                        </li>
                      ))}
                      {errors.length > 3 && (
                        <li className={cn(
                          "italic",
                          status === 'failed'
                            ? "text-red-600 dark:text-red-400"
                            : "text-yellow-600 dark:text-yellow-400"
                        )}>
                          ... and {errors.length - 3} more issues
                        </li>
                      )}
                    </ul>
                  </div>
                )}
                {onRetry && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={onRetry}
                      disabled={isRetrying}
                      className={cn(
                        "font-medium",
                        status === 'failed'
                          ? "border-red-300 text-red-700 hover:bg-red-100 dark:border-red-600 dark:text-red-300 dark:hover:bg-red-900/50"
                          : "border-yellow-300 text-yellow-700 hover:bg-yellow-100 dark:border-yellow-600 dark:text-yellow-300 dark:hover:bg-yellow-900/50"
                      )}
                    >
                      {isRetrying ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Retrying...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          {retryCount > 0 ? 'Try Again' : 'Retry Processing'}
                        </>
                      )}
                    </Button>
                    <div className="flex flex-col text-xs">
                      {retryCount > 0 && (
                        <span className={cn(
                          status === 'failed'
                            ? "text-red-600 dark:text-red-400"
                            : "text-yellow-600 dark:text-yellow-400"
                        )}>
                          💡 Tip: Check document formats or try again later
                        </span>
                      )}
                      {retryCount === 0 && (
                        <span className={cn(
                          "text-gray-600 dark:text-gray-400"
                        )}>
                          🔄 Retry will attempt to reprocess failed documents
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Partial Success Information */}
        {status === 'partial' && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-yellow-800 dark:text-yellow-200">
                    Partial Processing Success
                  </h4>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    {processedCount} of {totalCount} documents were processed successfully. Your clone has enhanced capabilities but some content may be missing.
                  </p>
                </div>
                {onRetry && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={onRetry}
                    disabled={isRetrying}
                    className="border-yellow-300 text-yellow-700 hover:bg-yellow-100 dark:border-yellow-600 dark:text-yellow-300 dark:hover:bg-yellow-900/50"
                  >
                    {isRetrying ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Retrying Failed Items...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Retry Failed Documents
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Health Check Information */}
        {showHealthCheck && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">System Health</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHealthDetails(!showHealthDetails)}
              >
                {showHealthDetails ? 'Hide Details' : 'Show Details'}
              </Button>
            </div>
            
            {healthStatus ? (
              <div className={`p-3 rounded-lg border ${
                healthStatus.isHealthy 
                  ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' 
                  : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
              }`}>
                <div className="flex items-center space-x-2">
                  {healthStatus.isHealthy ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  )}
                  <span className={`text-sm font-medium ${
                    healthStatus.isHealthy ? 'text-green-800 dark:text-green-200' : 'text-yellow-800 dark:text-yellow-200'
                  }`}>
                    {healthStatus.isHealthy ? 'OpenAI RAG system operational' : 'Configuration issues detected'}
                  </span>
                </div>
                
                {showHealthDetails && healthStatus.issues.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div>
                      <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300">Issues:</h5>
                      <ul className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {healthStatus.issues.map((issue, index) => (
                          <li key={index}>• {issue}</li>
                        ))}
                      </ul>
                    </div>
                    {healthStatus.solutions.length > 0 && (
                      <div>
                        <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300">Solutions:</h5>
                        <ul className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {healthStatus.solutions.map((solution, index) => (
                            <li key={index}>• {solution}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Checking system health...</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}