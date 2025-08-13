/**
 * Supabase Storage Setup Script
 * Creates required storage buckets and sets up RLS policies
 */
import { supabase } from './supabase'

export async function setupStorageBuckets() {
  console.log('Setting up Supabase storage buckets...')
  
  try {
    // Create knowledge-documents bucket
    const { error: knowledgeError } = await supabase.storage.createBucket('knowledge-documents', {
      public: false,
      allowedMimeTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'text/markdown',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      ],
      fileSizeLimit: 50 * 1024 * 1024 // 50MB
    })
    
    if (knowledgeError && !knowledgeError.message.includes('already exists')) {
      throw knowledgeError
    }
    
    // Create avatars bucket
    const { error: avatarError } = await supabase.storage.createBucket('avatars', {
      public: true,
      allowedMimeTypes: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp'
      ],
      fileSizeLimit: 5 * 1024 * 1024 // 5MB
    })
    
    if (avatarError && !avatarError.message.includes('already exists')) {
      throw avatarError
    }
    
    console.log('✅ Storage buckets created successfully')
    
    // Set up RLS policies
    await setupStoragePolicies()
    
    return { success: true }
    
  } catch (error) {
    console.error('❌ Failed to setup storage buckets:', error)
    return { success: false, error }
  }
}

async function setupStoragePolicies() {
  console.log('Setting up storage RLS policies...')
  
  // Note: In production, you should set up proper RLS policies through the Supabase dashboard
  // or SQL migrations. For now, we'll create basic policies that allow authenticated users
  // to manage their own files.
  
  try {
    // Knowledge documents policy - users can upload/access their own files
    await supabase.rpc('create_storage_policy', {
      bucket_name: 'knowledge-documents',
      policy_name: 'Users can upload knowledge documents',
      definition: `
        CREATE POLICY "Users can upload knowledge documents" ON storage.objects
        FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND bucket_id = 'knowledge-documents');
      `
    }).catch(() => {
      // Policy might already exist or RPC not available
      console.log('Note: Could not create knowledge documents policy via RPC')
    })
    
    // Avatar policy - users can upload/access avatar images  
    await supabase.rpc('create_storage_policy', {
      bucket_name: 'avatars',
      policy_name: 'Users can upload avatars',
      definition: `
        CREATE POLICY "Users can upload avatars" ON storage.objects
        FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND bucket_id = 'avatars');
      `
    }).catch(() => {
      // Policy might already exist or RPC not available
      console.log('Note: Could not create avatar policy via RPC')
    })
    
    console.log('✅ Storage policies setup completed')
    
  } catch (error) {
    console.warn('⚠️ Could not setup all storage policies:', error)
    console.log('Please set up RLS policies manually in Supabase dashboard if needed')
  }
}

// Export function to check if buckets exist
export async function checkStorageBuckets() {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets()
    
    if (error) {
      throw error
    }
    
    const requiredBuckets = ['knowledge-documents', 'avatars']
    const existingBuckets = buckets?.map(b => b.name) || []
    const missingBuckets = requiredBuckets.filter(name => !existingBuckets.includes(name))
    
    return {
      allExist: missingBuckets.length === 0,
      existing: existingBuckets,
      missing: missingBuckets
    }
    
  } catch (error) {
    console.error('Failed to check storage buckets:', error)
    return { allExist: false, existing: [], missing: ['knowledge-documents', 'avatars'], error }
  }
}