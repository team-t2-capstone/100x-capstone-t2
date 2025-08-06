"use client"

import { useState, useEffect } from 'react'
import { FileText, Download, Trash2, Eye, Search, Filter, MoreHorizontal, RefreshCw, CheckCircle2, Clock, AlertCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { apiClient } from '@/lib/api-client'

interface Document {
  id: string
  title: string
  file_name: string
  file_type: string
  file_size_bytes: number
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  chunk_count: number
  upload_date: string
  tags: string[]
  description?: string
}

interface DocumentManagerProps {
  cloneId: string
  refreshTrigger?: number
  onDocumentSelect?: (document: Document) => void
  showActions?: boolean
}

const statusIcons = {
  pending: <Clock className="h-4 w-4 text-yellow-500" />,
  processing: <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />,
  completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  failed: <AlertCircle className="h-4 w-4 text-red-500" />,
}

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
}

export function DocumentManager({ 
  cloneId, 
  refreshTrigger, 
  onDocumentSelect,
  showActions = true 
}: DocumentManagerProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const { toast } = useToast()

  // Load documents
  const loadDocuments = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get(`/clones/${cloneId}/documents`)
      setDocuments(response.data.documents || [])
    } catch (error: any) {
      console.error('Failed to load documents:', error)
      toast({
        variant: "destructive",
        title: "Failed to load documents",
        description: error.response?.data?.detail || "Please try again",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (cloneId) {
      loadDocuments()
    }
  }, [cloneId, refreshTrigger])

  // Filter documents
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesStatus = statusFilter === 'all' || doc.processing_status === statusFilter
    const matchesType = typeFilter === 'all' || doc.file_type === typeFilter

    return matchesSearch && matchesStatus && matchesType
  })

  // Get unique file types for filter
  const uniqueTypes = [...new Set(documents.map(doc => doc.file_type))]

  // Delete document
  const deleteDocument = async (documentId: string) => {
    try {
      await apiClient.delete(`/clones/${cloneId}/documents/${documentId}`)
      toast({
        title: "Document deleted",
        description: "The document has been removed from the knowledge base",
      })
      await loadDocuments() // Refresh the list
    } catch (error: any) {
      console.error('Failed to delete document:', error)
      toast({
        variant: "destructive",
        title: "Failed to delete document",
        description: error.response?.data?.detail || "Please try again",
      })
    }
  }

  // Download document
  const downloadDocument = async (documentId: string, fileName: string) => {
    try {
      const response = await apiClient.get(
        `/clones/${cloneId}/documents/${documentId}/download`,
        { responseType: 'blob' }
      )
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', fileName)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
      toast({
        title: "Download started",
        description: `Downloading ${fileName}`,
      })
    } catch (error: any) {
      console.error('Failed to download document:', error)
      toast({
        variant: "destructive",
        title: "Download failed",
        description: error.response?.data?.detail || "Please try again",
      })
    }
  }

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  // Format date
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>Manage your clone's knowledge base documents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-12 w-12 rounded" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Documents ({filteredDocuments.length})
        </CardTitle>
        <CardDescription>
          Manage your clone's knowledge base documents
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents, tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {uniqueTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={loadDocuments}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Documents Table */}
        {filteredDocuments.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              {documents.length === 0 ? 'No documents uploaded' : 'No documents match your filters'}
            </h3>
            <p className="text-slate-600 dark:text-slate-300">
              {documents.length === 0 
                ? 'Upload your first document to get started' 
                : 'Try adjusting your search or filters'
              }
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Chunks</TableHead>
                  <TableHead>Uploaded</TableHead>
                  {showActions && <TableHead className="w-12"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.map((doc) => (
                  <TableRow 
                    key={doc.id}
                    className={onDocumentSelect ? "cursor-pointer hover:bg-muted/50" : ""}
                    onClick={() => onDocumentSelect?.(doc)}
                  >
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{doc.title}</p>
                        <p className="text-sm text-muted-foreground">{doc.file_name}</p>
                        {doc.tags.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {doc.tags.map(tag => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {statusIcons[doc.processing_status]}
                        <Badge className={statusColors[doc.processing_status]}>
                          {doc.processing_status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {doc.file_type.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatFileSize(doc.file_size_bytes)}</TableCell>
                    <TableCell>
                      <span className={doc.chunk_count > 0 ? "text-green-600" : "text-slate-500"}>
                        {doc.chunk_count || 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(doc.upload_date)}
                    </TableCell>
                    {showActions && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation()
                                downloadDocument(doc.id, doc.file_name)
                              }}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem 
                                  className="text-red-600"
                                  onSelect={(e) => e.preventDefault()}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Document</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{doc.title}"? This action cannot be undone and will remove all processed chunks from the knowledge base.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteDocument(doc.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Document details dialog
export function DocumentDetailsDialog({ 
  document, 
  onClose 
}: { 
  document: Document | null
  onClose: () => void 
}) {
  if (!document) return null

  return (
    <Dialog open={!!document} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{document.title}</DialogTitle>
          <DialogDescription>
            Document details and processing information
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">File Name</label>
              <p className="text-sm text-muted-foreground">{document.file_name}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <div className="flex items-center gap-2 mt-1">
                {statusIcons[document.processing_status]}
                <Badge className={statusColors[document.processing_status]}>
                  {document.processing_status}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">File Type</label>
              <p className="text-sm text-muted-foreground">{document.file_type.toUpperCase()}</p>
            </div>
            <div>
              <label className="text-sm font-medium">File Size</label>
              <p className="text-sm text-muted-foreground">
                {(document.file_size_bytes / 1024).toFixed(1)} KB
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Chunks Processed</label>
              <p className="text-sm text-muted-foreground">{document.chunk_count || 0}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Upload Date</label>
              <p className="text-sm text-muted-foreground">
                {new Date(document.upload_date).toLocaleString()}
              </p>
            </div>
          </div>

          {document.description && (
            <div>
              <label className="text-sm font-medium">Description</label>
              <p className="text-sm text-muted-foreground mt-1">{document.description}</p>
            </div>
          )}

          {document.tags.length > 0 && (
            <div>
              <label className="text-sm font-medium">Tags</label>
              <div className="flex gap-2 flex-wrap mt-1">
                {document.tags.map(tag => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}