import { Routes, Route } from 'react-router-dom';
import { Layout, LoginPage } from '@/components';
import { HomePage, AudioDetailPage, AboutPage, ProfileSettingsPage, TestProfilePage } from '@/pages';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';

function App() {
  const { user, loading } = useAuth();
  
  useEffect(() => {
    console.log('Auth state:', { user: !!user, loading });
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {!user ? (
        <Route path="*" element={<LoginPage />} />
      ) : (
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="audio/:id" element={<AudioDetailPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="profile" element={<ProfileSettingsPage />} />
          <Route path="test-profile" element={<TestProfilePage />} />
        </Route>
      )}
    </Routes>
  );
}

export default App;