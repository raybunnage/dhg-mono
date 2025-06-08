import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Components
import { MainNavbar } from '@/components/MainNavbar';
import { DebugMenu } from '@/pages/DebugMenu';

// Pages
import { Home } from '@/pages/Home';
import { Easy } from '@/pages/Easy';
import { HomeMinimal } from '@/pages/HomeMinimal';
import { SuperMinimal } from '@/pages/SuperMinimal';
import { NetworkTest } from '@/pages/NetworkTest';
import { HookTest } from '@/pages/HookTest';
import { ReactQueryTest } from '@/pages/ReactQueryTest';

const queryClient = new QueryClient();

let appRenderCount = 0;

function App() {
  appRenderCount++;
  console.log(`🏠 APP COMPONENT RENDER #${appRenderCount} at ${new Date().toLocaleTimeString()}`);
  
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" />
      <MainNavbar />
      <DebugMenu />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/easy" element={<Easy />} />
        <Route path="/test" element={<HomeMinimal />} />
        <Route path="/super" element={<SuperMinimal />} />
        <Route path="/network" element={<NetworkTest />} />
        <Route path="/hooks" element={<HookTest />} />
        <Route path="/query" element={<ReactQueryTest />} />
      </Routes>
    </QueryClientProvider>
  );
}

export default App;