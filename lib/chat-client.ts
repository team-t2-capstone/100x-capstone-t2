/**
 * Real-time Chat Client with WebSocket Integration
 * Handles WebSocket connections for real-time chat with RAG-enhanced responses
 */
import { getAuthTokens } from './api-client'

export interface ChatMessage {
  id: string
  content: string
  sender: 'user' | 'assistant'
  timestamp: Date
  metadata?: {
    knowledge_context?: Array<{
      content: string
      source: string
      similarity: number
    }>
    model_used?: string
    sources?: string[]
  }
  isStreaming?: boolean
}

export interface WebSocketMessage {
  type: 'message_chunk' | 'message_complete' | 'typing_indicator' | 'error' | 'connection_status'
  content?: string
  is_complete?: boolean
  knowledge_used?: boolean
  sources?: string[]
  metadata?: any
  error?: string
  is_typing?: boolean
  status?: string
}

export interface ChatSession {
  id: string
  clone_id: string
  clone_name?: string
  title: string
  message_count: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type ChatEventHandler = {
  onMessage?: (message: ChatMessage) => void
  onMessageChunk?: (chunk: string) => void
  onMessageComplete?: (message: ChatMessage) => void
  onTypingIndicator?: (isTyping: boolean) => void
  onError?: (error: string) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onReconnect?: () => void
}

export class ChatClient {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private sessionId: string
  private cloneId: string
  private handlers: ChatEventHandler
  private currentStreamingMessage: Partial<ChatMessage> | null = null
  
  constructor(
    sessionId: string,
    cloneId: string,
    handlers: ChatEventHandler = {}
  ) {
    this.sessionId = sessionId
    this.cloneId = cloneId
    this.handlers = handlers
  }

  async connect(): Promise<void> {
    const { accessToken } = getAuthTokens()
    if (!accessToken) {
      throw new Error('Authentication token required')
    }

    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8001'}/api/v1/chat/ws/${this.sessionId}?token=${accessToken}`
    
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl)

        this.ws.onopen = () => {
          console.log('Chat WebSocket connected')
          this.reconnectAttempts = 0
          this.handlers.onConnect?.()
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const data: WebSocketMessage = JSON.parse(event.data)
            this.handleWebSocketMessage(data)
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error)
          }
        }

        this.ws.onclose = (event) => {
          console.log('Chat WebSocket disconnected:', event.code, event.reason)
          this.handlers.onDisconnect?.()
          
          // Attempt to reconnect unless it was a clean close
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect()
          }
        }

        this.ws.onerror = (error) => {
          console.error('Chat WebSocket error:', error)
          this.handlers.onError?.('Connection error occurred')
          reject(error)
        }

      } catch (error) {
        reject(error)
      }
    })
  }

  private handleWebSocketMessage(data: WebSocketMessage) {
    switch (data.type) {
      case 'message_chunk':
        if (!data.is_complete && data.content) {
          // Handle streaming message chunk
          if (!this.currentStreamingMessage) {
            this.currentStreamingMessage = {
              id: Date.now().toString(),
              content: '',
              sender: 'assistant',
              timestamp: new Date(),
              isStreaming: true,
              metadata: {
                sources: data.sources || []
              }
            }
          }
          
          this.currentStreamingMessage.content += data.content
          this.handlers.onMessageChunk?.(data.content)
        }
        break

      case 'message_complete':
        if (this.currentStreamingMessage && data.content) {
          // Complete the streaming message
          const completedMessage: ChatMessage = {
            ...this.currentStreamingMessage,
            content: data.content,
            isStreaming: false,
            metadata: {
              ...this.currentStreamingMessage.metadata,
              sources: data.sources || [],
              model_used: data.metadata?.model_used,
              knowledge_chunks_used: data.metadata?.knowledge_chunks_used
            }
          } as ChatMessage

          this.handlers.onMessageComplete?.(completedMessage)
          this.currentStreamingMessage = null
        }
        break

      case 'typing_indicator':
        this.handlers.onTypingIndicator?.(data.is_typing || false)
        break

      case 'error':
        this.handlers.onError?.(data.content || data.error || 'Unknown error')
        break

      case 'connection_status':
        // Handle connection status updates
        break
    }
  }

  private async attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.handlers.onError?.('Maximum reconnection attempts exceeded')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1) // Exponential backoff
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`)
    
    setTimeout(async () => {
      try {
        await this.connect()
        this.handlers.onReconnect?.()
      } catch (error) {
        console.error('Reconnection failed:', error)
        this.attemptReconnect()
      }
    }, delay)
  }

  sendMessage(content: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.handlers.onError?.('Not connected to chat server')
      return
    }

    const message = {
      type: 'chat',
      content: content.trim(),
      clone_id: this.cloneId
    }

    this.ws.send(JSON.stringify(message))
  }

  sendTypingIndicator(isTyping: boolean): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return
    }

    const message = {
      type: 'typing',
      is_typing: isTyping
    }

    this.ws.send(JSON.stringify(message))
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'User disconnected')
      this.ws = null
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

// Chat API functions for session management
export async function createChatSession(cloneId: string, title?: string): Promise<ChatSession> {
  const { accessToken } = getAuthTokens()
  
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}/api/v1/chat/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({ clone_id: cloneId, title })
  })

  if (!response.ok) {
    throw new Error('Failed to create chat session')
  }

  return response.json()
}

export async function getChatHistory(sessionId: string, limit: number = 50): Promise<{
  messages: ChatMessage[]
  total_messages: number
  has_more: boolean
}> {
  const { accessToken } = getAuthTokens()
  
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}/api/v1/chat/sessions/${sessionId}/history?limit=${limit}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  })

  if (!response.ok) {
    throw new Error('Failed to get chat history')
  }

  const data = await response.json()
  
  // Transform messages to frontend format
  const messages: ChatMessage[] = data.messages.map((msg: any) => ({
    id: msg.id,
    content: msg.content,
    sender: msg.sender_type === 'user' ? 'user' : 'assistant',
    timestamp: new Date(msg.created_at),
    metadata: msg.metadata
  }))

  return {
    messages,
    total_messages: data.total_messages,
    has_more: data.has_more
  }
}

export async function getUserChatSessions(limit: number = 20): Promise<{
  sessions: ChatSession[]
  has_more: boolean
}> {
  const { accessToken } = getAuthTokens()
  
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}/api/v1/chat/sessions?limit=${limit}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  })

  if (!response.ok) {
    throw new Error('Failed to get chat sessions')
  }

  const data = await response.json()
  return {
    sessions: data.sessions,
    has_more: data.has_more
  }
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  const { accessToken } = getAuthTokens()
  
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}/api/v1/chat/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  })

  if (!response.ok) {
    throw new Error('Failed to delete chat session')
  }
}