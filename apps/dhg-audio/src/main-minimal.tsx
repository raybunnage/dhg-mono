import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// Absolute minimal app - no custom imports
function MinimalApp() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>DHG Audio - Minimal Test</h1>
      <p>If you can see this, the basic React app works!</p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MinimalApp />
  </React.StrictMode>,
);