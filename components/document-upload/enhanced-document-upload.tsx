"use client"

import React, { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, FileText, X, AlertCircle, CheckCircle } from 'lucide-react'
import { DuplicateDetector } from './duplicate-detector'
import { toast } from '@/components/ui/use-toast'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

interface PendingUpload {
  id: string
  file: File
  title: string
  description?: string
  tags?: string[]
  status: 'waiting' | 'checking' | 'uploading' | 'completed' | 'error' | 'cancelled'
  error?: string
}

// Enhanced interface with better type safety
interface ExistingDocument {
  id: string
  name?: string | null // Allow null explicitly
  url?: string | null
  status?: string | null
  type?: string | null
}

interface EnhancedDocumentUploadProps {
  cloneId: string
  onDocumentUploaded: (document: any) => void
  existingDocuments?: ExistingDocument[]
  maxFileSize?: number // in MB
  allowedExtensions?: string[]
  expertName?: string
  domainName?: string
  onDocumentRemoved?: (documentId: string) => void
}

export function EnhancedDocumentUpload({
  cloneId,
  onDocumentUploaded,
  existingDocuments = [],
  maxFileSize = 10,
  allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.md', '.rtf'],
  expertName,
  domainName,
  onDocumentRemoved
}: EnhancedDocumentUploadProps) {
  // Input validation with error boundaries
  React.useEffect(() => {
    try {
      if (!cloneId || typeof cloneId !== 'string') {
        console.error('EnhancedDocumentUpload: Invalid cloneId provided:', cloneId)
      }
      if (!onDocumentUploaded || typeof onDocumentUploaded !== 'function') {
        console.error('EnhancedDocumentUpload: Invalid onDocumentUploaded callback provided:', onDocumentUploaded)
      }
      if (existingDocuments && !Array.isArray(existingDocuments)) {
        console.error('EnhancedDocumentUpload: existingDocuments must be an array:', existingDocuments)
      }
    } catch (error) {
      console.error('EnhancedDocumentUpload: Error in useEffect validation:', error)
    }
  }, [cloneId, onDocumentUploaded, existingDocuments])
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [documentToRemove, setDocumentToRemove] = useState<ExistingDocument | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): string | null => {
    try {
      // Basic file validation
      if (!file || !(file instanceof File)) {
        return 'Invalid file object'
      }

      if (!file.name || typeof file.name !== 'string') {
        return 'File must have a valid name'
      }

      // Check file size
      if (file.size > maxFileSize * 1024 * 1024) {
        return `File size exceeds ${maxFileSize}MB limit`
      }

      // Check for empty file
      if (file.size === 0) {
        return 'File is empty'
      }

      // Check file extension with comprehensive error handling
      const fileName = file.name || ''
      const nameParts = fileName.split('.')
      
      if (nameParts.length < 2) {
        return 'File must have an extension'
      }

      const lastPart = nameParts.pop()
      if (!lastPart || typeof lastPart !== 'string') {
        return 'File must have a valid extension'
      }

      const fileExtension = '.' + lastPart.toLowerCase().trim()
      if (!fileExtension || fileExtension === '.' || fileExtension === '.undefined') {
        return 'File must have a valid extension'
      }

      if (!allowedExtensions.includes(fileExtension)) {
        return `File type ${fileExtension} not allowed. Allowed types: ${allowedExtensions.join(', ')}`
      }

      return null
    } catch (error) {
      console.error('Error validating file:', { error, fileName: file?.name })
      return 'Error validating file'
    }
  }

  const checkForExistingDuplicate = (filename: string): boolean => {
    try {
      // Validate inputs with strict type checking
      if (!filename || typeof filename !== 'string' || filename.trim() === '') {
        console.warn('Invalid filename provided to checkForExistingDuplicate:', filename)
        return false
      }

      // Ensure existingDocuments is a valid array
      if (!existingDocuments || !Array.isArray(existingDocuments)) {
        console.warn('existingDocuments is not a valid array:', {
          type: typeof existingDocuments,
          isArray: Array.isArray(existingDocuments),
          value: existingDocuments
        })
        return false
      }

      // Normalize filename for comparison
      const normalizedFilename = filename.trim().toLowerCase()
      
      return existingDocuments.some((doc, index) => {
        try {
          // Comprehensive document validation
          if (!doc || typeof doc !== 'object') {
            console.warn(`Document at index ${index} is null/undefined or not an object:`, doc)
            return false
          }

          // Check if doc.name exists and is a valid string
          if (!doc.name || typeof doc.name !== 'string' || doc.name.trim() === '') {
            console.warn(`Document at index ${index} has invalid name:`, {
              id: doc.id || 'unknown',
              name: doc.name,
              nameType: typeof doc.name,
              hasName: Object.prototype.hasOwnProperty.call(doc, 'name')
            })
            return false
          }

          // Safely normalize document name
          const normalizedDocName = doc.name.trim().toLowerCase()
          
          // Check for name match and valid status
          const isNameMatch = normalizedDocName === normalizedFilename
          const isValidStatus = !doc.status || doc.status !== 'failed'
          
          return isNameMatch && isValidStatus
        } catch (docError) {
          console.warn(`Error processing document at index ${index}:`, {
            error: docError,
            doc: doc,
            filename: filename
          })
          return false
        }
      })
    } catch (error) {
      console.error('Critical error in checkForExistingDuplicate:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        filename,
        existingDocumentsType: typeof existingDocuments,
        existingDocumentsLength: Array.isArray(existingDocuments) ? existingDocuments.length : 'N/A',
        existingDocumentsKeys: existingDocuments && typeof existingDocuments === 'object' ? Object.keys(existingDocuments) : 'N/A'
      })
      return false // Safe fallback - assume no duplicate if we can't check
    }
  }

  const handleFileSelection = (files: FileList | null) => {
    try {
      // Enhanced input validation
      if (!files || !(files instanceof FileList) || files.length === 0) {
        console.log('No valid files provided for selection:', {
          files,
          isFileList: files instanceof FileList,
          length: files?.length
        })
        return
      }

      const newUploads: PendingUpload[] = []
      const errors: string[] = []

      Array.from(files).forEach((file, index) => {
        try {
          // Enhanced file validation with null checks
          if (!file || !(file instanceof File)) {
            errors.push(`File ${index + 1}: Invalid file object`)
            return
          }

          const validationError = validateFile(file)
          if (validationError) {
            errors.push(`${file.name || `File ${index + 1}`}: ${validationError}`)
            return
          }

          // Check if file is already pending upload
          const isDuplicatePending = pendingUploads.some(upload => 
            upload.file.name === file.name && upload.file.size === file.size
          )

          if (isDuplicatePending) {
            errors.push(`${file.name}: Already selected for upload`)
            return
          }

          // Check if file exists in existing documents (quick client-side check)
          try {
            const fileName = file?.name || `file-${index}`
            if (fileName && typeof fileName === 'string' && checkForExistingDuplicate(fileName)) {
              // Still allow it, but the DuplicateDetector will handle the proper server-side check
              console.log(`File ${fileName} may be a duplicate, will check server-side`)
            }
          } catch (duplicateCheckError) {
            console.warn('Error checking for duplicates, proceeding with upload:', {
              error: duplicateCheckError,
              fileName: file?.name,
              fileSize: file?.size
            })
          }

          // Safely create title from filename with comprehensive validation
          let title = file?.name || `Document ${index + 1}`
          try {
            if (file?.name && typeof file.name === 'string') {
              const processedTitle = file.name.replace(/\.[^/.]+$/, "") // Remove extension for title
              if (processedTitle && processedTitle.trim().length > 0) {
                title = processedTitle.trim()
              } else {
                title = file.name // Fallback to full name if empty after extension removal
              }
            }
          } catch (titleError) {
            console.warn('Error processing title, using fallback:', {
              error: titleError,
              fileName: file?.name,
              fallbackTitle: title
            })
          }

          // Create upload with safe ID generation
          const safeName = file?.name || `file-${index}`
          const safeSize = file?.size || 0
          const uploadId = `${safeName.replace(/[^a-zA-Z0-9.-]/g, '_')}-${safeSize}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          
          newUploads.push({
            id: uploadId,
            file,
            title: title?.trim() || `Document ${index + 1}`,
            description: '',
            tags: [],
            status: 'waiting'
          })
        } catch (fileError) {
          console.error(`Error processing file ${file?.name || index}:`, fileError)
          errors.push(`${file?.name || `File ${index + 1}`}: Error processing file`)
        }
      })

      if (errors.length > 0) {
        toast({
          title: "Some files couldn't be added",
          description: errors.join('. '),
          variant: "destructive",
        })
      }

      if (newUploads.length > 0) {
        setPendingUploads(prev => [...prev, ...newUploads])
        toast({
          title: `${newUploads.length} file(s) added`,
          description: "Ready to upload with duplicate detection",
        })
      }
    } catch (error) {
      console.error('Error in handleFileSelection:', error)
      toast({
        title: "Error processing files",
        description: "An unexpected error occurred while processing your files",
        variant: "destructive",
      })
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    try {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)
      handleFileSelection(e.dataTransfer.files)
    } catch (error) {
      console.error('Error handling file drop:', error)
      setDragActive(false)
      toast({
        title: "Error dropping files",
        description: "Please try selecting files manually",
        variant: "destructive",
      })
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    try {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(true)
    } catch (error) {
      console.error('Error handling drag over:', error)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    try {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)
    } catch (error) {
      console.error('Error handling drag leave:', error)
      setDragActive(false) // Ensure we reset state
    }
  }

  const updateUploadStatus = (uploadId: string, status: PendingUpload['status'], error?: string) => {
    try {
      if (!uploadId || typeof uploadId !== 'string') {
        console.error('Invalid uploadId provided to updateUploadStatus:', uploadId)
        return
      }

      setPendingUploads(prev => 
        prev.map(upload => 
          upload.id === uploadId 
            ? { ...upload, status, error } 
            : upload
        )
      )
    } catch (updateError) {
      console.error('Error updating upload status:', { uploadId, status, error: updateError })
    }
  }

  const updateUploadTitle = (uploadId: string, title: string) => {
    try {
      if (!uploadId || typeof uploadId !== 'string') {
        console.error('Invalid uploadId provided to updateUploadTitle:', uploadId)
        return
      }

      if (typeof title !== 'string') {
        console.error('Invalid title provided to updateUploadTitle:', title)
        return
      }

      setPendingUploads(prev => 
        prev.map(upload => 
          upload.id === uploadId 
            ? { ...upload, title: title.trim() } 
            : upload
        )
      )
    } catch (updateError) {
      console.error('Error updating upload title:', { uploadId, title, error: updateError })
    }
  }

  const removeUpload = (uploadId: string) => {
    try {
      if (!uploadId || typeof uploadId !== 'string') {
        console.error('Invalid uploadId provided to removeUpload:', uploadId)
        return
      }

      setPendingUploads(prev => prev.filter(upload => upload.id !== uploadId))
    } catch (removeError) {
      console.error('Error removing upload:', { uploadId, error: removeError })
    }
  }

  const startUpload = (uploadId: string) => {
    const upload = pendingUploads.find(u => u.id === uploadId)
    if (!upload) return

    updateUploadStatus(uploadId, 'checking')
  }

  const callExpertUpdateEndpoint = async () => {
    if (!expertName || !domainName) {
      console.log('expertName or domainName not provided, skipping expert update call')
      return
    }

    try {
      const { createClient } = await import('@/utils/supabase/client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        console.warn('No session found for expert update')
        return
      }

      const response = await fetch('http://127.0.0.1:8000/api/v1/rag/expert/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          expert_name: expertName,
          domain_name: domainName,
          qa_pairs: [] // Empty for now, can be expanded later
        })
      })

      if (response.ok) {
        const result = await response.json()
        console.log('Expert update completed successfully:', result)
        toast({
          title: "Expert updated successfully",
          description: "Your expert's knowledge has been refreshed with the new documents",
        })
      } else {
        console.warn('Expert update failed:', response.status)
      }
    } catch (error) {
      console.error('Error calling expert update endpoint:', error)
    }
  }

  const removeDocument = async (document: ExistingDocument) => {
    if (!document.id) return

    setIsRemoving(true)
    try {
      const { createClient } = await import('@/utils/supabase/client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('Authentication required for document removal')
      }

      // Call backend to remove document, assistants, and vector store
      const response = await fetch(`http://127.0.0.1:8000/api/v1/clones/${cloneId}/documents/${document.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to remove document: ${response.status} - ${errorText}`)
      }

      toast({
        title: "Document removed successfully",
        description: "The document and associated AI resources have been deleted",
      })

      // Call parent callback to update the UI
      if (onDocumentRemoved) {
        onDocumentRemoved(document.id)
      }

      // Update expert after removal
      await callExpertUpdateEndpoint()

    } catch (error) {
      console.error('Failed to remove document:', error)
      toast({
        title: "Failed to remove document",
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: "destructive",
      })
    } finally {
      setIsRemoving(false)
      setDocumentToRemove(null)
    }
  }

  const handleUploadSuccess = async (uploadId: string, document: any) => {
    updateUploadStatus(uploadId, 'completed')
    onDocumentUploaded(document)
    
    // Call expert update endpoint after successful upload
    await callExpertUpdateEndpoint()
    
    // Remove completed upload after a delay
    setTimeout(() => {
      removeUpload(uploadId)
    }, 3000)
  }

  const handleUploadError = (uploadId: string, error: string) => {
    updateUploadStatus(uploadId, 'error', error)
  }

  const handleUploadCancel = (uploadId: string) => {
    updateUploadStatus(uploadId, 'cancelled')
    // Remove cancelled upload after a delay
    setTimeout(() => {
      removeUpload(uploadId)
    }, 1000)
  }

  const getStatusIcon = (status: PendingUpload['status']) => {
    switch (status) {
      case 'waiting':
        return <FileText className="h-4 w-4 text-gray-500" />
      case 'checking':
      case 'uploading':
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'cancelled':
        return <X className="h-4 w-4 text-gray-400" />
      default:
        return <FileText className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: PendingUpload['status']) => {
    switch (status) {
      case 'waiting':
        return 'bg-gray-100 text-gray-800'
      case 'checking':
      case 'uploading':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'error':
        return 'bg-red-100 text-red-800'
      case 'cancelled':
        return 'bg-gray-100 text-gray-600'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="space-y-4">
      {/* Existing Documents */}
      {existingDocuments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Existing Documents ({existingDocuments.length})</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {existingDocuments.map((document) => (
                <div key={document.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">
                        {document.name || 'Untitled Document'}
                      </span>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge 
                          variant="secondary" 
                          className={
                            document.status === 'completed' ? 'bg-green-100 text-green-800' :
                            document.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                            document.status === 'failed' ? 'bg-red-100 text-red-800' :
                            document.status === 'uploaded' ? 'bg-blue-50 text-blue-700' :
                            'bg-gray-100 text-gray-800'
                          }
                        >
                          {document.status || 'unknown'}
                        </Badge>
                        {document.type && (
                          <Badge variant="outline" className="text-xs">
                            {document.type}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-3">
                    {document.url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(document.url, '_blank')}
                        disabled={isRemoving}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDocumentToRemove(document)}
                      disabled={isRemoving}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="h-5 w-5" />
            <span>Upload Documents</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-2">
              {existingDocuments.length > 0 ? 'Add More Documents' : 'Drop files here or click to browse'}
            </p>
            <p className="text-gray-600 mb-4">
              {allowedExtensions.join(', ')} files up to {maxFileSize}MB each
            </p>
            <p className="text-sm text-gray-500 mb-4">
              ✅ Automatic duplicate detection • ⚡ Smart content analysis
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={allowedExtensions.join(',')}
              onChange={(e) => handleFileSelection(e.target.files)}
              className="hidden"
            />
            <Button 
              variant="outline" 
              onClick={() => fileInputRef.current?.click()}
              className="bg-transparent"
            >
              Choose Files
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pending Uploads */}
      {pendingUploads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Uploads ({pendingUploads.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingUploads.map((upload) => (
                <div key={upload.id}>
                  {upload.status === 'checking' || upload.status === 'uploading' ? (
                    <DuplicateDetector
                      cloneId={cloneId}
                      file={upload.file}
                      title={upload.title}
                      description={upload.description}
                      tags={upload.tags}
                      onUploadSuccess={(document) => handleUploadSuccess(upload.id, document)}
                      onUploadError={(error) => handleUploadError(upload.id, error)}
                      onCancel={() => handleUploadCancel(upload.id)}
                    />
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        {getStatusIcon(upload.status)}
                        <div className="flex-1 min-w-0">
                          {upload.status === 'waiting' ? (
                            <Input
                              value={upload.title}
                              onChange={(e) => updateUploadTitle(upload.id, e.target.value)}
                              placeholder="Document title"
                              className="text-sm h-8"
                            />
                          ) : (
                            <span className="text-sm font-medium truncate block">
                              {upload.title}
                            </span>
                          )}
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-xs text-gray-500">
                              {upload.file.name} • {formatFileSize(upload.file.size)}
                            </span>
                            <Badge variant="secondary" className={getStatusColor(upload.status)}>
                              {upload.status}
                            </Badge>
                          </div>
                          {upload.error && (
                            <p className="text-xs text-red-600 mt-1">{upload.error}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-3">
                        {upload.status === 'waiting' && (
                          <Button
                            size="sm"
                            onClick={() => startUpload(upload.id)}
                            disabled={!upload.title.trim()}
                          >
                            Upload
                          </Button>
                        )}
                        {(upload.status === 'waiting' || upload.status === 'error') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeUpload(upload.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Document Removal Confirmation Dialog */}
      <AlertDialog open={!!documentToRemove} onOpenChange={() => !isRemoving && setDocumentToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Document</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>Are you sure you want to remove "{documentToRemove?.name || 'this document'}"? This action will:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Delete the document from storage</li>
                  <li>Remove associated AI assistants</li>
                  <li>Delete vector store embeddings</li>
                  <li>Update the expert's knowledge base</li>
                </ul>
                <p className="mt-2"><strong>This action cannot be undone.</strong></p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => documentToRemove && removeDocument(documentToRemove)}
              disabled={isRemoving}
              className="bg-red-600 hover:bg-red-700"
            >
              {isRemoving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Removing...
                </>
              ) : (
                'Remove Document'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}