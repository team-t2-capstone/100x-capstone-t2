# Phase 1: Database Schema Integration Guide

## Overview

This guide provides step-by-step instructions for integrating RAG-specific database tables with the existing CloneAI Supabase schema while preserving all existing functionality.

## Architecture Strategy

We use a **coexistence approach** - adding RAG tables alongside existing schema with bridge connections to preserve backward compatibility.

## Prerequisites

- Access to Supabase SQL Editor
- Understanding of existing CloneAI database schema
- Admin privileges on the Supabase project

## Implementation Steps

### Step 1: RAG Tables Creation

Execute the following SQL scripts in Supabase SQL Editor in the exact order shown:

#### 1.1 Domains Table

```sql
-- Create Domain table with TEXT domain_name instead of enum
CREATE TABLE IF NOT EXISTS domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_name TEXT NOT NULL UNIQUE,
    expert_names TEXT[] DEFAULT '{}'::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_domains_updated_at 
    BEFORE UPDATE ON domains 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default domains matching CloneAI categories
INSERT INTO domains (domain_name) VALUES 
    ('health-wellness'),
    ('business-strategy'),
    ('education-learning'),
    ('finance-investment'),
    ('life-coaching'),
    ('legal-consulting'),
    ('ai-technology'),
    ('other')
ON CONFLICT (domain_name) DO NOTHING;
```

#### 1.2 Experts Table

```sql
-- Create Expert table
CREATE TABLE IF NOT EXISTS experts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    context TEXT NOT NULL,
    clone_id UUID REFERENCES clones(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_domain
        FOREIGN KEY (domain)
        REFERENCES domains (domain_name)
        ON DELETE CASCADE,
    UNIQUE(name, domain)
);

CREATE TRIGGER update_experts_updated_at 
    BEFORE UPDATE ON experts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### 1.3 RAG Documents Table

```sql
-- Create Documents table (RAG-specific, separate from existing knowledge table)
CREATE TABLE IF NOT EXISTS rag_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    document_link TEXT NOT NULL,
    created_by TEXT,
    domain TEXT NOT NULL,
    included_in_default BOOLEAN NOT NULL DEFAULT FALSE,
    client_name TEXT,
    openai_file_id TEXT,
    clone_id UUID REFERENCES clones(id) ON DELETE CASCADE,
    processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    content_preview TEXT,
    file_size_bytes BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_domain
        FOREIGN KEY (domain)
        REFERENCES domains (domain_name)
        ON DELETE CASCADE,
    UNIQUE(name, clone_id)
);

CREATE TRIGGER update_rag_documents_updated_at 
    BEFORE UPDATE ON rag_documents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### 1.4 Vector Stores Table

```sql
-- Create Vector Stores table
CREATE TABLE IF NOT EXISTS vector_stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vector_id TEXT NOT NULL UNIQUE,
    domain_name TEXT NOT NULL,
    expert_name TEXT,
    client_name TEXT,
    clone_id UUID REFERENCES clones(id) ON DELETE CASCADE,
    file_ids TEXT[] DEFAULT '{}'::TEXT[],
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_vector_domain
        FOREIGN KEY (domain_name)
        REFERENCES domains (domain_name)
        ON DELETE CASCADE
);

CREATE TRIGGER update_vector_stores_updated_at 
    BEFORE UPDATE ON vector_stores 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### 1.5 Assistants Table

```sql
-- Create Assistants table for OpenAI Assistant API tracking
CREATE TABLE IF NOT EXISTS assistants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assistant_id TEXT NOT NULL UNIQUE,
    domain_name TEXT NOT NULL,
    expert_name TEXT NOT NULL,
    clone_id UUID REFERENCES clones(id) ON DELETE CASCADE,
    vector_store_id TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deleted')),
    configuration JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_assistant_domain
        FOREIGN KEY (domain_name)
        REFERENCES domains (domain_name)
        ON DELETE CASCADE,
    CONSTRAINT fk_assistant_vector_store
        FOREIGN KEY (vector_store_id)
        REFERENCES vector_stores (vector_id)
        ON DELETE SET NULL
);

CREATE TRIGGER update_assistants_updated_at 
    BEFORE UPDATE ON assistants 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### 1.6 Clone RAG Mapping Table (Bridge Table)

```sql
-- Create clone_rag_mapping table to bridge clones with RAG components
CREATE TABLE IF NOT EXISTS clone_rag_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clone_id UUID NOT NULL REFERENCES clones(id) ON DELETE CASCADE,
    expert_name TEXT NOT NULL,
    domain_name TEXT NOT NULL,
    assistant_id TEXT REFERENCES assistants(assistant_id) ON DELETE SET NULL,
    vector_store_id TEXT REFERENCES vector_stores(vector_id) ON DELETE SET NULL,
    rag_status TEXT DEFAULT 'initializing' CHECK (rag_status IN ('initializing', 'ready', 'error', 'disabled')),
    last_processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    configuration JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_mapping_domain
        FOREIGN KEY (domain_name)
        REFERENCES domains (domain_name)
        ON DELETE CASCADE,
    UNIQUE(clone_id)  -- One RAG mapping per clone
);

CREATE TRIGGER update_clone_rag_mapping_updated_at 
    BEFORE UPDATE ON clone_rag_mapping 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Step 2: Extend Existing Tables

#### 2.1 Add RAG Support to Clones Table

```sql
-- Add RAG-related columns to existing clones table
ALTER TABLE clones 
ADD COLUMN IF NOT EXISTS rag_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS rag_initialization_status TEXT DEFAULT 'pending' CHECK (rag_initialization_status IN ('pending', 'initializing', 'ready', 'error', 'disabled')),
ADD COLUMN IF NOT EXISTS rag_expert_name TEXT,
ADD COLUMN IF NOT EXISTS rag_domain_mapping TEXT,
ADD COLUMN IF NOT EXISTS rag_config JSONB DEFAULT '{}';

-- Create index for RAG queries
CREATE INDEX IF NOT EXISTS idx_clones_rag_status ON clones(rag_initialization_status);
CREATE INDEX IF NOT EXISTS idx_clones_rag_enabled ON clones(rag_enabled);
```

#### 2.2 Extend Knowledge Table

```sql
-- Add RAG processing status to existing knowledge table
ALTER TABLE knowledge 
ADD COLUMN IF NOT EXISTS rag_processing_status TEXT DEFAULT 'pending' CHECK (rag_processing_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
ADD COLUMN IF NOT EXISTS rag_document_id UUID REFERENCES rag_documents(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS openai_file_id TEXT,
ADD COLUMN IF NOT EXISTS rag_error_message TEXT;

-- Create index for RAG processing queries
CREATE INDEX IF NOT EXISTS idx_knowledge_rag_status ON knowledge(rag_processing_status);
```

### Step 3: Create Indexes for Performance

```sql
-- Performance indexes for RAG operations
CREATE INDEX IF NOT EXISTS idx_experts_clone_id ON experts(clone_id);
CREATE INDEX IF NOT EXISTS idx_experts_domain ON experts(domain);
CREATE INDEX IF NOT EXISTS idx_rag_documents_clone_id ON rag_documents(clone_id);
CREATE INDEX IF NOT EXISTS idx_rag_documents_status ON rag_documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_vector_stores_clone_id ON vector_stores(clone_id);
CREATE INDEX IF NOT EXISTS idx_assistants_clone_id ON assistants(clone_id);
CREATE INDEX IF NOT EXISTS idx_clone_rag_mapping_clone_id ON clone_rag_mapping(clone_id);
CREATE INDEX IF NOT EXISTS idx_clone_rag_mapping_status ON clone_rag_mapping(rag_status);
```

### Step 4: Row Level Security (RLS) Policies

```sql
-- Enable RLS on all RAG tables
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE experts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE vector_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE clone_rag_mapping ENABLE ROW LEVEL SECURITY;

-- Create policies for domains (read-only for authenticated users)
CREATE POLICY "Allow read access to domains for authenticated users" ON domains
    FOR SELECT USING (auth.role() = 'authenticated');

-- Create policies for experts (users can only access their own experts)
CREATE POLICY "Users can read their own experts" ON experts
    FOR SELECT USING (
        clone_id IN (
            SELECT id FROM clones WHERE creator_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can insert their own experts" ON experts
    FOR INSERT WITH CHECK (
        clone_id IN (
            SELECT id FROM clones WHERE creator_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can update their own experts" ON experts
    FOR UPDATE USING (
        clone_id IN (
            SELECT id FROM clones WHERE creator_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can delete their own experts" ON experts
    FOR DELETE USING (
        clone_id IN (
            SELECT id FROM clones WHERE creator_id = auth.uid()::text
        )
    );

-- Create policies for rag_documents
CREATE POLICY "Users can read their own rag documents" ON rag_documents
    FOR SELECT USING (
        clone_id IN (
            SELECT id FROM clones WHERE creator_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can insert their own rag documents" ON rag_documents
    FOR INSERT WITH CHECK (
        clone_id IN (
            SELECT id FROM clones WHERE creator_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can update their own rag documents" ON rag_documents
    FOR UPDATE USING (
        clone_id IN (
            SELECT id FROM clones WHERE creator_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can delete their own rag documents" ON rag_documents
    FOR DELETE USING (
        clone_id IN (
            SELECT id FROM clones WHERE creator_id = auth.uid()::text
        )
    );

-- Create policies for vector_stores
CREATE POLICY "Users can read their own vector stores" ON vector_stores
    FOR SELECT USING (
        clone_id IN (
            SELECT id FROM clones WHERE creator_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can insert their own vector stores" ON vector_stores
    FOR INSERT WITH CHECK (
        clone_id IN (
            SELECT id FROM clones WHERE creator_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can update their own vector stores" ON vector_stores
    FOR UPDATE USING (
        clone_id IN (
            SELECT id FROM clones WHERE creator_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can delete their own vector stores" ON vector_stores
    FOR DELETE USING (
        clone_id IN (
            SELECT id FROM clones WHERE creator_id = auth.uid()::text
        )
    );

-- Create policies for assistants
CREATE POLICY "Users can read their own assistants" ON assistants
    FOR SELECT USING (
        clone_id IN (
            SELECT id FROM clones WHERE creator_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can insert their own assistants" ON assistants
    FOR INSERT WITH CHECK (
        clone_id IN (
            SELECT id FROM clones WHERE creator_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can update their own assistants" ON assistants
    FOR UPDATE USING (
        clone_id IN (
            SELECT id FROM clones WHERE creator_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can delete their own assistants" ON assistants
    FOR DELETE USING (
        clone_id IN (
            SELECT id FROM clones WHERE creator_id = auth.uid()::text
        )
    );

-- Create policies for clone_rag_mapping
CREATE POLICY "Users can read their own clone rag mappings" ON clone_rag_mapping
    FOR SELECT USING (
        clone_id IN (
            SELECT id FROM clones WHERE creator_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can insert their own clone rag mappings" ON clone_rag_mapping
    FOR INSERT WITH CHECK (
        clone_id IN (
            SELECT id FROM clones WHERE creator_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can update their own clone rag mappings" ON clone_rag_mapping
    FOR UPDATE USING (
        clone_id IN (
            SELECT id FROM clones WHERE creator_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can delete their own clone rag mappings" ON clone_rag_mapping
    FOR DELETE USING (
        clone_id IN (
            SELECT id FROM clones WHERE creator_id = auth.uid()::text
        )
    );
```

### Step 5: Update TypeScript Database Types

Update `/types/database.ts` by adding the new tables to the Database interface:

```typescript
// Add to the Tables interface in database.ts
      assistants: {
        Row: {
          id: string
          assistant_id: string
          domain_name: string
          expert_name: string
          clone_id: string
          vector_store_id: string | null
          status: string
          configuration: Json
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          assistant_id: string
          domain_name: string
          expert_name: string
          clone_id: string
          vector_store_id?: string | null
          status?: string
          configuration?: Json
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          assistant_id?: string
          domain_name?: string
          expert_name?: string
          clone_id?: string
          vector_store_id?: string | null
          status?: string
          configuration?: Json
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assistants_clone_id_fkey"
            columns: ["clone_id"]
            isOneToOne: false
            referencedRelation: "clones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_assistant_domain"
            columns: ["domain_name"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["domain_name"]
          },
          {
            foreignKeyName: "fk_assistant_vector_store"
            columns: ["vector_store_id"]
            isOneToOne: false
            referencedRelation: "vector_stores"
            referencedColumns: ["vector_id"]
          },
        ]
      }
      clone_rag_mapping: {
        Row: {
          id: string
          clone_id: string
          expert_name: string
          domain_name: string
          assistant_id: string | null
          vector_store_id: string | null
          rag_status: string
          last_processed_at: string | null
          error_message: string | null
          configuration: Json
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          clone_id: string
          expert_name: string
          domain_name: string
          assistant_id?: string | null
          vector_store_id?: string | null
          rag_status?: string
          last_processed_at?: string | null
          error_message?: string | null
          configuration?: Json
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          clone_id?: string
          expert_name?: string
          domain_name?: string
          assistant_id?: string | null
          vector_store_id?: string | null
          rag_status?: string
          last_processed_at?: string | null
          error_message?: string | null
          configuration?: Json
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clone_rag_mapping_clone_id_fkey"
            columns: ["clone_id"]
            isOneToOne: true
            referencedRelation: "clones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_mapping_domain"
            columns: ["domain_name"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["domain_name"]
          },
        ]
      }
      domains: {
        Row: {
          id: string
          domain_name: string
          expert_names: string[] | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          domain_name: string
          expert_names?: string[] | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          domain_name?: string
          expert_names?: string[] | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      experts: {
        Row: {
          id: string
          name: string
          domain: string
          context: string
          clone_id: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          domain: string
          context: string
          clone_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          domain?: string
          context?: string
          clone_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "experts_clone_id_fkey"
            columns: ["clone_id"]
            isOneToOne: false
            referencedRelation: "clones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_domain"
            columns: ["domain"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["domain_name"]
          },
        ]
      }
      rag_documents: {
        Row: {
          id: string
          name: string
          document_link: string
          created_by: string | null
          domain: string
          included_in_default: boolean
          client_name: string | null
          openai_file_id: string | null
          clone_id: string | null
          processing_status: string
          content_preview: string | null
          file_size_bytes: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          document_link: string
          created_by?: string | null
          domain: string
          included_in_default?: boolean
          client_name?: string | null
          openai_file_id?: string | null
          clone_id?: string | null
          processing_status?: string
          content_preview?: string | null
          file_size_bytes?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          document_link?: string
          created_by?: string | null
          domain?: string
          included_in_default?: boolean
          client_name?: string | null
          openai_file_id?: string | null
          clone_id?: string | null
          processing_status?: string
          content_preview?: string | null
          file_size_bytes?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rag_documents_clone_id_fkey"
            columns: ["clone_id"]
            isOneToOne: false
            referencedRelation: "clones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_domain"
            columns: ["domain"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["domain_name"]
          },
        ]
      }
      vector_stores: {
        Row: {
          id: string
          vector_id: string
          domain_name: string
          expert_name: string | null
          client_name: string | null
          clone_id: string | null
          file_ids: string[] | null
          status: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          vector_id: string
          domain_name: string
          expert_name?: string | null
          client_name?: string | null
          clone_id?: string | null
          file_ids?: string[] | null
          status?: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          vector_id?: string
          domain_name?: string
          expert_name?: string | null
          client_name?: string | null
          clone_id?: string | null
          file_ids?: string[] | null
          status?: string
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vector_stores_clone_id_fkey"
            columns: ["clone_id"]
            isOneToOne: false
            referencedRelation: "clones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_vector_domain"
            columns: ["domain_name"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["domain_name"]
          },
        ]
      }
```

Also update the existing clones table definition to include new RAG columns:

```typescript
// Update existing clones table definition
clones: {
  Row: {
    // ... existing fields ...
    rag_enabled: boolean | null
    rag_initialization_status: string | null
    rag_expert_name: string | null
    rag_domain_mapping: string | null
    rag_config: Json | null
  }
  Insert: {
    // ... existing fields ...
    rag_enabled?: boolean | null
    rag_initialization_status?: string | null
    rag_expert_name?: string | null
    rag_domain_mapping?: string | null
    rag_config?: Json | null
  }
  Update: {
    // ... existing fields ...
    rag_enabled?: boolean | null
    rag_initialization_status?: string | null
    rag_expert_name?: string | null
    rag_domain_mapping?: string | null
    rag_config?: Json | null
  }
  // ... existing relationships ...
}

// Update existing knowledge table definition
knowledge: {
  Row: {
    // ... existing fields ...
    rag_processing_status: string | null
    rag_document_id: string | null
    openai_file_id: string | null
    rag_error_message: string | null
  }
  Insert: {
    // ... existing fields ...
    rag_processing_status?: string | null
    rag_document_id?: string | null
    openai_file_id?: string | null
    rag_error_message?: string | null
  }
  Update: {
    // ... existing fields ...
    rag_processing_status?: string | null
    rag_document_id?: string | null
    openai_file_id?: string | null
    rag_error_message?: string | null
  }
  // ... existing relationships ...
}
```

### Step 6: Migration Strategy

#### 6.1 For Existing Clones

```sql
-- Migration script for existing clones
-- This should be run after schema updates

-- Set default RAG status for existing clones
UPDATE clones 
SET 
    rag_enabled = FALSE,
    rag_initialization_status = 'pending',
    rag_config = '{}'::jsonb
WHERE 
    rag_enabled IS NULL;

-- Set default RAG processing status for existing knowledge
UPDATE knowledge 
SET 
    rag_processing_status = 'pending'
WHERE 
    rag_processing_status IS NULL;
```

#### 6.2 Domain Mapping Function

```sql
-- Create function to map clone categories to RAG domains
CREATE OR REPLACE FUNCTION map_clone_category_to_domain(category TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN CASE category
        WHEN 'medical' THEN 'health-wellness'
        WHEN 'business' THEN 'business-strategy'
        WHEN 'education' THEN 'education-learning'
        WHEN 'finance' THEN 'finance-investment'
        WHEN 'coaching' THEN 'life-coaching'
        WHEN 'legal' THEN 'legal-consulting'
        WHEN 'ai' THEN 'ai-technology'
        ELSE 'other'
    END;
END;
$$ LANGUAGE plpgsql;

-- Update existing clones with domain mapping
UPDATE clones 
SET rag_domain_mapping = map_clone_category_to_domain(category)
WHERE rag_domain_mapping IS NULL;
```

## Verification Steps

### 1. Schema Verification

```sql
-- Verify all tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('domains', 'experts', 'rag_documents', 'vector_stores', 'assistants', 'clone_rag_mapping');

-- Verify foreign key constraints
SELECT 
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name IN ('experts', 'rag_documents', 'vector_stores', 'assistants', 'clone_rag_mapping');
```

### 2. RLS Verification

```sql
-- Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('domains', 'experts', 'rag_documents', 'vector_stores', 'assistants', 'clone_rag_mapping');

-- Verify policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('domains', 'experts', 'rag_documents', 'vector_stores', 'assistants', 'clone_rag_mapping');
```

### 3. Data Integrity Check

```sql
-- Check default domains were inserted
SELECT domain_name FROM domains ORDER BY domain_name;

-- Check clone columns were added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'clones' 
AND column_name LIKE 'rag_%';

-- Check knowledge columns were added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'knowledge' 
AND column_name LIKE 'rag_%';
```

## Error Handling

### Common Issues and Solutions

1. **Foreign Key Constraint Errors**
   - Ensure referenced tables exist before creating dependent tables
   - Check that referenced columns have correct data types

2. **RLS Policy Conflicts**
   - Drop existing policies before recreating: `DROP POLICY IF EXISTS policy_name ON table_name;`

3. **Index Creation Failures**
   - Check if indexes already exist: `\d+ table_name` in psql
   - Drop conflicting indexes before recreation

4. **Type Mismatch in Existing Data**
   - Use explicit type casting: `column_name::new_type`
   - Handle NULL values appropriately

## Rollback Plan

If rollback is needed:

```sql
-- Drop RAG tables in reverse dependency order
DROP TABLE IF EXISTS clone_rag_mapping CASCADE;
DROP TABLE IF EXISTS assistants CASCADE;
DROP TABLE IF EXISTS vector_stores CASCADE;
DROP TABLE IF EXISTS rag_documents CASCADE;
DROP TABLE IF EXISTS experts CASCADE;
DROP TABLE IF EXISTS domains CASCADE;

-- Remove added columns from existing tables
ALTER TABLE clones 
DROP COLUMN IF EXISTS rag_enabled,
DROP COLUMN IF EXISTS rag_initialization_status,
DROP COLUMN IF EXISTS rag_expert_name,
DROP COLUMN IF EXISTS rag_domain_mapping,
DROP COLUMN IF EXISTS rag_config;

ALTER TABLE knowledge 
DROP COLUMN IF EXISTS rag_processing_status,
DROP COLUMN IF EXISTS rag_document_id,
DROP COLUMN IF EXISTS openai_file_id,
DROP COLUMN IF EXISTS rag_error_message;

-- Drop helper function
DROP FUNCTION IF EXISTS map_clone_category_to_domain(TEXT);
DROP FUNCTION IF EXISTS update_updated_at_column();
```

## Success Criteria

- ✅ All 6 RAG tables created successfully
- ✅ Foreign key relationships established
- ✅ RLS policies active and tested
- ✅ Performance indexes created
- ✅ Existing tables extended without data loss
- ✅ TypeScript types updated
- ✅ Migration scripts executed successfully
- ✅ Default domains populated
- ✅ All verification queries pass

## Next Steps

After completing Phase 1:
1. Proceed to Phase 2: Backend API Integration
2. Test database operations through Supabase client
3. Verify authentication and authorization work correctly
4. Begin implementing RAG service integration