import { supabase } from './supabase'
import type { User, Session } from '@supabase/supabase-js'

export interface AuthUser {
  id: string
  email: string
  displayName: string
  avatar?: string
  bio?: string
  location?: string
  rating: number
  reviewCount: number
  isActive: boolean
  createdAt: string
}

export class AuthService {
  // Sign up with email and password
  static async signUp(email: string, password: string, displayName: string) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName
          }
        }
      })

      if (error) throw error

      // Create user profile
      if (data.user) {
        // Wait a bit for auth to be fully processed
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Try to create user profile with retry logic
        let retryCount = 0
        const maxRetries = 3
        
        while (retryCount < maxRetries) {
          const { error: profileError } = await supabase
            .from('users')
            .insert({
              id: data.user.id,
              email: data.user.email!,
              display_name: displayName,
              bio: '',
              avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=3b82f6&color=fff`
            })

          if (!profileError) {
            break // Success
          }
          
          console.error(`Profile creation attempt ${retryCount + 1} failed:`, profileError)
          retryCount++
          
          if (retryCount >= maxRetries) {
            console.error('Final profile error details:', JSON.stringify(profileError, null, 2))
            // Don't throw error for profile creation - the auth user is still created
            console.warn('Profile creation failed but auth user exists. Profile can be created later.')
            break
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      return { user: data.user, session: data.session }
    } catch (error) {
      console.error('Sign up error:', error)
      throw error
    }
  }

  // Sign in with email and password
  static async signIn(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error

      return { user: data.user, session: data.session }
    } catch (error) {
      console.error('Sign in error:', error)
      throw error
    }
  }

  // Sign out
  static async signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (error) {
      console.error('Sign out error:', error)
      throw error
    }
  }

  // Get current session
  static async getCurrentSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) throw error
      return session
    } catch (error) {
      console.error('Get session error:', error)
      return null
    }
  }

  // Get current user
  static async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) throw error
      return user
    } catch (error) {
      console.error('Get user error:', error)
      return null
    }
  }

  // Get user profile with additional data
  static async getUserProfile(userId: string): Promise<AuthUser | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        // If profile doesn't exist, try to create it
        if (error.code === 'PGRST116') {
          console.log('Profile not found, attempting to create it...')
          return await this.createMissingProfile(userId)
        }
        throw error
      }

      return {
        id: data.id,
        email: data.email,
        displayName: data.display_name,
        avatar: data.avatar,
        bio: data.bio,
        location: data.location,
        rating: data.rating,
        reviewCount: data.review_count,
        isActive: data.is_active,
        createdAt: data.created_at
      }
    } catch (error) {
      console.error('Get user profile error:', error)
      return null
    }
  }

  // Create missing profile for existing auth user
  static async createMissingProfile(userId: string): Promise<AuthUser | null> {
    try {
      // Get auth user details
      const { data: authUser } = await supabase.auth.getUser()
      if (!authUser.user || authUser.user.id !== userId) {
        throw new Error('Auth user not found or ID mismatch')
      }

      const email = authUser.user.email!
      const displayName = authUser.user.user_metadata?.display_name || email.split('@')[0]

      // Create profile
      const { data, error } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: email,
          display_name: displayName,
          bio: '',
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=3b82f6&color=fff`
        })
        .select()
        .single()

      if (error) {
        // Silently handle profile creation errors - not critical since we have temporary profile
        console.log('Profile creation skipped due to database constraints - using temporary profile')
        return null
      }

      return {
        id: data.id,
        email: data.email,
        displayName: data.display_name,
        avatar: data.avatar,
        bio: data.bio,
        location: data.location,
        rating: data.rating,
        reviewCount: data.review_count,
        isActive: data.is_active,
        createdAt: data.created_at
      }
    } catch (error) {
      console.error('Error creating missing profile:', error)
      return null
    }
  }

  // Update user profile
  static async updateUserProfile(userId: string, updates: Partial<AuthUser>) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({
          display_name: updates.displayName,
          bio: updates.bio,
          location: updates.location,
          avatar: updates.avatar
        })
        .eq('id', userId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Update profile error:', error)
      throw error
    }
  }

  // Listen to auth state changes
  static onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange(callback)
  }
}