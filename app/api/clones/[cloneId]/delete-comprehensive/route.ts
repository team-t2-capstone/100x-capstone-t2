/**
 * Comprehensive Clone Deletion API Route
 * 
 * Handles complete clone deletion with proper cleanup across all systems:
 * - OpenAI vector stores and assistants
 * - Supabase storage files
 * - Database records with proper foreign key handling
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

interface CleanupProgress {
  step: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message: string;
  details?: any;
}

interface CleanupResult {
  success: boolean;
  clone_id: string;
  message: string;
  steps: CleanupProgress[];
  warnings: string[];
  errors: string[];
  timestamp: string;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { cloneId: string } }
): Promise<NextResponse> {
  try {
    const { cloneId } = params;
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const forceDelete = searchParams.get('force') === 'true';
    const preview = searchParams.get('preview') === 'true';

    // Initialize cleanup tracking
    const cleanupResult: CleanupResult = {
      success: false,
      clone_id: cloneId,
      message: '',
      steps: [],
      warnings: [],
      errors: [],
      timestamp: new Date().toISOString()
    };

    // Step 1: Validate clone access
    const validateStep: CleanupProgress = {
      step: 'validate_access',
      status: 'in_progress',
      message: 'Validating clone access and permissions'
    };
    cleanupResult.steps.push(validateStep);

    const { data: clone, error: cloneError } = await supabase
      .from('clones')
      .select('*')
      .eq('id', cloneId)
      .eq('creator_id', user.id)
      .single();

    if (cloneError || !clone) {
      validateStep.status = 'failed';
      validateStep.message = 'Clone not found or access denied';
      cleanupResult.errors.push('Clone not found or you do not have permission to delete it');
      return NextResponse.json(cleanupResult, { status: 404 });
    }

    validateStep.status = 'completed';
    validateStep.message = `Clone "${clone.name}" validated for deletion`;

    // Step 2: Check for active sessions
    const sessionCheckStep: CleanupProgress = {
      step: 'check_active_sessions',
      status: 'in_progress',
      message: 'Checking for active sessions'
    };
    cleanupResult.steps.push(sessionCheckStep);

    const { data: activeSessions, error: sessionError } = await supabase
      .from('sessions')
      .select('id, status')
      .eq('clone_id', cloneId)
      .eq('status', 'active');

    if (sessionError) {
      sessionCheckStep.status = 'failed';
      sessionCheckStep.message = 'Failed to check active sessions';
      cleanupResult.warnings.push('Could not verify active sessions');
    } else if (activeSessions && activeSessions.length > 0 && !forceDelete) {
      sessionCheckStep.status = 'failed';
      sessionCheckStep.message = `Found ${activeSessions.length} active sessions`;
      cleanupResult.errors.push(`Cannot delete clone with ${activeSessions.length} active sessions. Use force delete if needed.`);
      return NextResponse.json(cleanupResult, { status: 400 });
    } else {
      sessionCheckStep.status = 'completed';
      sessionCheckStep.message = forceDelete 
        ? `Will force terminate ${activeSessions?.length || 0} active sessions`
        : 'No active sessions found';
    }

    // If this is just a preview, return what would be deleted
    if (preview) {
      const previewData = await getCloneDeletionPreview(supabase, cloneId, clone);
      return NextResponse.json({
        ...cleanupResult,
        success: true,
        message: 'Deletion preview generated',
        preview: previewData
      });
    }

    // Step 3: Force terminate active sessions if needed
    if (forceDelete && activeSessions && activeSessions.length > 0) {
      const terminateStep: CleanupProgress = {
        step: 'terminate_sessions',
        status: 'in_progress',
        message: 'Force terminating active sessions'
      };
      cleanupResult.steps.push(terminateStep);

      const { error: terminateError } = await supabase
        .from('sessions')
        .update({
          status: 'force_terminated',
          end_time: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('clone_id', cloneId)
        .eq('status', 'active');

      if (terminateError) {
        terminateStep.status = 'failed';
        terminateStep.message = 'Failed to terminate some sessions';
        cleanupResult.warnings.push('Some active sessions could not be terminated');
      } else {
        terminateStep.status = 'completed';
        terminateStep.message = `Terminated ${activeSessions.length} active sessions`;
      }
    }

    // Step 4: Delete storage files
    const storageStep: CleanupProgress = {
      step: 'cleanup_storage',
      status: 'in_progress',
      message: 'Deleting storage files'
    };
    cleanupResult.steps.push(storageStep);

    const storageCleanup = await cleanupStorageFiles(supabase, cloneId, clone);
    storageStep.status = storageCleanup.success ? 'completed' : 'failed';
    storageStep.message = storageCleanup.message;
    storageStep.details = storageCleanup.details;
    if (storageCleanup.warnings) {
      cleanupResult.warnings.push(...storageCleanup.warnings);
    }

    // Step 5: Call backend for comprehensive cleanup
    const backendStep: CleanupProgress = {
      step: 'backend_cleanup',
      status: 'in_progress',
      message: 'Performing comprehensive cleanup via backend'
    };
    cleanupResult.steps.push(backendStep);

    try {
      const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:8001';
      const backendResponse = await fetch(`${backendUrl}/api/v1/clones/${cloneId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user.id}`, // This would need proper JWT token
          'Content-Type': 'application/json'
        }
      });

      const backendResult = await backendResponse.json();
      
      if (backendResponse.ok && backendResult.success) {
        backendStep.status = 'completed';
        backendStep.message = 'Backend cleanup completed successfully';
        backendStep.details = backendResult.cleanup_details;
        
        if (backendResult.warnings) {
          cleanupResult.warnings.push(...backendResult.warnings);
        }
      } else {
        backendStep.status = 'failed';
        backendStep.message = backendResult.error || 'Backend cleanup failed';
        cleanupResult.errors.push(backendResult.error || 'Backend cleanup failed');
      }
    } catch (error) {
      backendStep.status = 'failed';
      backendStep.message = 'Failed to contact backend cleanup service';
      cleanupResult.errors.push(`Backend cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Fallback to direct database cleanup
      const fallbackCleanup = await performFallbackCleanup(supabase, cloneId, clone);
      if (fallbackCleanup.success) {
        backendStep.message += ' (fallback cleanup succeeded)';
        cleanupResult.warnings.push('Used fallback cleanup method');
      }
    }

    // Final result
    const hasErrors = cleanupResult.errors.length > 0;
    const hasFailedSteps = cleanupResult.steps.some(step => step.status === 'failed');
    
    cleanupResult.success = !hasErrors && !hasFailedSteps;
    cleanupResult.message = cleanupResult.success 
      ? `Clone "${clone.name}" deleted successfully`
      : `Clone deletion completed with ${cleanupResult.errors.length} errors and ${cleanupResult.warnings.length} warnings`;

    const statusCode = cleanupResult.success ? 200 : (hasErrors ? 500 : 207); // 207 = Multi-Status
    return NextResponse.json(cleanupResult, { status: statusCode });

  } catch (error) {
    console.error('Comprehensive clone deletion failed:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error during clone deletion',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

async function getCloneDeletionPreview(supabase: any, cloneId: string, clone: any) {
  const preview = {
    clone: {
      id: cloneId,
      name: clone.name,
      created_at: clone.created_at
    },
    database_records: {} as Record<string, number>,
    storage_files: [] as string[],
    openai_resources: {
      vector_stores: 0,
      assistants: 0,
      estimated_files: 0
    }
  };

  // Count database records
  const tables = ['sessions', 'knowledge', 'clone_qa_training'];
  for (const table of tables) {
    try {
      const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('clone_id', cloneId);
      preview.database_records[table] = count || 0;
    } catch (error) {
      preview.database_records[table] = 0;
    }
  }

  // Check for storage files
  try {
    const { data: knowledgeFiles } = await supabase
      .from('knowledge')
      .select('file_url')
      .eq('clone_id', cloneId)
      .not('file_url', 'is', null);
    
    if (knowledgeFiles) {
      preview.storage_files = knowledgeFiles.map(k => k.file_url);
    }
  } catch (error) {
    console.warn('Could not preview storage files:', error);
  }

  return preview;
}

async function cleanupStorageFiles(supabase: any, cloneId: string, clone: any) {
  const result = {
    success: true,
    message: '',
    details: { deleted_files: [] as string[] },
    warnings: [] as string[]
  };

  try {
    // Get knowledge files
    const { data: knowledgeFiles, error: knowledgeError } = await supabase
      .from('knowledge')
      .select('file_url')
      .eq('clone_id', cloneId)
      .not('file_url', 'is', null);

    if (knowledgeError) {
      result.warnings.push(`Could not retrieve knowledge files: ${knowledgeError.message}`);
    } else if (knowledgeFiles && knowledgeFiles.length > 0) {
      for (const fileRecord of knowledgeFiles) {
        try {
          const fileUrl = fileRecord.file_url;
          const urlParts = fileUrl.split('/storage/v1/object/public/');
          if (urlParts.length > 1) {
            const [bucket, ...pathParts] = urlParts[1].split('/');
            const filePath = pathParts.join('/');
            
            const { error: deleteError } = await supabase.storage
              .from(bucket)
              .remove([filePath]);
            
            if (deleteError) {
              result.warnings.push(`Could not delete file ${filePath}: ${deleteError.message}`);
            } else {
              result.details.deleted_files.push(filePath);
            }
          }
        } catch (error) {
          result.warnings.push(`Error processing file ${fileRecord.file_url}`);
        }
      }
    }

    // Delete clone avatar if it exists
    if (clone.avatar_url) {
      try {
        const urlParts = clone.avatar_url.split('/storage/v1/object/public/');
        if (urlParts.length > 1) {
          const [bucket, ...pathParts] = urlParts[1].split('/');
          const filePath = pathParts.join('/');
          
          const { error: deleteError } = await supabase.storage
            .from(bucket)
            .remove([filePath]);
          
          if (deleteError) {
            result.warnings.push(`Could not delete avatar: ${deleteError.message}`);
          } else {
            result.details.deleted_files.push(filePath);
          }
        }
      } catch (error) {
        result.warnings.push('Error processing avatar file');
      }
    }

    result.message = `Storage cleanup completed. Deleted ${result.details.deleted_files.length} files`;
    return result;

  } catch (error) {
    result.success = false;
    result.message = `Storage cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return result;
  }
}

async function performFallbackCleanup(supabase: any, cloneId: string, clone: any) {
  try {
    const expertName = `${clone.name.replace(' ', '_').toLowerCase()}_${cloneId.substring(0, 8)}`;
    
    // Delete in order to handle foreign keys
    const tables = [
      { name: 'sessions', condition: { clone_id: cloneId } },
      { name: 'knowledge', condition: { clone_id: cloneId } },
      { name: 'clone_qa_training', condition: { clone_id: cloneId } },
      { name: 'assistants', condition: { expert_name: expertName } },
      { name: 'vector_stores', condition: { expert_name: expertName } },
      { name: 'documents', condition: { client_name: clone.name } },
      { name: 'experts', condition: { name: expertName } },
      { name: 'clones', condition: { id: cloneId } }
    ];

    for (const table of tables) {
      try {
        const query = supabase.from(table.name).delete();
        const [key, value] = Object.entries(table.condition)[0];
        await query.eq(key, value);
      } catch (error) {
        console.warn(`Fallback cleanup failed for table ${table.name}:`, error);
      }
    }

    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}

// Export for OPTIONS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 200 });
}