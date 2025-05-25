import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from './hooks/useAuth';

// Components
import { MainNavbar } from '@/components/MainNavbar';

// Pages
import { Home } from '@/pages/Home';
import { Easy } from '@/pages/Easy';
import { LoginPage } from '@/pages/LoginPage';

const queryClient = new QueryClient();

// Layout component for authenticated pages
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <>
      <MainNavbar />
      <main>{children}</main>
    </>
  );
};

function App() {
  const { user, loading, needsProfile } = useAuth();

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" />
      <Routes>
        {/* Public route - login page */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* Protected routes */}
        <Route
          path="/"
          element={
            user && !needsProfile ? (
              <Layout>
                <Home />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/easy"
          element={
            user && !needsProfile ? (
              <Layout>
                <Easy />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        
        {/* Catch all - redirect to home or login */}
        <Route
          path="*"
          element={<Navigate to={user && !needsProfile ? "/" : "/login"} replace />}
        />
      </Routes>
    </QueryClientProvider>
  );
}

export default App;