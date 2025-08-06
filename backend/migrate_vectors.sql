-- Migration script to convert text embedding columns to vector type
-- Run this AFTER pgvector extension is installed and you're ready to use vectors

-- Step 1: Add new vector columns
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS embedding_vector vector(1536);
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS embedding_vector vector(1536);
ALTER TABLE conversation_memories ADD COLUMN IF NOT EXISTS embedding_vector vector(1536);

-- Step 2: Copy data from text columns to vector columns (when you have actual embeddings)
-- UPDATE document_chunks SET embedding_vector = embedding::vector WHERE embedding IS NOT NULL;
-- UPDATE knowledge_entries SET embedding_vector = embedding::vector WHERE embedding IS NOT NULL;
-- UPDATE conversation_memories SET embedding_vector = embedding::vector WHERE embedding IS NOT NULL;

-- Step 3: Create vector indexes for similarity search
-- CREATE INDEX CONCURRENTLY idx_document_chunks_embedding_vector 
-- ON document_chunks USING ivfflat (embedding_vector vector_cosine_ops) WITH (lists = 100);

-- CREATE INDEX CONCURRENTLY idx_knowledge_entries_embedding_vector 
-- ON knowledge_entries USING ivfflat (embedding_vector vector_cosine_ops) WITH (lists = 100);

-- CREATE INDEX CONCURRENTLY idx_conversation_memories_embedding_vector 
-- ON conversation_memories USING ivfflat (embedding_vector vector_cosine_ops) WITH (lists = 100);

-- Step 4: Eventually drop old text columns (after confirming vector columns work)
-- ALTER TABLE document_chunks DROP COLUMN IF EXISTS embedding;
-- ALTER TABLE knowledge_entries DROP COLUMN IF EXISTS embedding;
-- ALTER TABLE conversation_memories DROP COLUMN IF EXISTS embedding;