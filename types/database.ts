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
      knowledge: {
        Row: {
          clone_id: string
          content_preview: string | null
          content_type: string
          created_at: string | null
          description: string | null
          file_name: string | null
          file_size_bytes: number | null
          file_type: string | null
          file_url: string | null
          id: string
          metadata: Json | null
          original_url: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          clone_id: string
          content_preview?: string | null
          content_type: string
          created_at?: string | null
          description?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          metadata?: Json | null
          original_url?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          clone_id?: string
          content_preview?: string | null
          content_type?: string
          created_at?: string | null
          description?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          metadata?: Json | null
          original_url?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
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

