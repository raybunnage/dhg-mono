import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ExpertProfiles from "@/pages/ExpertProfiles";
import { Toaster } from 'react-hot-toast';
import DocumentTestingPage from './pages/document-testing';

function App() {
  console.log('App component mounting');  // Debug log
  return (
    <Router>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/" element={<ExpertProfiles />} />
        <Route path="/document-testing" element={<DocumentTestingPage />} />
      </Routes>
    </Router>
  );
}

export default App;