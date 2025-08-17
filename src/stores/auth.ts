import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { AuthService, type AuthUser } from '@/lib/auth'
import type { Session } from '@supabase/supabase-js'

interface AuthState {
  user: AuthUser | null
  session: Session | null
  isAuthenticated: boolean
  isLoading: boolean
  
  // Actions
  signUp: (email: string, password: string, displayName: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<AuthUser>) => Promise<void>
  setUser: (user: AuthUser | null) => void
  setSession: (session: Session | null) => void
  setLoading: (loading: boolean) => void
  initializeAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      isAuthenticated: false,
      isLoading: true,
      
      signUp: async (email: string, password: string, displayName: string) => {
        try {
          set({ isLoading: true })
          const { user, session } = await AuthService.signUp(email, password, displayName)
          
          if (user) {
            const profile = await AuthService.getUserProfile(user.id)
            set({ 
              user: profile, 
              session, 
              isAuthenticated: !!profile,
              isLoading: false 
            })
          }
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },
      
      signIn: async (email: string, password: string) => {
        try {
          set({ isLoading: true })
          const { user, session } = await AuthService.signIn(email, password)
          
          if (user) {
            let profile = await AuthService.getUserProfile(user.id)
            
            // If profile doesn't exist, create a temporary one and try to save it
            if (!profile) {
              console.log('Profile not found after login, creating temporary profile')
              profile = {
                id: user.id,
                email: user.email!,
                displayName: user.user_metadata?.display_name || user.email!.split('@')[0],
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.user_metadata?.display_name || user.email!.split('@')[0])}&background=3b82f6&color=fff`,
                bio: '',
                location: '',
                rating: 0,
                reviewCount: 0,
                isActive: true,
                createdAt: new Date().toISOString()
              }
            }
            
            set({ 
              user: profile, 
              session, 
              isAuthenticated: !!user, // Base on auth user, not profile
              isLoading: false 
            })
          }
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },
      
      signOut: async () => {
        try {
          await AuthService.signOut()
          set({ 
            user: null, 
            session: null, 
            isAuthenticated: false,
            isLoading: false 
          })
        } catch (error) {
          console.error('Sign out error:', error)
        }
      },
      
      updateProfile: async (updates: Partial<AuthUser>) => {
        try {
          const { user } = get()
          if (!user) return
          
          await AuthService.updateUserProfile(user.id, updates)
          set((state) => ({
            user: state.user ? { ...state.user, ...updates } : null
          }))
        } catch (error) {
          console.error('Update profile error:', error)
          throw error
        }
      },
      
      setUser: (user: AuthUser | null) => {
        set({ user, isAuthenticated: !!user })
      },
      
      setSession: (session: Session | null) => {
        set({ session })
      },
      
      setLoading: (isLoading: boolean) => {
        set({ isLoading })
      },
      
      initializeAuth: async () => {
        try {
          set({ isLoading: true })
          
          const session = await AuthService.getCurrentSession()
          
          if (session?.user) {
            let profile = await AuthService.getUserProfile(session.user.id)
            
            // If profile doesn't exist but we have a session, we're still authenticated
            // The profile will be created on demand
            if (!profile && session.user) {
              console.log('User authenticated but profile missing, will create on demand')
              profile = {
                id: session.user.id,
                email: session.user.email!,
                displayName: session.user.user_metadata?.display_name || session.user.email!.split('@')[0],
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(session.user.user_metadata?.display_name || session.user.email!.split('@')[0])}&background=3b82f6&color=fff`,
                bio: '',
                location: '',
                rating: 0,
                reviewCount: 0,
                isActive: true,
                createdAt: new Date().toISOString()
              }
            }
            
            set({ 
              user: profile, 
              session, 
              isAuthenticated: !!session.user, // Base authentication on session, not profile
              isLoading: false 
            })
          } else {
            set({ 
              user: null, 
              session: null, 
              isAuthenticated: false,
              isLoading: false 
            })
          }
        } catch (error) {
          console.error('Initialize auth error:', error)
          set({ 
            user: null, 
            session: null, 
            isAuthenticated: false,
            isLoading: false 
          })
        }
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user,
        isAuthenticated: state.isAuthenticated 
      })
    }
  )
)