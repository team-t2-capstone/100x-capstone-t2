/**
 * Test utility for validating the knowledge loading functionality
 * This can be used to test the auto-population features
 */

import { supabase } from './supabase';

export interface KnowledgeTestResult {
  success: boolean;
  documentsCount: number;
  linksCount: number;
  processingStatus: string;
  errors: string[];
}

/**
 * Test the knowledge loading functionality for a specific clone
 */
export async function testKnowledgeLoading(cloneId: string): Promise<KnowledgeTestResult> {
  const errors: string[] = [];
  
  try {
    console.log('Testing knowledge loading for clone:', cloneId);
    
    // Test 1: Load knowledge data
    const { data: knowledgeData, error } = await supabase
      .from('knowledge')
      .select('*')
      .eq('clone_id', cloneId)
      .order('created_at', { ascending: false });
    
    if (error) {
      errors.push(`Knowledge query error: ${error.message}`);
      return {
        success: false,
        documentsCount: 0,
        linksCount: 0,
        processingStatus: 'error',
        errors
      };
    }
    
    if (!knowledgeData) {
      return {
        success: true,
        documentsCount: 0,
        linksCount: 0,
        processingStatus: 'no_data',
        errors
      };
    }
    
    console.log(`Loaded ${knowledgeData.length} knowledge entries`);
    
    // Test 2: Separate documents and links
    const documents = knowledgeData.filter(item => item.content_type === 'document' && item.file_url);
    const links = knowledgeData.filter(item => item.content_type === 'link' && item.original_url);
    
    console.log(`Found ${documents.length} documents and ${links.length} links`);
    
    // Test 3: Determine processing status
    const allStatuses = knowledgeData.map(item => item.vector_store_status);
    let overallStatus = 'pending';
    
    if (allStatuses.length > 0) {
      if (allStatuses.every(status => status === 'completed')) {
        overallStatus = 'completed';
      } else if (allStatuses.some(status => status === 'processing')) {
        overallStatus = 'processing';
      } else if (allStatuses.some(status => status === 'failed')) {
        overallStatus = 'partial';
      }
    }
    
    console.log('Processing status analysis:', {
      totalItems: knowledgeData.length,
      statuses: allStatuses,
      overallStatus
    });
    
    // Test 4: Validate data structure
    const invalidItems = knowledgeData.filter(item => 
      !item.id || !item.title || !item.content_type
    );
    
    if (invalidItems.length > 0) {
      errors.push(`Found ${invalidItems.length} invalid knowledge items`);
    }
    
    return {
      success: errors.length === 0,
      documentsCount: documents.length,
      linksCount: links.length,
      processingStatus: overallStatus,
      errors
    };
    
  } catch (error) {
    console.error('Test error:', error);
    errors.push(`Exception: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    return {
      success: false,
      documentsCount: 0,
      linksCount: 0,
      processingStatus: 'error',
      errors
    };
  }
}

/**
 * Test the Q&A loading functionality
 */
export async function testQALoading(cloneId: string): Promise<{
  success: boolean;
  qaCount: number;
  errors: string[];
}> {
  const errors: string[] = [];
  
  try {
    console.log('Testing Q&A loading for clone:', cloneId);
    
    const { data, error } = await supabase
      .from('clone_qa_data')
      .select('qa_data')
      .eq('clone_id', cloneId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No Q&A data found - this is OK
        return {
          success: true,
          qaCount: 0,
          errors
        };
      }
      errors.push(`Q&A query error: ${error.message}`);
      return {
        success: false,
        qaCount: 0,
        errors
      };
    }
    
    const qaData = data?.qa_data || {};
    const qaCount = Object.keys(qaData).length;
    
    console.log(`Found ${qaCount} Q&A responses`);
    
    return {
      success: true,
      qaCount,
      errors
    };
    
  } catch (error) {
    console.error('Q&A test error:', error);
    errors.push(`Exception: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    return {
      success: false,
      qaCount: 0,
      errors
    };
  }
}

/**
 * Test complete clone data loading (simulates wizard auto-population)
 */
export async function testCompleteCloneLoading(cloneId: string): Promise<{
  success: boolean;
  cloneData: any;
  knowledgeResult: KnowledgeTestResult;
  qaResult: any;
  errors: string[];
}> {
  const errors: string[] = [];
  
  try {
    console.log('Testing complete clone loading for:', cloneId);
    
    // Test 1: Load basic clone data
    const { data: cloneData, error: cloneError } = await supabase
      .from('clones')
      .select('*')
      .eq('id', cloneId)
      .single();
    
    if (cloneError) {
      errors.push(`Clone query error: ${cloneError.message}`);
      return {
        success: false,
        cloneData: null,
        knowledgeResult: { success: false, documentsCount: 0, linksCount: 0, processingStatus: 'error', errors: [] },
        qaResult: { success: false, qaCount: 0, errors: [] },
        errors
      };
    }
    
    console.log('Clone data loaded:', cloneData.name);
    
    // Test 2: Load knowledge data
    const knowledgeResult = await testKnowledgeLoading(cloneId);
    
    // Test 3: Load Q&A data
    const qaResult = await testQALoading(cloneId);
    
    // Combine errors
    errors.push(...knowledgeResult.errors, ...qaResult.errors);
    
    const success = knowledgeResult.success && qaResult.success && errors.length === 0;
    
    console.log('Complete loading test result:', {
      success,
      hasClone: !!cloneData,
      documentsCount: knowledgeResult.documentsCount,
      linksCount: knowledgeResult.linksCount,
      qaCount: qaResult.qaCount,
      processingStatus: knowledgeResult.processingStatus
    });
    
    return {
      success,
      cloneData,
      knowledgeResult,
      qaResult,
      errors
    };
    
  } catch (error) {
    console.error('Complete loading test error:', error);
    errors.push(`Exception: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    return {
      success: false,
      cloneData: null,
      knowledgeResult: { success: false, documentsCount: 0, linksCount: 0, processingStatus: 'error', errors: [] },
      qaResult: { success: false, qaCount: 0, errors: [] },
      errors
    };
  }
}

// Example usage:
// const result = await testCompleteCloneLoading('your-clone-id-here');
// console.log('Test result:', result);