import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Pages
import { Dashboard } from './pages/Dashboard';
import { GoogleDashboard } from './pages/GoogleDashboard';
import Viewer from './pages/Viewer';
import { SyncStatus } from './pages/SyncStatus';
import { Statistics } from './pages/Statistics';
import { Filters } from './pages/Filters';

function App() {
  return (
    <>
      <Toaster position="top-right" />
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<GoogleDashboard />} />
          <Route path="/explorer" element={<Viewer />} />
          <Route path="/sync-status" element={<SyncStatus />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/filters" element={<Filters />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </>
  );
}

export default App;