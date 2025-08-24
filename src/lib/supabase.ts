import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Create a client for admin operations (bypasses RLS)
// Note: In production, this should be handled server-side
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
console.log('Service key available:', !!supabaseServiceKey);
console.log('Service key length:', supabaseServiceKey?.length || 0);

if (!supabaseServiceKey || supabaseServiceKey === 'not-set') {
  console.error('⚠️ VITE_SUPABASE_SERVICE_ROLE_KEY not found in environment variables');
  console.error('Available env vars:', Object.keys(import.meta.env).filter(key => key.includes('SUPABASE')));
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

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