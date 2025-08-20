"use client"

import React, { useState } from 'react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, AlertTriangle, CheckCircle, Clock, X } from 'lucide-react'
import { checkDocumentDuplicate, generateFileHash, uploadDocumentWithOverwrite, type DuplicateCheckResponse } from '@/lib/knowledge-api'
import { toast } from '@/components/ui/use-toast'

interface DuplicateDetectorProps {
  cloneId: string
  file: File
  title: string
  description?: string
  tags?: string[]
  onUploadSuccess: (document: any) => void
  onUploadError: (error: string) => void
  onCancel: () => void
}

export function DuplicateDetector({
  cloneId,
  file,
  title,
  description,
  tags,
  onUploadSuccess,
  onUploadError,
  onCancel
}: DuplicateDetectorProps) {
  const [isChecking, setIsChecking] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResponse | null>(null)
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)
  const [contentHash, setContentHash] = useState<string>('')

  const checkForDuplicates = async () => {
    setIsChecking(true)
    try {
      // Generate content hash for better duplicate detection
      const hash = await generateFileHash(file)
      setContentHash(hash)

      // Retry duplicate check with exponential backoff to handle race conditions
      let lastError: Error | null = null
      let duplicateResult: any = null
      let attempt = 0
      const maxAttempts = 3
      
      while (attempt < maxAttempts && !duplicateResult) {
        attempt++
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000) // 1s, 2s, 4s max
        
        if (attempt > 1) {
          console.log(`Duplicate check attempt ${attempt}/${maxAttempts} after ${waitTime}ms wait...`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
        }
        
        try {
          duplicateResult = await checkDocumentDuplicate(cloneId, {
            clone_id: cloneId,
            filename: file.name,
            file_size: file.size,
            content_hash: hash
          })
          break // Success
        } catch (error) {
          lastError = error as Error
          console.error(`Duplicate check attempt ${attempt} failed:`, error)
          
          // If it's a "Clone not found" error and we have more attempts, continue retrying
          if (error instanceof Error && error.message.includes('Clone not found') && attempt < maxAttempts) {
            console.log('Clone not found, retrying duplicate check...')
            continue
          }
          
          // For other errors or if we've exhausted attempts, break
          break
        }
      }
      
      if (duplicateResult) {
        setDuplicateResult(duplicateResult)
        
        if (duplicateResult.is_duplicate) {
          setShowDuplicateDialog(true)
        } else {
          // No duplicate found, proceed with upload
          await proceedWithUpload(false)
        }
      } else {
        // If duplicate check failed after all attempts, proceed with upload anyway
        console.warn('Duplicate check failed after all attempts, proceeding with upload:', lastError?.message)
        await proceedWithUpload(false)
      }
    } catch (error) {
      console.error('Error in duplicate check process:', error)
      // If duplicate check fails, proceed with upload anyway
      await proceedWithUpload(false)
    } finally {
      setIsChecking(false)
    }
  }

  const proceedWithUpload = async (forceOverwrite: boolean = false) => {
    setIsUploading(true)
    try {
      const document = await uploadDocumentWithOverwrite(
        cloneId,
        {
          file,
          title,
          description,
          tags
        },
        forceOverwrite
      )

      toast({
        title: "Document uploaded successfully",
        description: forceOverwrite 
          ? "Previous document was replaced with the new version"
          : "Document added to knowledge base",
      })

      onUploadSuccess(document)
      setShowDuplicateDialog(false)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      
      // Check if it's a duplicate error (409 status)
      if (errorMessage.includes('already exists') || errorMessage.includes('duplicate')) {
        // This shouldn't happen if we checked properly, but handle gracefully
        setShowDuplicateDialog(true)
      } else {
        toast({
          title: "Upload failed",
          description: errorMessage,
          variant: "destructive",
        })
        onUploadError(errorMessage)
      }
    } finally {
      setIsUploading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-500" />
      case 'failed':
        return <X className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'processing':
        return 'bg-blue-100 text-blue-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getMatchTypeDescription = (matchType: string) => {
    switch (matchType) {
      case 'filename':
        return 'Same filename detected'
      case 'content_hash':
        return 'Identical content detected'
      case 'size_and_name':
        return 'Similar name and file size'
      default:
        return 'Potential duplicate'
    }
  }

  // Start duplicate check automatically when component mounts, with a slight delay to allow clone creation to complete
  React.useEffect(() => {
    const timer = setTimeout(() => {
      checkForDuplicates()
    }, 500) // 500ms delay to allow clone creation to propagate
    
    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      {/* Loading state */}
      {isChecking && (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-sm text-gray-600">Checking for duplicate documents...</p>
          </div>
        </div>
      )}

      {/* Duplicate detection dialog */}
      <AlertDialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <span>Document Already Exists</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              {duplicateResult?.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4">
            {duplicateResult?.existing_document && (
              <div className="bg-gray-50 p-3 rounded-lg border">
                <div className="flex items-start space-x-3">
                  <FileText className="h-4 w-4 text-gray-500 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {duplicateResult.existing_document.filename}
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      {getStatusIcon(duplicateResult.existing_document.processing_status)}
                      <Badge variant="secondary" className={getStatusColor(duplicateResult.existing_document.processing_status)}>
                        {duplicateResult.existing_document.processing_status}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {getMatchTypeDescription(duplicateResult.existing_document.match_type)}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Uploaded: {new Date(duplicateResult.existing_document.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-400">
              <p className="text-sm text-blue-800">
                <strong>What would you like to do?</strong>
              </p>
              <div className="text-xs text-blue-700 mt-1 space-y-1">
                <div>• <strong>Replace:</strong> Remove the existing document and upload this one</div>
                <div>• <strong>Cancel:</strong> Keep the existing document and don't upload</div>
              </div>
            </div>
          </div>
          <AlertDialogFooter className="space-x-2">
            <AlertDialogCancel 
              onClick={() => {
                setShowDuplicateDialog(false)
                onCancel()
              }}
              disabled={isUploading}
            >
              Cancel Upload
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => proceedWithUpload(true)}
              disabled={isUploading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isUploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Replacing...
                </>
              ) : (
                'Replace Existing'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}