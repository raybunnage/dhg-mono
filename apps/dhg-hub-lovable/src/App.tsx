import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Index from "@/pages/Index";
import NotFound from "@/pages/NotFound";
import Auth from "@/pages/Auth";
import Experts from "@/pages/Experts";
import DocumentTypes from "@/pages/DocumentTypes";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Header from './components/Header'
import EnvironmentBadge from './components/EnvironmentBadge'

function App() {
  return (
    <Router>
      <div className="fixed top-4 right-4 z-50">
        <EnvironmentBadge />
      </div>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Index />
            </ProtectedRoute>
          }
        />
        <Route
          path="/experts"
          element={
            <ProtectedRoute>
              <Experts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/document-types"
          element={
            <ProtectedRoute>
              <DocumentTypes />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;