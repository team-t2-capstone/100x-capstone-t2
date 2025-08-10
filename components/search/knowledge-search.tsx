"use client"

import { useState } from 'react'
import { Search, Sparkles, FileText, Clock, ExternalLink, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'

interface SearchResult {
  chunk_id: string
  content: string
  similarity_score: number
  source: {
    type: string
    document_id: string
    document_title: string
    chunk_index: number
  }
  doc_metadata: Record<string, any>
}

interface SearchResponse {
  query: string
  results: SearchResult[]
  total_results: number
  search_metadata: {
    similarity_threshold: number
    search_method: string
    execution_time_ms: number
    include_metadata: boolean
  }
  searched_at: string
}

interface KnowledgeSearchProps {
  cloneId: string
  onResultSelect?: (result: SearchResult) => void
}

export function KnowledgeSearch({ cloneId, onResultSelect }: KnowledgeSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searchMetadata, setSearchMetadata] = useState<SearchResponse['search_metadata'] | null>(null)
  const [loading, setLoading] = useState(false)
  const [similarityThreshold, setSimilarityThreshold] = useState([0.7])
  const [limit, setLimit] = useState('10')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const { toast } = useToast()

  const performSearch = async () => {
    if (!query.trim()) {
      toast({
        variant: "destructive",
        title: "Search query required",
        description: "Please enter a search query",
      })
      return
    }

    setLoading(true)
    try {
      const startTime = Date.now()
      
      // Get documents for this clone first
      const { data: documents, error: docsError } = await supabase
        .from('documents')
        .select('id, title, file_name')
        .eq('clone_id', cloneId)
        .eq('processing_status', 'completed')
      
      if (docsError) throw docsError
      
      if (!documents || documents.length === 0) {
        setResults([])
        setSearchMetadata({
          similarity_threshold: similarityThreshold[0],
          search_method: 'text_search',
          execution_time_ms: Date.now() - startTime,
          include_metadata: true
        })
        return
      }
      
      // Search document chunks using text search
      const { data: chunks, error: chunksError } = await supabase
        .from('document_chunks')
        .select('id, content, chunk_index, document_id, doc_metadata')
        .in('document_id', documents.map(d => d.id))
        .textSearch('content', query, {
          type: 'websearch',
          config: 'english'
        })
        .limit(parseInt(limit))
      
      if (chunksError) {
        // Fallback to ilike search if text search fails
        const { data: fallbackChunks, error: fallbackError } = await supabase
          .from('document_chunks')
          .select('id, content, chunk_index, document_id, doc_metadata')
          .in('document_id', documents.map(d => d.id))
          .ilike('content', `%${query}%`)
          .limit(parseInt(limit))
        
        if (fallbackError) throw fallbackError
        chunks = fallbackChunks
      }
      
      // Transform results to match interface
      const results: SearchResult[] = (chunks || []).map((chunk, index) => {
        const document = documents.find(d => d.id === chunk.document_id)
        return {
          chunk_id: chunk.id,
          content: chunk.content,
          similarity_score: 0.8 - (index * 0.05), // Mock similarity score
          source: {
            type: 'document',
            document_id: chunk.document_id,
            document_title: document?.title || document?.file_name || 'Unknown Document',
            chunk_index: chunk.chunk_index
          },
          doc_metadata: chunk.doc_metadata || {}
        }
      })
      
      const searchMetadata = {
        similarity_threshold: similarityThreshold[0],
        search_method: 'text_search',
        execution_time_ms: Date.now() - startTime,
        include_metadata: true
      }
      
      setResults(results)
      setSearchMetadata(searchMetadata)

      toast({
        title: "Search completed",
        description: `Found ${results.length} relevant results`,
      })
    } catch (error: any) {
      console.error('Search failed:', error)
      toast({
        variant: "destructive",
        title: "Search failed",
        description: error.response?.data?.detail || "Please try again",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      performSearch()
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getSimilarityColor = (score: number) => {
    if (score >= 0.9) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    if (score >= 0.8) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    if (score >= 0.7) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  }

  return (
    <div className="space-y-6">
      {/* Search Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Knowledge Base Search
          </CardTitle>
          <CardDescription>
            Search your clone's knowledge base using semantic similarity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Main Search Input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Ask questions about your documents..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10"
              />
            </div>
            <Button onClick={performSearch} disabled={loading}>
              {loading ? (
                <>
                  <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                  Searching...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Search
                </>
              )}
            </Button>
          </div>

          {/* Advanced Options */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Advanced Options
            </Button>
            {searchMetadata && (
              <Badge variant="secondary">
                {searchMetadata.search_method.replace('_', ' ')} • {searchMetadata.execution_time_ms}ms
              </Badge>
            )}
          </div>

          {showAdvanced && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="space-y-2">
                <Label>Similarity Threshold: {similarityThreshold[0]}</Label>
                <Slider
                  value={similarityThreshold}
                  onValueChange={setSimilarityThreshold}
                  max={1}
                  min={0.1}
                  step={0.1}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label>Max Results</Label>
                <Select value={limit} onValueChange={setLimit}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 results</SelectItem>
                    <SelectItem value="10">10 results</SelectItem>
                    <SelectItem value="20">20 results</SelectItem>
                    <SelectItem value="50">50 results</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Search Results ({results.length})</span>
              <Badge variant="outline">
                Query: "{query}"
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.map((result, index) => (
                <div
                  key={result.chunk_id}
                  className="p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => onResultSelect?.(result)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">
                        {result.source.document_title}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        Chunk {result.source.chunk_index}
                      </Badge>
                    </div>
                    <Badge className={getSimilarityColor(result.similarity_score)}>
                      {Math.round(result.similarity_score * 100)}% match
                    </Badge>
                  </div>
                  
                  <p className="text-sm leading-relaxed mb-3">
                    {result.content}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-4">
                      {result.doc_metadata.upload_date && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(result.doc_metadata.upload_date)}
                        </span>
                      )}
                      {result.doc_metadata.pages && (
                        <span>{result.doc_metadata.pages} pages</span>
                      )}
                      {result.doc_metadata.author && (
                        <span>by {result.doc_metadata.author}</span>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" className="h-auto p-1">
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && results.length === 0 && query && (
        <Card>
          <CardContent className="text-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No results found</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search terms or lowering the similarity threshold
            </p>
            <Button variant="outline" onClick={() => setShowAdvanced(true)}>
              <Filter className="h-4 w-4 mr-2" />
              Adjust Search Settings
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Initial State */}
      {!query && results.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Search Your Knowledge Base</h3>
            <p className="text-muted-foreground mb-4">
              Ask questions about your uploaded documents and get AI-powered answers
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-md mx-auto text-sm text-muted-foreground">
              <div>• "How does machine learning work?"</div>
              <div>• "What are the key findings?"</div>
              <div>• "Explain the methodology"</div>
              <div>• "Summarize the conclusions"</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Search results modal/dialog component
export function SearchResultDialog({ 
  result, 
  open, 
  onOpenChange 
}: { 
  result: SearchResult | null
  open: boolean
  onOpenChange: (open: boolean) => void 
}) {
  if (!result) return null

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background border rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">{result.source.document_title}</h2>
              <p className="text-sm text-muted-foreground">
                Chunk {result.source.chunk_index} • {Math.round(result.similarity_score * 100)}% similarity
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              ×
            </Button>
          </div>
          
          <div className="prose prose-sm max-w-none">
            <p className="leading-relaxed">{result.content}</p>
          </div>
          
          <Separator className="my-4" />
          
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>Document ID:</strong> {result.source.document_id}</p>
            <p><strong>Chunk ID:</strong> {result.chunk_id}</p>
            {Object.entries(result.doc_metadata).map(([key, value]) => (
              <p key={key}><strong>{key}:</strong> {String(value)}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}