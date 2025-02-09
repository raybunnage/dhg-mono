import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { UserSession } from '@/types/supabase'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/components/ui/use-toast'

export const useAuth = () => {
  const [session, setSession] = useState<UserSession>({ user: null, session: null })
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setSession({
          user: session?.user ? {
            id: session.user.id,
            email: session.user.email
          } : null,
          session: session
        })
      } catch (error: any) {
        console.error('Error getting session:', error)
        // If there's an error getting the session, clear it
        setSession({ user: null, session: null })
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event)
      
      if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed successfully')
      }

      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        // Clear the session immediately on sign out or user deletion
        setSession({ user: null, session: null })
        navigate('/auth')
        return
      }

      setSession({
        user: session?.user ? {
          id: session.user.id,
          email: session.user.email
        } : null,
        session: session
      })
      setLoading(false)

      // Handle specific auth events
      switch (event) {
        case 'SIGNED_IN':
          toast({
            title: "Welcome back!",
            description: "You have successfully signed in.",
          })
          navigate('/')
          break
        case 'SIGNED_OUT':
          toast({
            title: "Signed out",
            description: "You have been signed out successfully.",
          })
          navigate('/auth')
          break
        case 'USER_UPDATED':
          toast({
            title: "Profile updated",
            description: "Your profile has been updated successfully.",
          })
          break
        case 'PASSWORD_RECOVERY':
          toast({
            title: "Password recovery",
            description: "Please check your email for password reset instructions.",
          })
          break
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [navigate, toast])

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (error: any) {
      console.error('Error signing out:', error)
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  return {
    session,
    loading,
    isAuthenticated: !!session.user,
    signOut,
  }
}