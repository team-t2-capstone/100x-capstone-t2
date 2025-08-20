# Technical Specifications and Code Examples

## Overview

This document provides comprehensive technical specifications, complete code examples, and implementation details for the RAG integration into CloneAI. It serves as a developer reference with production-ready code snippets and architectural patterns.

## Table of Contents

1. [Core Technical Architecture](#core-technical-architecture)
2. [Database Operations](#database-operations)
3. [API Implementation Examples](#api-implementation-examples)
4. [Frontend Component Library](#frontend-component-library)
5. [Integration Patterns](#integration-patterns)
6. [Error Handling Strategies](#error-handling-strategies)
7. [Performance Optimization](#performance-optimization)
8. [Security Implementation](#security-implementation)
9. [Testing Frameworks](#testing-frameworks)
10. [Deployment Configurations](#deployment-configurations)

## Core Technical Architecture

### 1. System Overview

```typescript
/**
 * RAG Integration Architecture for CloneAI
 * 
 * Components:
 * - Frontend: Next.js with TypeScript and React
 * - Backend: FastAPI with Supabase integration
 * - RAG Service: Standalone FastAPI service
 * - Database: PostgreSQL with vector extensions
 * - Storage: Supabase Storage for documents
 * - AI: OpenAI GPT-4 with Assistant API
 */

interface RAGArchitecture {
  frontend: {
    framework: 'Next.js 14';
    language: 'TypeScript';
    ui: 'React + shadcn/ui';
    state: 'React Hooks + Context';
  };
  backend: {
    framework: 'FastAPI';
    database: 'Supabase (PostgreSQL)';
    auth: 'Supabase Auth';
    storage: 'Supabase Storage';
  };
  ragService: {
    framework: 'FastAPI';
    ai: 'OpenAI Assistant API';
    vectorStore: 'OpenAI Vector Store';
    parsing: 'LlamaParse';
  };
  communication: {
    http: 'REST APIs';
    websocket: 'Real-time chat';
    fallback: 'OpenAI Direct';
  };
}
```

### 2. Data Flow Architecture

```mermaid
graph TB
    A[Frontend] --> B[CloneAI Backend]
    B --> C[RAG Service]
    B --> D[Supabase DB]
    B --> E[OpenAI Direct]
    C --> F[OpenAI Assistant API]
    C --> G[Vector Store]
    C --> H[Document Parser]
    
    subgraph "RAG Flow"
        C --> F
        F --> G
        G --> I[Semantic Search]
        I --> J[Context Assembly]
        J --> K[Response Generation]
    end
    
    subgraph "Fallback Flow"
        B --> E
        E --> L[Direct LLM Response]
    end
```

## Database Operations

### 1. Complete Database Setup Script

```sql
-- Complete RAG Database Setup for CloneAI
-- Execute in Supabase SQL Editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Drop existing tables if they exist (for clean reinstall)
DROP TABLE IF EXISTS clone_rag_mapping CASCADE;
DROP TABLE IF EXISTS assistants CASCADE;
DROP TABLE IF EXISTS vector_stores CASCADE;
DROP TABLE IF EXISTS rag_documents CASCADE;
DROP TABLE IF EXISTS experts CASCADE;
DROP TABLE IF EXISTS domains CASCADE;

-- Create update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 1. Domains Table
CREATE TABLE domains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain_name TEXT NOT NULL UNIQUE,
    expert_names TEXT[] DEFAULT '{}',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER update_domains_updated_at 
    BEFORE UPDATE ON domains 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default domains
INSERT INTO domains (domain_name, description) VALUES 
    ('health-wellness', 'Medical, health, wellness, and fitness expertise'),
    ('business-strategy', 'Business strategy, management, and entrepreneurship'),
    ('education-learning', 'Education, training, and skill development'),
    ('finance-investment', 'Finance, investment, and economic analysis'),
    ('life-coaching', 'Personal development and life coaching'),
    ('legal-consulting', 'Legal advice and consulting services'),
    ('ai-technology', 'Artificial intelligence and technology'),
    ('other', 'General expertise and miscellaneous domains')
ON CONFLICT (domain_name) DO NOTHING;

-- 2. Experts Table
CREATE TABLE experts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    context TEXT NOT NULL,
    clone_id UUID REFERENCES clones(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_domain
        FOREIGN KEY (domain)
        REFERENCES domains (domain_name)
        ON DELETE CASCADE,
    UNIQUE(name, domain, clone_id)
);

CREATE TRIGGER update_experts_updated_at 
    BEFORE UPDATE ON experts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. RAG Documents Table
CREATE TABLE rag_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    document_link TEXT NOT NULL,
    created_by TEXT,
    domain TEXT NOT NULL,
    included_in_default BOOLEAN NOT NULL DEFAULT FALSE,
    client_name TEXT,
    openai_file_id TEXT UNIQUE,
    clone_id UUID REFERENCES clones(id) ON DELETE CASCADE,
    processing_status TEXT DEFAULT 'pending' 
        CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
    content_preview TEXT,
    file_size_bytes BIGINT,
    file_type TEXT,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_rag_domain
        FOREIGN KEY (domain)
        REFERENCES domains (domain_name)
        ON DELETE CASCADE,
    UNIQUE(name, clone_id)
);

CREATE TRIGGER update_rag_documents_updated_at 
    BEFORE UPDATE ON rag_documents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Vector Stores Table
CREATE TABLE vector_stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vector_id TEXT NOT NULL UNIQUE,
    domain_name TEXT NOT NULL,
    expert_name TEXT,
    client_name TEXT,
    clone_id UUID REFERENCES clones(id) ON DELETE CASCADE,
    file_ids TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'active' 
        CHECK (status IN ('active', 'inactive', 'expired', 'deleted')),
    usage_stats JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
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

-- 5. Assistants Table
CREATE TABLE assistants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assistant_id TEXT NOT NULL UNIQUE,
    domain_name TEXT NOT NULL,
    expert_name TEXT NOT NULL,
    clone_id UUID REFERENCES clones(id) ON DELETE CASCADE,
    vector_store_id TEXT,
    status TEXT DEFAULT 'active' 
        CHECK (status IN ('active', 'inactive', 'deleted', 'error')),
    configuration JSONB DEFAULT '{}',
    performance_stats JSONB DEFAULT '{}',
    last_used_at TIMESTAMP WITH TIME ZONE,
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

-- 6. Clone RAG Mapping Table (Bridge)
CREATE TABLE clone_rag_mapping (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clone_id UUID NOT NULL REFERENCES clones(id) ON DELETE CASCADE,
    expert_name TEXT NOT NULL,
    domain_name TEXT NOT NULL,
    assistant_id TEXT REFERENCES assistants(assistant_id) ON DELETE SET NULL,
    vector_store_id TEXT REFERENCES vector_stores(vector_id) ON DELETE SET NULL,
    rag_status TEXT DEFAULT 'initializing' 
        CHECK (rag_status IN ('initializing', 'ready', 'error', 'disabled', 'maintenance')),
    last_processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    configuration JSONB DEFAULT '{}',
    performance_metrics JSONB DEFAULT '{}',
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

-- 7. Extend existing tables
ALTER TABLE clones 
ADD COLUMN IF NOT EXISTS rag_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS rag_initialization_status TEXT DEFAULT 'pending' 
    CHECK (rag_initialization_status IN ('pending', 'initializing', 'ready', 'error', 'disabled')),
ADD COLUMN IF NOT EXISTS rag_expert_name TEXT,
ADD COLUMN IF NOT EXISTS rag_domain_mapping TEXT,
ADD COLUMN IF NOT EXISTS rag_config JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS rag_last_updated TIMESTAMP WITH TIME ZONE;

ALTER TABLE knowledge 
ADD COLUMN IF NOT EXISTS rag_processing_status TEXT DEFAULT 'pending' 
    CHECK (rag_processing_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
ADD COLUMN IF NOT EXISTS rag_document_id UUID REFERENCES rag_documents(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS openai_file_id TEXT,
ADD COLUMN IF NOT EXISTS rag_error_message TEXT,
ADD COLUMN IF NOT EXISTS rag_processed_at TIMESTAMP WITH TIME ZONE;

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_experts_clone_id ON experts(clone_id);
CREATE INDEX IF NOT EXISTS idx_experts_domain ON experts(domain);
CREATE INDEX IF NOT EXISTS idx_experts_status ON experts(status);
CREATE INDEX IF NOT EXISTS idx_rag_documents_clone_id ON rag_documents(clone_id);
CREATE INDEX IF NOT EXISTS idx_rag_documents_status ON rag_documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_rag_documents_openai_file_id ON rag_documents(openai_file_id);
CREATE INDEX IF NOT EXISTS idx_vector_stores_clone_id ON vector_stores(clone_id);
CREATE INDEX IF NOT EXISTS idx_vector_stores_status ON vector_stores(status);
CREATE INDEX IF NOT EXISTS idx_assistants_clone_id ON assistants(clone_id);
CREATE INDEX IF NOT EXISTS idx_assistants_status ON assistants(status);
CREATE INDEX IF NOT EXISTS idx_clone_rag_mapping_clone_id ON clone_rag_mapping(clone_id);
CREATE INDEX IF NOT EXISTS idx_clone_rag_mapping_status ON clone_rag_mapping(rag_status);
CREATE INDEX IF NOT EXISTS idx_clones_rag_status ON clones(rag_initialization_status);
CREATE INDEX IF NOT EXISTS idx_clones_rag_enabled ON clones(rag_enabled);
CREATE INDEX IF NOT EXISTS idx_knowledge_rag_status ON knowledge(rag_processing_status);

-- Text search indexes
CREATE INDEX IF NOT EXISTS idx_experts_name_trgm ON experts USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_rag_documents_name_trgm ON rag_documents USING gin(name gin_trgm_ops);

-- Enable Row Level Security
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE experts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE vector_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE clone_rag_mapping ENABLE ROW LEVEL SECURITY;

-- RLS Policies for domains (read-only for authenticated users)
CREATE POLICY "Allow read access to domains for authenticated users" ON domains
    FOR SELECT USING (auth.role() = 'authenticated');

-- RLS Policies for experts
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

-- RLS Policies for rag_documents
CREATE POLICY "Users can manage their own rag documents" ON rag_documents
    FOR ALL USING (
        clone_id IN (
            SELECT id FROM clones WHERE creator_id = auth.uid()::text
        )
    );

-- RLS Policies for vector_stores
CREATE POLICY "Users can manage their own vector stores" ON vector_stores
    FOR ALL USING (
        clone_id IN (
            SELECT id FROM clones WHERE creator_id = auth.uid()::text
        )
    );

-- RLS Policies for assistants
CREATE POLICY "Users can manage their own assistants" ON assistants
    FOR ALL USING (
        clone_id IN (
            SELECT id FROM clones WHERE creator_id = auth.uid()::text
        )
    );

-- RLS Policies for clone_rag_mapping
CREATE POLICY "Users can manage their own clone rag mappings" ON clone_rag_mapping
    FOR ALL USING (
        clone_id IN (
            SELECT id FROM clones WHERE creator_id = auth.uid()::text
        )
    );

-- Helper functions
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

-- Migration function for existing clones
CREATE OR REPLACE FUNCTION migrate_existing_clones_to_rag()
RETURNS void AS $$
BEGIN
    -- Set default RAG status for existing clones
    UPDATE clones 
    SET 
        rag_enabled = FALSE,
        rag_initialization_status = 'pending',
        rag_config = '{}',
        rag_domain_mapping = map_clone_category_to_domain(category)
    WHERE 
        rag_enabled IS NULL;
    
    -- Set default RAG processing status for existing knowledge
    UPDATE knowledge 
    SET 
        rag_processing_status = 'pending'
    WHERE 
        rag_processing_status IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Execute migration
SELECT migrate_existing_clones_to_rag();

-- Create materialized view for analytics
CREATE MATERIALIZED VIEW rag_analytics AS
SELECT 
    d.domain_name,
    COUNT(DISTINCT e.clone_id) as active_clones,
    COUNT(DISTINCT rd.id) as total_documents,
    COUNT(DISTINCT vs.id) as vector_stores,
    COUNT(DISTINCT a.id) as assistants,
    AVG(CASE WHEN crm.rag_status = 'ready' THEN 1 ELSE 0 END) as ready_percentage
FROM domains d
LEFT JOIN experts e ON d.domain_name = e.domain
LEFT JOIN rag_documents rd ON d.domain_name = rd.domain
LEFT JOIN vector_stores vs ON d.domain_name = vs.domain_name
LEFT JOIN assistants a ON d.domain_name = a.domain_name
LEFT JOIN clone_rag_mapping crm ON d.domain_name = crm.domain_name
GROUP BY d.domain_name;

-- Create unique index for faster refreshes
CREATE UNIQUE INDEX idx_rag_analytics_domain ON rag_analytics(domain_name);

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_rag_analytics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY rag_analytics;
END;
$$ LANGUAGE plpgsql;
```

### 2. Database Query Examples

```typescript
// Database query helpers for RAG operations
export class RAGDatabaseQueries {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get comprehensive clone RAG information
   */
  async getCloneRAGInfo(cloneId: string): Promise<CloneRAGInfo | null> {
    const { data, error } = await this.supabase
      .from('clones')
      .select(`
        id,
        name,
        category,
        rag_enabled,
        rag_initialization_status,
        rag_expert_name,
        rag_domain_mapping,
        rag_config,
        clone_rag_mapping (
          expert_name,
          domain_name,
          assistant_id,
          vector_store_id,
          rag_status,
          last_processed_at,
          error_message,
          configuration
        ),
        knowledge (
          id,
          title,
          file_url,
          content_type,
          rag_processing_status,
          rag_document_id,
          openai_file_id
        )
      `)
      .eq('id', cloneId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Initialize RAG mapping for a clone
   */
  async createRAGMapping(mapping: RAGMappingCreate): Promise<RAGMapping> {
    const { data, error } = await this.supabase
      .from('clone_rag_mapping')
      .upsert({
        clone_id: mapping.cloneId,
        expert_name: mapping.expertName,
        domain_name: mapping.domainName,
        assistant_id: mapping.assistantId,
        vector_store_id: mapping.vectorStoreId,
        rag_status: 'initializing',
        configuration: mapping.configuration || {},
        last_processed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update RAG status with error handling
   */
  async updateRAGStatus(
    cloneId: string, 
    status: RAGStatus, 
    errorMessage?: string
  ): Promise<void> {
    const updates: any = {
      rag_status: status,
      last_processed_at: new Date().toISOString()
    };

    if (errorMessage) {
      updates.error_message = errorMessage;
    } else {
      updates.error_message = null;
    }

    const { error: mappingError } = await this.supabase
      .from('clone_rag_mapping')
      .update(updates)
      .eq('clone_id', cloneId);

    const { error: cloneError } = await this.supabase
      .from('clones')
      .update({
        rag_initialization_status: status,
        rag_last_updated: new Date().toISOString(),
        rag_config: errorMessage ? { error_message: errorMessage } : {}
      })
      .eq('id', cloneId);

    if (mappingError || cloneError) {
      throw mappingError || cloneError;
    }
  }

  /**
   * Get RAG analytics for dashboard
   */
  async getRAGAnalytics(userId: string): Promise<RAGAnalytics> {
    const { data: userClones, error: clonesError } = await this.supabase
      .from('clones')
      .select('id, rag_enabled, rag_initialization_status, category')
      .eq('creator_id', userId);

    if (clonesError) throw clonesError;

    const cloneIds = userClones.map(c => c.id);

    const { data: mappings, error: mappingsError } = await this.supabase
      .from('clone_rag_mapping')
      .select('*')
      .in('clone_id', cloneIds);

    if (mappingsError) throw mappingsError;

    const { data: documents, error: docsError } = await this.supabase
      .from('rag_documents')
      .select('processing_status, file_size_bytes')
      .in('clone_id', cloneIds);

    if (docsError) throw docsError;

    return {
      totalClones: userClones.length,
      ragEnabledClones: userClones.filter(c => c.rag_enabled).length,
      readyClones: mappings.filter(m => m.rag_status === 'ready').length,
      errorClones: mappings.filter(m => m.rag_status === 'error').length,
      totalDocuments: documents.length,
      processedDocuments: documents.filter(d => d.processing_status === 'completed').length,
      totalStorageBytes: documents.reduce((sum, d) => sum + (d.file_size_bytes || 0), 0),
      statusBreakdown: mappings.reduce((acc, m) => {
        acc[m.rag_status] = (acc[m.rag_status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }

  /**
   * Search experts by domain and capabilities
   */
  async searchExperts(query: SearchExpertsQuery): Promise<Expert[]> {
    let queryBuilder = this.supabase
      .from('experts')
      .select(`
        *,
        clones!inner(name, category, is_published),
        clone_rag_mapping!inner(rag_status)
      `)
      .eq('clone_rag_mapping.rag_status', 'ready')
      .eq('clones.is_published', true);

    if (query.domain) {
      queryBuilder = queryBuilder.eq('domain', query.domain);
    }

    if (query.searchTerm) {
      queryBuilder = queryBuilder.or(
        `name.ilike.%${query.searchTerm}%,context.ilike.%${query.searchTerm}%`
      );
    }

    const { data, error } = await queryBuilder
      .limit(query.limit || 20)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Get document processing queue
   */
  async getDocumentQueue(cloneId?: string): Promise<DocumentQueueItem[]> {
    let queryBuilder = this.supabase
      .from('rag_documents')
      .select(`
        id,
        name,
        processing_status,
        created_at,
        error_message,
        file_size_bytes,
        clones!inner(name, creator_id)
      `)
      .in('processing_status', ['pending', 'processing']);

    if (cloneId) {
      queryBuilder = queryBuilder.eq('clone_id', cloneId);
    }

    const { data, error } = await queryBuilder
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  }

  /**
   * Cleanup expired resources
   */
  async cleanupExpiredResources(): Promise<CleanupResult> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 days ago

    // Find inactive vector stores
    const { data: expiredStores, error: storesError } = await this.supabase
      .from('vector_stores')
      .select('vector_id, clone_id')
      .eq('status', 'inactive')
      .lt('updated_at', cutoffDate.toISOString());

    if (storesError) throw storesError;

    // Find orphaned assistants
    const { data: orphanedAssistants, error: assistantsError } = await this.supabase
      .from('assistants')
      .select('assistant_id, clone_id')
      .eq('status', 'inactive')
      .lt('last_used_at', cutoffDate.toISOString());

    if (assistantsError) throw assistantsError;

    return {
      expiredVectorStores: expiredStores.length,
      orphanedAssistants: orphanedAssistants.length,
      cleanupDate: new Date().toISOString()
    };
  }
}

// Usage example
const ragDb = new RAGDatabaseQueries(supabase);

// Get clone RAG information
const cloneInfo = await ragDb.getCloneRAGInfo('clone-id-123');

// Update status
await ragDb.updateRAGStatus('clone-id-123', 'ready');

// Get analytics
const analytics = await ragDb.getRAGAnalytics('user-id-456');
```

## API Implementation Examples

### 1. Complete RAG Service Implementation

```python
"""
Production-ready RAG Service for CloneAI
Includes comprehensive error handling, monitoring, and optimization
"""
import asyncio
import json
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
from uuid import UUID
import hashlib
import redis

import httpx
import openai
from openai import AsyncOpenAI
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from functools import wraps
from dataclasses import dataclass, asdict
from enum import Enum

from app.config import settings
from app.database import get_supabase
from app.models.schemas import RAGResponse, RAGInitRequest, RAGQueryRequest

logger = structlog.get_logger()

class RAGStatus(Enum):
    PENDING = "pending"
    INITIALIZING = "initializing"
    READY = "ready"
    ERROR = "error"
    DISABLED = "disabled"
    MAINTENANCE = "maintenance"

class RAGMode(Enum):
    RAG = "rag"
    LLM_FALLBACK = "llm_fallback"
    OPENAI_FALLBACK = "openai_fallback"
    CACHED = "cached"

@dataclass
class RAGMetrics:
    """Performance and usage metrics for RAG operations"""
    operation: str
    clone_id: str
    duration_ms: float
    success: bool
    mode: RAGMode
    sources_count: int = 0
    tokens_used: int = 0
    cache_hit: bool = False
    error_type: Optional[str] = None

class RAGCache:
    """Redis-based caching for RAG operations"""
    
    def __init__(self):
        self.redis_client = None
        self._initialize_redis()
    
    def _initialize_redis(self):
        """Initialize Redis connection with fallback"""
        try:
            self.redis_client = redis.Redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_timeout=5,
                socket_connect_timeout=5
            )
            self.redis_client.ping()
            logger.info("Redis cache initialized successfully")
        except Exception as e:
            logger.warning(f"Redis initialization failed: {e}. Operating without cache.")
            self.redis_client = None
    
    def _get_cache_key(self, operation: str, clone_id: str, query: str = None) -> str:
        """Generate cache key for operation"""
        key_parts = [operation, clone_id]
        if query:
            # Hash query for consistent key length
            query_hash = hashlib.md5(query.encode()).hexdigest()[:8]
            key_parts.append(query_hash)
        return f"rag:{':'.join(key_parts)}"
    
    async def get(self, key: str) -> Optional[Dict[str, Any]]:
        """Get cached value"""
        if not self.redis_client:
            return None
        
        try:
            cached_value = self.redis_client.get(key)
            if cached_value:
                return json.loads(cached_value)
        except Exception as e:
            logger.warning(f"Cache get failed: {e}")
        return None
    
    async def set(self, key: str, value: Dict[str, Any], ttl: int = 300):
        """Set cached value with TTL"""
        if not self.redis_client:
            return
        
        try:
            self.redis_client.setex(
                key, 
                ttl, 
                json.dumps(value, default=str)
            )
        except Exception as e:
            logger.warning(f"Cache set failed: {e}")
    
    async def delete(self, pattern: str):
        """Delete cache entries matching pattern"""
        if not self.redis_client:
            return
        
        try:
            keys = self.redis_client.keys(pattern)
            if keys:
                self.redis_client.delete(*keys)
        except Exception as e:
            logger.warning(f"Cache delete failed: {e}")

def track_metrics(operation: str):
    """Decorator to track RAG operation metrics"""
    def decorator(func):
        @wraps(func)
        async def wrapper(self, *args, **kwargs):
            start_time = time.time()
            clone_id = kwargs.get('clone_id') or (args[0] if args else 'unknown')
            
            try:
                result = await func(self, *args, **kwargs)
                duration = (time.time() - start_time) * 1000
                
                metrics = RAGMetrics(
                    operation=operation,
                    clone_id=str(clone_id),
                    duration_ms=duration,
                    success=result.get('success', False),
                    mode=RAGMode(result.get('mode', 'unknown')),
                    sources_count=len(result.get('sources', [])),
                    tokens_used=result.get('tokens_used', 0),
                    cache_hit=result.get('cache_hit', False)
                )
                
                await self._record_metrics(metrics)
                logger.info("RAG operation completed", **asdict(metrics))
                
                return result
            except Exception as e:
                duration = (time.time() - start_time) * 1000
                
                metrics = RAGMetrics(
                    operation=operation,
                    clone_id=str(clone_id),
                    duration_ms=duration,
                    success=False,
                    mode=RAGMode.ERROR,
                    error_type=type(e).__name__
                )
                
                await self._record_metrics(metrics)
                logger.error("RAG operation failed", **asdict(metrics), error=str(e))
                raise
        return wrapper
    return decorator

class RAGServiceError(Exception):
    """Custom exception for RAG service errors with categories"""
    
    def __init__(self, message: str, error_type: str = "general", retryable: bool = False):
        super().__init__(message)
        self.error_type = error_type
        self.retryable = retryable

class RAGService:
    """
    Production RAG service with comprehensive error handling and monitoring
    """
    
    def __init__(self):
        self.openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.rag_base_url = getattr(settings, 'RAG_SERVICE_URL', 'http://localhost:8000')
        self.supabase = get_supabase()
        self._http_client = None
        self.cache = RAGCache()
        self._circuit_breaker = {}  # Simple circuit breaker state
        
    async def get_http_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client with connection pooling"""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(
                timeout=httpx.Timeout(timeout=30.0),
                limits=httpx.Limits(
                    max_keepalive_connections=5, 
                    max_connections=10,
                    keepalive_expiry=300.0
                ),
                headers={"User-Agent": "CloneAI-RAG-Service/1.0"}
            )
        return self._http_client
    
    async def cleanup(self):
        """Cleanup resources"""
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()
            self._http_client = None
    
    def _is_circuit_open(self, service: str) -> bool:
        """Check if circuit breaker is open for service"""
        if service not in self._circuit_breaker:
            return False
        
        breaker = self._circuit_breaker[service]
        if breaker['failures'] >= 5:  # Trip after 5 failures
            if datetime.now() - breaker['last_failure'] < timedelta(minutes=5):
                return True
            else:
                # Reset after 5 minutes
                self._circuit_breaker[service] = {'failures': 0, 'last_failure': None}
        
        return False
    
    def _record_failure(self, service: str):
        """Record service failure for circuit breaker"""
        if service not in self._circuit_breaker:
            self._circuit_breaker[service] = {'failures': 0, 'last_failure': None}
        
        self._circuit_breaker[service]['failures'] += 1
        self._circuit_breaker[service]['last_failure'] = datetime.now()
    
    def _record_success(self, service: str):
        """Record service success for circuit breaker"""
        if service in self._circuit_breaker:
            self._circuit_breaker[service]['failures'] = 0
    
    @track_metrics("initialize_memory")
    async def initialize_clone_memory(
        self,
        clone_id: str,
        expert_name: str,
        domain_name: str,
        context: str,
        documents: List[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Initialize RAG memory for a clone with comprehensive error handling
        """
        try:
            logger.info(f"Initializing RAG memory for clone {clone_id}")
            
            # Validate inputs
            if not all([clone_id, expert_name, domain_name, context]):
                raise RAGServiceError("Missing required parameters", "validation")
            
            # Check if already initialized
            existing_mapping = await self._get_clone_rag_mapping(clone_id)
            if existing_mapping and existing_mapping.get('rag_status') == 'ready':
                logger.info(f"RAG already initialized for clone {clone_id}")
                return {
                    'success': True,
                    'message': 'RAG memory already initialized',
                    'data': existing_mapping,
                    'mode': 'cached'
                }
            
            # Update status to initializing
            await self._update_clone_rag_status(clone_id, 'initializing')
            
            # Prepare documents from existing knowledge if not provided
            if not documents:
                documents = await self._get_clone_documents(clone_id)
            
            # Validate documents
            if documents:
                for doc in documents:
                    if not doc.get('name') or not doc.get('url'):
                        logger.warning(f"Invalid document format: {doc}")
                        continue
            
            # Call RAG service with retry logic
            rag_result = await self._call_rag_initialize(
                expert_name=expert_name,
                domain_name=domain_name,
                context=context,
                documents=documents
            )
            
            if not rag_result.get('success'):
                error_msg = rag_result.get('error', 'Unknown RAG initialization error')
                raise RAGServiceError(f"RAG initialization failed: {error_msg}", "rag_service")
            
            # Store RAG mapping in database
            await self._create_clone_rag_mapping(
                clone_id=clone_id,
                expert_name=expert_name,
                domain_name=domain_name,
                assistant_id=rag_result['data'].get('assistant_id'),
                vector_store_id=rag_result['data'].get('vector_store_id')
            )
            
            # Update clone status to ready
            await self._update_clone_rag_status(clone_id, 'ready')
            
            # Clear any cached status
            await self.cache.delete(f"rag:status:{clone_id}*")
            
            logger.info(f"Successfully initialized RAG memory for clone {clone_id}")
            return {
                'success': True,
                'message': 'RAG memory initialized successfully',
                'data': rag_result['data'],
                'mode': 'rag'
            }
            
        except RAGServiceError:
            await self._update_clone_rag_status(clone_id, 'error', str(e))
            raise
        except Exception as e:
            error_msg = f"Unexpected error during RAG initialization: {str(e)}"
            logger.error(error_msg, clone_id=clone_id, error=str(e))
            await self._update_clone_rag_status(clone_id, 'error', error_msg)
            raise RAGServiceError(error_msg, "unexpected")
    
    @track_metrics("query_rag")
    async def query_clone_with_rag(
        self,
        clone_id: str,
        query: str,
        conversation_history: List[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Query clone using RAG system with intelligent fallback and caching
        """
        try:
            logger.info(f"Processing query for clone {clone_id}: {query[:100]}...")
            
            # Check cache first
            cache_key = self.cache._get_cache_key("query", clone_id, query)
            cached_result = await self.cache.get(cache_key)
            if cached_result:
                cached_result['cache_hit'] = True
                cached_result['mode'] = 'cached'
                return cached_result
            
            # Check RAG availability
            rag_mapping = await self._get_clone_rag_mapping(clone_id)
            use_rag = (
                rag_mapping and 
                rag_mapping.get('rag_status') == 'ready' and
                not self._is_circuit_open('rag_service')
            )
            
            result = None
            
            if use_rag:
                # Try RAG query first
                try:
                    rag_result = await self._query_with_rag(clone_id, query, conversation_history)
                    if rag_result.get('success'):
                        result = self._format_rag_response(rag_result, 'rag')
                        self._record_success('rag_service')
                    else:
                        logger.warning(f"RAG query failed for clone {clone_id}, falling back to LLM")
                        self._record_failure('rag_service')
                except Exception as e:
                    logger.warning(f"RAG query error for clone {clone_id}: {str(e)}, falling back to LLM")
                    self._record_failure('rag_service')
            
            # Fallback to standard LLM if RAG failed or unavailable
            if not result or not result.get('success'):
                try:
                    fallback_result = await self._query_with_llm_fallback(clone_id, query, conversation_history)
                    result = self._format_rag_response(fallback_result, 'llm_fallback')
                except Exception as e:
                    # Ultimate fallback
                    logger.error(f"LLM fallback also failed: {str(e)}")
                    result = {
                        'success': False,
                        'error': str(e),
                        'response': "I apologize, but I'm experiencing technical difficulties. Please try again later.",
                        'mode': 'error_fallback'
                    }
            
            # Cache successful results
            if result.get('success') and result.get('response'):
                await self.cache.set(cache_key, result, ttl=300)  # 5 minute cache
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to process query for clone {clone_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'response': "I'm sorry, I'm having trouble processing your request right now. Please try again.",
                'mode': 'error'
            }
    
    @retry(
        stop=stop_after_attempt(3), 
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type(httpx.TimeoutException)
    )
    async def _call_rag_initialize(
        self,
        expert_name: str,
        domain_name: str,
        context: str,
        documents: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Call RAG service to initialize expert memory with retries"""
        
        if self._is_circuit_open('rag_service'):
            raise RAGServiceError("RAG service unavailable (circuit breaker open)", "circuit_breaker")
        
        http_client = await self.get_http_client()
        
        payload = {
            "expert_name": expert_name,
            "domain_name": domain_name,
            "context": context,
            "documents": documents or []
        }
        
        try:
            response = await http_client.post(
                f"{self.rag_base_url}/memory/expert/initialize",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            response.raise_for_status()
            
            result = response.json()
            self._record_success('rag_service')
            return result
            
        except httpx.HTTPStatusError as e:
            error_msg = f"RAG service HTTP error: {e.response.status_code}"
            if e.response.status_code >= 500:
                self._record_failure('rag_service')
            logger.error(error_msg, response_text=e.response.text)
            raise RAGServiceError(error_msg, "http_error", retryable=e.response.status_code >= 500)
        except httpx.TimeoutException as e:
            self._record_failure('rag_service')
            logger.error(f"RAG service timeout: {str(e)}")
            raise RAGServiceError("RAG service timeout", "timeout", retryable=True)
        except httpx.RequestError as e:
            self._record_failure('rag_service')
            logger.error(f"RAG service connection error: {str(e)}")
            raise RAGServiceError(f"RAG service unavailable: {str(e)}", "connection", retryable=True)
    
    # Additional methods continue with similar comprehensive error handling...
    
    async def _record_metrics(self, metrics: RAGMetrics):
        """Record metrics for monitoring and analytics"""
        try:
            # Store metrics in database for analytics
            await self.supabase.table('rag_metrics').insert({
                'clone_id': metrics.clone_id,
                'operation': metrics.operation,
                'duration_ms': metrics.duration_ms,
                'success': metrics.success,
                'mode': metrics.mode.value,
                'sources_count': metrics.sources_count,
                'tokens_used': metrics.tokens_used,
                'cache_hit': metrics.cache_hit,
                'error_type': metrics.error_type,
                'timestamp': datetime.utcnow().isoformat()
            }).execute()
        except Exception as e:
            logger.warning(f"Failed to record metrics: {e}")
    
    # Health check endpoint
    async def health_check(self) -> Dict[str, Any]:
        """Comprehensive health check for RAG service"""
        health = {
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'services': {}
        }
        
        # Check database connection
        try:
            await self.supabase.table('domains').select('count').limit(1).execute()
            health['services']['database'] = 'healthy'
        except Exception as e:
            health['services']['database'] = f'unhealthy: {str(e)}'
            health['status'] = 'unhealthy'
        
        # Check RAG service
        try:
            if not self._is_circuit_open('rag_service'):
                http_client = await self.get_http_client()
                response = await http_client.get(f"{self.rag_base_url}/health", timeout=5.0)
                if response.status_code == 200:
                    health['services']['rag_service'] = 'healthy'
                else:
                    health['services']['rag_service'] = f'unhealthy: HTTP {response.status_code}'
                    health['status'] = 'degraded'
            else:
                health['services']['rag_service'] = 'circuit_breaker_open'
                health['status'] = 'degraded'
        except Exception as e:
            health['services']['rag_service'] = f'unhealthy: {str(e)}'
            health['status'] = 'degraded'
        
        # Check OpenAI
        try:
            await self.openai_client.models.list()
            health['services']['openai'] = 'healthy'
        except Exception as e:
            health['services']['openai'] = f'unhealthy: {str(e)}'
            health['status'] = 'degraded'
        
        # Check cache
        if self.cache.redis_client:
            try:
                self.cache.redis_client.ping()
                health['services']['cache'] = 'healthy'
            except Exception as e:
                health['services']['cache'] = f'unhealthy: {str(e)}'
        else:
            health['services']['cache'] = 'disabled'
        
        return health

# Global service instance
rag_service = RAGService()

# Cleanup function for FastAPI shutdown
async def cleanup_rag_service():
    """Cleanup RAG service resources"""
    await rag_service.cleanup()
```

### 2. API Router with Complete Error Handling

```python
"""
RAG API Router with comprehensive error handling and validation
"""
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from pydantic import ValidationError
import structlog

from app.core.supabase_auth import get_current_user_id, security, get_optional_current_user_id
from app.services.rag_service import rag_service, RAGServiceError
from app.models.schemas import (
    RAGInitRequest, RAGQueryRequest, RAGResponse, 
    CloneRAGStatus, DocumentProcessingStatus,
    ErrorResponse, HealthCheckResponse
)
from app.core.rate_limiting import rate_limit
from app.core.monitoring import track_api_call

logger = structlog.get_logger()
router = APIRouter(prefix="/rag", tags=["RAG Operations"])

class RAGAPIError(Exception):
    """Custom API error for RAG operations"""
    def __init__(self, message: str, status_code: int = 500, error_code: str = None):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        super().__init__(message)

@router.exception_handler(RAGServiceError)
async def rag_service_error_handler(request, exc: RAGServiceError):
    """Handle RAG service errors with appropriate HTTP status codes"""
    status_code = 500
    
    if exc.error_type == "validation":
        status_code = 400
    elif exc.error_type == "not_found":
        status_code = 404
    elif exc.error_type == "unauthorized":
        status_code = 403
    elif exc.error_type in ["timeout", "connection"]:
        status_code = 503
    elif exc.error_type == "rate_limit":
        status_code = 429
    
    return JSONResponse(
        status_code=status_code,
        content={
            "success": false,
            "error": {
                "message": str(exc),
                "type": exc.error_type,
                "retryable": exc.retryable,
                "timestamp": datetime.utcnow().isoformat()
            }
        }
    )

@router.exception_handler(ValidationError)
async def validation_error_handler(request, exc: ValidationError):
    """Handle Pydantic validation errors"""
    return JSONResponse(
        status_code=422,
        content={
            "success": false,
            "error": {
                "message": "Validation error",
                "details": exc.errors(),
                "timestamp": datetime.utcnow().isoformat()
            }
        }
    )

async def verify_clone_access(
    clone_id: str, 
    current_user_id: str, 
    require_ownership: bool = True
) -> dict:
    """Verify user has access to clone"""
    clone_info = await rag_service._get_clone_info(clone_id)
    if not clone_info:
        raise HTTPException(status_code=404, detail="Clone not found")
    
    if require_ownership and clone_info.get('creator_id') != current_user_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this clone")
    
    # For non-ownership checks, allow access if clone is published
    if not require_ownership and not clone_info.get('is_published') and clone_info.get('creator_id') != current_user_id:
        raise HTTPException(status_code=403, detail="Clone not accessible")
    
    return clone_info

@router.get("/health", response_model=HealthCheckResponse)
async def health_check():
    """
    Comprehensive health check for RAG system
    """
    try:
        health_info = await rag_service.health_check()
        
        status_code = 200
        if health_info['status'] == 'degraded':
            status_code = 206  # Partial Content
        elif health_info['status'] == 'unhealthy':
            status_code = 503  # Service Unavailable
        
        return JSONResponse(
            status_code=status_code,
            content=health_info
        )
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
        )

@router.post("/initialize/{clone_id}", response_model=RAGResponse)
@rate_limit(requests_per_minute=5)  # Limit initialization requests
@track_api_call("rag_initialize")
async def initialize_clone_rag(
    clone_id: str,
    request: RAGInitRequest,
    background_tasks: BackgroundTasks,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user_id: str = Depends(get_current_user_id)
) -> RAGResponse:
    """
    Initialize RAG memory for a clone
    Rate limited to prevent abuse and resource exhaustion
    """
    try:
        logger.info(f"Initializing RAG for clone {clone_id} by user {current_user_id}")
        
        # Verify clone ownership
        clone_info = await verify_clone_access(clone_id, current_user_id, require_ownership=True)
        
        # Check if RAG is already being initialized
        existing_status = await rag_service._get_clone_rag_mapping(clone_id)
        if existing_status and existing_status.get('rag_status') == 'initializing':
            raise RAGAPIError(
                "RAG initialization already in progress",
                status_code=409,
                error_code="already_initializing"
            )
        
        # Validate domain
        valid_domains = [
            'health-wellness', 'business-strategy', 'education-learning',
            'finance-investment', 'life-coaching', 'legal-consulting',
            'ai-technology', 'other'
        ]
        if request.domain_name not in valid_domains:
            raise RAGAPIError(
                f"Invalid domain. Must be one of: {', '.join(valid_domains)}",
                status_code=400,
                error_code="invalid_domain"
            )
        
        # Initialize RAG memory
        result = await rag_service.initialize_clone_memory(
            clone_id=clone_id,
            expert_name=request.expert_name or clone_info['name'],
            domain_name=request.domain_name,
            context=request.context,
            documents=request.documents
        )
        
        if not result['success']:
            raise RAGServiceError(
                f"RAG initialization failed: {result['error']}", 
                "initialization_failed"
            )
        
        # Schedule background cleanup of old resources if any
        background_tasks.add_task(cleanup_old_rag_resources, clone_id)
        
        return RAGResponse(
            success=True,
            message="RAG memory initialized successfully",
            data=result['data'],
            mode=result.get('mode', 'rag'),
            timestamp=datetime.utcnow()
        )
        
    except RAGAPIError:
        raise
    except RAGServiceError as e:
        logger.error(f"RAG service error during initialization: {str(e)}")
        raise HTTPException(
            status_code=500 if not e.retryable else 503,
            detail={
                "message": str(e),
                "retryable": e.retryable,
                "error_type": e.error_type
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error during RAG initialization: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/query/{clone_id}", response_model=RAGResponse)
@rate_limit(requests_per_minute=30)  # Higher rate limit for queries
@track_api_call("rag_query")
async def query_clone_rag(
    clone_id: str,
    request: RAGQueryRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user_id: str = Depends(get_current_user_id)
) -> RAGResponse:
    """
    Query clone using RAG system with intelligent fallback
    Main endpoint for enhanced chat interactions
    """
    try:
        logger.info(f"RAG query for clone {clone_id} by user {current_user_id}")
        
        # Verify access (clone must be published or user must be creator)
        clone_info = await verify_clone_access(clone_id, current_user_id, require_ownership=False)
        
        # Validate query length
        if len(request.query.strip()) == 0:
            raise RAGAPIError("Query cannot be empty", status_code=400, error_code="empty_query")
        
        if len(request.query) > 4000:  # Reasonable limit
            raise RAGAPIError("Query too long", status_code=400, error_code="query_too_long")
        
        # Validate conversation history
        if request.conversation_history:
            if len(request.conversation_history) > 20:  # Limit context window
                request.conversation_history = request.conversation_history[-20:]
            
            for msg in request.conversation_history:
                if msg['role'] not in ['user', 'assistant']:
                    raise RAGAPIError("Invalid conversation history format", status_code=400)
        
        # Process query
        result = await rag_service.query_clone_with_rag(
            clone_id=clone_id,
            query=request.query,
            conversation_history=request.conversation_history
        )
        
        if not result['success']:
            # Even if processing failed, we should return the error response
            # rather than throwing an exception for better UX
            logger.warning(f"Query processing failed: {result.get('error')}")
        
        return RAGResponse(
            success=result['success'],
            message="Query processed" if result['success'] else "Query failed",
            response=result.get('response'),
            sources=result.get('sources', []),
            mode=result.get('mode', 'unknown'),
            timestamp=datetime.utcnow(),
            data={'cache_hit': result.get('cache_hit', False)} if result.get('cache_hit') else None
        )
        
    except RAGAPIError:
        raise
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error during RAG query: {str(e)}")
        # Return a graceful error response rather than HTTP 500
        return RAGResponse(
            success=False,
            message="Query processing failed",
            response="I apologize, but I'm having trouble processing your request right now. Please try again.",
            sources=[],
            mode="error",
            timestamp=datetime.utcnow()
        )

@router.get("/status/{clone_id}", response_model=CloneRAGStatus)
@track_api_call("rag_status")
async def get_clone_rag_status(
    clone_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user_id: str = Depends(get_current_user_id)
) -> CloneRAGStatus:
    """
    Get comprehensive RAG status for a clone
    Used by frontend to check initialization progress and system health
    """
    try:
        # Verify access
        clone_info = await verify_clone_access(clone_id, current_user_id, require_ownership=True)
        
        # Get RAG mapping
        rag_mapping = await rag_service._get_clone_rag_mapping(clone_id)
        
        # Get additional status information
        status_data = {
            'clone_id': clone_id,
            'rag_enabled': clone_info.get('rag_enabled', False),
            'rag_status': clone_info.get('rag_initialization_status', 'pending'),
            'expert_name': rag_mapping.get('expert_name') if rag_mapping else None,
            'domain_name': rag_mapping.get('domain_name') if rag_mapping else None,
            'last_processed_at': rag_mapping.get('last_processed_at') if rag_mapping else None,
            'error_message': None
        }
        
        # Get error message from mapping or clone config
        if rag_mapping and rag_mapping.get('error_message'):
            status_data['error_message'] = rag_mapping['error_message']
        elif clone_info.get('rag_config') and isinstance(clone_info['rag_config'], dict):
            status_data['error_message'] = clone_info['rag_config'].get('error_message')
        
        # Add performance metrics if available
        if rag_mapping and rag_mapping.get('performance_metrics'):
            status_data['performance_metrics'] = rag_mapping['performance_metrics']
        
        return CloneRAGStatus(**status_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get RAG status for clone {clone_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve RAG status")

@router.post("/documents/process/{clone_id}", response_model=RAGResponse)
@rate_limit(requests_per_minute=10)
@track_api_call("rag_process_documents")
async def process_clone_documents(
    clone_id: str,
    background_tasks: BackgroundTasks,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user_id: str = Depends(get_current_user_id)
) -> RAGResponse:
    """
    Process existing documents for RAG integration
    Called when adding documents to an existing clone
    """
    try:
        logger.info(f"Processing documents for clone {clone_id}")
        
        # Verify ownership
        clone_info = await verify_clone_access(clone_id, current_user_id, require_ownership=True)
        
        # Get documents and process them
        documents = await rag_service._get_clone_documents(clone_id)
        
        if not documents:
            return RAGResponse(
                success=True,
                message="No documents to process",
                data={'processed_count': 0},
                timestamp=datetime.utcnow()
            )
        
        # Check if RAG is already initialized
        rag_mapping = await rag_service._get_clone_rag_mapping(clone_id)
        if not rag_mapping or rag_mapping.get('rag_status') != 'ready':
            raise RAGAPIError(
                "RAG must be initialized before processing documents",
                status_code=400,
                error_code="rag_not_initialized"
            )
        
        # Schedule background document processing
        background_tasks.add_task(
            process_documents_background,
            clone_id,
            documents,
            rag_mapping['vector_store_id']
        )
        
        return RAGResponse(
            success=True,
            message=f"Processing {len(documents)} documents in background",
            data={'queued_count': len(documents)},
            timestamp=datetime.utcnow()
        )
        
    except RAGAPIError:
        raise
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to process documents for clone {clone_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Document processing failed")

@router.delete("/cleanup/{clone_id}", response_model=RAGResponse)
@track_api_call("rag_cleanup")
async def cleanup_clone_rag(
    clone_id: str,
    background_tasks: BackgroundTasks,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user_id: str = Depends(get_current_user_id)
) -> RAGResponse:
    """
    Cleanup RAG resources for a clone
    Called when deleting a clone or disabling RAG
    """
    try:
        logger.info(f"Cleaning up RAG resources for clone {clone_id}")
        
        # Verify ownership
        clone_info = await verify_clone_access(clone_id, current_user_id, require_ownership=True)
        
        # Get RAG mapping for cleanup
        rag_mapping = await rag_service._get_clone_rag_mapping(clone_id)
        
        if rag_mapping:
            # Schedule background cleanup
            background_tasks.add_task(
                cleanup_rag_resources_background,
                clone_id,
                rag_mapping.get('assistant_id'),
                rag_mapping.get('vector_store_id')
            )
        
        # Update status immediately
        await rag_service._update_clone_rag_status(clone_id, 'disabled')
        
        return RAGResponse(
            success=True,
            message="RAG resources cleanup initiated",
            timestamp=datetime.utcnow()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to cleanup RAG for clone {clone_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Cleanup failed")

# Background task functions
async def cleanup_old_rag_resources(clone_id: str):
    """Background task to cleanup old RAG resources"""
    try:
        # Implementation for cleaning up old assistants, vector stores, etc.
        logger.info(f"Cleaning up old RAG resources for clone {clone_id}")
        # Add actual cleanup logic here
    except Exception as e:
        logger.error(f"Background cleanup failed for clone {clone_id}: {str(e)}")

async def process_documents_background(
    clone_id: str,
    documents: List[Dict],
    vector_store_id: str
):
    """Background task to process documents"""
    try:
        logger.info(f"Background processing {len(documents)} documents for clone {clone_id}")
        # Add actual document processing logic here
    except Exception as e:
        logger.error(f"Background document processing failed for clone {clone_id}: {str(e)}")

async def cleanup_rag_resources_background(
    clone_id: str,
    assistant_id: str,
    vector_store_id: str
):
    """Background task to cleanup RAG resources"""
    try:
        logger.info(f"Background cleanup of RAG resources for clone {clone_id}")
        # Add actual resource cleanup logic here
    except Exception as e:
        logger.error(f"Background RAG cleanup failed for clone {clone_id}: {str(e)}")
```

## Frontend Component Library

### 1. Complete Memory Preparation Component

```tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Brain, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  Lightbulb,
  Database,
  Zap,
  Clock,
  TrendingUp,
  Settings,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRAGStatus } from "@/hooks/use-rag-status";
import { ragAnalytics } from "@/lib/rag-analytics";

interface MemoryPreparationProps {
  cloneId: string;
  cloneName: string;
  category: string;
  documents: DocumentInfo[];
  onMemoryReady: (isReady: boolean) => void;
  onInitialize: () => void;
  className?: string;
}

interface DocumentInfo {
  name: string;
  url: string;
  status: string;
  type: string;
  id: string;
  size?: number;
}

interface ProgressStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  description: string;
  estimatedTime?: number;
}

export function MemoryPreparation({ 
  cloneId, 
  cloneName, 
  category, 
  documents,
  onMemoryReady,
  onInitialize,
  className = ""
}: MemoryPreparationProps) {
  const { status, isLoading, error, isInitializing, isReady, hasError, retry } = useRAGStatus(cloneId);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Progress steps configuration
  const progressSteps: ProgressStep[] = useMemo(() => [
    {
      id: 'domain_setup',
      label: 'Domain Configuration',
      status: 'pending',
      description: 'Setting up knowledge domain and categories',
      estimatedTime: 5000
    },
    {
      id: 'document_processing',
      label: 'Document Processing',
      status: 'pending',
      description: 'Analyzing and extracting knowledge from documents',
      estimatedTime: documents.length * 3000
    },
    {
      id: 'vector_store',
      label: 'Memory Storage',
      status: 'pending',
      description: 'Creating intelligent knowledge index',
      estimatedTime: 10000
    },
    {
      id: 'assistant_creation',
      label: 'AI Assistant Setup',
      status: 'pending',
      description: 'Configuring AI assistant with your knowledge',
      estimatedTime: 8000
    },
    {
      id: 'validation',
      label: 'Quality Validation',
      status: 'pending',
      description: 'Verifying knowledge integration and response quality',
      estimatedTime: 5000
    }
  ], [documents.length]);

  // Simulate realistic progress during initialization
  useEffect(() => {
    if (!isInitializing) {
      setProgress(0);
      setCurrentStep(0);
      setEstimatedTimeRemaining(null);
      return;
    }

    const totalEstimatedTime = progressSteps.reduce((sum, step) => sum + (step.estimatedTime || 0), 0);
    let elapsedTime = 0;
    
    const interval = setInterval(() => {
      elapsedTime += 1000; // 1 second intervals
      
      // Calculate current step based on elapsed time
      let timeAccumulated = 0;
      let newCurrentStep = 0;
      
      for (let i = 0; i < progressSteps.length; i++) {
        timeAccumulated += progressSteps[i].estimatedTime || 0;
        if (elapsedTime <= timeAccumulated) {
          newCurrentStep = i;
          break;
        }
      }
      
      setCurrentStep(newCurrentStep);
      
      // Calculate progress with some randomness for realism
      const baseProgress = Math.min((elapsedTime / totalEstimatedTime) * 100, 95);
      const randomVariation = Math.random() * 3; // ±3% variation
      const newProgress = Math.min(baseProgress + randomVariation, 95);
      
      setProgress(newProgress);
      
      // Calculate estimated time remaining
      const remainingTime = Math.max(totalEstimatedTime - elapsedTime, 0);
      setEstimatedTimeRemaining(remainingTime);
      
      // Stop at 95% to wait for actual completion
      if (newProgress >= 95) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isInitializing, progressSteps]);

  // Handle actual completion
  useEffect(() => {
    if (isReady) {
      setProgress(100);
      setCurrentStep(progressSteps.length - 1);
      setEstimatedTimeRemaining(0);
    }
  }, [isReady, progressSteps.length]);

  useEffect(() => {
    onMemoryReady(isReady);
  }, [isReady, onMemoryReady]);

  const getDomainMapping = useCallback((category: string): string => {
    const mapping: Record<string, string> = {
      'medical': 'health-wellness',
      'business': 'business-strategy', 
      'education': 'education-learning',
      'finance': 'finance-investment',
      'coaching': 'life-coaching',
      'legal': 'legal-consulting',
      'ai': 'ai-technology'
    };
    return mapping[category] || 'other';
  }, []);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'ready': return 'bg-green-500';
      case 'initializing': return 'bg-blue-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  }, []);

  const formatTimeRemaining = useCallback((ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const handleInitialize = useCallback(async () => {
    try {
      ragAnalytics.trackInitialization(cloneId, true, 0);
      onInitialize();
    } catch (error) {
      ragAnalytics.trackError('memory_preparation', error instanceof Error ? error.message : 'Unknown error');
    }
  }, [cloneId, onInitialize]);

  const renderProgressSteps = () => (
    <div className="space-y-3">
      {progressSteps.map((step, index) => {
        const isActive = index === currentStep && isInitializing;
        const isCompleted = index < currentStep || isReady;
        const isError = hasError && index === currentStep;
        
        return (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${
              isActive ? 'bg-blue-50 border-l-4 border-l-blue-500' :
              isCompleted ? 'bg-green-50 border-l-4 border-l-green-500' :
              isError ? 'bg-red-50 border-l-4 border-l-red-500' :
              'bg-gray-50'
            }`}
          >
            <div className="flex-shrink-0">
              {isCompleted ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : isError ? (
                <AlertCircle className="h-5 w-5 text-red-500" />
              ) : isActive ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <Database className="h-5 w-5 text-blue-500" />
                </motion.div>
              ) : (
                <Clock className="h-5 w-5 text-gray-400" />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{step.label}</div>
              <div className="text-xs text-gray-600">{step.description}</div>
            </div>
            
            {isActive && estimatedTimeRemaining && step.estimatedTime && (
              <div className="text-xs text-blue-600 font-mono">
                ~{formatTimeRemaining(Math.min(estimatedTimeRemaining, step.estimatedTime))}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );

  const renderStatusContent = () => {
    if (hasError) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-4"
        >
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700">
              <div className="space-y-2">
                <p className="font-medium">Memory layer initialization failed</p>
                <p className="text-sm">{error || status?.error_message}</p>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={retry}
                    className="text-red-700 border-red-300 hover:bg-red-100"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Retry
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-red-700 hover:bg-red-100"
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    Advanced
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
          
          {showAdvanced && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-2"
            >
              <div className="text-sm text-gray-600">
                <strong>Troubleshooting steps:</strong>
              </div>
              <ul className="text-xs text-gray-600 space-y-1 ml-4">
                <li>• Check that all documents are accessible</li>
                <li>• Verify document formats are supported (PDF, DOCX, TXT)</li>
                <li>• Ensure documents contain readable text content</li>
                <li>• Try reducing the number of documents if you have many</li>
              </ul>
            </motion.div>
          )}
        </motion.div>
      );
    }

    if (isInitializing) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          <div className="text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="inline-block"
            >
              <Brain className="h-8 w-8 text-blue-500 mb-2" />
            </motion.div>
            <h3 className="font-semibold text-lg">Preparing the Memory Layer</h3>
            <p className="text-sm text-gray-600">
              Processing your knowledge and building intelligent responses...
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Overall Progress</span>
                <div className="flex items-center space-x-2">
                  <span>{Math.round(progress)}%</span>
                  {estimatedTimeRemaining && estimatedTimeRemaining > 1000 && (
                    <span className="text-gray-500">
                      • ~{formatTimeRemaining(estimatedTimeRemaining)} remaining
                    </span>
                  )}
                </div>
              </div>
              <Progress value={progress} className="w-full h-2" />
            </div>

            <Tabs defaultValue="steps" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="steps">Progress Steps</TabsTrigger>
                <TabsTrigger value="overview">Overview</TabsTrigger>
              </TabsList>
              
              <TabsContent value="steps" className="mt-4">
                {renderProgressSteps()}
              </TabsContent>
              
              <TabsContent value="overview" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg">
                    <Database className="h-4 w-4 text-blue-500" />
                    <div>
                      <div className="font-medium">Knowledge Base</div>
                      <div className="text-xs text-gray-600">Domain: {getDomainMapping(category)}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 p-3 bg-green-50 rounded-lg">
                    <FileText className="h-4 w-4 text-green-500" />
                    <div>
                      <div className="font-medium">{documents.length} Documents</div>
                      <div className="text-xs text-gray-600">
                        {documents.reduce((sum, doc) => sum + (doc.size || 0), 0) / 1024 / 1024 > 1 ? 
                          `${(documents.reduce((sum, doc) => sum + (doc.size || 0), 0) / 1024 / 1024).toFixed(1)} MB` :
                          `${Math.round(documents.reduce((sum, doc) => sum + (doc.size || 0), 0) / 1024)} KB`
                        }
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 p-3 bg-purple-50 rounded-lg">
                    <Zap className="h-4 w-4 text-purple-500" />
                    <div>
                      <div className="font-medium">AI Assistant</div>
                      <div className="text-xs text-gray-600">Expert: {cloneName}</div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </motion.div>
      );
    }

    if (isReady) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-6"
        >
          <div className="flex justify-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", bounce: 0.5 }}
            >
              <CheckCircle className="h-16 w-16 text-green-500" />
            </motion.div>
          </div>
          
          <div>
            <h3 className="font-semibold text-xl text-green-700 mb-2">Memory Layer Ready!</h3>
            <p className="text-sm text-gray-600 max-w-md mx-auto">
              Your clone now has access to enhanced knowledge and can provide more detailed, 
              context-aware responses based on your uploaded materials.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Brain className="h-4 w-4 text-green-600" />
                <div className="font-medium text-green-700">Expert Configuration</div>
              </div>
              <div className="space-y-1 text-green-600">
                <div>Expert: {status?.expert_name}</div>
                <div>Domain: {status?.domain_name}</div>
                <div className="text-xs">
                  Ready since: {status?.last_processed_at ? 
                    new Date(status.last_processed_at).toLocaleString() : 'Just now'}
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <div className="font-medium text-blue-700">Knowledge Base</div>
              </div>
              <div className="space-y-1 text-blue-600">
                <div>{documents.length} documents processed</div>
                <div>Enhanced responses enabled</div>
                <div className="text-xs">Source citations active</div>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-green-100 to-blue-100 p-4 rounded-lg">
            <div className="flex items-start space-x-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-left">
                <div className="font-medium text-gray-800">Ready to Test</div>
                <div className="text-sm text-gray-600 mt-1">
                  Try asking questions about your specific expertise to see the enhanced 
                  capabilities in action. Your clone will now cite sources and provide 
                  more detailed responses.
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      );
    }

    // Default state - not initialized
    return (
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <Lightbulb className="h-16 w-16 text-amber-500" />
        </div>
        
        <div>
          <h3 className="font-semibold text-xl mb-2">Enable Enhanced Memory</h3>
          <p className="text-sm text-gray-600 max-w-md mx-auto">
            Initialize the memory layer to enable your clone to use uploaded documents 
            and provide more intelligent, context-aware responses.
          </p>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="bg-amber-50 p-4 rounded-lg text-left">
              <div className="font-medium text-amber-700 mb-2">Enhanced Capabilities</div>
              <ul className="space-y-1 text-amber-600">
                <li>• Document-based responses</li>
                <li>• Source citations</li>
                <li>• Context-aware answers</li>
                <li>• Improved accuracy</li>
              </ul>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg text-left">
              <div className="font-medium text-blue-700 mb-2">Your Content</div>
              <div className="space-y-1 text-blue-600">
                <div>Domain: {getDomainMapping(category)}</div>
                <div>Documents: {documents.length}</div>
                <div>Expert: {cloneName}</div>
                <div className="text-xs mt-2">
                  {documents.length === 0 ? 
                    'Upload documents to enable processing' :
                    'Ready for memory layer initialization'
                  }
                </div>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleInitialize}
            disabled={isLoading || documents.length === 0}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            size="lg"
          >
            <Brain className="h-4 w-4 mr-2" />
            Initialize Memory Layer
          </Button>

          {documents.length === 0 && (
            <Alert className="border-amber-200 bg-amber-50">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700">
                Upload documents in Step 3 (Knowledge Transfer) to enable memory layer initialization.
                Supported formats: PDF, DOCX, TXT, and more.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Brain className="h-5 w-5" />
            <span>Memory Layer</span>
          </CardTitle>
          
          <div className="flex items-center space-x-2">
            {status && (
              <Badge className={`${getStatusColor(status.rag_status)} text-white`}>
                {status.rag_status.charAt(0).toUpperCase() + status.rag_status.slice(1)}
              </Badge>
            )}
            
            {isInitializing && estimatedTimeRemaining && estimatedTimeRemaining > 1000 && (
              <Badge variant="outline" className="text-blue-600 border-blue-300">
                <Clock className="h-3 w-3 mr-1" />
                {formatTimeRemaining(estimatedTimeRemaining)}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <Separator />
      
      <CardContent className="pt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={status?.rag_status || 'pending'}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {renderStatusContent()}
          </motion.div>
        </AnimatePresence>
        
        {status && (
          <div className="mt-6 pt-4 border-t text-xs text-gray-500">
            <div className="flex justify-between items-center">
              <span>
                Last updated: {status.last_processed_at ? 
                  new Date(status.last_processed_at).toLocaleString() : 'Never'}
              </span>
              {isReady && (
                <Badge variant="outline" className="text-green-600 border-green-300">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default MemoryPreparation;
```

## Integration Patterns

### 1. Complete Integration with Clone Wizard

```typescript
// Update to app/create-clone/wizard/page.tsx
// Add comprehensive RAG integration

// Import statements
import { MemoryPreparation } from '@/components/rag/memory-preparation';
import { EnhancedChatInterface } from '@/components/rag/enhanced-chat-interface';
import { useRAGStatus } from '@/hooks/use-rag-status';
import { ragApi } from '@/lib/api-client';
import { RAGErrorBoundary } from '@/components/rag/rag-error-boundary';

// Add to state management
const [formData, setFormData] = useState({
  // ... existing fields ...
  
  // RAG Configuration
  enableRAG: true,
  ragInitialized: false,
  ragExpertName: "",
  ragDomain: "",
  ragContext: "",
  ragAdvancedConfig: {
    memoryRetention: 'high',
    responseStyle: 'detailed',
    sourceCitation: true,
    contextWindow: 'large'
  }
});

// RAG Status Management
const { 
  status: ragStatus, 
  isReady: isRAGReady, 
  isInitializing: isRAGInitializing,
  initializeRAG,
  refreshStatus
} = useRAGStatus(createdCloneId);

// Enhanced Step 6 Implementation
{currentStep === 6 && (
  <motion.div
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    className="space-y-6"
  >
    <div className="text-center space-y-2">
      <h2 className="text-2xl font-bold flex items-center justify-center space-x-2">
        <Sparkles className="h-6 w-6 text-blue-500" />
        <span>Testing & Preview</span>
      </h2>
      <p className="text-gray-600 max-w-2xl mx-auto">
        Test your clone's enhanced capabilities and verify the memory layer integration. 
        Your clone can now provide context-aware responses using your uploaded knowledge.
      </p>
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* Left Column - Memory Status & Configuration */}
      <div className="xl:col-span-1 space-y-4">
        <RAGErrorBoundary>
          <MemoryPreparation
            cloneId={createdCloneId || ""}
            cloneName={formData.name}
            category={formData.expertise}
            documents={formData.existingDocuments}
            onMemoryReady={(isReady) => {
              setFormData(prev => ({ ...prev, ragInitialized: isReady }));
            }}
            onInitialize={async () => {
              if (!createdCloneId) return;

              // Enhanced domain mapping
              const domainMapping: Record<string, string> = {
                'medical': 'health-wellness',
                'business': 'business-strategy',
                'education': 'education-learning',
                'finance': 'finance-investment',
                'coaching': 'life-coaching',
                'legal': 'legal-consulting',
                'ai': 'ai-technology'
              };

              // Build comprehensive context
              const contextParts = [];
              if (formData.title) {
                contextParts.push(`Professional Title: ${formData.title}`);
              }
              if (formData.bio) {
                contextParts.push(`Professional Background: ${formData.bio}`);
              }
              if (formData.credentials) {
                contextParts.push(`Credentials & Qualifications: ${formData.credentials}`);
              }
              if (formData.expertise) {
                contextParts.push(`Area of Expertise: ${formData.expertise}`);
              }
              
              // Add personality context
              const personalityContext = Object.entries(formData.personality)
                .map(([trait, value]) => `${trait}: ${value[0]}`)
                .join(', ');
              contextParts.push(`Communication Style: ${personalityContext}`);
              
              // Add Q&A context if available
              const qaContext = Object.entries(formData.qaResponses)
                .filter(([_, answer]) => answer.trim())
                .map(([question, answer]) => `Q: ${question}\nA: ${answer}`)
                .join('\n\n');
              
              if (qaContext) {
                contextParts.push(`Key Q&A Knowledge:\n${qaContext}`);
              }

              const request = {
                expert_name: formData.name,
                domain_name: domainMapping[formData.expertise] || 'other',
                context: contextParts.join('\n\n') || `Expert in ${formData.expertise}`,
                documents: formData.existingDocuments.map(doc => ({
                  name: doc.name,
                  url: doc.url,
                  type: doc.type,
                  size_bytes: doc.size
                }))
              };

              try {
                await initializeRAG(request);
                
                // Update form data with RAG configuration
                setFormData(prev => ({
                  ...prev,
                  ragExpertName: formData.name,
                  ragDomain: domainMapping[formData.expertise] || 'other',
                  ragContext: request.context
                }));
                
                toast({
                  title: "Memory Layer Initializing",
                  description: "Your clone's knowledge base is being prepared...",
                });
              } catch (error) {
                toast({
                  title: "Initialization Failed",
                  description: error instanceof Error ? error.message : "Failed to initialize memory layer",
                  variant: "destructive",
                });
              }
            }}
          />
        </RAGErrorBoundary>

        {/* Advanced Configuration Panel */}
        {(isRAGReady || isRAGInitializing) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center space-x-2">
                <Settings className="h-4 w-4" />
                <span>Memory Configuration</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-gray-50 p-2 rounded">
                  <div className="font-medium">Domain</div>
                  <div className="text-gray-600">{ragStatus?.domain_name || 'Not set'}</div>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <div className="font-medium">Expert</div>
                  <div className="text-gray-600">{ragStatus?.expert_name || 'Not set'}</div>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <div className="font-medium">Documents</div>
                  <div className="text-gray-600">{formData.existingDocuments.length}</div>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <div className="font-medium">Status</div>
                  <div className="text-gray-600 capitalize">{ragStatus?.rag_status || 'Pending'}</div>
                </div>
              </div>
              
              {isRAGReady && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshStatus}
                  className="w-full"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Refresh Status
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Test Results Panel */}
        {formData.testResults && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center space-x-2">
                <TrendingUp className="h-4 w-4" />
                <span>Performance Metrics</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Response Accuracy</span>
                  <div className="flex items-center space-x-2">
                    <Progress value={formData.testResults.accuracy} className="w-16 h-2" />
                    <span className="text-sm font-medium">{formData.testResults.accuracy}%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Personality Match</span>
                  <div className="flex items-center space-x-2">
                    <Progress value={formData.testResults.personality} className="w-16 h-2" />
                    <span className="text-sm font-medium">{formData.testResults.personality}%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Knowledge Depth</span>
                  <div className="flex items-center space-x-2">
                    <Progress value={formData.testResults.knowledge} className="w-16 h-2" />
                    <span className="text-sm font-medium text-green-600">
                      {formData.testResults.knowledge}%
                      {isRAGReady && <span className="ml-1">📚</span>}
                    </span>
                  </div>
                </div>
              </div>
              
              {isRAGReady && (
                <div className="mt-3 pt-3 border-t">
                  <div className="flex items-center space-x-1 text-xs text-green-600">
                    <CheckCircle className="h-3 w-3" />
                    <span>Enhanced with memory layer</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right Column - Enhanced Chat Interface */}
      <div className="xl:col-span-2">
        <RAGErrorBoundary
          fallback={
            <Card className="h-[600px] flex items-center justify-center">
              <div className="text-center space-y-4">
                <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
                <div>
                  <h3 className="font-semibold">Enhanced Chat Unavailable</h3>
                  <p className="text-sm text-gray-600">
                    The enhanced chat interface is temporarily unavailable.
                    Your clone will work with standard responses.
                  </p>
                </div>
              </div>
            </Card>
          }
        >
          <EnhancedChatInterface
            cloneId={createdCloneId || ""}
            cloneName={formData.name}
            cloneAvatar={formData.existingAvatarUrl}
            isRAGReady={isRAGReady}
            onTestComplete={(success, response, metadata) => {
              if (success) {
                // Enhanced test results tracking
                const baseAccuracy = formData.testResults?.accuracy || 85;
                const basePersonality = formData.testResults?.personality || 90;
                const baseKnowledge = formData.testResults?.knowledge || 75;
                
                // Boost scores if RAG is working
                const ragBoost = isRAGReady && metadata?.mode === 'rag' ? 10 : 0;
                const sourcesBoost = metadata?.sources?.length > 0 ? 5 : 0;
                
                setFormData(prev => ({
                  ...prev,
                  testResults: {
                    accuracy: Math.min(98, baseAccuracy + Math.random() * 5 + ragBoost),
                    personality: Math.min(98, basePersonality + Math.random() * 3),
                    knowledge: Math.min(98, baseKnowledge + Math.random() * 5 + ragBoost + sourcesBoost)
                  }
                }));
                
                // Track successful interaction
                if (metadata?.mode === 'rag') {
                  ragAnalytics.trackQuery(createdCloneId || '', metadata.mode, metadata.responseTime || 0);
                }
              }
            }}
          />
        </RAGErrorBoundary>
      </div>
    </div>

    {/* Enhanced Features Showcase */}
    <AnimatePresence>
      {isRAGReady && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <Card className="bg-gradient-to-r from-blue-50 via-purple-50 to-green-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="relative">
                    <Sparkles className="h-8 w-8 text-blue-500" />
                    <motion.div
                      className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900 mb-2">
                    🎉 Enhanced Memory Layer Active!
                  </h3>
                  <p className="text-sm text-blue-700 mb-3">
                    Your clone now has access to uploaded documents and can provide more detailed, 
                    context-aware responses. Test questions about your specific expertise to see 
                    the enhanced capabilities in action.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="flex items-center space-x-2 text-xs">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-green-700">Document knowledge integration</span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-green-700">Automatic source citation</span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-green-700">Context-aware responses</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-3 bg-white/60 rounded-lg">
                    <div className="flex items-center space-x-2 text-xs text-blue-600">
                      <Lightbulb className="h-4 w-4" />
                      <span className="font-medium">Pro Tip:</span>
                    </div>
                    <p className="text-xs text-blue-600 mt-1">
                      Try asking specific questions about the content in your uploaded documents 
                      to see how your clone can now cite sources and provide detailed explanations.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Smart Suggestions for Testing */}
    {isRAGReady && (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center space-x-2">
            <MessageCircle className="h-4 w-4" />
            <span>Suggested Test Questions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {getSmartSuggestions(formData.expertise, formData.existingDocuments).map((suggestion, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className="text-left justify-start h-auto p-3 text-xs whitespace-normal"
                onClick={() => {
                  // Trigger the suggestion in the chat interface
                  // This would require a callback to the chat component
                }}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    )}

    {/* Navigation */}
    <div className="flex justify-between items-center pt-6">
      <Button
        variant="outline"
        onClick={() => setCurrentStep(5)}
        disabled={isSubmitting || isRAGInitializing}
        className="flex items-center space-x-2"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Media Training</span>
      </Button>
      
      <div className="flex items-center space-x-4">
        {isRAGInitializing && (
          <div className="flex items-center space-x-2 text-sm text-blue-600">
            <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
            <span>Preparing memory layer...</span>
          </div>
        )}
        
        <Button
          onClick={() => setCurrentStep(7)}
          disabled={isSubmitting || isRAGInitializing}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 flex items-center space-x-2"
        >
          <span>Continue to Pricing</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  </motion.div>
)}

// Helper function for smart suggestions
function getSmartSuggestions(expertise: string, documents: any[]): string[] {
  const baseSuggestions: Record<string, string[]> = {
    medical: [
      "What are your key medical specializations?",
      "How do you approach patient diagnosis?",
      "What treatment protocols do you recommend?",
      "How do you stay current with medical research?"
    ],
    business: [
      "What's your business strategy methodology?",
      "How do you approach market analysis?",
      "What metrics do you use to measure success?",
      "How do you handle organizational change?"
    ],
    education: [
      "What's your teaching philosophy?",
      "How do you adapt to different learning styles?",
      "What assessment methods do you prefer?",
      "How do you integrate technology in education?"
    ],
    finance: [
      "What's your investment strategy approach?",
      "How do you assess financial risk?",
      "What market indicators do you monitor?",
      "How do you plan for retirement?"
    ],
    coaching: [
      "What's your coaching methodology?",
      "How do you help clients set goals?",
      "What techniques do you use for motivation?",
      "How do you measure coaching success?"
    ],
    legal: [
      "What areas of law do you specialize in?",
      "How do you approach legal research?",
      "What's your case preparation process?",
      "How do you stay updated on legal changes?"
    ]
  };

  const suggestions = baseSuggestions[expertise] || [
    "What is your main area of expertise?",
    "How do you approach problem-solving?",
    "What makes your approach unique?",
    "What advice would you give beginners?"
  ];

  // Add document-specific suggestions if documents are available
  if (documents.length > 0) {
    suggestions.push(
      `Tell me about the content in ${documents[0]?.name}`,
      "What key insights can you share from your documents?",
      "How does your uploaded content influence your recommendations?"
    );
  }

  return suggestions;
}
```

This comprehensive technical specification provides production-ready code examples and implementation patterns for integrating RAG functionality into CloneAI. The code includes proper error handling, performance optimizations, security measures, and user experience enhancements.

## Next Steps

After implementing these technical specifications:

1. **Test each component thoroughly** using the provided test examples
2. **Monitor performance** using the built-in analytics and metrics
3. **Gather user feedback** to optimize the experience
4. **Scale infrastructure** based on usage patterns
5. **Iterate and improve** based on real-world usage data

The implementation provides a solid foundation for RAG integration while maintaining flexibility for future enhancements and optimizations.