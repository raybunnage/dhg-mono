import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Components
import { MainNavbar } from '@/components/MainNavbar';

// Pages
import { Home } from '@/pages/Home';
import { Easy } from '@/pages/Easy';
import { HomeMinimal } from '@/pages/HomeMinimal';
import { SuperMinimal } from '@/pages/SuperMinimal';

const queryClient = new QueryClient();

let appRenderCount = 0;

function App() {
  appRenderCount++;
  console.log(`🏠 APP COMPONENT RENDER #${appRenderCount} at ${new Date().toLocaleTimeString()}`);
  
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" />
      <MainNavbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/easy" element={<Easy />} />
        <Route path="/test" element={<HomeMinimal />} />
        <Route path="/super" element={<SuperMinimal />} />
      </Routes>
    </QueryClientProvider>
  );
}

export default App;