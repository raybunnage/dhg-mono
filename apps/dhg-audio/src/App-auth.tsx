import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components';
import { HomePage, AudioDetailPage, AboutPage } from '@/pages';
import Login from '@/pages/Login';
import { useAuth } from '@/hooks/useAuth';
import { Toaster } from 'sonner';

function App() {
  const { user, loading, needsProfile } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="text-lg">Loading...</div>
    </div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public route for login */}
        <Route path="/login" element={user && !needsProfile ? <Navigate to="/" replace /> : <Login />} />
        
        {/* Protected routes */}
        <Route path="/" element={
          !user || needsProfile ? <Navigate to="/login" replace /> : <Layout />
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