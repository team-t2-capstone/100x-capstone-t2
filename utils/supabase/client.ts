import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

let supabaseClient: ReturnType<typeof createBrowserClient<Database>> | null = null

// Check if we're running in a browser environment
const isBrowser = typeof window !== 'undefined'

export function createClient() {
  // Only create the client in browser environments
  if (isBrowser && !supabaseClient) {
    // Use window.ENV if available (for testing/development)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    
    if (supabaseUrl && supabaseKey) {
      supabaseClient = createBrowserClient<Database>(supabaseUrl, supabaseKey)
    } else {
      console.warn('Supabase URL or key is missing. Client will be initialized later.')
      // Return a dummy client for SSR/build
      return {} as ReturnType<typeof createBrowserClient<Database>>
    }
  } else if (!isBrowser) {
    // Return a dummy client for SSR/build
    return {} as ReturnType<typeof createBrowserClient<Database>>
  }
  
  return supabaseClient || ({} as ReturnType<typeof createBrowserClient<Database>>)
}