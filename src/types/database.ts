export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          display_name: string | null
          bio: string | null
          location: string | null
          avatar: string | null
          phone: string | null
          is_verified: boolean
          rating: number
          review_count: number
          total_earnings: number
          total_spent: number
          is_provider: boolean
          provider_verified_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          display_name?: string | null
          bio?: string | null
          location?: string | null
          avatar?: string | null
          phone?: string | null
          is_verified?: boolean
          rating?: number
          review_count?: number
          total_earnings?: number
          total_spent?: number
          is_provider?: boolean
          provider_verified_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string | null
          bio?: string | null
          location?: string | null
          avatar?: string | null
          phone?: string | null
          is_verified?: boolean
          rating?: number
          review_count?: number
          total_earnings?: number
          total_spent?: number
          is_provider?: boolean
          provider_verified_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          name: string
          description: string | null
          icon: string | null
          color: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          icon?: string | null
          color?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          icon?: string | null
          color?: string | null
          created_at?: string
        }
      }
      services: {
        Row: {
          id: string
          provider_id: string
          category_id: string | null
          title: string
          description: string
          short_description: string | null
          price: number
          duration_minutes: number
          location: string | null
          is_online: boolean
          is_active: boolean
          rating: number
          review_count: number
          total_bookings: number
          images: string[] | null
          tags: string[] | null
          availability_schedule: Json | null
          requirements: string | null
          cancellation_policy: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          provider_id: string
          category_id?: string | null
          title: string
          description: string
          short_description?: string | null
          price: number
          duration_minutes: number
          location?: string | null
          is_online?: boolean
          is_active?: boolean
          rating?: number
          review_count?: number
          total_bookings?: number
          images?: string[] | null
          tags?: string[] | null
          availability_schedule?: Json | null
          requirements?: string | null
          cancellation_policy?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          provider_id?: string
          category_id?: string | null
          title?: string
          description?: string
          short_description?: string | null
          price?: number
          duration_minutes?: number
          location?: string | null
          is_online?: boolean
          is_active?: boolean
          rating?: number
          review_count?: number
          total_bookings?: number
          images?: string[] | null
          tags?: string[] | null
          availability_schedule?: Json | null
          requirements?: string | null
          cancellation_policy?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      bookings: {
        Row: {
          id: string
          service_id: string
          customer_id: string
          provider_id: string
          status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'refunded'
          scheduled_at: string
          duration_minutes: number
          total_price: number
          service_fee: number
          customer_notes: string | null
          provider_notes: string | null
          location: string | null
          is_online: boolean
          meeting_link: string | null
          cancellation_reason: string | null
          cancelled_by: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          service_id: string
          customer_id: string
          provider_id: string
          status?: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'refunded'
          scheduled_at: string
          duration_minutes: number
          total_price: number
          service_fee?: number
          customer_notes?: string | null
          provider_notes?: string | null
          location?: string | null
          is_online?: boolean
          meeting_link?: string | null
          cancellation_reason?: string | null
          cancelled_by?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          service_id?: string
          customer_id?: string
          provider_id?: string
          status?: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'refunded'
          scheduled_at?: string
          duration_minutes?: number
          total_price?: number
          service_fee?: number
          customer_notes?: string | null
          provider_notes?: string | null
          location?: string | null
          is_online?: boolean
          meeting_link?: string | null
          cancellation_reason?: string | null
          cancelled_by?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      reviews: {
        Row: {
          id: string
          booking_id: string
          reviewer_id: string
          reviewee_id: string
          service_id: string
          rating: number
          comment: string | null
          is_public: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          booking_id: string
          reviewer_id: string
          reviewee_id: string
          service_id: string
          rating: number
          comment?: string | null
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          booking_id?: string
          reviewer_id?: string
          reviewee_id?: string
          service_id?: string
          rating?: number
          comment?: string | null
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          booking_id: string
          customer_id: string
          provider_id: string
          amount: number
          service_fee: number
          status: 'pending' | 'processing' | 'held' | 'released' | 'refunded' | 'failed'
          payment_method_id: string | null
          payment_intent_id: string | null
          held_at: string | null
          released_at: string | null
          refunded_at: string | null
          refund_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          booking_id: string
          customer_id: string
          provider_id: string
          amount: number
          service_fee?: number
          status?: 'pending' | 'processing' | 'held' | 'released' | 'refunded' | 'failed'
          payment_method_id?: string | null
          payment_intent_id?: string | null
          held_at?: string | null
          released_at?: string | null
          refunded_at?: string | null
          refund_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          booking_id?: string
          customer_id?: string
          provider_id?: string
          amount?: number
          service_fee?: number
          status?: 'pending' | 'processing' | 'held' | 'released' | 'refunded' | 'failed'
          payment_method_id?: string | null
          payment_intent_id?: string | null
          held_at?: string | null
          released_at?: string | null
          refunded_at?: string | null
          refund_reason?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      conversations: {
        Row: {
          id: string
          booking_id: string | null
          participants: string[]
          last_message_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          booking_id?: string | null
          participants: string[]
          last_message_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          booking_id?: string | null
          participants?: string[]
          last_message_at?: string | null
          created_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          content: string
          message_type: 'text' | 'image' | 'file' | 'system'
          file_url: string | null
          file_name: string | null
          file_size: number | null
          is_read: boolean
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          content: string
          message_type?: 'text' | 'image' | 'file' | 'system'
          file_url?: string | null
          file_name?: string | null
          file_size?: number | null
          is_read?: boolean
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_id?: string
          content?: string
          message_type?: 'text' | 'image' | 'file' | 'system'
          file_url?: string | null
          file_name?: string | null
          file_size?: number | null
          is_read?: boolean
          read_at?: string | null
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: 'booking_request' | 'booking_confirmed' | 'booking_cancelled' | 'payment_received' | 'new_review' | 'message' | 'reminder'
          title: string
          content: string
          data: Json | null
          is_read: boolean
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: 'booking_request' | 'booking_confirmed' | 'booking_cancelled' | 'payment_received' | 'new_review' | 'message' | 'reminder'
          title: string
          content: string
          data?: Json | null
          is_read?: boolean
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: 'booking_request' | 'booking_confirmed' | 'booking_cancelled' | 'payment_received' | 'new_review' | 'message' | 'reminder'
          title?: string
          content?: string
          data?: Json | null
          is_read?: boolean
          read_at?: string | null
          created_at?: string
        }
      }
      user_favorites: {
        Row: {
          id: string
          user_id: string
          service_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          service_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          service_id?: string
          created_at?: string
        }
      }
      provider_availability: {
        Row: {
          id: string
          provider_id: string
          day_of_week: number
          start_time: string
          end_time: string
          is_available: boolean
          timezone: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          provider_id: string
          day_of_week: number
          start_time: string
          end_time: string
          is_available?: boolean
          timezone?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          provider_id?: string
          day_of_week?: number
          start_time?: string
          end_time?: string
          is_available?: boolean
          timezone?: string
          created_at?: string
          updated_at?: string
        }
      }
      file_uploads: {
        Row: {
          id: string
          user_id: string
          file_name: string
          file_url: string
          file_size: number | null
          mime_type: string | null
          upload_type: 'avatar' | 'service_image' | 'message_attachment' | 'document' | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          file_name: string
          file_url: string
          file_size?: number | null
          mime_type?: string | null
          upload_type?: 'avatar' | 'service_image' | 'message_attachment' | 'document' | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          file_name?: string
          file_url?: string
          file_size?: number | null
          mime_type?: string | null
          upload_type?: 'avatar' | 'service_image' | 'message_attachment' | 'document' | null
          created_at?: string
        }
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