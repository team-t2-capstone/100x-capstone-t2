-- Add RAG integration columns to clones table
-- Migration: Add RAG workflow integration support
-- Date: 2025-08-12

-- Add RAG-related columns to the clones table
ALTER TABLE clones ADD COLUMN IF NOT EXISTS rag_expert_name TEXT;
ALTER TABLE clones ADD COLUMN IF NOT EXISTS rag_domain_name TEXT;
ALTER TABLE clones ADD COLUMN IF NOT EXISTS rag_assistant_id TEXT;
ALTER TABLE clones ADD COLUMN IF NOT EXISTS document_processing_status TEXT DEFAULT 'pending';

-- Add index for faster queries on processing status
CREATE INDEX IF NOT EXISTS idx_clones_processing_status ON clones(document_processing_status);

-- Add index for RAG expert lookups
CREATE INDEX IF NOT EXISTS idx_clones_rag_expert ON clones(rag_expert_name) WHERE rag_expert_name IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN clones.rag_expert_name IS 'Name of the RAG expert created for this clone';
COMMENT ON COLUMN clones.rag_domain_name IS 'Domain name used in RAG service for this clone';
COMMENT ON COLUMN clones.rag_assistant_id IS 'OpenAI Assistant ID created by RAG service';
COMMENT ON COLUMN clones.document_processing_status IS 'Status of document processing: pending, processing, completed, failed, partial';