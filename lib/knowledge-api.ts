// Stub implementation - RAG functionality removed
// This file provides minimal stubs to prevent build errors

export interface DuplicateCheckResponse {
  isDuplicate: boolean;
  existingDocument?: {
    id: string;
    title: string;
    hash: string;
  };
}

export interface DocumentUpload {
  file: File;
  title: string;
  description?: string;
  tags?: string[];
  hash: string;
}

// Stub function - always returns no duplicates
export async function checkDocumentDuplicate(
  cloneId: string,
  documentData: DocumentUpload
): Promise<DuplicateCheckResponse> {
  console.warn('checkDocumentDuplicate: RAG functionality disabled, returning no duplicates');
  return {
    isDuplicate: false
  };
}

// Stub function - generates a basic hash
export async function generateFileHash(file: File): Promise<string> {
  console.warn('generateFileHash: RAG functionality disabled, returning basic hash');
  // Generate a simple hash based on file name and size
  return `stub_${file.name}_${file.size}_${Date.now()}`;
}

// Stub function - returns success without uploading
export async function uploadDocumentWithOverwrite(
  cloneId: string,
  documentData: DocumentUpload,
  forceOverwrite: boolean = false
): Promise<any> {
  console.warn('uploadDocumentWithOverwrite: RAG functionality disabled, returning stub response');
  return {
    id: `stub_doc_${Date.now()}`,
    title: documentData.title,
    description: documentData.description,
    tags: documentData.tags || [],
    hash: documentData.hash,
    status: 'completed'
  };
}