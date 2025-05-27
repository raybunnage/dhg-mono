import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;