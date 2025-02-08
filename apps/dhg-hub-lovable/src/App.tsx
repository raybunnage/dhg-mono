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
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-2">Environment</h2>
        <EnvironmentBadge />
      </div>
    </Router>
  );
}

export default App;