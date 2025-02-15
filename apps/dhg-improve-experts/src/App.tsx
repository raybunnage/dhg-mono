import { BrowserRouter as Router, Routes, Route, UNSAFE_DataRouterContext } from "react-router-dom";
import ExpertProfiles from "@/pages/ExpertProfiles";
import { Toaster } from 'react-hot-toast';
import DocumentTestingPage from './pages/document-testing';
import ExpertProfilerPage from './pages/expert-profiler';

function App() {
  console.log('App component mounting');
  console.log('Available routes:', [
    '/',
    '/experts',
    '/document-testing',
    '/experts/profiler'
  ]);
  
  return (
    <Router future={{ v7_startTransition: true }}>
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
      </Routes>
    </Router>
  );
}

export default App;