# Enhanced RAG Backend Integration Guide

## Overview

This guide documents the complete integration of Enhanced RAG capabilities into the CloneAI backend, providing fine-grained control and hybrid search functionality while maintaining backward compatibility with the existing OpenAI Assistant-based approach.

## Architecture Overview

### Dual Storage Architecture

1. **OpenAI Vector Stores**: Continue using OpenAI's native file_search capabilities
2. **Supabase Storage**: Store chunks and embeddings for hybrid search and analytics
3. **Seamless Integration**: Both systems work together for optimal performance

### Enhanced Features

- **Hybrid Search**: Combines vector and keyword search using Reciprocal Rank Fusion (RRF)
- **Smart Chunking**: Sentence boundary, fixed size, and semantic chunking strategies
- **Performance Analytics**: Detailed query performance and usage tracking
- **Fallback Support**: Graceful degradation to standard RAG when enhanced features fail

## API Endpoints

### New Enhanced RAG Endpoints

#### 1. Process Documents with Enhanced Features
```http
POST /api/v1/api/enhanced-rag/process-documents
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "clone_id": "your-clone-id",
  "documents": {
    "Research Paper": "https://example.com/paper.pdf",
    "Manual": "https://example.com/manual.pdf"
  },
  "chunking_strategy": "sentence_boundary",
  "chunk_size": 800,
  "overlap": 200
}
```

**Response:**
```json
{
  "message": "Document processing started",
  "clone_id": "your-clone-id",
  "documents_count": 2,
  "status": "processing"
}
```

#### 2. Query with Enhanced RAG
```http
POST /api/v1/api/enhanced-rag/query
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "clone_id": "your-clone-id",
  "query": "How does machine learning improve recommendations?",
  "search_strategy": "hybrid",
  "top_k": 5,
  "similarity_threshold": 0.7
}
```

**Response:**
```json
{
  "response": {
    "text": "Machine learning improves recommendations by...",
    "status": "success"
  },
  "citations": [
    {
      "document_title": "Research Paper",
      "content_preview": "ML algorithms analyze user behavior...",
      "similarity_score": 0.89,
      "chunk_id": "chunk_123"
    }
  ],
  "search_results_count": 5,
  "search_strategy_used": "hybrid",
  "response_time_ms": 1200,
  "thread_id": "thread_abc123"
}
```

#### 3. Get Analytics
```http
GET /api/v1/api/enhanced-rag/analytics/{clone_id}?days=7
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "clone_id": "your-clone-id",
  "query_analytics": {
    "total_queries": 45,
    "avg_response_time_ms": 950,
    "search_strategies": {
      "hybrid": 30,
      "vector": 10,
      "keyword": 5
    }
  },
  "chunk_statistics": {
    "total_chunks": 150,
    "total_documents": 5,
    "avg_chunk_size": 750
  },
  "period_days": 7
}
```

#### 4. Check Processing Status
```http
GET /api/v1/api/enhanced-rag/status/{clone_id}
Authorization: Bearer <jwt-token>
```

#### 5. Test Search Strategies
```http
POST /api/v1/api/enhanced-rag/test-search
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "clone_id": "your-clone-id",
  "query": "Benefits of transformers in NLP",
  "top_k": 3
}
```

#### 6. Get Available Strategies
```http
GET /api/v1/api/enhanced-rag/search-strategies
```

#### 7. Clear RAG Data
```http
DELETE /api/v1/api/enhanced-rag/clear-data/{clone_id}
Authorization: Bearer <jwt-token>
```

### Enhanced Existing Endpoints

#### 1. Enhanced Knowledge Processing
```http
POST /api/v1/clones/{clone_id}/process-knowledge?use_enhanced_rag=true&chunking_strategy=sentence_boundary
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "documents": {
    "Doc 1": "https://example.com/doc1.pdf"
  },
  "links": ["https://example.com/page1"]
}
```

**New Parameters:**
- `use_enhanced_rag`: Boolean flag to enable enhanced processing
- `chunking_strategy`: `fixed_size`, `sentence_boundary`, or `semantic`

#### 2. Enhanced Clone Query
```http
POST /api/v1/clones/{clone_id}/query?use_enhanced_rag=true&search_strategy=hybrid&top_k=5
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "query": "Your question here"
}
```

**New Parameters:**
- `use_enhanced_rag`: Boolean flag to enable enhanced search
- `search_strategy`: `vector`, `keyword`, or `hybrid`
- `top_k`: Number of results to retrieve (1-10)

## Database Schema Extensions

### New Tables

#### `document_chunks`
```sql
CREATE TABLE document_chunks (
    id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    document_id text REFERENCES documents(id),
    clone_id text REFERENCES clones(id),
    chunk_index integer NOT NULL,
    content text NOT NULL,
    content_hash text UNIQUE NOT NULL,
    token_count integer,
    openai_embedding_vector vector(1536),
    chunk_metadata jsonb,
    created_at timestamp with time zone DEFAULT now()
);
```

#### `rag_threads`
```sql
CREATE TABLE rag_threads (
    id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    clone_id text REFERENCES clones(id),
    openai_thread_id text NOT NULL,
    thread_metadata jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);
```

#### `vector_queries`
```sql
CREATE TABLE vector_queries (
    id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    clone_id text REFERENCES clones(id),
    query_text text NOT NULL,
    query_embedding vector(1536),
    search_type text NOT NULL,
    top_k integer,
    similarity_threshold float,
    results_metadata jsonb,
    response_time_ms integer,
    created_at timestamp with time zone DEFAULT now()
);
```

#### `search_results`
```sql
CREATE TABLE search_results (
    id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    query_id text REFERENCES vector_queries(id),
    chunk_id text REFERENCES document_chunks(id),
    similarity_score float,
    rank_position integer,
    used_in_response boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);
```

### Database Functions

#### Vector Search Function
```sql
CREATE OR REPLACE FUNCTION vector_search(
    query_embedding vector(1536),
    clone_id text,
    similarity_threshold float DEFAULT 0.3,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id text,
    content text,
    chunk_metadata jsonb,
    document_title text,
    similarity_score float
)
```

#### Keyword Search Function
```sql
CREATE OR REPLACE FUNCTION keyword_search(
    search_query text,
    clone_id text,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id text,
    content text,
    chunk_metadata jsonb,
    document_title text,
    rank_score float
)
```

#### Analytics Function
```sql
CREATE OR REPLACE FUNCTION get_clone_chunk_stats(clone_id text)
RETURNS TABLE (
    total_chunks int,
    total_documents int,
    avg_chunk_size float,
    total_tokens int
)
```

## Service Architecture

### Enhanced RAG Service (`enhanced_rag_service.py`)

The core service that orchestrates enhanced RAG operations:

**Key Classes:**
- `EnhancedRAGService`: Main service class with async context management
- `SearchStrategy`: Enum for search types (VECTOR, KEYWORD, HYBRID)
- `ChunkingStrategy`: Enum for chunking types (FIXED_SIZE, SENTENCE_BOUNDARY, SEMANTIC)
- `SearchResult`: Data class for search results
- `QueryAnalysis`: Data class for query analysis results

**Key Methods:**
- `process_documents_enhanced()`: Process documents with advanced chunking
- `query_enhanced()`: Perform hybrid search with analytics
- `_hybrid_search()`: Combine vector and keyword search using RRF
- `_analyze_query()`: Determine optimal search strategy
- `_log_query_analytics()`: Track performance metrics

### Search Strategies

#### Vector Search
- Uses OpenAI embeddings and pgvector for similarity search
- Best for conceptual and semantic queries
- Threshold-based filtering

#### Keyword Search
- Uses PostgreSQL full-text search
- Best for exact term matches and specific facts
- Ranking based on term frequency and position

#### Hybrid Search
- Combines vector and keyword results using Reciprocal Rank Fusion (RRF)
- Automatically balances semantic and lexical matching
- Optimal for most query types

### Chunking Strategies

#### Sentence Boundary
- Respects sentence endings for better context preservation
- Configurable chunk size with overlap
- Best for most document types

#### Fixed Size
- Fixed character count chunks
- Simple and predictable
- Good for consistent processing

#### Semantic (Future Enhancement)
- AI-powered semantic chunking
- Preserves logical context boundaries
- Most sophisticated but computationally expensive

## Integration Patterns

### Gradual Migration
1. Enhanced RAG runs alongside existing RAG
2. Use feature flags to control adoption
3. Fallback to standard RAG on failures
4. Monitor performance and gradually increase usage

### Backward Compatibility
- All existing APIs continue to work unchanged
- Enhanced features are opt-in via query parameters
- Existing data structures are preserved
- No breaking changes to current workflows

### Error Handling
- Graceful degradation when enhanced features fail
- Comprehensive logging for debugging
- Automatic fallback to standard RAG
- Clear error messages for troubleshooting

## Performance Considerations

### Optimization Strategies
1. **Batch Processing**: Process embeddings in batches to respect rate limits
2. **Connection Pooling**: Efficient database connection management
3. **Caching**: Cache frequently accessed chunks and embeddings
4. **Async Processing**: Non-blocking document processing
5. **Indexing**: Proper database indexes for vector and text search

### Monitoring
- Response time tracking for all operations
- Search strategy effectiveness analysis
- Resource usage monitoring
- Error rate tracking

## Configuration

### Environment Variables
```bash
# Enhanced RAG Configuration
ENHANCED_RAG_ENABLED=true
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
DEFAULT_CHUNK_SIZE=800
DEFAULT_OVERLAP=200
VECTOR_SIMILARITY_THRESHOLD=0.7
```

### Feature Flags
- `use_enhanced_rag`: Enable enhanced processing/querying
- `chunking_strategy`: Control chunking behavior
- `search_strategy`: Control search behavior

## Usage Examples

### Python Client
```python
import httpx

async def process_with_enhanced_rag():
    async with httpx.AsyncClient() as client:
        # Process documents with enhanced RAG
        response = await client.post(
            "http://localhost:8000/api/v1/api/enhanced-rag/process-documents",
            json={
                "clone_id": "your-clone-id",
                "documents": {"Doc": "https://example.com/doc.pdf"},
                "chunking_strategy": "sentence_boundary",
                "chunk_size": 800,
                "overlap": 200
            },
            headers={"Authorization": "Bearer your-token"}
        )
        
        # Query with hybrid search
        query_response = await client.post(
            "http://localhost:8000/api/v1/api/enhanced-rag/query",
            json={
                "clone_id": "your-clone-id",
                "query": "Your question here",
                "search_strategy": "hybrid",
                "top_k": 5
            },
            headers={"Authorization": "Bearer your-token"}
        )
```

### Using Enhanced Features in Existing Endpoints
```python
# Enhanced processing
response = await client.post(
    "http://localhost:8000/api/v1/clones/your-clone-id/process-knowledge?use_enhanced_rag=true&chunking_strategy=sentence_boundary",
    json={"documents": {"Doc": "https://example.com/doc.pdf"}},
    headers={"Authorization": "Bearer your-token"}
)

# Enhanced querying
response = await client.post(
    "http://localhost:8000/api/v1/clones/your-clone-id/query?use_enhanced_rag=true&search_strategy=hybrid&top_k=5",
    json={"query": "Your question here"},
    headers={"Authorization": "Bearer your-token"}
)
```

## Testing

### Unit Tests
- Test individual search strategies
- Test chunking algorithms
- Test RRF ranking
- Test error handling and fallbacks

### Integration Tests
- Test end-to-end document processing
- Test query flow with different strategies
- Test analytics collection
- Test performance under load

### API Tests
- Test all enhanced endpoints
- Test parameter validation
- Test authentication and authorization
- Test error responses

## Migration Guide

### For Existing Clones
1. Existing clones continue to work with standard RAG
2. To enable enhanced features, reprocess with `use_enhanced_rag=true`
3. Enhanced data is stored alongside existing data
4. No data loss during migration

### For New Clones
1. Choose enhanced RAG during initial processing
2. Set appropriate chunking strategy based on document types
3. Monitor analytics to optimize parameters

## Troubleshooting

### Common Issues

1. **Vector search not working**
   - Ensure pgvector extension is enabled
   - Check embedding dimensions match (1536)
   - Verify database permissions

2. **Slow response times**
   - Reduce `top_k` parameter
   - Adjust similarity threshold
   - Check database indexes

3. **Poor search results**
   - Try different search strategies
   - Adjust chunk size and overlap
   - Reprocess with different chunking strategy

4. **Processing failures**
   - Check document URLs are accessible
   - Verify OpenAI API limits
   - Check database connection

### Performance Tuning

1. **Chunk Size Optimization**
   - Small chunks (400-600): Better precision, more API calls
   - Large chunks (800-1200): Better context, fewer API calls
   - Test with your specific document types

2. **Search Strategy Selection**
   - Use analytics to identify optimal strategies for your use case
   - Consider query patterns and document types
   - Monitor user feedback

3. **Database Optimization**
   - Ensure proper indexes on vector columns
   - Monitor query execution plans
   - Consider connection pooling optimization

## Security Considerations

- All enhanced endpoints require authentication
- User authorization is checked for clone access
- No sensitive information is logged
- Database queries use parameterized statements
- API rate limiting should be configured

## Future Enhancements

1. **Advanced Chunking**: Implement semantic chunking using AI
2. **Better Analytics**: Add user behavior tracking and feedback loops
3. **Caching Layer**: Implement Redis caching for frequent queries
4. **Real-time Updates**: Support for document updates without full reprocessing
5. **Multi-language Support**: Enhanced support for non-English documents
6. **Custom Models**: Support for custom embedding models

## Conclusion

The Enhanced RAG integration provides powerful new capabilities while maintaining full backward compatibility. The hybrid search approach combines the best of semantic and lexical search, while the analytics capabilities enable continuous optimization. The gradual migration approach ensures a smooth transition with minimal risk.

Key benefits:
- ✅ **Improved Search Quality**: Hybrid search combines semantic and lexical matching
- ✅ **Performance Analytics**: Detailed insights into query performance
- ✅ **Flexible Chunking**: Multiple strategies for different document types
- ✅ **Backward Compatibility**: Existing functionality remains unchanged
- ✅ **Scalable Architecture**: Designed for high-volume production use
- ✅ **Comprehensive Monitoring**: Full observability into system performance

The system is now ready for production use with enhanced RAG capabilities.