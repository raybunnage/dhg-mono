import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Page imports
import ExpertProfiles from "@/pages/ExpertProfiles";
import ExpertsDashboard from "@/pages/ExpertsDashboard";
import CodeDashboard from "@/pages/Code";
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
import SupabaseAdmin from './pages/SupabaseAdmin'
import { FileTree } from './pages/FileTree';
import { BatchProcessingMonitor } from './components/BatchProcessingMonitor';
import Viewer from '@/pages/Viewer';
import Dashboard from '@/pages/Dashboard';
// import Docs from '@/pages/Docs'; // Archived on 2025-03-04
import Sync from '@/pages/Sync';
import Write from '@/pages/Write';
import Show from '@/pages/Show';
import AI from '@/pages/AI';
import Cmds from '@/pages/Cmds';
import { GoogleAuthCallback } from './components/GoogleAuthCallback';
import GutsExample from '@/pages/GutsExample';
import DocsExplorer from '@/pages/DocsExplorer';
import Gmail from '@/pages/Gmail';
// import DocumentationTest from '@/pages/DocumentationTest'; // Archived on 2025-03-04

// Component imports
import { MainNavbar } from '@/components/MainNavbar'; 
import { RegistryViewer } from '@/components/RegistryViewer';

function TestComponent() {
  const [authStatus, setAuthStatus] = useState<string>('Checking auth...');

  useEffect(() => {
    async function init() {
      try {
        if (import.meta.env.VITE_TEST_USER_EMAIL && import.meta.env.VITE_TEST_USER_PASSWORD) {
          // Test Supabase connection only if credentials exist
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: import.meta.env.VITE_TEST_USER_EMAIL,
            password: import.meta.env.VITE_TEST_USER_PASSWORD
          });
          
          if (!authError) {
            // Only run this query if auth succeeded
            const { data, error } = await supabase
              .from('experts')
              .select('count');
            if (!error) {
              console.log('Supabase test:', { data });
            }
          }
        }
      } catch (err) {
        // Silent fail - don't block app startup
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
      <MainNavbar />
      <TestComponent />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/viewer" element={<Viewer />} />
        <Route path="/sync" element={<Sync />} />
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
        <Route path="/transcribe" element={<Transcribe />} />
        <Route path="/supabase" element={<SupabaseAdmin />} />
        <Route path="/supabase/legacy" element={<SupabasePage />} />
        <Route path="/supabase/explorer" element={<SupabasePage />} />
        <Route path="/file-tree" element={<FileTree />} />
        <Route path="/batches" element={<BatchProcessingMonitor />} />
        <Route path="/auth/google/callback" element={<GoogleAuthCallback />} />
        <Route path="/experts" element={<ExpertsDashboard />} />
        <Route path="/code" element={<CodeDashboard />} />
        <Route path="/write" element={<Write />} />
        <Route path="/analyze" element={<Analyze />} />
        <Route path="/docs" element={<DocsExplorer />} />
        {/* <Route path="/docs-explorer" element={<DocsExplorer />} /> <!-- Replaced by /docs route --> */}
        {/* <Route path="/documentation-test" element={<DocumentationTest />} /> <!-- Archived on 2025-03-04 --> */}
        <Route path="/show" element={<Show />} />
        <Route path="/ai" element={<AI />} />
        <Route path="/cmds" element={<Cmds />} />
        <Route path="/registry" element={<RegistryViewer />} />
        <Route path="/guts-example" element={<GutsExample />} />
        <Route path="/gmail" element={<Gmail />} />
      </Routes>
    </QueryClientProvider>
  );
}

export default App;