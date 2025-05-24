import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components';
import { HomePage, AudioDetailPage, AboutPage } from '@/pages';
import Login from '@/pages/Login';
import { useAuth } from '@/hooks/useAuth';
import { ProtectedRoute } from '@dhg/shared-components';
import { Toaster } from 'sonner';

function App() {
  const { user, loading } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        {/* Public route for login */}
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        
        {/* Protected routes */}
        <Route path="/" element={
          <ProtectedRoute isAuthenticated={!!user} isLoading={loading} redirectTo="/login">
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<HomePage />} />
          <Route path="audio/:id" element={<AudioDetailPage />} />
          <Route path="about" element={<AboutPage />} />
        </Route>
      </Routes>
      <Toaster position="top-right" richColors />
    </BrowserRouter>
  );
}

export default App;