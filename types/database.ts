/**
 * Database types for Supabase integration - Auto-generated
 * Generated from Supabase schema
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      assistants: {
        Row: {
          assistant_id: string
          client_name: string | null
          created_at: string | null
          expert_name: string
          id: string
          memory_type: string
          updated_at: string | null
          vector_id: string | null
        }
        Insert: {
          assistant_id: string
          client_name?: string | null
          created_at?: string | null
          expert_name: string
          id?: string
          memory_type: string
          updated_at?: string | null
          vector_id?: string | null
        }
        Update: {
          assistant_id?: string
          client_name?: string | null
          created_at?: string | null
          expert_name?: string
          id?: string
          memory_type?: string
          updated_at?: string | null
          vector_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_expert"
            columns: ["expert_name"]
            isOneToOne: false
            referencedRelation: "experts"
            referencedColumns: ["name"]
          },
        ]
      }
      clone_qa_data: {
        Row: {
          clone_id: string
          created_at: string | null
          id: string
          qa_data: Json
          updated_at: string | null
        }
        Insert: {
          clone_id: string
          created_at?: string | null
          id?: string
          qa_data?: Json
          updated_at?: string | null
        }
        Update: {
          clone_id?: string
          created_at?: string | null
          id?: string
          qa_data?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      clones: {
        Row: {
          avatar_url: string | null
          average_rating: number | null
          base_price: number
          bio: string | null
          category: string
          communication_style: Json | null
          created_at: string | null
          creator_id: string | null
          credentials_qualifications: string | null
          currency: string | null
          document_processing_status: string | null
          expertise_areas: string[] | null
          id: string
          is_active: boolean | null
          is_published: boolean | null
          languages: string[] | null
          max_tokens: number | null
          name: string
          personality_traits: Json | null
          professional_title: string | null
          published_at: string | null
          rag_assistant_id: string | null
          rag_domain_name: string | null
          rag_expert_name: string | null
          rag_status: string | null
          rag_updated_at: string | null
          system_prompt: string | null
          temperature: number | null
          total_earnings: number | null
          total_ratings: number | null
          total_sessions: number | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          average_rating?: number | null
          base_price: number
          bio?: string | null
          category: string
          communication_style?: Json | null
          created_at?: string | null
          creator_id?: string | null
          credentials_qualifications?: string | null
          currency?: string | null
          document_processing_status?: string | null
          expertise_areas?: string[] | null
          id?: string
          is_active?: boolean | null
          is_published?: boolean | null
          languages?: string[] | null
          max_tokens?: number | null
          name: string
          personality_traits?: Json | null
          professional_title?: string | null
          published_at?: string | null
          rag_assistant_id?: string | null
          rag_domain_name?: string | null
          rag_expert_name?: string | null
          rag_status?: string | null
          rag_updated_at?: string | null
          system_prompt?: string | null
          temperature?: number | null
          total_earnings?: number | null
          total_ratings?: number | null
          total_sessions?: number | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          average_rating?: number | null
          base_price?: number
          bio?: string | null
          category?: string
          communication_style?: Json | null
          created_at?: string | null
          creator_id?: string | null
          credentials_qualifications?: string | null
          currency?: string | null
          document_processing_status?: string | null
          expertise_areas?: string[] | null
          id?: string
          is_active?: boolean | null
          is_published?: boolean | null
          languages?: string[] | null
          max_tokens?: number | null
          name?: string
          personality_traits?: Json | null
          professional_title?: string | null
          published_at?: string | null
          rag_assistant_id?: string | null
          rag_domain_name?: string | null
          rag_expert_name?: string | null
          rag_status?: string | null
          rag_updated_at?: string | null
          system_prompt?: string | null
          temperature?: number | null
          total_earnings?: number | null
          total_ratings?: number | null
          total_sessions?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clones_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_analytics: {
        Row: {
          average_rating: number | null
          clone_id: string | null
          created_at: string | null
          creator_id: string | null
          date: string
          id: string
          ratings_count: number | null
          sessions_count: number | null
          total_duration_minutes: number | null
          total_earnings: number | null
          updated_at: string | null
          user_retention_rate: number | null
        }
        Insert: {
          average_rating?: number | null
          clone_id?: string | null
          created_at?: string | null
          creator_id?: string | null
          date: string
          id?: string
          ratings_count?: number | null
          sessions_count?: number | null
          total_duration_minutes?: number | null
          total_earnings?: number | null
          updated_at?: string | null
          user_retention_rate?: number | null
        }
        Update: {
          average_rating?: number | null
          clone_id?: string | null
          created_at?: string | null
          creator_id?: string | null
          date?: string
          id?: string
          ratings_count?: number | null
          sessions_count?: number | null
          total_duration_minutes?: number | null
          total_earnings?: number | null
          updated_at?: string | null
          user_retention_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_analytics_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          client_name: string | null
          created_by: string | null
          document_link: string
          domain: string
          id: string
          included_in_default: boolean
          name: string
          openai_file_id: string | null
        }
        Insert: {
          client_name?: string | null
          created_by?: string | null
          document_link: string
          domain: string
          id?: string
          included_in_default?: boolean
          name: string
          openai_file_id?: string | null
        }
        Update: {
          client_name?: string | null
          created_by?: string | null
          document_link?: string
          domain?: string
          id?: string
          included_in_default?: boolean
          name?: string
          openai_file_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_domain"
            columns: ["domain"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["domain_name"]
          },
        ]
      }
      domains: {
        Row: {
          domain_name: string
          expert_names: string[] | null
          id: string
        }
        Insert: {
          domain_name: string
          expert_names?: string[] | null
          id?: string
        }
        Update: {
          domain_name?: string
          expert_names?: string[] | null
          id?: string
        }
        Relationships: []
      }
      experts: {
        Row: {
          context: string
          domain: string
          id: string
          name: string
        }
        Insert: {
          context: string
          domain: string
          id?: string
          name: string
        }
        Update: {
          context?: string
          domain?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_domain"
            columns: ["domain"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["domain_name"]
          },
        ]
      }
      knowledge: {
        Row: {
          clone_id: string
          content_preview: string | null
          content_type: string
          created_at: string | null
          description: string | null
          embedding_metadata: Json | null
          file_name: string | null
          file_size_bytes: number | null
          file_type: string | null
          file_url: string | null
          id: string
          metadata: Json | null
          openai_file_id: string | null
          original_url: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          vector_store_status: string | null
        }
        Insert: {
          clone_id: string
          content_preview?: string | null
          content_type: string
          created_at?: string | null
          description?: string | null
          embedding_metadata?: Json | null
          file_name?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          metadata?: Json | null
          openai_file_id?: string | null
          original_url?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          vector_store_status?: string | null
        }
        Update: {
          clone_id?: string
          content_preview?: string | null
          content_type?: string
          created_at?: string | null
          description?: string | null
          embedding_metadata?: Json | null
          file_name?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          metadata?: Json | null
          openai_file_id?: string | null
          original_url?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          vector_store_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_clone_id_fkey"
            columns: ["clone_id"]
            isOneToOne: false
            referencedRelation: "clones"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_usage_stats: {
        Row: {
          archived_memories_count: number | null
          average_retrieval_time_ms: number | null
          compressed_memories_count: number | null
          context_relevance_score: number | null
          context_retrievals: number | null
          created_at: string | null
          date: string
          id: string
          memory_hit_rate: number | null
          memory_searches_performed: number | null
          total_memories_stored: number | null
          total_memory_size_kb: number | null
          updated_at: string | null
          user_id: string
          user_satisfaction_score: number | null
        }
        Insert: {
          archived_memories_count?: number | null
          average_retrieval_time_ms?: number | null
          compressed_memories_count?: number | null
          context_relevance_score?: number | null
          context_retrievals?: number | null
          created_at?: string | null
          date: string
          id?: string
          memory_hit_rate?: number | null
          memory_searches_performed?: number | null
          total_memories_stored?: number | null
          total_memory_size_kb?: number | null
          updated_at?: string | null
          user_id: string
          user_satisfaction_score?: number | null
        }
        Update: {
          archived_memories_count?: number | null
          average_retrieval_time_ms?: number | null
          compressed_memories_count?: number | null
          context_relevance_score?: number | null
          context_retrievals?: number | null
          created_at?: string | null
          date?: string
          id?: string
          memory_hit_rate?: number | null
          memory_searches_performed?: number | null
          total_memories_stored?: number | null
          total_memory_size_kb?: number | null
          updated_at?: string | null
          user_id?: string
          user_satisfaction_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "memory_usage_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json | null
          content: string
          context_used: string | null
          cost_increment: number | null
          created_at: string | null
          id: string
          sender_type: string
          session_id: string | null
          sources: Json | null
          tokens_used: number | null
        }
        Insert: {
          attachments?: Json | null
          content: string
          context_used?: string | null
          cost_increment?: number | null
          created_at?: string | null
          id?: string
          sender_type: string
          session_id?: string | null
          sources?: Json | null
          tokens_used?: number | null
        }
        Update: {
          attachments?: Json | null
          content?: string
          context_used?: string | null
          cost_increment?: number | null
          created_at?: string | null
          id?: string
          sender_type?: string
          session_id?: string | null
          sources?: Json | null
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          credits_remaining: number | null
          email: string
          email_confirmed: boolean | null
          full_name: string | null
          id: string
          onboarding_completed: boolean | null
          preferences: Json | null
          role: string | null
          subscription_tier: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          credits_remaining?: number | null
          email: string
          email_confirmed?: boolean | null
          full_name?: string | null
          id: string
          onboarding_completed?: boolean | null
          preferences?: Json | null
          role?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          credits_remaining?: number | null
          email?: string
          email_confirmed?: boolean | null
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean | null
          preferences?: Json | null
          role?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sessions: {
        Row: {
          clone_id: string | null
          created_at: string | null
          demo_mode: boolean | null
          duration_minutes: number | null
          end_time: string | null
          id: string
          message_count: number | null
          rate_per_minute: number
          session_metadata: Json | null
          session_type: string | null
          start_time: string | null
          status: string | null
          total_cost: number | null
          updated_at: string | null
          user_feedback: string | null
          user_id: string | null
          user_rating: number | null
        }
        Insert: {
          clone_id?: string | null
          created_at?: string | null
          demo_mode?: boolean | null
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          message_count?: number | null
          rate_per_minute: number
          session_metadata?: Json | null
          session_type?: string | null
          start_time?: string | null
          status?: string | null
          total_cost?: number | null
          updated_at?: string | null
          user_feedback?: string | null
          user_id?: string | null
          user_rating?: number | null
        }
        Update: {
          clone_id?: string | null
          created_at?: string | null
          demo_mode?: boolean | null
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          message_count?: number | null
          rate_per_minute?: number
          session_metadata?: Json | null
          session_type?: string | null
          start_time?: string | null
          status?: string | null
          total_cost?: number | null
          updated_at?: string | null
          user_feedback?: string | null
          user_id?: string | null
          user_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          credits_remaining: number | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          is_verified: boolean | null
          language: string | null
          last_login: string | null
          preferences: Json | null
          role: string | null
          subscription_tier: string | null
          timezone: string | null
          total_spent: number | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          credits_remaining?: number | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          language?: string | null
          last_login?: string | null
          preferences?: Json | null
          role?: string | null
          subscription_tier?: string | null
          timezone?: string | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          credits_remaining?: number | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          language?: string | null
          last_login?: string | null
          preferences?: Json | null
          role?: string | null
          subscription_tier?: string | null
          timezone?: string | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      vector_stores: {
        Row: {
          batch_ids: string[] | null
          client_name: string | null
          created_at: string | null
          domain_name: string
          expert_name: string | null
          file_ids: string[] | null
          id: string
          latest_batch_id: string | null
          owner: string
          updated_at: string | null
          vector_id: string
        }
        Insert: {
          batch_ids?: string[] | null
          client_name?: string | null
          created_at?: string | null
          domain_name: string
          expert_name?: string | null
          file_ids?: string[] | null
          id?: string
          latest_batch_id?: string | null
          owner: string
          updated_at?: string | null
          vector_id: string
        }
        Update: {
          batch_ids?: string[] | null
          client_name?: string | null
          created_at?: string | null
          domain_name?: string
          expert_name?: string | null
          file_ids?: string[] | null
          id?: string
          latest_batch_id?: string | null
          owner?: string
          updated_at?: string | null
          vector_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_domain"
            columns: ["domain_name"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["domain_name"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Additional helper types
export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] &
        Database["public"]["Views"])
    ? (Database["public"]["Tables"] &
        Database["public"]["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

// Legacy RAG API Response Types for backward compatibility
export interface RAGProcessingResponse {
  status: 'success' | 'failed'
  message: string
  clone_id?: string
  assistant_id?: string
  vector_store_id?: string
  processed_documents?: number
  error?: string
}

export interface RAGQueryResponse {
  response: { text: string }
  thread_id?: string
  assistant_id?: string
  sources?: string[]
  confidence?: number
  clone_id: string
  query?: string
  timestamp?: string
}

export interface RAGError {
  type: 'configuration' | 'processing' | 'validation' | 'connection' | 'auth'
  message: string
  suggestion?: string
  retryable: boolean
}

export interface RAGHealthCheckResponse {
  rag_ready: boolean
  status: 'healthy' | 'error' | 'unhealthy'
  message: string
  openai_api_key_configured: boolean
  openai_client_initialized: boolean
  supabase_configured: boolean
  issues?: string[]
  solutions?: string[]
  timestamp: string
  error?: string
}

export interface ProcessingStatus {
  clone_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'no_documents'
  completed_documents: number
  total_documents: number
  processing_documents: number
  failed_documents: number
  progress_percentage: number
  expert_name?: string
  assistant_id?: string
  error_message?: string
}