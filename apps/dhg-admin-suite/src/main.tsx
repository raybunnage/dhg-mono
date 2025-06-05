import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

console.log('=== DHG Admin Config: main.tsx loaded ===');
console.log('Root element:', document.getElementById('root'));
console.log('Environment:', {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Set' : 'Not set'
});

try {
  const root = document.getElementById('root');
  if (!root) {
    console.error('Root element not found!');
  } else {
    console.log('Creating React root...');
    createRoot(root).render(
      <StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </StrictMode>,
    );
    console.log('React root created successfully');
  }
} catch (error) {
  console.error('Error creating React app:', error);
}
