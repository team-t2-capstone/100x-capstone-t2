# Enhanced RAG Usage Guide

## Overview
This guide demonstrates how to use the Enhanced RAG system that builds upon your existing OpenAI Assistant-based approach with fine-grained control and hybrid search capabilities.

## Key Features

### 1. **Dual Storage Architecture**
- **OpenAI Vector Stores**: Continue using OpenAI's native file_search capabilities
- **Supabase Storage**: Store chunks and embeddings for hybrid search and analytics
- **Seamless Integration**: Both systems work together for optimal performance

### 2. **Advanced Search Strategies**
- **Vector Search**: Semantic similarity using embeddings
- **Keyword Search**: Traditional full-text search
- **Hybrid Search**: Combines both with RRF (Reciprocal Rank Fusion) ranking

### 3. **Enhanced Document Processing**
- **Semantic Chunking**: Respects sentence boundaries
- **Overlap Strategy**: Maintains context between chunks
- **Metadata Tracking**: Detailed chunk-level information

### 4. **Fine-Grained Analytics**
- **Query Performance**: Track response times and accuracy
- **Search Strategy Analysis**: Compare effectiveness of different approaches
- **Usage Statistics**: Monitor clone performance over time

## API Usage Examples

### 1. Process Documents with Enhanced Features

```python
import httpx
import asyncio

async def process_clone_documents():
    """Process documents for a clone with enhanced RAG"""
    
    documents = {
        "AI Research Paper": "https://example.com/ai-research.pdf",
        "Technical Manual": "https://example.com/manual.pdf",
        "Product Documentation": "https://example.com/docs.pdf"
    }
    
    payload = {
        "clone_id": "your-clone-id",
        "documents": documents,
        "chunking_strategy": "sentence_boundary",  # or "fixed_size", "semantic"
        "chunk_size": 800,
        "overlap": 200
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/api/enhanced-rag/process-documents",
            json=payload,
            headers={"Authorization": "Bearer your-jwt-token"}
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"Processing started: {result['message']}")
            return result
        else:
            print(f"Error: {response.text}")

# Run the processing
asyncio.run(process_clone_documents())
```

### 2. Query with Different Search Strategies

```python
async def query_with_different_strategies():
    """Test different search strategies"""
    
    query_data = {
        "clone_id": "your-clone-id",
        "query": "How does machine learning improve recommendation systems?",
        "search_strategy": "hybrid",  # "vector", "keyword", or "hybrid"
        "top_k": 5,
        "similarity_threshold": 0.7
    }
    
    async with httpx.AsyncClient() as client:
        # Test hybrid search
        response = await client.post(
            "http://localhost:8000/api/enhanced-rag/query",
            json=query_data,
            headers={"Authorization": "Bearer your-jwt-token"}
        )
        
        result = response.json()
        print(f"Response: {result['response']['text']}")
        print(f"Citations: {len(result['citations'])} sources")
        print(f"Strategy used: {result['search_strategy_used']}")
        print(f"Response time: {result['response_time_ms']}ms")

asyncio.run(query_with_different_strategies())
```

### 3. Compare Search Strategies

```python
async def compare_search_strategies():
    """Compare all search strategies on the same query"""
    
    test_data = {
        "clone_id": "your-clone-id",
        "query": "What are the benefits of using transformers in NLP?",
        "top_k": 3
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/api/enhanced-rag/test-search",
            json=test_data,
            headers={"Authorization": "Bearer your-jwt-token"}
        )
        
        results = response.json()["results"]
        
        for strategy, result in results.items():
            print(f"\n--- {strategy.upper()} STRATEGY ---")
            if "error" not in result:
                print(f"Response time: {result['response_time_ms']}ms")
                print(f"Results found: {result['search_results_count']}")
                print(f"Response: {result['response']['text'][:200]}...")
            else:
                print(f"Error: {result['error']}")

asyncio.run(compare_search_strategies())
```

### 4. Get Analytics and Performance Metrics

```python
async def get_clone_analytics():
    """Get comprehensive analytics for a clone"""
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "http://localhost:8000/api/enhanced-rag/analytics/your-clone-id?days=7",
            headers={"Authorization": "Bearer your-jwt-token"}
        )
        
        analytics = response.json()
        
        # Query analytics
        query_stats = analytics["query_analytics"]
        print(f"Total queries (last 7 days): {query_stats['total_queries']}")
        print(f"Average response time: {query_stats['avg_response_time_ms']}ms")
        print(f"Search strategies used: {query_stats['search_strategies']}")
        
        # Chunk statistics
        chunk_stats = analytics["chunk_statistics"]
        print(f"Total chunks: {chunk_stats['total_chunks']}")
        print(f"Total documents: {chunk_stats['total_documents']}")
        print(f"Average chunk size: {chunk_stats['avg_chunk_size']}")

asyncio.run(get_clone_analytics())
```

### 5. Monitor Processing Status

```python
async def check_processing_status():
    """Check document processing status"""
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "http://localhost:8000/api/enhanced-rag/status/your-clone-id",
            headers={"Authorization": "Bearer your-jwt-token"}
        )
        
        status = response.json()
        print(f"Processing status: {status['processing_status']}")
        print(f"RAG status: {status['rag_status']}")
        print(f"Chunks processed: {status['chunks_processed']}")

asyncio.run(check_processing_status())
```

## Frontend Integration Examples

### React Component for Enhanced Query

```tsx
import React, { useState } from 'react';

interface EnhancedQueryProps {
  cloneId: string;
  authToken: string;
}

export const EnhancedQueryComponent: React.FC<EnhancedQueryProps> = ({
  cloneId,
  authToken
}) => {
  const [query, setQuery] = useState('');
  const [strategy, setStrategy] = useState<'vector' | 'keyword' | 'hybrid'>('hybrid');
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleQuery = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/enhanced-rag/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          clone_id: cloneId,
          query,
          search_strategy: strategy,
          top_k: 5
        })
      });

      const result = await response.json();
      setResponse(result);
    } catch (error) {
      console.error('Query failed:', error);
    }
    setLoading(false);
  };

  return (
    <div className="enhanced-query">
      <div className="query-input">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask your question..."
          rows={3}
        />
      </div>

      <div className="strategy-selector">
        <label>Search Strategy:</label>
        <select 
          value={strategy} 
          onChange={(e) => setStrategy(e.target.value as any)}
        >
          <option value="hybrid">Hybrid (Recommended)</option>
          <option value="vector">Vector (Semantic)</option>
          <option value="keyword">Keyword (Exact match)</option>
        </select>
      </div>

      <button onClick={handleQuery} disabled={loading || !query.trim()}>
        {loading ? 'Searching...' : 'Ask Question'}
      </button>

      {response && (
        <div className="response">
          <div className="answer">
            <h3>Answer:</h3>
            <p>{response.response.text}</p>
          </div>

          <div className="metadata">
            <small>
              Strategy: {response.search_strategy_used} | 
              Response time: {response.response_time_ms}ms | 
              Sources: {response.citations.length}
            </small>
          </div>

          {response.citations.length > 0 && (
            <div className="citations">
              <h4>Sources:</h4>
              {response.citations.map((citation: any, index: number) => (
                <div key={index} className="citation">
                  <strong>{citation.document_title}</strong>
                  <p>{citation.content_preview}</p>
                  <small>Relevance: {(citation.similarity_score * 100).toFixed(1)}%</small>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

### Analytics Dashboard Component

```tsx
import React, { useEffect, useState } from 'react';

interface AnalyticsDashboardProps {
  cloneId: string;
  authToken: string;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  cloneId,
  authToken
}) => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await fetch(`/api/enhanced-rag/analytics/${cloneId}?days=7`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        const data = await response.json();
        setAnalytics(data);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      }
      setLoading(false);
    };

    fetchAnalytics();
  }, [cloneId, authToken]);

  if (loading) return <div>Loading analytics...</div>;
  if (!analytics) return <div>Failed to load analytics</div>;

  const { query_analytics, chunk_statistics } = analytics;

  return (
    <div className="analytics-dashboard">
      <h2>RAG Performance Analytics</h2>
      
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Query Metrics</h3>
          <p>Total Queries: {query_analytics.total_queries}</p>
          <p>Avg Response Time: {query_analytics.avg_response_time_ms}ms</p>
        </div>

        <div className="metric-card">
          <h3>Content Metrics</h3>
          <p>Total Chunks: {chunk_statistics.total_chunks}</p>
          <p>Documents: {chunk_statistics.total_documents}</p>
          <p>Avg Chunk Size: {Math.round(chunk_statistics.avg_chunk_size)} chars</p>
        </div>

        <div className="metric-card">
          <h3>Search Strategy Usage</h3>
          {Object.entries(query_analytics.search_strategies || {}).map(([strategy, count]) => (
            <p key={strategy}>{strategy}: {count as number}</p>
          ))}
        </div>
      </div>
    </div>
  );
};
```

## Best Practices

### 1. **Choosing Search Strategies**
- **Hybrid**: Best for most queries, automatically optimizes results
- **Vector**: Better for conceptual questions and semantic similarity
- **Keyword**: Better for exact term matches and specific facts

### 2. **Document Processing**
- Use `sentence_boundary` chunking for most documents
- Adjust `chunk_size` based on document complexity (500-1000 chars)
- Use `overlap` of 100-200 characters to maintain context

### 3. **Performance Optimization**
- Monitor response times and adjust `top_k` accordingly
- Use analytics to identify optimal search strategies for your use case
- Consider clearing and reprocessing if documents are updated significantly

### 4. **Error Handling**
- Always check processing status before querying
- Implement fallback to basic search if enhanced features fail
- Monitor analytics for performance degradation

## Migration from Current System

### Gradual Migration Approach

1. **Keep existing APIs functional**
2. **Add enhanced endpoints alongside**
3. **Test with subset of clones**
4. **Gradually migrate based on performance**

### Backward Compatibility

The enhanced system maintains compatibility with your existing RAG implementation:
- OpenAI Assistants continue to work
- Existing vector stores are preserved
- Current APIs remain functional

## Troubleshooting

### Common Issues

1. **Vector search not working**: Ensure pgvector extension is enabled
2. **Slow response times**: Reduce `top_k` or adjust similarity threshold
3. **Poor search results**: Try different search strategies or reprocess documents
4. **Processing failures**: Check document URLs and OpenAI API limits

### Performance Tuning

1. **Adjust chunk sizes** based on document types
2. **Tune similarity thresholds** for your specific use case
3. **Monitor query patterns** and optimize accordingly
4. **Use analytics** to identify bottlenecks

This enhanced RAG system provides you with the fine-grained control and hybrid search capabilities you requested while maintaining compatibility with your existing OpenAI Assistant-based approach.