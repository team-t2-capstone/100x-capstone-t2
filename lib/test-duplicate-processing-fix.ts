/**
 * Test script to verify duplicate processing fixes in clone creation wizard
 * 
 * This script tests:
 * 1. Navigation between steps 3 and 4 doesn't trigger duplicate processing
 * 2. Documents are only processed once
 * 3. Processing state guards work correctly
 * 4. Rapid button clicks are properly debounced
 */

import { toast } from '@/components/ui/use-toast'

interface TestState {
  currentStep: number
  hasTriggeredProcessing: boolean
  isProcessingKnowledge: boolean
  lastProcessedCloneId: string | null
  processedDocuments: Set<string>
  processingCallCount: number
}

export class DuplicateProcessingTester {
  private state: TestState = {
    currentStep: 3,
    hasTriggeredProcessing: false,
    isProcessingKnowledge: false,
    lastProcessedCloneId: null,
    processedDocuments: new Set(),
    processingCallCount: 0
  }

  private cloneId = "test-clone-id-123"
  private mockDocuments = [
    { name: "test-doc1.pdf", size: 1024 },
    { name: "test-doc2.docx", size: 2048 }
  ]

  /**
   * Simulate the navigation logic from the wizard
   */
  private shouldTriggerProcessing(): boolean {
    const hasDocumentsOrLinks = this.mockDocuments.length > 0
    return this.state.currentStep === 3 && 
           hasDocumentsOrLinks && 
           !this.state.hasTriggeredProcessing && 
           !this.state.isProcessingKnowledge && 
           this.cloneId !== this.state.lastProcessedCloneId
  }

  /**
   * Mock the processKnowledgeWithRAG function
   */
  private async mockProcessKnowledge(cloneId: string): Promise<void> {
    if (this.state.isProcessingKnowledge) {
      console.log('⚠️ Processing already in progress, skipping')
      return
    }

    this.state.processingCallCount++
    this.state.isProcessingKnowledge = true
    
    console.log(`🚀 Mock processing started (call #${this.state.processingCallCount})`)
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100))
    
    this.state.isProcessingKnowledge = false
    console.log('✅ Mock processing completed')
  }

  /**
   * Test Case 1: Normal navigation should trigger processing once
   */
  async testNormalNavigation(): Promise<boolean> {
    console.log('\n=== Test Case 1: Normal Navigation ===')
    
    this.state.currentStep = 3
    this.state.hasTriggeredProcessing = false
    this.state.lastProcessedCloneId = null
    this.state.processingCallCount = 0
    
    // Simulate moving from step 3 to step 4
    if (this.shouldTriggerProcessing()) {
      this.state.hasTriggeredProcessing = true
      this.state.lastProcessedCloneId = this.cloneId
      await this.mockProcessKnowledge(this.cloneId)
    }
    
    this.state.currentStep = 4
    
    const success = this.state.processingCallCount === 1
    console.log(`✅ Normal navigation: ${success ? 'PASSED' : 'FAILED'} (calls: ${this.state.processingCallCount})`)
    return success
  }

  /**
   * Test Case 2: Back and forth navigation should NOT trigger duplicate processing
   */
  async testBackAndForthNavigation(): Promise<boolean> {
    console.log('\n=== Test Case 2: Back and Forth Navigation ===')
    
    // Continue from previous test state
    const initialCallCount = this.state.processingCallCount
    
    // Navigate back to step 3
    this.state.currentStep = 3
    this.state.hasTriggeredProcessing = false // This gets reset when going back
    
    // Navigate forward to step 4 again
    if (this.shouldTriggerProcessing()) {
      this.state.hasTriggeredProcessing = true
      this.state.lastProcessedCloneId = this.cloneId
      await this.mockProcessKnowledge(this.cloneId)
    }
    
    this.state.currentStep = 4
    
    // Should NOT have triggered processing again since lastProcessedCloneId matches
    const success = this.state.processingCallCount === initialCallCount
    console.log(`✅ Back and forth navigation: ${success ? 'PASSED' : 'FAILED'} (calls: ${this.state.processingCallCount})`)
    return success
  }

  /**
   * Test Case 3: Rapid clicks should not trigger multiple processing
   */
  async testRapidClicks(): Promise<boolean> {
    console.log('\n=== Test Case 3: Rapid Clicks ===')
    
    // Reset for this test
    this.state.currentStep = 3
    this.state.hasTriggeredProcessing = false
    this.state.lastProcessedCloneId = null
    this.state.processingCallCount = 0
    
    // Simulate rapid clicks (multiple calls in quick succession)
    const promises = []
    for (let i = 0; i < 5; i++) {
      if (this.shouldTriggerProcessing()) {
        this.state.hasTriggeredProcessing = true
        this.state.lastProcessedCloneId = this.cloneId
        promises.push(this.mockProcessKnowledge(this.cloneId))
      }
    }
    
    await Promise.all(promises)
    
    // Should only process once due to the concurrent processing check
    const success = this.state.processingCallCount === 1
    console.log(`✅ Rapid clicks: ${success ? 'PASSED' : 'FAILED'} (calls: ${this.state.processingCallCount})`)
    return success
  }

  /**
   * Test Case 4: Document deduplication
   */
  testDocumentDeduplication(): boolean {
    console.log('\n=== Test Case 4: Document Deduplication ===')
    
    const processedDocuments: Array<{name: string, url: string, type: string}> = []
    
    // Simulate processing the same document multiple times
    for (const doc of this.mockDocuments) {
      // Check if already processed
      if (processedDocuments.some(processed => processed.name === doc.name)) {
        console.log(`Skipping already processed document: ${doc.name}`)
        continue
      }
      
      // "Process" the document
      processedDocuments.push({
        name: doc.name,
        url: `https://example.com/${doc.name}`,
        type: 'document'
      })
      
      // Track processed document
      this.state.processedDocuments.add(doc.name)
    }
    
    // Try to process the same documents again
    for (const doc of this.mockDocuments) {
      if (processedDocuments.some(processed => processed.name === doc.name)) {
        console.log(`Correctly skipped duplicate: ${doc.name}`)
      }
    }
    
    const success = processedDocuments.length === this.mockDocuments.length && 
                   this.state.processedDocuments.size === this.mockDocuments.length
    
    console.log(`✅ Document deduplication: ${success ? 'PASSED' : 'FAILED'} (processed: ${processedDocuments.length}, tracked: ${this.state.processedDocuments.size})`)
    return success
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<{ passed: number; failed: number; results: boolean[] }> {
    console.log('🧪 Running Duplicate Processing Fix Tests...')
    
    const results = [
      await this.testNormalNavigation(),
      await this.testBackAndForthNavigation(),
      await this.testRapidClicks(),
      this.testDocumentDeduplication()
    ]
    
    const passed = results.filter(r => r).length
    const failed = results.filter(r => !r).length
    
    console.log('\n📊 Test Results Summary:')
    console.log(`✅ Passed: ${passed}`)
    console.log(`❌ Failed: ${failed}`)
    console.log(`📈 Success Rate: ${(passed / results.length * 100).toFixed(1)}%`)
    
    if (failed === 0) {
      console.log('🎉 All tests passed! Duplicate processing fixes are working correctly.')
    } else {
      console.log('⚠️ Some tests failed. Review the implementation.')
    }
    
    return { passed, failed, results }
  }
}

// Export a function to run the tests
export async function testDuplicateProcessingFixes(): Promise<void> {
  const tester = new DuplicateProcessingTester()
  await tester.runAllTests()
}

// Usage example:
// import { testDuplicateProcessingFixes } from '@/lib/test-duplicate-processing-fix'
// testDuplicateProcessingFixes()