"use client"

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Upload, FileText, X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { apiClient } from '@/lib/api-client'

// File validation constants (matching backend)
const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.doc', '.docx', '.md', '.rtf']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_FILES = 5

// Validation schema
const documentUploadSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  tags: z.string().optional(),
})

type DocumentUploadData = z.infer<typeof documentUploadSchema>

interface UploadFile extends File {
  id: string
  progress: number
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error'
  error?: string
  uploadedId?: string
}

interface DocumentUploadProps {
  cloneId?: string
  onUploadComplete?: (documents: any[]) => void
  maxFiles?: number
  showCloneSelector?: boolean
}

export function DocumentUpload({ 
  cloneId, 
  onUploadComplete,
  maxFiles = MAX_FILES,
  showCloneSelector = false 
}: DocumentUploadProps) {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const { toast } = useToast()

  const form = useForm<DocumentUploadData>({
    resolver: zodResolver(documentUploadSchema),
    defaultValues: {
      title: '',
      description: '',
      tags: '',
    },
  })

  // File validation
  const validateFile = (file: File): string | null => {
    // Check file extension
    const extension = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return `File type not supported. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`
    }

    return null
  }

  // Dropzone configuration
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = []
    
    acceptedFiles.forEach((file) => {
      // Check if we're at max files limit
      if (files.length + newFiles.length >= maxFiles) {
        toast({
          variant: "destructive",
          title: "Too many files",
          description: `Maximum ${maxFiles} files allowed`,
        })
        return
      }

      // Validate file
      const error = validateFile(file)
      if (error) {
        toast({
          variant: "destructive",
          title: "Invalid file",
          description: error,
        })
        return
      }

      // Check for duplicates
      const isDuplicate = files.some(f => f.name === file.name && f.size === file.size) ||
                          newFiles.some(f => f.name === file.name && f.size === file.size)
      
      if (isDuplicate) {
        toast({
          variant: "destructive",
          title: "Duplicate file",
          description: `${file.name} is already selected`,
        })
        return
      }

      const uploadFile: UploadFile = {
        ...file,
        id: Math.random().toString(36).substr(2, 9),
        progress: 0,
        status: 'pending'
      }
      
      newFiles.push(uploadFile)
    })

    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles])
      
      // Auto-fill title if it's empty and we have one file
      if (newFiles.length === 1 && !form.getValues('title')) {
        const fileName = newFiles[0].name.split('.').slice(0, -1).join('.')
        form.setValue('title', fileName)
      }
    }
  }, [files, maxFiles, toast, form])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/markdown': ['.md'],
      'application/rtf': ['.rtf'],
    },
    multiple: true,
    maxFiles: maxFiles,
  })

  // Remove file
  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId))
  }

  // Upload single file
  const uploadFile = async (file: UploadFile, metadata: DocumentUploadData): Promise<boolean> => {
    if (!cloneId) {
      throw new Error('Clone ID is required for upload')
    }

    try {
      // Update file status
      setFiles(prev => prev.map(f => 
        f.id === file.id ? { ...f, status: 'uploading' as const, progress: 0 } : f
      ))

      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', metadata.title)
      if (metadata.description) {
        formData.append('description', metadata.description)
      }
      if (metadata.tags) {
        formData.append('tags_str', metadata.tags)
      }

      const response = await apiClient.post(
        `/clones/${cloneId}/documents`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const progress = progressEvent.total 
              ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
              : 0
            
            setFiles(prev => prev.map(f => 
              f.id === file.id ? { ...f, progress } : f
            ))
          },
        }
      )

      // Update file status to processing
      setFiles(prev => prev.map(f => 
        f.id === file.id 
          ? { 
              ...f, 
              status: 'processing' as const, 
              progress: 100,
              uploadedId: response.data.id 
            } 
          : f
      ))

      // Simulate processing time (in real app, you'd poll for status)
      setTimeout(() => {
        setFiles(prev => prev.map(f => 
          f.id === file.id ? { ...f, status: 'completed' as const } : f
        ))
      }, 2000)

      return true

    } catch (error: any) {
      console.error('Upload error:', error)
      
      const errorMessage = error.response?.data?.detail || 'Upload failed'
      
      setFiles(prev => prev.map(f => 
        f.id === file.id 
          ? { ...f, status: 'error' as const, error: errorMessage }
          : f
      ))

      throw error
    }
  }

  // Upload all files
  const onSubmit = async (data: DocumentUploadData) => {
    if (files.length === 0) {
      toast({
        variant: "destructive",
        title: "No files selected",
        description: "Please select at least one file to upload",
      })
      return
    }

    if (!cloneId) {
      toast({
        variant: "destructive",
        title: "Clone required",
        description: "Please select a clone to upload documents to",
      })
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    try {
      const uploadPromises = files.map(async (file, index) => {
        const fileMetadata = {
          title: files.length === 1 ? data.title : `${data.title} - ${file.name}`,
          description: data.description,
          tags: data.tags,
        }

        await uploadFile(file, fileMetadata)
        
        // Update overall progress
        setUploadProgress(((index + 1) / files.length) * 100)
      })

      await Promise.all(uploadPromises)

      toast({
        title: "Upload successful",
        description: `${files.length} document(s) uploaded successfully`,
      })

      // Callback with uploaded files
      if (onUploadComplete) {
        const uploadedDocs = files.map(f => ({
          id: f.uploadedId,
          name: f.name,
          status: f.status,
        }))
        onUploadComplete(uploadedDocs)
      }

      // Reset form
      form.reset()
      setFiles([])

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: "Some files failed to upload. Please try again.",
      })
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'pending':
        return <FileText className="h-4 w-4 text-slate-500" />
      case 'uploading':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      case 'processing':
        return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <FileText className="h-4 w-4 text-slate-500" />
    }
  }

  const getStatusText = (status: UploadFile['status']) => {
    switch (status) {
      case 'pending':
        return 'Ready to upload'
      case 'uploading':
        return 'Uploading...'
      case 'processing':
        return 'Processing...'
      case 'completed':
        return 'Completed'
      case 'error':
        return 'Failed'
      default:
        return 'Unknown'
    }
  }

  return (
    <div className="w-full space-y-6">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Documents
          </CardTitle>
          <CardDescription>
            Upload documents to your clone's knowledge base. Supported formats: PDF, TXT, DOC, DOCX, MD, RTF
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-slate-300 dark:border-slate-700 hover:border-primary/50'
              }
            `}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            {isDragActive ? (
              <p className="text-lg font-medium text-primary">
                Drop files here...
              </p>
            ) : (
              <>
                <p className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                  Drag and drop your files here
                </p>
                <p className="text-slate-600 dark:text-slate-300 mb-4">
                  Or click to browse files ({ALLOWED_EXTENSIONS.join(', ')}) up to {MAX_FILE_SIZE / (1024 * 1024)}MB each
                </p>
                <Button variant="outline" type="button">
                  Choose Files
                </Button>
              </>
            )}
          </div>

          {/* Selected Files */}
          {files.length > 0 && (
            <div className="mt-6 space-y-3">
              <h4 className="font-medium text-sm">Selected Files ({files.length}/{maxFiles})</h4>
              <div className="space-y-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      {getStatusIcon(file.status)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <div className="flex items-center space-x-2 text-xs text-slate-500">
                          <span>{(file.size / 1024).toFixed(1)} KB</span>
                          <span>•</span>
                          <span>{getStatusText(file.status)}</span>
                          {file.error && (
                            <>
                              <span>•</span>
                              <span className="text-red-500">{file.error}</span>
                            </>
                          )}
                        </div>
                        {(file.status === 'uploading' || file.status === 'processing') && (
                          <Progress value={file.progress} className="mt-1" />
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(file.id)}
                      disabled={file.status === 'uploading' || file.status === 'processing'}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Form */}
          {files.length > 0 && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter document title..." />
                      </FormControl>
                      <FormDescription>
                        A descriptive title for the document(s)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder="Enter description (optional)..."
                          rows={3}
                        />
                      </FormControl>
                      <FormDescription>
                        Additional context about the document content
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tags</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="tag1, tag2, tag3..."
                        />
                      </FormControl>
                      <FormDescription>
                        Comma-separated tags to help organize documents
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!cloneId && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Please select a clone to upload documents to.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="text-sm text-slate-600">
                    {files.length} file(s) selected
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setFiles([])}
                      disabled={isUploading}
                    >
                      Clear All
                    </Button>
                    <Button
                      type="submit"
                      disabled={isUploading || !cloneId}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Uploading... ({Math.round(uploadProgress)}%)
                        </>
                      ) : (
                        'Upload Documents'
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Dialog version for modal usage
export function DocumentUploadDialog({ 
  children, 
  cloneId, 
  onUploadComplete,
  ...props 
}: DocumentUploadProps & { 
  children: React.ReactNode 
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Documents</DialogTitle>
          <DialogDescription>
            Add documents to your clone's knowledge base for enhanced conversations
          </DialogDescription>
        </DialogHeader>
        <DocumentUpload 
          cloneId={cloneId}
          onUploadComplete={onUploadComplete}
          {...props}
        />
      </DialogContent>
    </Dialog>
  )
}