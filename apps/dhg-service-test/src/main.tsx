import React from 'react'
import ReactDOM from 'react-dom/client'
// import App from './App.tsx'
import App from './App-minimal.tsx'
import './index.css'

// Import auth initialization (this runs immediately)
// import './lib/auth-init'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)