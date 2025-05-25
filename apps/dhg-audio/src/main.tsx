import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { ensureSupabaseInitialized } from './services/supabase-init';

const rootElement = document.getElementById('root');

if (rootElement) {
  // Initialize Supabase before rendering the app
  ensureSupabaseInitialized()
    .then(() => {
      ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </React.StrictMode>,
      );
    })
    .catch((error) => {
      console.error('Failed to initialize app:', error);
      // Render error message
      ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
          <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
              <h1 className="text-xl font-semibold text-red-600 mb-2">
                Configuration Error
              </h1>
              <p className="text-gray-700 mb-4">
                {error.message || 'Failed to initialize the application'}
              </p>
              <p className="text-sm text-gray-600">
                Please ensure your environment is properly configured and try refreshing the page.
              </p>
            </div>
          </div>
        </React.StrictMode>,
      );
    });
} else {
  console.error('Could not find root element!');
}