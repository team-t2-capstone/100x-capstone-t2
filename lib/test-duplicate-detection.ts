/**
 * Test script to verify the duplicate detection fixes
 * This can be imported and used to test the enhanced document upload component
 */

export interface TestDocument {
  id: string
  name?: string | null
  url?: string | null
  status?: string | null
  type?: string | null
}

// Test checkForExistingDuplicate function with various edge cases
export function testCheckForExistingDuplicate(
  filename: string,
  existingDocuments: TestDocument[]
): boolean {
  try {
    // Validate inputs
    if (!filename || typeof filename !== 'string') {
      console.warn('Invalid filename provided to checkForExistingDuplicate:', filename)
      return false
    }

    if (!Array.isArray(existingDocuments)) {
      console.warn('existingDocuments is not an array:', existingDocuments)
      return false
    }

    return existingDocuments.some(doc => {
      // Comprehensive null/undefined checks
      if (!doc) {
        console.warn('Found null/undefined document in existingDocuments')
        return false
      }

      if (!doc.name || typeof doc.name !== 'string') {
        console.warn('Found document without valid name in existingDocuments:', {
          id: doc.id,
          name: doc.name,
          type: typeof doc.name
        })
        return false
      }
      
      try {
        return doc.name.toLowerCase() === filename.toLowerCase() && 
               doc.status !== 'failed'
      } catch (nameError) {
        console.warn('Error processing document name:', {
          docName: doc.name,
          filename,
          error: nameError
        })
        return false
      }
    })
  } catch (error) {
    console.error('Error checking for existing duplicate:', {
      error,
      filename,
      existingDocumentsType: typeof existingDocuments,
      existingDocumentsLength: Array.isArray(existingDocuments) ? existingDocuments.length : 'N/A'
    })
    return false // Assume no duplicate if we can't check
  }
}

// Test cases for the duplicate detection
export const testCases = [
  {
    name: 'Normal case with valid documents',
    filename: 'test.pdf',
    existingDocuments: [
      { id: '1', name: 'document1.pdf', status: 'completed', type: 'document' },
      { id: '2', name: 'test.pdf', status: 'completed', type: 'document' }
    ],
    expected: true
  },
  {
    name: 'Case insensitive matching',
    filename: 'TEST.PDF',
    existingDocuments: [
      { id: '1', name: 'test.pdf', status: 'completed', type: 'document' }
    ],
    expected: true
  },
  {
    name: 'Document with null name',
    filename: 'test.pdf',
    existingDocuments: [
      { id: '1', name: null, status: 'completed', type: 'document' },
      { id: '2', name: 'other.pdf', status: 'completed', type: 'document' }
    ],
    expected: false
  },
  {
    name: 'Document with undefined name',
    filename: 'test.pdf',
    existingDocuments: [
      { id: '1', name: undefined, status: 'completed', type: 'document' },
      { id: '2', name: 'other.pdf', status: 'completed', type: 'document' }
    ],
    expected: false
  },
  {
    name: 'Failed status document should not count as duplicate',
    filename: 'test.pdf',
    existingDocuments: [
      { id: '1', name: 'test.pdf', status: 'failed', type: 'document' }
    ],
    expected: false
  },
  {
    name: 'Empty filename',
    filename: '',
    existingDocuments: [
      { id: '1', name: 'test.pdf', status: 'completed', type: 'document' }
    ],
    expected: false
  },
  {
    name: 'Null existing documents array',
    filename: 'test.pdf',
    existingDocuments: null as any,
    expected: false
  },
  {
    name: 'Undefined existing documents array',
    filename: 'test.pdf',
    existingDocuments: undefined as any,
    expected: false
  },
  {
    name: 'Document with empty string name',
    filename: 'test.pdf',
    existingDocuments: [
      { id: '1', name: '', status: 'completed', type: 'document' }
    ],
    expected: false
  },
  {
    name: 'Mixed valid and invalid documents',
    filename: 'valid.pdf',
    existingDocuments: [
      { id: '1', name: null, status: 'completed', type: 'document' },
      { id: '2', name: 'valid.pdf', status: 'completed', type: 'document' },
      { id: '3', name: undefined, status: 'completed', type: 'document' }
    ],
    expected: true
  }
]

// Run all test cases
export function runDuplicateDetectionTests(): void {
  console.log('Running duplicate detection tests...')
  
  let passed = 0
  let failed = 0
  
  testCases.forEach((testCase, index) => {
    try {
      const result = testCheckForExistingDuplicate(testCase.filename, testCase.existingDocuments)
      if (result === testCase.expected) {
        console.log(`✅ Test ${index + 1}: ${testCase.name} - PASSED`)
        passed++
      } else {
        console.log(`❌ Test ${index + 1}: ${testCase.name} - FAILED (expected ${testCase.expected}, got ${result})`)
        failed++
      }
    } catch (error) {
      console.log(`💥 Test ${index + 1}: ${testCase.name} - ERROR:`, error)
      failed++
    }
  })
  
  console.log(`\nTest Results: ${passed} passed, ${failed} failed`)
  
  if (failed === 0) {
    console.log('🎉 All tests passed! Duplicate detection is working correctly.')
  } else {
    console.log('⚠️  Some tests failed. Check the implementation.')
  }
}

// Test the safe document mapping
export function testSafeDocumentMapping(rawDocument: any): TestDocument {
  try {
    const safeName = (
      rawDocument?.title || 
      rawDocument?.file_name || 
      rawDocument?.name || 
      (rawDocument?.file_url ? `Document-${rawDocument.id}` : '') ||
      (rawDocument?.original_url ? `Link-${rawDocument.id}` : '') ||
      `Item-${rawDocument?.id || Date.now()}`
    ).trim()

    return {
      id: rawDocument?.id || `knowledge-${Date.now()}`,
      name: safeName || `Unknown-${Date.now()}`,
      url: rawDocument?.file_url || rawDocument?.original_url || '',
      status: rawDocument?.vector_store_status || 'pending',
      type: rawDocument?.content_type || 'unknown'
    }
  } catch (error) {
    console.error('Error in safe document mapping:', error)
    return {
      id: `error-${Date.now()}`,
      name: `Error-${Date.now()}`,
      url: '',
      status: 'error',
      type: 'unknown'
    }
  }
}

// Usage example:
// import { runDuplicateDetectionTests } from '@/lib/test-duplicate-detection'
// runDuplicateDetectionTests()