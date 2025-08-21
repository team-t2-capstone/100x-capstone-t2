"use client"

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Upload, FileText, BarChart3, Search } from 'lucide-react'

import { DocumentUpload } from '@/components/upload/document-upload'
import { DocumentManager } from '@/components/upload/document-manager'
// Removed: ProcessingMonitor import (RAG functionality removed)
// Removed: KnowledgeSearch import (RAG functionality removed)
import { useAuth } from '@/contexts/auth-context'
import { useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function UploadPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [selectedCloneId, setSelectedCloneId] = useState<string>('')
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [clones, setClones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Redirect non-creator users
  useEffect(() => {
    if (user && user.role !== 'creator') {
      router.push('/discover')
      return
    }
  }, [user, router])

  const handleUploadComplete = (documents: any[]) => {
    console.log('Upload completed:', documents)
    // Refresh the document manager
    setRefreshTrigger(prev => prev + 1)
  }

  // Fetch user's clones from Supabase
  useEffect(() => {
    async function fetchClones() {
      if (!user?.id) {
        console.log('No user ID available, skipping clone fetch')
        setLoading(false)
        return
      }
      
      try {
        setLoading(true)
        const supabase = createClient()
        
        // Test authentication first
        const { data: authData, error: authError } = await supabase.auth.getUser()
        if (authError || !authData.user) {
          throw new Error('Authentication failed: ' + (authError?.message || 'No user found'))
        }
        
        console.log('User authenticated:', authData.user.id)
        
        // First get clones
        const { data: clonesData, error: clonesError } = await supabase
          .from('clones')
          .select(`
            id,
            name,
            bio,
            is_active,
            total_sessions
          `)
          .eq('creator_id', user.id)
          .eq('is_active', true)
        
        if (clonesError) {
          console.error('Supabase error:', clonesError)
          throw clonesError
        }

        // Then get knowledge count for each clone
        const clonesWithKnowledge = await Promise.all(
          (clonesData || []).map(async (clone) => {
            const { data: knowledgeData, error: knowledgeError } = await supabase
              .from('knowledge')
              .select('id')
              .eq('clone_id', clone.id)
            
            if (knowledgeError) {
              console.warn('Error fetching knowledge for clone:', clone.id, knowledgeError)
            }
            
            return {
              ...clone,
              knowledge: knowledgeData || []
            }
          })
        )
        
        const data = clonesWithKnowledge
        
        console.log('Raw clones data:', data)
        
        const clonesWithDocCount = data?.map(clone => ({
          id: clone.id,
          name: clone.name,
          description: clone.bio || '',
          document_count: clone.knowledge?.length || 0,
          status: clone.is_active ? 'active' : 'inactive'
        })) || []
        
        console.log('Processed clones:', clonesWithDocCount)
        setClones(clonesWithDocCount)
      } catch (error) {
        console.error('Error fetching clones:', error)
        console.error('Error details:', {
          message: error?.message || 'Unknown error',
          code: error?.code || 'No code',
          details: error?.details || 'No details',
          hint: error?.hint || 'No hint',
          fullError: error
        })
        
        // Set empty clones array on error
        setClones([])
      } finally {
        setLoading(false)
      }
    }

    fetchClones()
  }, [user?.id])

  const selectedClone = clones.find(clone => clone.id === selectedCloneId)

  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="text-center py-12">
            <p>Please log in to upload documents.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Don't render content for non-creator users
  if (user && user.role !== 'creator') {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-6 text-center">
            <p>Redirecting...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Page Header */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Document Management</h1>
        <p className="text-muted-foreground">
          Upload and manage documents for your AI clones' knowledge bases
        </p>
      </div>

      {/* Clone Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Select Clone
          </CardTitle>
          <CardDescription>
            Choose which clone to upload documents to
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <div className="flex-1">
              <Select value={selectedCloneId} onValueChange={setSelectedCloneId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a clone..." />
                </SelectTrigger>
                <SelectContent>
                  {loading ? (
                    <SelectItem value="loading" disabled>Loading clones...</SelectItem>
                  ) : clones.length === 0 ? (
                    <SelectItem value="no-clones" disabled>No clones found</SelectItem>
                  ) : (
                    clones.map((clone) => (
                    <SelectItem key={clone.id} value={clone.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{clone.name}</span>
                        <div className="flex items-center gap-2 ml-4">
                          <Badge variant="secondary" className="text-xs">
                            {clone.document_count} docs
                          </Badge>
                          <Badge 
                            variant={clone.status === 'active' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {clone.status}
                          </Badge>
                        </div>
                      </div>
                    </SelectItem>
                  ))
                  )}
                </SelectContent>
              </Select>
            </div>
            
            {selectedClone && (
              <div className="flex-1 sm:flex-initial">
                <Card className="p-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">{selectedClone.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedClone.description}
                    </p>
                    <div className="flex gap-2">
                      <Badge variant="outline">
                        {selectedClone.document_count} documents
                      </Badge>
                      <Badge 
                        variant={selectedClone.status === 'active' ? 'default' : 'secondary'}
                      >
                        {selectedClone.status}
                      </Badge>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedCloneId ? (
        <Tabs defaultValue="upload" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="manage" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Manage
            </TabsTrigger>
            <TabsTrigger value="processing" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Processing
            </TabsTrigger>
            <TabsTrigger value="search" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Search
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Statistics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-6">
            <DocumentUpload 
              cloneId={selectedCloneId}
              onUploadComplete={handleUploadComplete}
              maxFiles={5}
            />
          </TabsContent>

          <TabsContent value="manage" className="space-y-6">
            <DocumentManager 
              cloneId={selectedCloneId}
              refreshTrigger={refreshTrigger}
              showActions={true}
            />
          </TabsContent>

          <TabsContent value="processing" className="space-y-6">
            {/* ProcessingMonitor removed - RAG functionality no longer available */}
            <div className="flex items-center justify-center p-8 text-gray-500">
              <p>Processing monitor is currently unavailable.</p>
            </div>
          </TabsContent>

          <TabsContent value="search" className="space-y-6">
            {/* KnowledgeSearch removed - RAG functionality no longer available */}
            <div className="flex items-center justify-center p-8 text-gray-500">
              <p>Knowledge search is currently unavailable.</p>
            </div>
          </TabsContent>

          <TabsContent value="stats" className="space-y-6">
            <UploadStatistics cloneId={selectedCloneId} />
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Select a Clone</h3>
            <p className="text-muted-foreground">
              Choose a clone from the dropdown above to start uploading documents
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Statistics component
function UploadStatistics({ cloneId }: { cloneId: string }) {
  const [stats, setStats] = useState({
    total_documents: 0,
    total_size_bytes: 0,
    total_chunks: 0,
    status_counts: {
      completed: 0,
      processing: 0,
      pending: 0,
      failed: 0,
    },
    processing_queue_length: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      if (!cloneId) return
      
      try {
        setLoading(true)
        const supabase = createClient()
        
        // Get knowledge documents for this clone (using knowledge table instead of documents)
        const { data: documents, error: docsError } = await supabase
          .from('knowledge')
          .select('id, file_size_bytes, processing_status')
          .eq('clone_id', cloneId)
        
        if (docsError) throw docsError
        
        // For now, we'll simulate chunks since document_chunks table may not exist
        const chunks = documents || []
        
        const statusCounts = documents?.reduce((acc, doc) => {
          acc[doc.processing_status] = (acc[doc.processing_status] || 0) + 1
          return acc
        }, {} as any) || {}
        
        setStats({
          total_documents: documents?.length || 0,
          total_size_bytes: documents?.reduce((sum, doc) => sum + (doc.file_size_bytes || 0), 0) || 0,
          total_chunks: chunks?.length || 0,
          status_counts: {
            completed: statusCounts.completed || 0,
            processing: statusCounts.processing || 0,
            pending: statusCounts.pending || 0,
            failed: statusCounts.failed || 0,
          },
          processing_queue_length: statusCounts.processing || 0,
        })
      } catch (error) {
        console.error('Error fetching upload statistics:', error)
        console.error('Statistics error details:', {
          message: error?.message || 'Unknown error',
          code: error?.code || 'No code',
          details: error?.details || 'No details',
          hint: error?.hint || 'No hint'
        })
        
        // Set default stats on error
        setStats({
          total_documents: 0,
          total_size_bytes: 0,
          total_chunks: 0,
          status_counts: {
            completed: 0,
            processing: 0,
            pending: 0,
            failed: 0,
          },
          processing_queue_length: 0,
        })
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [cloneId])

  const formatFileSize = (bytes: number) => {
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Total Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total_documents}</div>
          <p className="text-sm text-muted-foreground">
            {formatFileSize(stats.total_size_bytes)} total
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Processing Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm">Completed</span>
              <Badge variant="default">{stats.status_counts.completed}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Processing</span>
              <Badge variant="secondary">{stats.status_counts.processing}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Pending</span>
              <Badge variant="outline">{stats.status_counts.pending}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Knowledge Chunks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total_chunks}</div>
          <p className="text-sm text-muted-foreground">
            Searchable content pieces
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Queue Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.processing_queue_length}</div>
          <p className="text-sm text-muted-foreground">
            Documents in processing queue
          </p>
        </CardContent>
      </Card>
    </div>
  )
}