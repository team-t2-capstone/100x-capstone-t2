-- Add missing foreign key relationships
-- Migration: Add foreign key constraints that are missing in the database

-- Add foreign key constraint from sessions.clone_id to clones.id
-- This allows Supabase to understand the relationship between sessions and clones
ALTER TABLE sessions 
ADD CONSTRAINT fk_sessions_clone_id 
FOREIGN KEY (clone_id) 
REFERENCES clones(id) 
ON DELETE SET NULL;

-- Add foreign key constraint from sessions.user_id to auth.users.id (if user management is handled by Supabase Auth)
-- Note: This might already exist or be handled by Supabase Auth system
-- ALTER TABLE sessions 
-- ADD CONSTRAINT fk_sessions_user_id 
-- FOREIGN KEY (user_id) 
-- REFERENCES auth.users(id) 
-- ON DELETE CASCADE;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_sessions_clone_id ON sessions(clone_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);

-- Add comments for documentation
COMMENT ON CONSTRAINT fk_sessions_clone_id ON sessions IS 'Foreign key relationship to clones table for dashboard queries';