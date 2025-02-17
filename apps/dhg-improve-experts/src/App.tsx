import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ExpertProfiles from "@/pages/ExpertProfiles";
import { Toaster } from 'react-hot-toast';
import DocumentTestingPage from './pages/document-testing';
import ExpertProfilerPage from './app/experts/profiler/page';
import { TestPdfViewer } from '@/components/TestPdfViewer';
import SourceButtonsTest from '@/pages/source-buttons-test';

function App() {
  console.log('App component mounting');
  console.log('Available routes:', [
    '/',
    '/experts',
    '/document-testing',
    '/experts/profiler',
    '/test-pdf',
    '/source-buttons-test'
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
      </Routes>
    </BrowserRouter>
  );
}

export default App;