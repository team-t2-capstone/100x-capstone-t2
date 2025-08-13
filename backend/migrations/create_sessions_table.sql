-- Create sessions table with proper schema
-- Migration: Create or update sessions table with all required fields and constraints

-- Create sessions table if it doesn't exist
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    clone_id UUID NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    session_type VARCHAR(50) DEFAULT 'chat',
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER DEFAULT 0,
    total_cost DECIMAL(10,2) DEFAULT 0.00,
    rate_per_minute DECIMAL(10,2) DEFAULT 0.00,
    message_count INTEGER DEFAULT 0,
    user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns if they don't exist (for existing tables)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'session_type') THEN
        ALTER TABLE sessions ADD COLUMN session_type VARCHAR(50) DEFAULT 'chat';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'user_rating') THEN
        ALTER TABLE sessions ADD COLUMN user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5);
    END IF;
END $$;

-- Add foreign key constraints if they don't exist
ALTER TABLE sessions 
DROP CONSTRAINT IF EXISTS fk_sessions_clone_id;

ALTER TABLE sessions 
ADD CONSTRAINT fk_sessions_clone_id 
FOREIGN KEY (clone_id) 
REFERENCES clones(id) 
ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_clone_id ON sessions(clone_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

-- Enable Row Level Security (RLS) if needed
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for users to only see their own sessions
DROP POLICY IF EXISTS sessions_user_policy ON sessions;
CREATE POLICY sessions_user_policy ON sessions
    FOR ALL
    USING (auth.uid()::text = user_id::text);

-- Add comments for documentation
COMMENT ON TABLE sessions IS 'User chat/call sessions with AI clones';
COMMENT ON COLUMN sessions.session_type IS 'Type of session: chat, voice, video, etc.';
COMMENT ON COLUMN sessions.user_rating IS 'User rating for the session (1-5 stars)';
COMMENT ON CONSTRAINT fk_sessions_clone_id ON sessions IS 'Foreign key relationship to clones table';