-- Create RAG service tables in Supabase
-- Migration: Create tables needed by RAG-workflow service
-- Date: 2025-08-12
-- Based on RAG-workflow/src/db/schema.sql

-- Create Domain table with TEXT domain_name instead of enum
CREATE TABLE IF NOT EXISTS domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_name TEXT NOT NULL UNIQUE,
    expert_names TEXT[] DEFAULT '{}'::TEXT[]
);

-- Create Expert table
CREATE TABLE IF NOT EXISTS experts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    context TEXT NOT NULL,
    CONSTRAINT fk_domain
        FOREIGN KEY (domain)
        REFERENCES domains (domain_name)
        ON DELETE CASCADE
);

-- Create Documents table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    document_link TEXT NOT NULL,
    created_by TEXT,
    domain TEXT NOT NULL,
    included_in_default BOOLEAN NOT NULL DEFAULT FALSE,
    client_name TEXT,
    openai_file_id TEXT,
    CONSTRAINT fk_domain
        FOREIGN KEY (domain)
        REFERENCES domains (domain_name)
        ON DELETE CASCADE
);

-- Create Vector Stores table to track vector stores and their associated files
CREATE TABLE IF NOT EXISTS vector_stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vector_id TEXT NOT NULL UNIQUE,
    domain_name TEXT NOT NULL,
    expert_name TEXT,
    client_name TEXT,
    file_ids TEXT[] DEFAULT '{}'::TEXT[],
    batch_ids TEXT[] DEFAULT '{}'::TEXT[],
    latest_batch_id TEXT,
    owner TEXT NOT NULL,  -- 'domain', 'expert', or 'client'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_domain
        FOREIGN KEY (domain_name)
        REFERENCES domains (domain_name)
        ON DELETE CASCADE
);

-- Create Assistants table to track OpenAI assistants
CREATE TABLE IF NOT EXISTS assistants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assistant_id TEXT NOT NULL UNIQUE,
    expert_name TEXT NOT NULL,
    memory_type TEXT NOT NULL,
    client_name TEXT,
    vector_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_expert
        FOREIGN KEY (expert_name)
        REFERENCES experts (name)
        ON DELETE CASCADE
);

-- Insert default domain values (if they don't exist)
INSERT INTO domains (domain_name) VALUES
    ('AI education'),
    ('High School counseling'),
    ('Medical pediatrics'),
    ('General Knowledge')
ON CONFLICT (domain_name) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_experts_domain ON experts(domain);
CREATE INDEX IF NOT EXISTS idx_documents_domain ON documents(domain);
CREATE INDEX IF NOT EXISTS idx_vector_stores_expert ON vector_stores(expert_name);
CREATE INDEX IF NOT EXISTS idx_vector_stores_domain ON vector_stores(domain_name);
CREATE INDEX IF NOT EXISTS idx_assistants_expert ON assistants(expert_name);

-- Add comments for documentation
COMMENT ON TABLE domains IS 'Knowledge domains for organizing experts and documents';
COMMENT ON TABLE experts IS 'RAG experts with their context and domain association';
COMMENT ON TABLE documents IS 'Documents processed by RAG service';
COMMENT ON TABLE vector_stores IS 'OpenAI vector stores for each expert/domain';
COMMENT ON TABLE assistants IS 'OpenAI assistants created for experts';