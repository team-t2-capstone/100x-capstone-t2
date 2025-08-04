-- CloneAI Platform - Supabase Database Schema
-- This file contains all the database tables, indexes, and triggers needed for the CloneAI platform

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create custom types
CREATE TYPE user_role AS ENUM ('user', 'creator', 'admin');
CREATE TYPE session_type AS ENUM ('chat', 'voice', 'video');
CREATE TYPE session_status AS ENUM ('active', 'paused', 'ended');
CREATE TYPE processing_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE sender_type AS ENUM ('user', 'ai');
CREATE TYPE memory_type AS ENUM ('preference', 'context', 'goal');

-- =============================================
-- USER MANAGEMENT TABLES
-- =============================================

-- Extended user profiles (complements Supabase Auth users table)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    role user_role DEFAULT 'user',
    preferences JSONB DEFAULT '{}',
    timezone TEXT DEFAULT 'UTC',
    language TEXT DEFAULT 'en',
    notification_settings JSONB DEFAULT '{"email": true, "push": true, "sms": false}',
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User subscription and billing information
CREATE TABLE user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    lago_customer_id TEXT UNIQUE,
    subscription_tier TEXT DEFAULT 'free',
    credits_remaining INTEGER DEFAULT 0,
    monthly_limit INTEGER DEFAULT 100,
    current_usage INTEGER DEFAULT 0,
    billing_cycle_start DATE,
    billing_cycle_end DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- EXPERT CLONE TABLES
-- =============================================

-- Expert clone definitions
CREATE TABLE clones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    long_description TEXT,
    category TEXT NOT NULL,
    expertise_areas TEXT[] DEFAULT '{}',
    avatar_url TEXT,
    base_price DECIMAL(10,2) NOT NULL CHECK (base_price >= 0),
    currency TEXT DEFAULT 'USD',
    is_published BOOLEAN DEFAULT FALSE,
    is_featured BOOLEAN DEFAULT FALSE,
    rating DECIMAL(3,2) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
    total_sessions INTEGER DEFAULT 0,
    total_earnings DECIMAL(12,2) DEFAULT 0,
    bio TEXT,
    personality_traits JSONB DEFAULT '{}',
    communication_style JSONB DEFAULT '{}',
    languages TEXT[] DEFAULT '{"English"}',
    availability_schedule JSONB DEFAULT '{}',
    timezone TEXT DEFAULT 'UTC',
    credentials JSONB DEFAULT '[]',
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Clone categories for organization
CREATE TABLE clone_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    color TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Clone reviews and ratings
CREATE TABLE clone_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clone_id UUID REFERENCES clones(id) ON DELETE CASCADE,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    session_id UUID, -- Will reference sessions table
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    is_public BOOLEAN DEFAULT TRUE,
    helpful_votes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, session_id) -- One review per user per session
);

-- =============================================
-- KNOWLEDGE BASE TABLES
-- =============================================

-- Documents uploaded to clone knowledge bases
CREATE TABLE clone_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clone_id UUID REFERENCES clones(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    content TEXT, -- Extracted text content
    file_url TEXT, -- URL to file in Supabase Storage
    file_name TEXT,
    file_type TEXT,
    file_size_bytes BIGINT,
    processing_status processing_status DEFAULT 'pending',
    processing_error TEXT,
    chunk_count INTEGER DEFAULT 0,
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_date TIMESTAMP WITH TIME ZONE,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Text chunks with vector embeddings for RAG
CREATE TABLE knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES clone_documents(id) ON DELETE CASCADE,
    clone_id UUID REFERENCES clones(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding VECTOR(1536), -- OpenAI text-embedding-3-large dimension
    chunk_index INTEGER NOT NULL, -- Order within document
    token_count INTEGER,
    metadata JSONB DEFAULT '{}', -- page, section, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX (clone_id, chunk_index)
);

-- Direct text entries (not from files)
CREATE TABLE knowledge_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clone_id UUID REFERENCES clones(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT,
    tags TEXT[] DEFAULT '{}',
    embedding VECTOR(1536),
    token_count INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- URL-based knowledge sources
CREATE TABLE knowledge_urls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clone_id UUID REFERENCES clones(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title TEXT,
    content TEXT, -- Scraped content
    scrape_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processing_status processing_status DEFAULT 'pending',
    chunk_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- SESSION AND CHAT TABLES
-- =============================================

-- User sessions with expert clones
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    clone_id UUID REFERENCES clones(id) ON DELETE CASCADE,
    session_type session_type NOT NULL,
    status session_status DEFAULT 'active',
    is_demo BOOLEAN DEFAULT FALSE,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER DEFAULT 0,
    message_count INTEGER DEFAULT 0,
    total_cost DECIMAL(10,2) DEFAULT 0,
    rate_per_minute DECIMAL(8,4) NOT NULL,
    currency TEXT DEFAULT 'USD',
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    user_feedback TEXT,
    has_summary BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Individual messages within sessions
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    sender_type sender_type NOT NULL,
    content TEXT NOT NULL,
    tokens_used INTEGER,
    cost_increment DECIMAL(8,4) DEFAULT 0,
    processing_time_ms INTEGER,
    sources JSONB DEFAULT '[]', -- References to knowledge sources
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Session summaries generated by AI
CREATE TABLE session_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    summary_text TEXT NOT NULL,
    key_insights JSONB DEFAULT '[]',
    action_items JSONB DEFAULT '[]',
    recommendations JSONB DEFAULT '[]',
    next_session_topics JSONB DEFAULT '[]',
    sources_referenced JSONB DEFAULT '[]',
    user_notes TEXT,
    private_notes TEXT,
    summary_type TEXT DEFAULT 'detailed',
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- CONVERSATION MEMORY TABLES
-- =============================================

-- Long-term conversation memory for personalization
CREATE TABLE conversation_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    clone_id UUID REFERENCES clones(id) ON DELETE CASCADE,
    memory_type memory_type NOT NULL,
    content TEXT NOT NULL,
    context JSONB DEFAULT '{}', -- Additional structured data
    relevance_score DECIMAL(3,2) DEFAULT 1.0 CHECK (relevance_score >= 0 AND relevance_score <= 1),
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User goals and progress tracking
CREATE TABLE user_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    clone_id UUID REFERENCES clones(id),
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    target_date DATE,
    completion_date DATE,
    milestones JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- BILLING AND ANALYTICS TABLES
-- =============================================

-- Detailed billing transactions
CREATE TABLE billing_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    lago_charge_id TEXT,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    payment_method TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage analytics tracking
CREATE TABLE usage_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    clone_id UUID REFERENCES clones(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'session_start', 'message_sent', 'document_uploaded', etc.
    event_data JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    date DATE GENERATED ALWAYS AS (timestamp::DATE) STORED -- For efficient date-based queries
);

-- Daily aggregated analytics
CREATE TABLE daily_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    clone_id UUID REFERENCES clones(id) ON DELETE CASCADE,
    total_sessions INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    total_duration_minutes INTEGER DEFAULT 0,
    total_revenue DECIMAL(10,2) DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date, clone_id)
);

-- =============================================
-- SYSTEM TABLES
-- =============================================

-- API rate limiting
CREATE TABLE rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    request_count INTEGER DEFAULT 0,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, endpoint, window_start)
);

-- System notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- File exports and downloads
CREATE TABLE export_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    export_type TEXT NOT NULL, -- 'transcript', 'summary', 'combined'
    format TEXT NOT NULL, -- 'pdf', 'txt', 'json'
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    download_url TEXT,
    file_size_bytes BIGINT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Vector similarity search indexes
CREATE INDEX ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX ON knowledge_entries USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Performance indexes for common queries
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_clone_id ON sessions(clone_id);
CREATE INDEX idx_sessions_start_time ON sessions(start_time);
CREATE INDEX idx_sessions_status ON sessions(status);

CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

CREATE INDEX idx_clones_category ON clones(category);
CREATE INDEX idx_clones_published ON clones(is_published) WHERE is_published = TRUE;
CREATE INDEX idx_clones_featured ON clones(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_clones_rating ON clones(rating DESC);
CREATE INDEX idx_clones_creator_id ON clones(creator_id);

CREATE INDEX idx_clone_documents_clone_id ON clone_documents(clone_id);
CREATE INDEX idx_clone_documents_processing_status ON clone_documents(processing_status);

CREATE INDEX idx_knowledge_chunks_clone_id ON knowledge_chunks(clone_id);
CREATE INDEX idx_knowledge_chunks_document_id ON knowledge_chunks(document_id);

CREATE INDEX idx_conversation_memory_user_id ON conversation_memory(user_id);
CREATE INDEX idx_conversation_memory_clone_id ON conversation_memory(clone_id);
CREATE INDEX idx_conversation_memory_type ON conversation_memory(memory_type);

CREATE INDEX idx_usage_analytics_date ON usage_analytics(date);
CREATE INDEX idx_usage_analytics_user_id ON usage_analytics(user_id);
CREATE INDEX idx_usage_analytics_clone_id ON usage_analytics(clone_id);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- Full-text search indexes
CREATE INDEX idx_clones_search ON clones USING gin(to_tsvector('english', name || ' ' || description || ' ' || COALESCE(bio, '')));
CREATE INDEX idx_clone_documents_search ON clone_documents USING gin(to_tsvector('english', title || ' ' || COALESCE(content, '')));

-- =============================================
-- TRIGGERS AND FUNCTIONS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clones_updated_at BEFORE UPDATE ON clones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_session_summaries_updated_at BEFORE UPDATE ON session_summaries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_knowledge_entries_updated_at BEFORE UPDATE ON knowledge_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_goals_updated_at BEFORE UPDATE ON user_goals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON user_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update clone statistics when sessions are created/updated
CREATE OR REPLACE FUNCTION update_clone_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- New session started
        UPDATE clones 
        SET total_sessions = total_sessions + 1 
        WHERE id = NEW.clone_id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Session ended, update earnings and rating
        IF OLD.status != 'ended' AND NEW.status = 'ended' THEN
            UPDATE clones 
            SET 
                total_earnings = total_earnings + NEW.total_cost,
                rating = (
                    SELECT AVG(rating)::DECIMAL(3,2) 
                    FROM sessions 
                    WHERE clone_id = NEW.clone_id 
                    AND rating IS NOT NULL
                )
            WHERE id = NEW.clone_id;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_clone_stats
    AFTER INSERT OR UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_clone_stats();

-- Function to track usage analytics
CREATE OR REPLACE FUNCTION track_usage_event()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Track session start
        IF TG_TABLE_NAME = 'sessions' THEN
            INSERT INTO usage_analytics (user_id, clone_id, session_id, event_type, event_data)
            VALUES (NEW.user_id, NEW.clone_id, NEW.id, 'session_start', 
                   json_build_object('session_type', NEW.session_type, 'is_demo', NEW.is_demo));
        -- Track message sent
        ELSIF TG_TABLE_NAME = 'messages' THEN
            INSERT INTO usage_analytics (user_id, clone_id, session_id, event_type, event_data)
            SELECT s.user_id, s.clone_id, NEW.session_id, 'message_sent', 
                   json_build_object('sender_type', NEW.sender_type, 'tokens_used', NEW.tokens_used)
            FROM sessions s WHERE s.id = NEW.session_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Track session end
        IF TG_TABLE_NAME = 'sessions' AND OLD.status != 'ended' AND NEW.status = 'ended' THEN
            INSERT INTO usage_analytics (user_id, clone_id, session_id, event_type, event_data)
            VALUES (NEW.user_id, NEW.clone_id, NEW.id, 'session_end', 
                   json_build_object('duration_minutes', NEW.duration_minutes, 'total_cost', NEW.total_cost, 'rating', NEW.rating));
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_track_session_events
    AFTER INSERT OR UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION track_usage_event();

CREATE TRIGGER trigger_track_message_events
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION track_usage_event();

-- Function to automatically update session duration
CREATE OR REPLACE FUNCTION update_session_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.end_time IS NOT NULL AND NEW.start_time IS NOT NULL THEN
        NEW.duration_minutes = EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_session_duration
    BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_session_duration();

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on sensitive tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE clones ENABLE ROW LEVEL SECURITY;
ALTER TABLE clone_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- User profile policies
CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);

-- Clone policies
CREATE POLICY "Anyone can view published clones" ON clones FOR SELECT USING (is_published = true);
CREATE POLICY "Creators can view own clones" ON clones FOR SELECT USING (auth.uid() = creator_id);
CREATE POLICY "Creators can update own clones" ON clones FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Creators can delete own clones" ON clones FOR DELETE USING (auth.uid() = creator_id);

-- Session policies
CREATE POLICY "Users can view own sessions" ON sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Creators can view sessions for their clones" ON sessions FOR SELECT USING (
    auth.uid() IN (SELECT creator_id FROM clones WHERE id = clone_id)
);

-- Message policies
CREATE POLICY "Users can view messages from own sessions" ON messages FOR SELECT USING (
    session_id IN (SELECT id FROM sessions WHERE user_id = auth.uid())
);

-- Document policies
CREATE POLICY "Creators can manage own clone documents" ON clone_documents FOR ALL USING (
    clone_id IN (SELECT id FROM clones WHERE creator_id = auth.uid())
);

-- =============================================
-- SAMPLE DATA FOR DEVELOPMENT
-- =============================================

-- Insert sample categories
INSERT INTO clone_categories (id, name, description, icon, color, sort_order) VALUES
('life-coaching', 'Life & Coaching', 'Personal development and life guidance', 'heart', '#f97316', 1),
('business-strategy', 'Business & Strategy', 'Business consulting and strategic planning', 'briefcase', '#3b82f6', 2),
('education-learning', 'Education & Learning', 'Academic tutoring and skill development', 'graduation-cap', '#8b5cf6', 3),
('health-wellness', 'Health & Wellness', 'Fitness, nutrition, and mental health', 'activity', '#10b981', 4),
('finance-investment', 'Finance & Investment', 'Financial planning and investment advice', 'dollar-sign', '#f59e0b', 5),
('legal-consulting', 'Legal & Consulting', 'Legal advice and professional consulting', 'scale', '#6b7280', 6);

-- =============================================
-- MATERIALIZED VIEWS FOR ANALYTICS
-- =============================================

-- Popular clones view
CREATE MATERIALIZED VIEW popular_clones AS
SELECT 
    c.id,
    c.name,
    c.category,
    c.rating,
    c.total_sessions,
    c.total_earnings,
    COUNT(DISTINCT s.user_id) as unique_users,
    AVG(s.duration_minutes) as avg_session_duration
FROM clones c
LEFT JOIN sessions s ON c.id = s.clone_id
WHERE c.is_published = true
GROUP BY c.id, c.name, c.category, c.rating, c.total_sessions, c.total_earnings
ORDER BY c.total_sessions DESC, c.rating DESC;

-- User engagement summary
CREATE MATERIALIZED VIEW user_engagement_summary AS
SELECT 
    u.id as user_id,
    u.full_name,
    COUNT(DISTINCT s.id) as total_sessions,
    SUM(s.duration_minutes) as total_duration_minutes,
    SUM(s.total_cost) as total_spent,
    AVG(s.rating) as avg_rating_given,
    COUNT(DISTINCT s.clone_id) as unique_experts_used,
    MAX(s.start_time) as last_session_date
FROM user_profiles u
LEFT JOIN sessions s ON u.id = s.user_id
GROUP BY u.id, u.full_name;

-- Refresh materialized views (should be done periodically)
-- REFRESH MATERIALIZED VIEW popular_clones;
-- REFRESH MATERIALIZED VIEW user_engagement_summary;

-- =============================================
-- DATABASE MAINTENANCE FUNCTIONS
-- =============================================

-- Function to clean up old data
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
    -- Delete old rate limit entries (older than 1 hour)
    DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 hour';
    
    -- Delete old usage analytics (older than 2 years)
    DELETE FROM usage_analytics WHERE timestamp < NOW() - INTERVAL '2 years';
    
    -- Delete expired notifications
    DELETE FROM notifications WHERE expires_at IS NOT NULL AND expires_at < NOW();
    
    -- Delete expired export requests
    DELETE FROM export_requests WHERE expires_at IS NOT NULL AND expires_at < NOW();
    
    -- Archive old conversation memory (move to cold storage or delete)
    DELETE FROM conversation_memory WHERE expires_at IS NOT NULL AND expires_at < NOW();
    
    RAISE NOTICE 'Old data cleanup completed';
END;
$$ language 'plpgsql';

-- Function to update daily analytics
CREATE OR REPLACE FUNCTION update_daily_analytics(target_date DATE DEFAULT CURRENT_DATE - INTERVAL '1 day')
RETURNS void AS $$
BEGIN
    INSERT INTO daily_analytics (date, clone_id, total_sessions, total_messages, total_duration_minutes, total_revenue, unique_users, average_rating)
    SELECT 
        target_date,
        s.clone_id,
        COUNT(DISTINCT s.id) as total_sessions,
        SUM(s.message_count) as total_messages,
        SUM(s.duration_minutes) as total_duration_minutes,
        SUM(s.total_cost) as total_revenue,
        COUNT(DISTINCT s.user_id) as unique_users,
        AVG(s.rating) as average_rating
    FROM sessions s
    WHERE s.start_time::DATE = target_date
    AND s.status = 'ended'
    GROUP BY s.clone_id
    ON CONFLICT (date, clone_id) DO UPDATE SET
        total_sessions = EXCLUDED.total_sessions,
        total_messages = EXCLUDED.total_messages,
        total_duration_minutes = EXCLUDED.total_duration_minutes,
        total_revenue = EXCLUDED.total_revenue,
        unique_users = EXCLUDED.unique_users,
        average_rating = EXCLUDED.average_rating;
        
    RAISE NOTICE 'Daily analytics updated for %', target_date;
END;
$$ language 'plpgsql';

-- =============================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON TABLE user_profiles IS 'Extended user profiles complementing Supabase Auth';
COMMENT ON TABLE clones IS 'Expert AI clones created by users';
COMMENT ON TABLE knowledge_chunks IS 'Text chunks with vector embeddings for RAG system';
COMMENT ON TABLE sessions IS 'User sessions with expert clones';
COMMENT ON TABLE messages IS 'Individual messages within chat sessions';
COMMENT ON TABLE conversation_memory IS 'Long-term memory for personalized conversations';
COMMENT ON TABLE usage_analytics IS 'Detailed usage tracking for analytics and billing';

COMMENT ON COLUMN knowledge_chunks.embedding IS 'Vector embedding using OpenAI text-embedding-3-large (1536 dimensions)';
COMMENT ON COLUMN sessions.rate_per_minute IS 'Billing rate per minute for this session';
COMMENT ON COLUMN clones.personality_traits IS 'JSON object defining AI personality characteristics';
COMMENT ON COLUMN conversation_memory.relevance_score IS 'Score from 0-1 indicating memory relevance';

-- =============================================
-- FINAL NOTES
-- =============================================

/*
This schema is designed for the CloneAI platform with the following key features:

1. User Management: Extends Supabase Auth with detailed profiles and subscriptions
2. Expert Clones: Comprehensive clone management with categories, reviews, and analytics
3. Knowledge Base: Document storage with vector embeddings for RAG
4. Chat System: Real-time messaging with session management and billing
5. Memory System: Long-term conversation memory for personalization
6. Analytics: Detailed usage tracking and performance metrics
7. Billing: Integration with Lago billing system
8. Security: Row Level Security policies for data protection

Key PostgreSQL extensions used:
- uuid-ossp: For UUID generation
- vector (pgvector): For similarity search
- pg_trgm: For full-text search

Performance considerations:
- Proper indexing for common query patterns
- Materialized views for complex analytics
- Partitioning can be added for large tables (usage_analytics, messages)
- Connection pooling recommended for production

Maintenance:
- Run cleanup_old_data() daily to remove old data
- Run update_daily_analytics() daily for reporting
- Refresh materialized views periodically
- Monitor and optimize slow queries

Security:
- RLS policies restrict data access
- Sensitive operations require proper authentication
- API rate limiting built into the schema
*/