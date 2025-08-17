'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth'
import { AuthService } from '@/lib/auth'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { initializeAuth, setUser, setSession } = useAuthStore()

  useEffect(() => {
    // Initialize auth on app load
    initializeAuth()

    // Listen for auth state changes
    const { data: { subscription } } = AuthService.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await AuthService.getUserProfile(session.user.id)
        setUser(profile)
        setSession(session)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setSession(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [initializeAuth, setUser, setSession])

  return <>{children}</>
}