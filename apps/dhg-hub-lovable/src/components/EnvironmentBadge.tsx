import { useMemo } from 'react'

export default function EnvironmentBadge() {
  const env = import.meta.env.VITE_APP_ENV || 'development'
  
  const badgeColor = useMemo(() => {
    switch(env) {
      case 'production': return 'bg-green-100 text-green-800 border-green-200'
      case 'development': return 'bg-blue-100 text-blue-800 border-blue-200'
      default: return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    }
  }, [env])

  return (
    <div className={`inline-block px-2 py-1 rounded-md border ${badgeColor}`}>
      {env.toUpperCase()}
    </div>
  )
} 