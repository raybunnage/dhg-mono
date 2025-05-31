import React, { useState } from 'react';
import { DocumentList } from '../components/documents/DocumentList';
import type { DocumentFilters } from '../components/documents/DocumentList';
import { MarkdownViewer } from '../components/documents/MarkdownViewer';
import { useSupabase } from '../hooks/useSupabase';
import { DashboardLayout } from '../components/DashboardLayout';
import { FileText, Folder, Clock, Star, Filter, RefreshCw, Plus } from 'lucide-react';

// Define types locally until we have proper type imports
interface DocFile {
  id: string;
  file_path: string;
  title: string;
  file_hash?: string | null;
  file_size?: number | null;
  language?: string | null;
  document_type_id?: string | null;
  is_deleted?: boolean | null;
  created_at: string;
  updated_at: string;
  last_modified_at?: string | null;
  last_synced_at?: string | null;
  auto_update_enabled?: boolean | null;
  update_frequency?: string | null;
  update_source?: string | null;
  importance_score?: number | null;
  view_count?: number | null;
  tags?: string[] | null;
}

export const DocumentsPage: React.FC = () => {
  const { supabase } = useSupabase();
  const [selectedDocument, setSelectedDocument] = useState<DocFile | null>(null);
  const [groupBy, setGroupBy] = useState<'folder' | 'type' | 'recent' | 'important'>('recent');
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<DocumentFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleDocumentSelect = async (doc: DocFile) => {
    setSelectedDocument(doc);
    
    // TODO: Increment view count when function is available
    // await supabase.rpc('increment_doc_view_count', { doc_id: doc.id });
  };

  const handleSync = async () => {
    setSyncing(true);
    
    try {
      // In a real implementation, this would call your backend API
      const response = await fetch('/api/documents/sync', { method: 'POST' });
      if (response.ok) {
        // Refresh the document list
        window.location.reload();
      }
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleEdit = () => {
    if (selectedDocument) {
      // Copy file path to clipboard for easy opening in any editor
      navigator.clipboard.writeText(selectedDocument.file_path);
      alert(`File path copied to clipboard:\n${selectedDocument.file_path}`);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-12rem)] bg-gray-50 rounded-lg overflow-hidden">
      {/* Left Panel - Document List */}
      <div className="w-1/2 flex flex-col bg-white border-r">
        {/* Header */}
        <div className="p-4 border-b">
          <h1 className="text-2xl font-bold mb-4">Documentation Management</h1>
          
          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {/* Controls */}
          <div className="flex items-center justify-between gap-4">
            {/* Group By */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setGroupBy('recent')}
                className={`flex items-center gap-1 px-3 py-1 rounded ${
                  groupBy === 'recent' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
                }`}
              >
                <Clock className="w-4 h-4" />
                Recent
              </button>
              <button
                onClick={() => setGroupBy('folder')}
                className={`flex items-center gap-1 px-3 py-1 rounded ${
                  groupBy === 'folder' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
                }`}
              >
                <Folder className="w-4 h-4" />
                Folder
              </button>
              <button
                onClick={() => setGroupBy('type')}
                className={`flex items-center gap-1 px-3 py-1 rounded ${
                  groupBy === 'type' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
                }`}
              >
                <FileText className="w-4 h-4" />
                Type
              </button>
              <button
                onClick={() => setGroupBy('important')}
                className={`flex items-center gap-1 px-3 py-1 rounded ${
                  groupBy === 'important' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
                }`}
              >
                <Star className="w-4 h-4" />
                Important
              </button>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-1 px-3 py-1 hover:bg-gray-100 rounded"
              >
                <Filter className="w-4 h-4" />
                Filters
              </button>
              
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-1 px-3 py-1 hover:bg-gray-100 rounded disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                Sync
              </button>
              
              <button
                className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                New
              </button>
            </div>
          </div>
          
          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium mb-2">Filters</h3>
              
              <div className="space-y-2">
                <label className="block">
                  <span className="text-sm text-gray-600">Minimum Importance</span>
                  <select
                    value={filters.importanceScore || ''}
                    onChange={(e) => setFilters({ ...filters, importanceScore: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="mt-1 block w-full rounded border-gray-300"
                  >
                    <option value="">Any</option>
                    <option value="3">3+ Stars</option>
                    <option value="4">4+ Stars</option>
                    <option value="5">5 Stars</option>
                  </select>
                </label>
                
                <label className="block">
                  <span className="text-sm text-gray-600">Folder</span>
                  <input
                    type="text"
                    value={filters.folder || ''}
                    onChange={(e) => setFilters({ ...filters, folder: e.target.value })}
                    placeholder="e.g., docs/technical-specs"
                    className="mt-1 block w-full rounded border-gray-300"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
        
        {/* Document List */}
        <div className="flex-1 overflow-auto p-4">
          <DocumentList
            groupBy={groupBy}
            searchTerm={searchTerm}
            filters={filters}
            onDocumentSelect={handleDocumentSelect}
          />
        </div>
      </div>
      
      {/* Right Panel - Document Viewer */}
      <div className="w-1/2">
        {selectedDocument ? (
          <MarkdownViewer
            document={selectedDocument}
            onClose={() => setSelectedDocument(null)}
            onEdit={handleEdit}
            mode="side"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p>Select a document to view</p>
            </div>
          </div>
        )}
      </div>
      </div>
    </DashboardLayout>
  );
};