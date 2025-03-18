import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import SupabaseManager from './SupabaseManager';
import { Button } from "@/components/ui/button";
import { Database, Table2, TableIcon, Code, GitPullRequest, FileJson } from "lucide-react"; 

/**
 * This component demonstrates how to integrate the Supabase Manager 
 * into your application routing.
 */
const SupabaseRoutes: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation header */}
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="container mx-auto py-3 px-4 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Database className="h-5 w-5 text-blue-500" />
            <span className="text-xl font-semibold">Supabase Admin</span>
          </div>
          <nav className="flex gap-4">
            <Link to="/supabase" className="text-gray-600 hover:text-blue-600">
              <Button variant="ghost" size="sm">
                <Database className="h-4 w-4 mr-1" />
                Dashboard
              </Button>
            </Link>
            <Link to="/supabase/tables" className="text-gray-600 hover:text-blue-600">
              <Button variant="ghost" size="sm">
                <Table2 className="h-4 w-4 mr-1" />
                Tables
              </Button>
            </Link>
            <Link to="/supabase/sql" className="text-gray-600 hover:text-blue-600">
              <Button variant="ghost" size="sm">
                <Code className="h-4 w-4 mr-1" />
                SQL
              </Button>
            </Link>
            <Link to="/supabase/migrations" className="text-gray-600 hover:text-blue-600">
              <Button variant="ghost" size="sm">
                <GitPullRequest className="h-4 w-4 mr-1" />
                Migrations
              </Button>
            </Link>
            <Link to="/supabase/types" className="text-gray-600 hover:text-blue-600">
              <Button variant="ghost" size="sm">
                <FileJson className="h-4 w-4 mr-1" />
                Types
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-grow">
        <Routes>
          <Route path="/supabase" element={<SupabaseManager />} />
          <Route path="/supabase/:activeTab" element={<SupabaseManagerWithTab />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 py-4">
        <div className="container mx-auto px-4 text-center text-sm text-gray-500">
          Supabase Database Manager • Documentation available in <Link to="/docs/supabase" className="text-blue-500 hover:underline">Supabase Docs</Link>
        </div>
      </footer>
    </div>
  );
};

/**
 * Wrapper component that passes the active tab parameter from the URL
 * to the SupabaseManager component.
 */
const SupabaseManagerWithTab: React.FC = () => {
  const { activeTab } = useParams<{ activeTab: string }>();
  return <SupabaseManager initialTab={activeTab} />;
};

// Simulating useParams hook for the example
function useParams<T>() {
  // In a real app, this would use React Router's useParams
  return { activeTab: 'overview' } as T;
}

export default SupabaseRoutes;