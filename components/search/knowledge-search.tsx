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
import { apiClient } from '@/lib/api-client'

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
      // Mock search for demonstration - replace with actual API call
      const mockResponse: SearchResponse = {
        query: query,
        results: [
          {
            chunk_id: '1',
            content: `This document discusses advanced machine learning techniques for natural language processing. The content covers transformer architectures, attention mechanisms, and their applications in modern AI systems. Key concepts include self-attention, multi-head attention, and the role of positional encoding in sequence-to-sequence models.`,
            similarity_score: 0.92,
            source: {
              type: 'document',
              document_id: 'doc-1',
              document_title: 'AI and Machine Learning Fundamentals.pdf',
              chunk_index: 3
            },
            doc_metadata: {
              pages: 45,
              file_size: 2048000,
              upload_date: '2024-01-15T10:30:00Z'
            }
          },
          {
            chunk_id: '2',
            content: `The implementation of neural networks requires careful consideration of hyperparameters, including learning rates, batch sizes, and regularization techniques. This section explores best practices for training deep learning models and avoiding common pitfalls like overfitting and vanishing gradients.`,
            similarity_score: 0.87,
            source: {
              type: 'document',
              document_id: 'doc-2',
              document_title: 'Deep Learning Best Practices.docx',
              chunk_index: 7
            },
            doc_metadata: {
              author: 'Dr. Smith',
              created: '2024-02-01T14:20:00Z'
            }
          },
          {
            chunk_id: '3',
            content: `Data preprocessing is a critical step in any machine learning pipeline. This includes data cleaning, normalization, feature engineering, and handling missing values. The quality of your input data directly impacts model performance and generalization.`,
            similarity_score: 0.81,
            source: {
              type: 'document',
              document_id: 'doc-3',
              document_title: 'Data Science Handbook.txt',
              chunk_index: 12
            },
            doc_metadata: {
              lines: 450,
              encoding: 'utf-8'
            }
          }
        ],
        total_results: 3,
        search_metadata: {
          similarity_threshold: similarityThreshold[0],
          search_method: 'rag_processor_with_embeddings',
          execution_time_ms: 156,
          include_metadata: true
        },
        searched_at: new Date().toISOString()
      }

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800))

      setResults(mockResponse.results)
      setSearchMetadata(mockResponse.search_metadata)

      toast({
        title: "Search completed",
        description: `Found ${mockResponse.total_results} relevant results`,
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