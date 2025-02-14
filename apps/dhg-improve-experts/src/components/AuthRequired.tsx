import { useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useNavigate } from 'react-router-dom'

export function AuthRequired({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/login')
      }
    })
  }, [navigate])

  return <>{children}</>
} 