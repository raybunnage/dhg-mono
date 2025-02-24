import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Page imports
import ExpertProfiles from "@/pages/ExpertProfiles";
import DocumentTestingPage from './pages/document-testing';
import ExpertProfilerPage from './app/experts/profiler/page';
import SourceButtonsTest from '@/pages/source-buttons-test';
import SourceManagementPage from '@/pages/source-management';
import SourceButtonsPage from '@/pages/source-buttons';
import FunctionRegistryPage from '@/pages/function-registry';
import FileExplorer from '@/pages/file-explorer';
import PDFTestExtract from '@/pages/pdf-test-extract';
import PDFResearchPortal from '@/pages/pdf-research-portal';
import MP4Test from './pages/mp4-test';
import ClassifyDocument from '@/pages/ClassifyDocument';
import { Analyze } from '@/pages/Analyze';
import { Transcribe } from '@/pages/Transcribe';
import { SupabasePage } from './pages/Supabase'

// Component imports
import { MainNavbar } from '@/components/MainNavbar';
import { RegistryViewer } from '@/components/RegistryViewer';

function TestComponent() {
  const [authStatus, setAuthStatus] = useState<string>('Checking auth...');

  useEffect(() => {
    async function init() {
      try {
        // Test Supabase connection
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: import.meta.env.VITE_TEST_USER_EMAIL,
          password: import.meta.env.VITE_TEST_USER_PASSWORD || 'testpassword123'
        });
        if (authError) throw authError;

        // Test a simple Supabase query
        const { data, error } = await supabase
          .from('experts')
          .select('count');
        console.log('Supabase test:', { data, error });

      } catch (err) {
        console.error('Init error:', err);
      }
    }
    init();
  }, []);

  return null;
}

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" />
      <BrowserRouter>
        <MainNavbar />
        <TestComponent />
        <Routes>
          <Route path="/" element={<ExpertProfiles />} />
          <Route path="/registry" element={<RegistryViewer />} />
          <Route path="/document-testing" element={<DocumentTestingPage />} />
          <Route path="/expert-profiler" element={<ExpertProfilerPage />} />
          <Route path="/source-buttons-test" element={<SourceButtonsTest />} />
          <Route path="/source-management" element={<SourceManagementPage />} />
          <Route path="/source-buttons" element={<SourceButtonsPage />} />
          <Route path="/function-registry" element={<FunctionRegistryPage />} />
          <Route path="/file-explorer" element={<FileExplorer />} />
          <Route path="/pdf-test-extract" element={<PDFTestExtract />} />
          <Route path="/pdf-research-portal" element={<PDFResearchPortal />} />
          <Route path="/mp4-test" element={<MP4Test />} />
          <Route path="/classify" element={<ClassifyDocument />} />
          <Route path="/analyze" element={<Analyze />} />
          <Route path="/transcribe" element={<Transcribe />} />
          <Route path="/supabase" element={<SupabasePage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;