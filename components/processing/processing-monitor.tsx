"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle2, Clock, FileText, RefreshCw, Search, Loader2, Zap, Database } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { apiClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'

interface ProcessingStats {
  total_documents: number
  status_counts: Record<string, number>
  total_chunks: number
  processing_queue_length: number
}

interface ProcessingMonitorProps {
  cloneId: string
  refreshInterval?: number
}

const statusIcons = {
  pending: <Clock className="h-4 w-4 text-yellow-500" />,
  processing: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
  completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  failed: <AlertCircle className="h-4 w-4 text-red-500" />,
}

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
}

export function ProcessingMonitor({ cloneId, refreshInterval = 5000 }: ProcessingMonitorProps) {
  const [stats, setStats] = useState<ProcessingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const { toast } = useToast()

  // Load processing statistics
  const loadStats = async () => {
    try {
      // Mock API call - replace with actual endpoint
      // const response = await apiClient.get(`/clones/${cloneId}/processing/stats`)
      
      // Mock data for demonstration
      const mockStats: ProcessingStats = {
        total_documents: 8,
        status_counts: {
          completed: 6,
          processing: 1,
          pending: 1,
          failed: 0,
        },
        total_chunks: 147,
        processing_queue_length: 2,
      }
      
      setStats(mockStats)
      setLastUpdated(new Date())
    } catch (error: any) {
      console.error('Failed to load processing stats:', error)
      toast({
        variant: "destructive",
        title: "Failed to load processing statistics",
        description: error.response?.data?.detail || "Please try again",
      })
    } finally {
      setLoading(false)
    }
  }

  // Auto-refresh stats
  useEffect(() => {
    loadStats()
    
    const interval = setInterval(loadStats, refreshInterval)
    return () => clearInterval(interval)
  }, [cloneId, refreshInterval])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Knowledge Base Processing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Knowledge Base Processing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Unable to load processing statistics</p>
            <Button 
              variant="outline" 
              onClick={loadStats} 
              className="mt-4"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const completedPercentage = stats.total_documents > 0 
    ? Math.round((stats.status_counts.completed / stats.total_documents) * 100)
    : 0

  const isProcessing = stats.status_counts.processing > 0 || stats.status_counts.pending > 0

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Knowledge Base Processing
            {isProcessing && (
              <Badge variant="secondary" className="ml-auto">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Processing
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Document processing and knowledge base construction status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress Overview */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm text-muted-foreground">
                {stats.status_counts.completed} of {stats.total_documents} documents completed
              </span>
            </div>
            <Progress value={completedPercentage} className="h-2" />
            <p className="text-sm text-muted-foreground">
              {completedPercentage}% of documents have been processed into searchable knowledge chunks
            </p>
          </div>

          <Separator />

          {/* Status Breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              {statusIcons.completed}
              <div>
                <p className="text-2xl font-bold">{stats.status_counts.completed || 0}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {statusIcons.processing}
              <div>
                <p className="text-2xl font-bold">{stats.status_counts.processing || 0}</p>
                <p className="text-xs text-muted-foreground">Processing</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {statusIcons.pending}
              <div>
                <p className="text-2xl font-bold">{stats.status_counts.pending || 0}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {statusIcons.failed}
              <div>
                <p className="text-2xl font-bold">{stats.status_counts.failed || 0}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Knowledge Base Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <FileText className="h-8 w-8 text-blue-500" />
              </div>
              <p className="text-2xl font-bold">{stats.total_documents}</p>
              <p className="text-sm text-muted-foreground">Total Documents</p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Database className="h-8 w-8 text-green-500" />
              </div>
              <p className="text-2xl font-bold">{stats.total_chunks}</p>
              <p className="text-sm text-muted-foreground">Knowledge Chunks</p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Search className="h-8 w-8 text-purple-500" />
              </div>
              <p className="text-2xl font-bold">
                {stats.total_chunks > 0 ? 'Ready' : 'Not Ready'}
              </p>
              <p className="text-sm text-muted-foreground">Search Status</p>
            </div>
          </div>

          {/* Queue Status */}
          {stats.processing_queue_length > 0 && (
            <>
              <Separator />
              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                <span className="text-sm">
                  {stats.processing_queue_length} document{stats.processing_queue_length !== 1 ? 's' : ''} in processing queue
                </span>
              </div>
            </>
          )}

          {/* Last Updated */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Last updated: {lastUpdated?.toLocaleTimeString() || 'Unknown'}
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={loadStats}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Processing Pipeline Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Processing Pipeline
          </CardTitle>
          <CardDescription>
            How documents are transformed into searchable knowledge
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <ProcessingStep
              step={1}
              title="Text Extraction"
              description="Extract text from PDF, DOCX, TXT files"
              icon={<FileText className="h-5 w-5" />}
              status="active"
            />
            <ProcessingStep
              step={2}
              title="Smart Chunking"
              description="Split text into meaningful segments"
              icon={<Database className="h-5 w-5" />}
              status="active"
            />
            <ProcessingStep
              step={3}
              title="Generate Embeddings"
              description="Create vector representations using AI"
              icon={<Zap className="h-5 w-5" />}
              status="active"
            />
            <ProcessingStep
              step={4}
              title="Knowledge Storage"
              description="Store searchable knowledge chunks"
              icon={<Search className="h-5 w-5" />}
              status="active"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface ProcessingStepProps {
  step: number
  title: string
  description: string
  icon: React.ReactNode
  status: 'active' | 'inactive' | 'processing'
}

function ProcessingStep({ step, title, description, icon, status }: ProcessingStepProps) {
  const statusColors = {
    active: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950',
    inactive: 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950',
    processing: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950',
  }

  const iconColors = {
    active: 'text-green-600 dark:text-green-400',
    inactive: 'text-gray-400 dark:text-gray-600',
    processing: 'text-blue-600 dark:text-blue-400',
  }

  return (
    <div className={`p-4 rounded-lg border ${statusColors[status]}`}>
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-full bg-white dark:bg-gray-900 ${iconColors[status]}`}>
          {icon}
        </div>
        <span className="text-xs font-medium text-muted-foreground">Step {step}</span>
      </div>
      <h3 className="font-medium mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}