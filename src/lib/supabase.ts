// FRONTEND DECOUPLING COMPLETE
// This file now only exports TypeScript types for database schema
// All Supabase client operations have been moved to the backend
// See src/lib/api-migration.ts for the new API client pattern

// Database types for TypeScript
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          display_name: string
          bio: string | null
          location: string | null
          hobbies: string | null
          interests: string | null
          avatar: string | null
          is_active: boolean
          is_verified: boolean
          rating: number
          review_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          display_name: string
          bio?: string | null
          location?: string | null
          hobbies?: string | null
          interests?: string | null
          avatar?: string | null
          is_active?: boolean
          is_verified?: boolean
          rating?: number
          review_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string
          bio?: string | null
          location?: string | null
          hobbies?: string | null
          interests?: string | null
          avatar?: string | null
          is_active?: boolean
          is_verified?: boolean
          rating?: number
          review_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      services: {
        Row: {
          id: string
          provider_id: string
          title: string
          description: string
          category: string
          availability_slots: string
          duration: number
          price: number
          location: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          provider_id: string
          title: string
          description: string
          category: string
          availability_slots: string
          duration: number
          price: number
          location: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          provider_id?: string
          title?: string
          description?: string
          category?: string
          availability_slots?: string
          duration?: number
          price?: number
          location?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      bookings: {
        Row: {
          id: string
          service_id: string
          requester_id: string
          message: string
          status: string
          created_at: string
          updated_at: string
          confirmed_at: string | null
          declined_at: string | null
          cancelled_at: string | null
          completed_at: string | null
        }
        Insert: {
          id?: string
          service_id: string
          requester_id: string
          message: string
          status?: string
          created_at?: string
          updated_at?: string
          confirmed_at?: string | null
          declined_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
        }
        Update: {
          id?: string
          service_id?: string
          requester_id?: string
          message?: string
          status?: string
          created_at?: string
          updated_at?: string
          confirmed_at?: string | null
          declined_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
        }
      }
      conversations: {
        Row: {
          id: string
          booking_id: string
          provider_id: string
          customer_id: string
          last_message_at: string | null
          last_message_text: string | null
          last_message_sender: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          booking_id: string
          provider_id: string
          customer_id: string
          last_message_at?: string | null
          last_message_text?: string | null
          last_message_sender?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          booking_id?: string
          provider_id?: string
          customer_id?: string
          last_message_at?: string | null
          last_message_text?: string | null
          last_message_sender?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          content: string
          message_type: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          content: string
          message_type?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_id?: string
          content?: string
          message_type?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}