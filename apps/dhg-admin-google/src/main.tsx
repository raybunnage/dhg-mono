import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// Initialize browser auth service
import { browserAuthService } from '../../../packages/shared/services/auth-service/browser-auth-service'
import { getSupabaseClient } from './utils/supabase-adapter'
import { AuthProvider } from './hooks/useAuth'

// Initialize the auth service with the Supabase client
try {
  const supabaseClient = getSupabaseClient();
  // @ts-ignore - Type mismatch between Database types
  browserAuthService.initialize(supabaseClient);
  console.log('Browser auth service initialized successfully');
} catch (error) {
  console.error('Failed to initialize browser auth service:', error);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)