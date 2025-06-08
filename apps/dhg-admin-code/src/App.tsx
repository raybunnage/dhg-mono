import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { LoginPage } from './pages/LoginPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { WorkSummaries } from './pages/WorkSummaries';
import { CommandRefactorStatus } from './pages/CommandRefactorStatus';
import { CLICommandsRegistry } from './pages/CLICommandsRegistry';
import { DatabasePage } from './pages/DatabasePage';
import { DocumentsPage } from './pages/DocumentsPage';
// import { HiMomPage } from './pages/HiMomPage'; // Archived
import { ScriptsManagement } from './pages/ScriptsManagement';
import { GitManagement } from './pages/GitManagement';
import { GitBranchManagement } from './pages/GitBranchManagement';
import { ContinuousDocumentsPage } from './pages/ContinuousDocumentsPage';
import TasksPage from './pages/TasksPage';
import CreateTaskPage from './pages/CreateTaskPage';
import TaskDetailPage from './pages/TaskDetailPage';
import ClipboardManager from './pages/ClipboardManager';
import WorktreeMappings from './pages/WorktreeMappings';
import ServiceDependencies from './pages/ServiceDependencies';
import { DeprecationAnalysis } from './pages/DeprecationAnalysis';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route 
          path="/" 
          element={
            <ProtectedRoute requireAdmin>
              <Navigate to="/tasks" replace />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/work-summaries" 
          element={
            <ProtectedRoute requireAdmin>
              <WorkSummaries />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/refactor-status" 
          element={
            <ProtectedRoute requireAdmin>
              <CommandRefactorStatus />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/cli-commands" 
          element={
            <ProtectedRoute requireAdmin>
              <CLICommandsRegistry />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/database" 
          element={
            <ProtectedRoute requireAdmin>
              <DatabasePage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/documents" 
          element={
            <ProtectedRoute requireAdmin>
              <DocumentsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/tasks" 
          element={
            <ProtectedRoute requireAdmin>
              <TasksPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/tasks/new" 
          element={
            <ProtectedRoute requireAdmin>
              <CreateTaskPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/tasks/:id" 
          element={
            <ProtectedRoute requireAdmin>
              <TaskDetailPage />
            </ProtectedRoute>
          } 
        />
        {/* Archived Hi Mom page
        <Route 
          path="/hi-mom" 
          element={
            <ProtectedRoute requireAdmin>
              <HiMomPage />
            </ProtectedRoute>
          } 
        /> */}
        <Route 
          path="/scripts" 
          element={
            <ProtectedRoute requireAdmin>
              <ScriptsManagement />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/git" 
          element={
            <ProtectedRoute requireAdmin>
              <GitManagement />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/git-branches" 
          element={
            <ProtectedRoute requireAdmin>
              <GitBranchManagement />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/continuous-docs" 
          element={
            <ProtectedRoute requireAdmin>
              <ContinuousDocumentsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/clipboard" 
          element={
            <ProtectedRoute requireAdmin>
              <ClipboardManager />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/worktree-mappings" 
          element={
            <ProtectedRoute requireAdmin>
              <WorktreeMappings />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/service-dependencies" 
          element={
            <ProtectedRoute requireAdmin>
              <ServiceDependencies />
            </ProtectedRoute>
          }
        />
        <Route 
          path="/deprecation-analysis" 
          element={
            <ProtectedRoute requireAdmin>
              <DeprecationAnalysis />
            </ProtectedRoute>
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;