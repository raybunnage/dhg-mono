import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';

console.log('[main.tsx] Starting DHG Audio app...');
console.log('[main.tsx] Environment:', {
  NODE_ENV: import.meta.env.MODE,
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? 'Set' : 'Not set',
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Set' : 'Not set'
});

const rootElement = document.getElementById('root');
console.log('[main.tsx] Root element found:', !!rootElement);

if (rootElement) {
  try {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </React.StrictMode>,
    );
    console.log('[main.tsx] React app rendered successfully');
  } catch (error) {
    console.error('[main.tsx] Error rendering React app:', error);
  }
} else {
  console.error('[main.tsx] Could not find root element!');
}