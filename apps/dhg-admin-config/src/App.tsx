import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { WorkSummaries } from './pages/WorkSummaries';
import { CommandRefactorStatus } from './pages/CommandRefactorStatus';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    console.log('=== App component mounted ===');
    console.log('Routes setup complete');
  }, []);

  console.log('=== App component rendering ===');

  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route 
          path="/" 
          element={
            <ProtectedRoute requireAdmin>
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/work-summaries" 
          element={
            <ProtectedRoute requireAdmin>
              <WorkSummaries />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/refactor-status" 
          element={
            <ProtectedRoute requireAdmin>
              <CommandRefactorStatus />
            </ProtectedRoute>
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;