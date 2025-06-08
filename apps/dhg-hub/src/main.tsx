import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// Check if we should disable StrictMode for debugging
const shouldUseStrictMode = !window.location.search.includes('no-strict');

console.log(`🔧 STRICT MODE: ${shouldUseStrictMode ? 'ENABLED' : 'DISABLED'}`);
console.log('🔧 Add ?no-strict to URL to disable StrictMode for debugging');

const AppWrapper = () => (
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  shouldUseStrictMode ? (
    <React.StrictMode>
      <AppWrapper />
    </React.StrictMode>
  ) : (
    <AppWrapper />
  )
)