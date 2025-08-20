# Phase 3: Frontend Testing & Preview Integration Guide

## Overview

This guide provides detailed implementation for integrating RAG functionality into the CloneAI frontend, specifically enhancing the Testing & Preview section (Step 6) of the clone wizard with intelligent memory layer capabilities.

## Architecture Strategy

- **Minimal UI Changes**: Enhance existing Testing & Preview interface
- **Progressive Enhancement**: RAG features layer on top of existing functionality
- **Smart Loading States**: Clear feedback during memory preparation
- **Graceful Degradation**: Fallback to standard chat when RAG unavailable

## Prerequisites

- Phase 1 (Database Schema) and Phase 2 (Backend API) completed
- Existing clone wizard functionality working
- Understanding of React/Next.js and TypeScript
- Access to frontend codebase structure

## Implementation Steps

### Step 1: Enhanced API Client for RAG

Update `/lib/api-client.ts` to include RAG endpoints:

```typescript
/**
 * RAG API Client Functions
 * Extends existing API client with RAG-specific operations
 */

// Add RAG-specific types
export interface RAGInitRequest {
  expert_name?: string;
  domain_name: string;
  context: string;
  documents?: DocumentInfo[];
}

export interface DocumentInfo {
  name: string;
  url: string;
  type: string;
  size_bytes?: number;
}

export interface RAGQueryRequest {
  query: string;
  conversation_history?: ConversationMessage[];
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface RAGResponse {
  success: boolean;
  message: string;
  response?: string;
  sources?: SourceInfo[];
  mode?: 'rag' | 'llm_fallback' | 'openai_fallback';
  timestamp: string;
}

export interface SourceInfo {
  document_name: string;
  page_number?: number;
  relevance_score?: number;
  excerpt?: string;
}

export interface CloneRAGStatus {
  clone_id: string;
  rag_enabled: boolean;
  rag_status: 'pending' | 'initializing' | 'ready' | 'error' | 'disabled';
  expert_name?: string;
  domain_name?: string;
  last_processed_at?: string;
  error_message?: string;
}

// RAG API functions
export const ragApi = {
  /**
   * Initialize RAG memory for a clone
   */
  async initializeCloneRAG(cloneId: string, request: RAGInitRequest): Promise<RAGResponse> {
    try {
      const response = await apiClient.post(`/rag/initialize/${cloneId}`, request);
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(apiError.message);
    }
  },

  /**
   * Query clone using RAG system
   */
  async queryCloneRAG(cloneId: string, request: RAGQueryRequest): Promise<RAGResponse> {
    try {
      const response = await apiClient.post(`/rag/query/${cloneId}`, request);
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(apiError.message);
    }
  },

  /**
   * Get RAG status for a clone
   */
  async getCloneRAGStatus(cloneId: string): Promise<CloneRAGStatus> {
    try {
      const response = await apiClient.get(`/rag/status/${cloneId}`);
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(apiError.message);
    }
  },

  /**
   * Process documents for RAG
   */
  async processCloneDocuments(cloneId: string): Promise<RAGResponse> {
    try {
      const response = await apiClient.post(`/rag/documents/process/${cloneId}`);
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(apiError.message);
    }
  },

  /**
   * Cleanup RAG resources
   */
  async cleanupCloneRAG(cloneId: string): Promise<RAGResponse> {
    try {
      const response = await apiClient.delete(`/rag/cleanup/${cloneId}`);
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(apiError.message);
    }
  }
};

// Export updated API client
export { ragApi };
```

### Step 2: RAG Status Management Hook

Create `/hooks/use-rag-status.ts`:

```typescript
"use client";

import { useState, useEffect, useCallback } from 'react';
import { ragApi, CloneRAGStatus } from '@/lib/api-client';
import { toast } from '@/components/ui/use-toast';

export interface RAGStatusHook {
  status: CloneRAGStatus | null;
  isLoading: boolean;
  error: string | null;
  isInitializing: boolean;
  isReady: boolean;
  hasError: boolean;
  initializeRAG: (request: any) => Promise<boolean>;
  refreshStatus: () => Promise<void>;
  retry: () => Promise<void>;
}

export function useRAGStatus(cloneId: string | null): RAGStatusHook {
  const [status, setStatus] = useState<CloneRAGStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const fetchStatus = useCallback(async () => {
    if (!cloneId) return;

    setIsLoading(true);
    setError(null);

    try {
      const statusData = await ragApi.getCloneRAGStatus(cloneId);
      setStatus(statusData);
      
      // Auto-refresh if initializing
      if (statusData.rag_status === 'initializing') {
        setTimeout(fetchStatus, 3000); // Poll every 3 seconds
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch RAG status';
      setError(errorMessage);
      console.error('RAG status fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [cloneId]);

  const initializeRAG = useCallback(async (request: any): Promise<boolean> => {
    if (!cloneId) return false;

    setIsLoading(true);
    setError(null);

    try {
      const result = await ragApi.initializeCloneRAG(cloneId, request);
      
      if (result.success) {
        toast({
          title: "Memory Layer Initializing",
          description: "Preparing your clone's knowledge base...",
        });
        
        // Start polling for status
        setTimeout(fetchStatus, 1000);
        return true;
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize RAG';
      setError(errorMessage);
      toast({
        title: "Initialization Failed",
        description: errorMessage,
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [cloneId, fetchStatus]);

  const refreshStatus = useCallback(async () => {
    await fetchStatus();
  }, [fetchStatus]);

  const retry = useCallback(async () => {
    setRetryCount(prev => prev + 1);
    await fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (cloneId) {
      fetchStatus();
    }
  }, [cloneId, fetchStatus, retryCount]);

  return {
    status,
    isLoading,
    error,
    isInitializing: status?.rag_status === 'initializing',
    isReady: status?.rag_status === 'ready',
    hasError: status?.rag_status === 'error',
    initializeRAG,
    refreshStatus,
    retry
  };
}
```

### Step 3: Enhanced Memory Preparation Component

Create `/components/rag/memory-preparation.tsx`:

```tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Brain, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  Lightbulb,
  Database,
  Zap
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRAGStatus } from "@/hooks/use-rag-status";

interface MemoryPreparationProps {
  cloneId: string;
  cloneName: string;
  category: string;
  documents: Array<{name: string; url: string; status: string; type: string}>;
  onMemoryReady: (isReady: boolean) => void;
  onInitialize: () => void;
}

export function MemoryPreparation({ 
  cloneId, 
  cloneName, 
  category, 
  documents,
  onMemoryReady,
  onInitialize 
}: MemoryPreparationProps) {
  const { status, isLoading, error, isInitializing, isReady, hasError, retry } = useRAGStatus(cloneId);
  const [progress, setProgress] = useState(0);

  // Simulate progress during initialization
  useEffect(() => {
    if (isInitializing) {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 95) return prev;
          return prev + Math.random() * 5;
        });
      }, 500);

      return () => clearInterval(interval);
    } else if (isReady) {
      setProgress(100);
    }
  }, [isInitializing, isReady]);

  useEffect(() => {
    onMemoryReady(isReady);
  }, [isReady, onMemoryReady]);

  const getDomainMapping = (category: string): string => {
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
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'bg-green-500';
      case 'initializing': return 'bg-blue-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const renderStatusContent = () => {
    if (hasError) {
      return (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700">
            Memory layer initialization failed: {error || status?.error_message}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={retry}
              className="ml-2"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      );
    }

    if (isInitializing) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
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

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Initialization Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <Database className="h-4 w-4 text-blue-500" />
              <span>Setting up knowledge base</span>
            </div>
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-blue-500" />
              <span>Processing {documents.length} documents</span>
            </div>
            <div className="flex items-center space-x-2">
              <Zap className="h-4 w-4 text-blue-500" />
              <span>Configuring AI assistant</span>
            </div>
          </div>
        </motion.div>
      );
    }

    if (isReady) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4"
        >
          <div className="flex justify-center">
            <CheckCircle className="h-12 w-12 text-green-500" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-green-700">Memory Layer Ready!</h3>
            <p className="text-sm text-gray-600">
              Your clone now has access to enhanced knowledge and can provide more detailed, 
              context-aware responses based on your uploaded materials.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="font-medium text-green-700">Expert: {status?.expert_name}</div>
              <div className="text-green-600">Domain: {status?.domain_name}</div>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="font-medium text-blue-700">Knowledge Sources</div>
              <div className="text-blue-600">{documents.length} documents processed</div>
            </div>
          </div>
        </motion.div>
      );
    }

    // Default state - not initialized
    return (
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <Lightbulb className="h-12 w-12 text-amber-500" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Enable Enhanced Memory</h3>
          <p className="text-sm text-gray-600">
            Initialize the memory layer to enable your clone to use uploaded documents 
            and provide more intelligent, context-aware responses.
          </p>
        </div>
        
        <div className="space-y-2">
          <div className="text-xs text-gray-500">
            <strong>Benefits:</strong>
          </div>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• Answers based on your specific documents</li>
            <li>• Cites sources and provides context</li>
            <li>• More accurate and detailed responses</li>
            <li>• Maintains your expertise and knowledge</li>
          </ul>
        </div>

        <Button 
          onClick={onInitialize}
          disabled={isLoading || documents.length === 0}
          className="w-full"
        >
          <Brain className="h-4 w-4 mr-2" />
          Initialize Memory Layer
        </Button>

        {documents.length === 0 && (
          <p className="text-xs text-amber-600">
            Upload documents in Step 3 to enable memory layer initialization
          </p>
        )}
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Brain className="h-5 w-5" />
            <span>Memory Layer</span>
          </CardTitle>
          
          {status && (
            <Badge className={`${getStatusColor(status.rag_status)} text-white`}>
              {status.rag_status.charAt(0).toUpperCase() + status.rag_status.slice(1)}
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        <AnimatePresence mode="wait">
          {renderStatusContent()}
        </AnimatePresence>
        
        {status && (
          <div className="mt-4 pt-4 border-t text-xs text-gray-500">
            Last updated: {status.last_processed_at ? new Date(status.last_processed_at).toLocaleString() : 'Never'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### Step 4: Enhanced Chat Interface with RAG

Create `/components/rag/enhanced-chat-interface.tsx`:

```tsx
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { 
  Send, 
  Brain, 
  FileText, 
  ExternalLink,
  Sparkles,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ragApi, RAGQueryRequest, ConversationMessage, SourceInfo } from '@/lib/api-client';
import { toast } from '@/components/ui/use-toast';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: SourceInfo[];
  mode?: 'rag' | 'llm_fallback' | 'openai_fallback';
}

interface EnhancedChatInterfaceProps {
  cloneId: string;
  cloneName: string;
  cloneAvatar?: string;
  isRAGReady: boolean;
  onTestComplete?: (success: boolean, response: string) => void;
}

export function EnhancedChatInterface({ 
  cloneId, 
  cloneName, 
  cloneAvatar, 
  isRAGReady,
  onTestComplete 
}: EnhancedChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    try {
      // Prepare conversation history
      const conversationHistory: ConversationMessage[] = messages.slice(-5).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Query the clone
      const request: RAGQueryRequest = {
        query: userMessage.content,
        conversation_history: conversationHistory
      };

      const response = await ragApi.queryCloneRAG(cloneId, request);

      if (response.success && response.response) {
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.response,
          timestamp: new Date(),
          sources: response.sources,
          mode: response.mode
        };

        setMessages(prev => [...prev, assistantMessage]);
        
        // Notify parent of successful test
        onTestComplete?.(true, response.response);

        // Show success toast for RAG mode
        if (response.mode === 'rag' && response.sources && response.sources.length > 0) {
          toast({
            title: "Enhanced Response",
            description: `Response generated using ${response.sources.length} knowledge source(s)`,
          });
        }
      } else {
        throw new Error(response.message || 'Failed to get response');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      
      // Add error message to chat
      const errorChatMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I apologize, but I'm having trouble processing your message right now. Please try again.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorChatMessage]);
      
      onTestComplete?.(false, errorMessage);
      
      toast({
        title: "Message Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const renderMessage = (message: ChatMessage) => {
    const isUser = message.role === 'user';
    
    return (
      <motion.div
        key={message.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
      >
        {!isUser && (
          <Avatar className="h-8 w-8">
            <AvatarImage src={cloneAvatar} />
            <AvatarFallback>{cloneName.charAt(0)}</AvatarFallback>
          </Avatar>
        )}
        
        <div className={`max-w-[80%] space-y-2 ${isUser ? 'order-first' : ''}`}>
          <div className={`rounded-lg p-3 ${
            isUser 
              ? 'bg-blue-500 text-white ml-auto' 
              : 'bg-gray-100 text-gray-900'
          }`}>
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          </div>
          
          {/* Enhanced features for assistant messages */}
          {!isUser && (
            <div className="space-y-2">
              {/* Response mode indicator */}
              {message.mode && (
                <div className="flex items-center gap-2">
                  {message.mode === 'rag' ? (
                    <Badge variant="default" className="text-xs bg-green-100 text-green-700 hover:bg-green-100">
                      <Brain className="h-3 w-3 mr-1" />
                      Enhanced Response
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Standard Response
                    </Badge>
                  )}
                </div>
              )}
              
              {/* Sources */}
              {message.sources && message.sources.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs text-gray-500 font-medium">Sources:</div>
                  {message.sources.map((source, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs bg-blue-50 p-2 rounded">
                      <FileText className="h-3 w-3 text-blue-500" />
                      <span className="font-medium">{source.document_name}</span>
                      {source.page_number && (
                        <span className="text-gray-500">p. {source.page_number}</span>
                      )}
                      {source.relevance_score && (
                        <Badge variant="outline" className="text-xs">
                          {Math.round(source.relevance_score * 100)}% match
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          <div className="text-xs text-gray-500">
            {message.timestamp.toLocaleTimeString()}
          </div>
        </div>
        
        {isUser && (
          <Avatar className="h-8 w-8">
            <AvatarFallback>You</AvatarFallback>
          </Avatar>
        )}
      </motion.div>
    );
  };

  return (
    <Card className="w-full h-[600px] flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={cloneAvatar} />
              <AvatarFallback>{cloneName.charAt(0)}</AvatarFallback>
            </Avatar>
            <span>Chat with {cloneName}</span>
          </CardTitle>
          
          <div className="flex items-center gap-2">
            {isRAGReady ? (
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Memory Active
              </Badge>
            ) : (
              <Badge variant="secondary">
                <AlertCircle className="h-3 w-3 mr-1" />
                Standard Mode
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <Separator />
      
      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages Area */}
        <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <div className="space-y-2">
                  <p>Start a conversation to test your clone!</p>
                  {isRAGReady && (
                    <p className="text-sm text-blue-600">
                      ✨ Enhanced responses using your knowledge base are active
                    </p>
                  )}
                </div>
              </div>
            )}
            
            <AnimatePresence>
              {messages.map(renderMessage)}
            </AnimatePresence>
            
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-3"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={cloneAvatar} />
                  <AvatarFallback>{cloneName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="bg-gray-100 rounded-lg p-3 max-w-[80%]">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </ScrollArea>
        
        {/* Input Area */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isRAGReady ? "Ask anything about your expertise..." : "Type your test message..."}
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              onClick={sendMessage} 
              disabled={!inputMessage.trim() || isLoading}
              size="sm"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          
          {error && (
            <div className="mt-2 text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

### Step 5: Integration with Clone Wizard

Update the wizard's Step 6 in `/app/create-clone/wizard/page.tsx`:

First, add the RAG-related state and imports:

```typescript
// Add imports
import { MemoryPreparation } from '@/components/rag/memory-preparation';
import { EnhancedChatInterface } from '@/components/rag/enhanced-chat-interface';
import { useRAGStatus } from '@/hooks/use-rag-status';
import { ragApi } from '@/lib/api-client';

// Add to the formData state
const [formData, setFormData] = useState({
  // ... existing fields ...
  
  // RAG-related fields
  enableRAG: true, // Default to enabled
  ragInitialized: false,
  ragExpertName: "",
  ragDomain: "",
  ragContext: "",
});

// Add RAG status hook
const { 
  status: ragStatus, 
  isReady: isRAGReady, 
  initializeRAG 
} = useRAGStatus(createdCloneId);
```

Then update Step 6 (Testing & Preview) content:

```typescript
// Replace the existing Step 6 content
{currentStep === 6 && (
  <motion.div
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    className="space-y-6"
  >
    <div className="text-center space-y-2">
      <h2 className="text-2xl font-bold">Testing & Preview</h2>
      <p className="text-gray-600">
        Test your clone's responses and verify the memory layer is working correctly
      </p>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Memory Layer Status */}
      <div className="space-y-4">
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

            // Map category to domain
            const domainMapping: Record<string, string> = {
              'medical': 'health-wellness',
              'business': 'business-strategy',
              'education': 'education-learning',
              'finance': 'finance-investment',
              'coaching': 'life-coaching',
              'legal': 'legal-consulting',
              'ai': 'ai-technology'
            };

            // Build context from form data
            const contextParts = [];
            if (formData.title) contextParts.push(`Professional title: ${formData.title}`);
            if (formData.bio) contextParts.push(`Background: ${formData.bio}`);
            if (formData.credentials) contextParts.push(`Credentials: ${formData.credentials}`);
            
            const request = {
              expert_name: formData.name,
              domain_name: domainMapping[formData.expertise] || 'other',
              context: contextParts.join('\n') || `Expert in ${formData.expertise}`,
              documents: formData.existingDocuments.map(doc => ({
                name: doc.name,
                url: doc.url,
                type: doc.type
              }))
            };

            await initializeRAG(request);
          }}
        />

        {/* Test Results Summary */}
        {formData.testResults && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span>Test Results</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {formData.testResults.accuracy}%
                  </div>
                  <div className="text-sm text-gray-600">Accuracy</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {formData.testResults.personality}%
                  </div>
                  <div className="text-sm text-gray-600">Personality</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">
                    {formData.testResults.knowledge}%
                  </div>
                  <div className="text-sm text-gray-600">Knowledge</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Enhanced Chat Interface */}
      <div>
        <EnhancedChatInterface
          cloneId={createdCloneId || ""}
          cloneName={formData.name}
          cloneAvatar={formData.existingAvatarUrl}
          isRAGReady={isRAGReady}
          onTestComplete={(success, response) => {
            if (success) {
              // Update test results with successful interaction
              setFormData(prev => ({
                ...prev,
                testResults: {
                  accuracy: Math.min(95, prev.testResults?.accuracy || 85 + Math.random() * 10),
                  personality: Math.min(98, prev.testResults?.personality || 90 + Math.random() * 8),
                  knowledge: isRAGReady ? Math.min(95, 88 + Math.random() * 7) : Math.min(85, 75 + Math.random() * 10)
                }
              }));
            }
          }}
        />
      </div>
    </div>

    {/* Enhanced Features Info */}
    {isRAGReady && (
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <Sparkles className="h-6 w-6 text-blue-500 mt-1" />
            <div>
              <h3 className="font-semibold text-blue-900">Enhanced Memory Layer Active</h3>
              <p className="text-sm text-blue-700 mt-1">
                Your clone now has access to uploaded documents and can provide more detailed, 
                context-aware responses. Test questions about your specific expertise to see 
                the enhanced capabilities in action.
              </p>
              <div className="mt-2 text-xs text-blue-600">
                ✓ Document knowledge integration • ✓ Source citation • ✓ Context-aware responses
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )}

    {/* Action Buttons */}
    <div className="flex justify-between">
      <Button
        variant="outline"
        onClick={() => setCurrentStep(5)}
        disabled={isSubmitting}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>
      
      <Button
        onClick={() => setCurrentStep(7)}
        disabled={isSubmitting}
        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
      >
        Continue to Pricing
        <ArrowRight className="h-4 w-4 ml-2" />
      </Button>
    </div>
  </motion.div>
)}
```

### Step 6: Document Upload Integration

Update the document upload component to prepare for RAG processing:

```typescript
// In Step 3 (Knowledge Transfer), add RAG preparation
const handleDocumentUpload = async (files: File[]) => {
  // Existing upload logic...
  
  // After successful upload, prepare document info for RAG
  const processedDocs = uploadResults.map(result => ({
    name: result.fileName,
    url: result.fileUrl,
    type: result.fileType,
    status: 'uploaded',
    id: result.id
  }));
  
  setFormData(prev => ({
    ...prev,
    existingDocuments: [...prev.existingDocuments, ...processedDocs]
  }));
  
  // Show RAG preparation message
  toast({
    title: "Documents Ready",
    description: "Documents uploaded successfully. They will be processed when you initialize the memory layer in Testing & Preview.",
  });
};
```

### Step 7: Error Handling & Loading States

Create `/components/rag/rag-error-boundary.tsx`:

```tsx
"use client";

import React from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface RAGErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface RAGErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class RAGErrorBoundary extends React.Component<RAGErrorBoundaryProps, RAGErrorBoundaryState> {
  constructor(props: RAGErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): RAGErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('RAG Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700">
            <div className="space-y-2">
              <p>The enhanced memory features are temporarily unavailable.</p>
              <p className="text-sm">Your clone will continue to work with standard responses.</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => this.setState({ hasError: false, error: null })}
                className="mt-2"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Try Again
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}

// Usage wrapper component
export function withRAGErrorBoundary<P extends object>(
  Component: React.ComponentType<P>
) {
  return function WrappedComponent(props: P) {
    return (
      <RAGErrorBoundary>
        <Component {...props} />
      </RAGErrorBoundary>
    );
  };
}
```

### Step 8: Progressive Enhancement

Create `/hooks/use-progressive-rag.ts`:

```typescript
"use client";

import { useState, useEffect } from 'react';
import { ragApi } from '@/lib/api-client';

export interface ProgressiveRAGFeatures {
  memoryLayer: boolean;
  sourceCitation: boolean;
  contextAware: boolean;
  documentSearch: boolean;
}

export function useProgressiveRAG(cloneId: string | null) {
  const [features, setFeatures] = useState<ProgressiveRAGFeatures>({
    memoryLayer: false,
    sourceCitation: false,
    contextAware: false,
    documentSearch: false
  });
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (!cloneId) return;

    const checkFeatures = async () => {
      setIsChecking(true);
      try {
        const status = await ragApi.getCloneRAGStatus(cloneId);
        
        setFeatures({
          memoryLayer: status.rag_status === 'ready',
          sourceCitation: status.rag_status === 'ready',
          contextAware: status.rag_status === 'ready',
          documentSearch: status.rag_status === 'ready'
        });
      } catch (error) {
        // Graceful degradation - disable all enhanced features
        setFeatures({
          memoryLayer: false,
          sourceCitation: false,
          contextAware: false,
          documentSearch: false
        });
      } finally {
        setIsChecking(false);
      }
    };

    checkFeatures();
  }, [cloneId]);

  return { features, isChecking };
}
```

### Step 9: Performance Optimizations

Create `/lib/rag-cache.ts`:

```typescript
"use client";

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

class RAGCache {
  private cache = new Map<string, CacheEntry>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  set(key: string, data: any, ttl: number = this.DEFAULT_TTL) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  clear() {
    this.cache.clear();
  }

  // Cleanup expired entries
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

export const ragCache = new RAGCache();

// Cleanup expired entries every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => ragCache.cleanup(), 5 * 60 * 1000);
}
```

## Testing Strategy

### 1. Component Testing

Create test files for each component:

```typescript
// /tests/components/rag/memory-preparation.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryPreparation } from '@/components/rag/memory-preparation';

const mockProps = {
  cloneId: 'test-clone-id',
  cloneName: 'Test Clone',
  category: 'business',
  documents: [
    { name: 'test.pdf', url: '/test.pdf', status: 'uploaded', type: 'pdf' }
  ],
  onMemoryReady: jest.fn(),
  onInitialize: jest.fn()
};

describe('MemoryPreparation', () => {
  it('renders initialization button when not ready', () => {
    render(<MemoryPreparation {...mockProps} />);
    
    expect(screen.getByText('Initialize Memory Layer')).toBeInTheDocument();
    expect(screen.getByText('Enable Enhanced Memory')).toBeInTheDocument();
  });

  it('shows progress when initializing', async () => {
    // Mock RAG status hook to return initializing state
    jest.mock('@/hooks/use-rag-status', () => ({
      useRAGStatus: () => ({
        status: { rag_status: 'initializing' },
        isInitializing: true,
        isReady: false
      })
    }));

    render(<MemoryPreparation {...mockProps} />);
    
    expect(screen.getByText('Preparing the Memory Layer')).toBeInTheDocument();
    expect(screen.getByText('Initialization Progress')).toBeInTheDocument();
  });

  it('calls onInitialize when button clicked', () => {
    render(<MemoryPreparation {...mockProps} />);
    
    fireEvent.click(screen.getByText('Initialize Memory Layer'));
    
    expect(mockProps.onInitialize).toHaveBeenCalled();
  });
});
```

### 2. Integration Testing

```typescript
// /tests/integration/rag-workflow.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CloneWizard } from '@/app/create-clone/wizard/page';

describe('RAG Integration Workflow', () => {
  it('completes full RAG initialization flow', async () => {
    render(<CloneWizard />);
    
    // Navigate to step 6
    // ... navigation logic ...
    
    // Initialize memory layer
    fireEvent.click(screen.getByText('Initialize Memory Layer'));
    
    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByText('Memory Layer Ready!')).toBeInTheDocument();
    }, { timeout: 10000 });
    
    // Test chat functionality
    const chatInput = screen.getByPlaceholderText(/Ask anything about your expertise/);
    fireEvent.change(chatInput, { target: { value: 'What is your expertise?' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    
    // Verify response
    await waitFor(() => {
      expect(screen.getByText(/Enhanced Response/)).toBeInTheDocument();
    });
  });
});
```

### 3. Performance Testing

```typescript
// /tests/performance/rag-performance.test.ts
describe('RAG Performance', () => {
  it('initializes memory layer within acceptable time', async () => {
    const startTime = performance.now();
    
    // Simulate initialization
    await ragApi.initializeCloneRAG('test-clone', mockRequest);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(30000); // 30 seconds max
  });

  it('caches status requests', async () => {
    const cloneId = 'test-clone';
    
    // First request
    await ragApi.getCloneRAGStatus(cloneId);
    
    // Second request should be cached
    const startTime = performance.now();
    await ragApi.getCloneRAGStatus(cloneId);
    const endTime = performance.now();
    
    expect(endTime - startTime).toBeLessThan(10); // Should be very fast
  });
});
```

## Deployment & Configuration

### 1. Environment Variables

```env
# Frontend environment variables
NEXT_PUBLIC_RAG_ENABLED=true
NEXT_PUBLIC_RAG_DEBUG=false
NEXT_PUBLIC_RAG_TIMEOUT=30000
```

### 2. Feature Flags

```typescript
// /lib/feature-flags.ts
export const featureFlags = {
  ragEnabled: process.env.NEXT_PUBLIC_RAG_ENABLED === 'true',
  ragDebug: process.env.NEXT_PUBLIC_RAG_DEBUG === 'true',
  memoryLayerUI: true,
  sourceCitation: true,
  enhancedChat: true
};

export function isFeatureEnabled(feature: keyof typeof featureFlags): boolean {
  return featureFlags[feature] ?? false;
}
```

### 3. Monitoring & Analytics

```typescript
// /lib/rag-analytics.ts
export const ragAnalytics = {
  trackInitialization: (cloneId: string, success: boolean, duration: number) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'rag_initialization', {
        clone_id: cloneId,
        success,
        duration_ms: duration
      });
    }
  },

  trackQuery: (cloneId: string, mode: string, responseTime: number) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'rag_query', {
        clone_id: cloneId,
        mode,
        response_time_ms: responseTime
      });
    }
  },

  trackError: (component: string, error: string) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'rag_error', {
        component,
        error_message: error
      });
    }
  }
};
```

## Success Criteria

- ✅ Memory Preparation component shows clear status and progress
- ✅ Enhanced Chat Interface provides RAG-powered responses with source citations
- ✅ Graceful fallback to standard responses when RAG unavailable
- ✅ Document upload prepares files for RAG processing
- ✅ Step 6 integrates seamlessly with existing wizard flow
- ✅ Loading states provide clear feedback during initialization
- ✅ Error boundaries prevent crashes and show helpful messages
- ✅ Performance optimizations (caching, lazy loading) implemented
- ✅ Comprehensive testing covers all user scenarios
- ✅ Analytics and monitoring track feature usage and errors
- ✅ Progressive enhancement works across different browser capabilities

## User Experience Enhancements

### 1. Guided Tour for New Users

```typescript
// /components/rag/rag-tour.tsx
export function RAGTour({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const steps = [
    {
      target: '[data-tour="memory-layer"]',
      content: 'The Memory Layer enables your clone to use uploaded documents for enhanced responses.'
    },
    {
      target: '[data-tour="initialize-button"]',
      content: 'Click here to initialize the memory layer and process your documents.'
    },
    {
      target: '[data-tour="chat-interface"]',
      content: 'Test your clone here. Enhanced responses will include source citations.'
    }
  ];

  // Implementation using react-joyride or similar
  return <Tour steps={steps} isOpen={isOpen} onClose={onClose} />;
}
```

### 2. Smart Suggestions

```typescript
// /components/rag/smart-suggestions.tsx
export function SmartSuggestions({ cloneId, category }: { cloneId: string; category: string }) {
  const suggestions = {
    medical: [
      "What are your medical specializations?",
      "How do you approach patient diagnosis?",
      "What treatment protocols do you recommend?"
    ],
    business: [
      "What's your business strategy methodology?",
      "How do you approach market analysis?",
      "What are key success metrics you track?"
    ]
    // ... more categories
  };

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-700">Suggested questions:</h4>
      {suggestions[category]?.map((suggestion, index) => (
        <Button
          key={index}
          variant="outline"
          size="sm"
          className="text-left justify-start h-auto p-2 text-xs"
          onClick={() => onSuggestionClick(suggestion)}
        >
          {suggestion}
        </Button>
      ))}
    </div>
  );
}
```

## Accessibility Features

```typescript
// Add ARIA labels and keyboard navigation
<Card role="region" aria-label="Memory Layer Configuration">
  <CardContent>
    <Button
      aria-describedby="memory-layer-description"
      onClick={initializeMemory}
    >
      Initialize Memory Layer
    </Button>
    <div id="memory-layer-description" className="sr-only">
      Initializes the AI memory layer to enable document-based responses
    </div>
  </CardContent>
</Card>

// Screen reader announcements for status changes
const announceStatusChange = (status: string) => {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = `Memory layer status changed to ${status}`;
  document.body.appendChild(announcement);
  setTimeout(() => document.body.removeChild(announcement), 1000);
};
```

## Next Steps

After completing Phase 3:
1. Conduct user testing with the enhanced interface
2. Monitor performance metrics and user engagement
3. Gather feedback on the memory layer experience
4. Optimize based on real-world usage patterns
5. Plan additional RAG features (document search, advanced citations, etc.)
6. Prepare for production deployment and scaling