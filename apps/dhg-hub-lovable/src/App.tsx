import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Index from "@/pages/Index";
import NotFound from "@/pages/NotFound";
import Experts from "@/pages/Experts";
import DocumentTypes from "@/pages/DocumentTypes";
import Header from './components/Header'
import EnvironmentBadge from './components/EnvironmentBadge'

function App() {
  return (
    <Router>
      <div className="fixed top-4 right-4 z-50">
        <EnvironmentBadge />
      </div>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/experts" element={<Experts />} />
        <Route path="/document-types" element={<DocumentTypes />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;