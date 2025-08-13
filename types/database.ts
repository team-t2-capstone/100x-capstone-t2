/**
 * Database types for Supabase integration
 * Basic types for CloneAI Supabase schema
 */

export interface Database {
  public: {
    Tables: {
      clones: {
        Row: {
          id: string
          creator_id: string
          name: string
          description: string
          category: string
          expertise_areas: string[]
          base_price: number
          bio?: string
          personality_traits?: Record<string, any>
          communication_style?: Record<string, any>
          languages: string[]
          is_published: boolean
          is_active: boolean
          average_rating: number
          total_sessions: number
          total_earnings: number
          avatar_url?: string
          created_at: string
          updated_at: string
          published_at?: string
        }
        Insert: {
          id?: string
          creator_id: string
          name: string
          description: string
          category: string
          expertise_areas?: string[]
          base_price: number
          bio?: string
          personality_traits?: Record<string, any>
          communication_style?: Record<string, any>
          languages?: string[]
          is_published?: boolean
          is_active?: boolean
          average_rating?: number
          total_sessions?: number
          total_earnings?: number
          avatar_url?: string
          created_at?: string
          updated_at?: string
          published_at?: string
        }
        Update: {
          id?: string
          creator_id?: string
          name?: string
          description?: string
          category?: string
          expertise_areas?: string[]
          base_price?: number
          bio?: string
          personality_traits?: Record<string, any>
          communication_style?: Record<string, any>
          languages?: string[]
          is_published?: boolean
          is_active?: boolean
          average_rating?: number
          total_sessions?: number
          total_earnings?: number
          avatar_url?: string
          created_at?: string
          updated_at?: string
          published_at?: string
        }
      }
      knowledge: {
        Row: {
          id: string
          clone_id: string
          title: string
          description?: string
          content_type: 'document' | 'link' | 'text'
          file_name?: string
          file_url?: string
          file_type?: string
          file_size_bytes?: number
          original_url?: string
          content_preview?: string
          tags?: string[]
          vector_store_status: 'pending' | 'processing' | 'completed' | 'failed'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clone_id: string
          title: string
          description?: string
          content_type: 'document' | 'link' | 'text'
          file_name?: string
          file_url?: string
          file_type?: string
          file_size_bytes?: number
          original_url?: string
          content_preview?: string
          tags?: string[]
          vector_store_status?: 'pending' | 'processing' | 'completed' | 'failed'
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          description?: string
          content_type?: 'document' | 'link' | 'text'
          file_name?: string
          file_url?: string
          file_type?: string
          file_size_bytes?: number
          original_url?: string
          content_preview?: string
          tags?: string[]
          vector_store_status?: 'pending' | 'processing' | 'completed' | 'failed'
          updated_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          name: string
          document_link: string
          created_by?: string
          domain: string
          included_in_default: boolean
          client_name?: string
          openai_file_id?: string
        }
        Insert: {
          id?: string
          name: string
          document_link: string
          created_by?: string
          domain: string
          included_in_default?: boolean
          client_name?: string
          openai_file_id?: string
        }
        Update: {
          name?: string
          document_link?: string
          created_by?: string
          domain?: string
          included_in_default?: boolean
          client_name?: string
          openai_file_id?: string
        }
      }
      domains: {
        Row: {
          id: string
          domain_name: string
          expert_names: string[]
        }
        Insert: {
          id?: string
          domain_name: string
          expert_names?: string[]
        }
        Update: {
          domain_name?: string
          expert_names?: string[]
        }
      }
      experts: {
        Row: {
          id: string
          name: string
          domain: string
          context: string
        }
        Insert: {
          id?: string
          name: string
          domain: string
          context: string
        }
        Update: {
          name?: string
          domain?: string
          context?: string
        }
      }
      // Add other tables as needed
      sessions: {
        Row: {
          id: string
          user_id: string
          clone_id: string
          status: string
          session_type?: string
          start_time: string
          end_time?: string
          duration_minutes: number
          total_cost: number
          rate_per_minute: number
          message_count: number
          user_rating?: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          clone_id: string
          status?: string
          session_type?: string
          start_time?: string
          end_time?: string
          duration_minutes?: number
          total_cost?: number
          rate_per_minute: number
          message_count?: number
          user_rating?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          clone_id?: string
          status?: string
          session_type?: string
          start_time?: string
          end_time?: string
          duration_minutes?: number
          total_cost?: number
          rate_per_minute?: number
          message_count?: number
          user_rating?: number
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}