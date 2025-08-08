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
      // Add other tables as needed
      sessions: {
        Row: {
          id: string
          user_id: string
          clone_id: string
          status: string
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