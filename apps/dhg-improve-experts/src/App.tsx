import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ExpertProfiles from "@/pages/ExpertProfiles";
import { Toaster } from 'react-hot-toast';
import DocumentTestingPage from './pages/document-testing';
import ExpertProfilerPage from './app/experts/profiler/page';
import { TestPdfViewer } from '@/components/TestPdfViewer';
import SourceButtonsTest from '@/pages/source-buttons-test';
import SourceManagementPage from '@/pages/source-management';
import SourceButtonsPage from '@/pages/source-buttons';
import FunctionRegistryPage from '@/pages/function-registry';
import FileExplorer from '@/pages/file-explorer';

function App() {
  console.log('App component mounting');
  console.log('Available routes:', [
    '/',
    '/experts',
    '/document-testing',
    '/experts/profiler',
    '/test-pdf',
    '/source-buttons-test',
    '/source-management',
    '/source-buttons',
    '/function-registry',
    '/file-explorer'
  ]);
  
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
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
          path="/test-pdf" 
          element={<TestPdfViewer />}
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
          path="/function-registry" 
          element={<FunctionRegistryPage />} 
        />
        <Route 
          path="/file-explorer" 
          element={<FileExplorer />} 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;