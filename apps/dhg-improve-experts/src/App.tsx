import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ExpertProfiles from "@/pages/ExpertProfiles";
import { Toaster } from 'react-hot-toast';
import DocumentTestingPage from './pages/document-testing';
import ExpertProfilerPage from './app/experts/profiler/page';
import SourceButtonsTest from '@/pages/source-buttons-test';
import SourceManagementPage from '@/pages/source-management';
import SourceButtonsPage from '@/pages/source-buttons';
import FunctionRegistryPage from '@/pages/function-registry';
import FileExplorer from '@/pages/file-explorer';
import { MainNavbar } from '@/components/MainNavbar';
import RegistryViewer from './routes/RegistryViewer';
import PDFTestExtract from '@/pages/pdf-test-extract';
import PDFResearchPortal from '@/pages/pdf-research-portal';
import MP4Test from './pages/mp4-test';

function App() {
  console.log('App component mounting');
  console.log('Available routes:', [
    '/',
    '/experts',
    '/document-testing',
    '/experts/profiler',
    '/source-buttons-test',
    '/source-management',
    '/source-buttons',
    '/function-registry',
    '/file-explorer',
    '/registry',
    '/pdf-test-extract',
    '/pdf-research-portal'
  ]);
  
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <MainNavbar />
      <main className="pt-4">
        <Routes>
          <Route 
            path="/" 
            element={<ExpertProfiles />} 
          />
          <Route 
            path="/experts" 
            element={<ExpertProfiles />} 
          />
          <Route 
            path="/document-testing" 
            element={<DocumentTestingPage />} 
          />
          <Route 
            path="/experts/profiler" 
            element={<ExpertProfilerPage />}
            errorElement={<div>Error loading profiler page</div>} 
          />
          <Route 
            path="/source-buttons-test" 
            element={<SourceButtonsTest />}
          />
          <Route 
            path="/source-management" 
            element={<SourceManagementPage />}
          />
          <Route 
            path="/source-buttons" 
            element={<SourceButtonsPage />}
          />
          <Route 
            path="/file-explorer" 
            element={<FileExplorer />} 
          />
          <Route 
            path="/registry" 
            element={<RegistryViewer />} 
          />
          <Route 
            path="/pdf-test-extract" 
            element={<PDFTestExtract />} 
          />
          <Route 
            path="/mp4-test" 
            element={<MP4Test />} 
          />
          <Route 
            path="/pdf-research-portal" 
            element={<PDFResearchPortal />} 
          />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;