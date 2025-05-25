import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from './hooks/useAuth';

// Components
import { Layout } from './components/Layout';

// Pages
import { Home } from '@/pages/Home';
import { Easy } from '@/pages/Easy';
import { ProfilePage } from './pages/ProfilePage';
import { AboutPage } from './pages/AboutPage';
import { LoginPage } from '@/pages/LoginPage';

const queryClient = new QueryClient();

function App() {
  const { user, loading } = useAuth();

  // Show loading state
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
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" />
      <Routes>
        {!user ? (
          <Route path="*" element={<LoginPage />} />
        ) : (
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="easy" element={<Easy />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
        )}
      </Routes>
    </QueryClientProvider>
  );
}

export default App;