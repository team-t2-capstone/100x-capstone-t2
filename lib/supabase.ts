/**
 * DEPRECATED: Legacy Supabase client - Use @/utils/supabase/client instead
 * This file is kept for backward compatibility but should not be used in new code
 * The SSR-compatible clients in utils/supabase/ should be used instead
 */

// Re-export the proper SSR client to maintain compatibility
export { createClient as supabase } from '@/utils/supabase/client'

// Note: All auth functions should now use the SSR-compatible auth context
// located at @/contexts/auth-context.tsx
// Deprecated warning removed after migration completion