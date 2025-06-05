import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './hooks/useAuth';

// Pages
import { Dashboard } from './pages/Dashboard';
import { GoogleDashboard } from './pages/GoogleDashboard';
import { Login } from './pages/Login';
import Viewer from './pages/Viewer';
import { SyncStatus } from './pages/SyncStatus';
import { Statistics } from './pages/Statistics';
import { Filters } from './pages/Filters';
import SyncHistory from './pages/SyncHistory';
import { ClassifyDocument } from './pages/ClassifyDocument';

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isLoading } = useAuth();

  console.log('ProtectedRoute - isLoading:', isLoading, 'user:', user?.email, 'isAdmin:', isAdmin);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-purple-50 flex items-center justify-center">
        <div className="text-purple-700">Loading...</div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    console.log('ProtectedRoute - Redirecting to login. User:', user?.email, 'isAdmin:', isAdmin);
    return <Navigate to="/login" replace />;
  }

  console.log('ProtectedRoute - Access granted');
  return <>{children}</>;
}

function App() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-purple-50 flex items-center justify-center">
        <div className="text-purple-700">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" />
      <div className="min-h-screen bg-purple-50">
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/" element={
            <ProtectedRoute>
              <GoogleDashboard />
            </ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <GoogleDashboard />
            </ProtectedRoute>
          } />
          <Route path="/explorer" element={
            <ProtectedRoute>
              <Viewer />
            </ProtectedRoute>
          } />
          <Route path="/sync-status" element={
            <ProtectedRoute>
              <SyncStatus />
            </ProtectedRoute>
          } />
          <Route path="/statistics" element={
            <ProtectedRoute>
              <Statistics />
            </ProtectedRoute>
          } />
          <Route path="/filters" element={
            <ProtectedRoute>
              <Filters />
            </ProtectedRoute>
          } />
          <Route path="/sync-history" element={
            <ProtectedRoute>
              <SyncHistory />
            </ProtectedRoute>
          } />
          <Route path="/classify" element={
            <ProtectedRoute>
              <ClassifyDocument />
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </>
  );
}

export default App;