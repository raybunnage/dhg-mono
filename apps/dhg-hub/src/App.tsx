import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Components
import { MainNavbar } from '@/components/MainNavbar';

// Pages
import { Home } from '@/pages/Home';
import { Easy } from '@/pages/Easy';
import { HomeMinimal } from '@/pages/HomeMinimal';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" />
      <MainNavbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/easy" element={<Easy />} />
        <Route path="/test" element={<HomeMinimal />} />
      </Routes>
    </QueryClientProvider>
  );
}

export default App;