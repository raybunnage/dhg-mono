import React, { useState, useEffect } from 'react';
import { DocumentList } from '../components/documents/DocumentList';
import type { DocumentFilters } from '../components/documents/DocumentList';
import { MarkdownViewer } from '../components/documents/MarkdownViewer';
import { useSupabase } from '../hooks/useSupabase';
import { DashboardLayout } from '../components/DashboardLayout';
import { FileText, Folder, Clock, Star, Filter, RefreshCw, Plus, Wrench } from 'lucide-react';
import { MaintenancePanel, type MaintenanceStats, type MaintenanceAction } from '../components/MaintenancePanel';

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
  const [showMaintenance, setShowMaintenance] = useState(false);
  const [documents, setDocuments] = useState<DocFile[]>([]);
  const [maintenanceStats, setMaintenanceStats] = useState<MaintenanceStats>({
    totalItems: 0,
    lastUsed30Days: 0,
    lastUsed90Days: 0,
    neverUsed: 0,
    duplicates: 0,
    outdated: 0,
    oversized: 0,
    archived: 0
  });

  // Fetch documents for maintenance stats
  useEffect(() => {
    const fetchDocuments = async () => {
      const { data, error } = await supabase
        .from('doc_files')
        .select('*')
        .order('last_modified_at', { ascending: false });
      
      if (!error && data) {
        setDocuments(data);
        calculateMaintenanceStats(data);
      }
    };
    
    fetchDocuments();
  }, [supabase]);

  // Calculate maintenance statistics
  const calculateMaintenanceStats = (docs: DocFile[]) => {
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = now - (90 * 24 * 60 * 60 * 1000);
    
    const stats: MaintenanceStats = {
      totalItems: docs.length,
      lastUsed30Days: 0,
      lastUsed90Days: 0,
      neverUsed: 0,
      duplicates: 0,
      outdated: 0,
      oversized: 0,
      archived: docs.filter(d => d.is_deleted).length
    };
    
    // Track duplicate titles
    const titleCounts = new Map<string, number>();
    
    docs.forEach(doc => {
      const lastModified = new Date(doc.last_modified_at || doc.created_at).getTime();
      
      if (lastModified > thirtyDaysAgo) {
        stats.lastUsed30Days++;
      } else if (lastModified > ninetyDaysAgo) {
        stats.lastUsed90Days++;
      }
      
      if (!doc.view_count || doc.view_count === 0) {
        stats.neverUsed++;
      }
      
      // Check for duplicates by title
      const title = doc.title.toLowerCase();
      titleCounts.set(title, (titleCounts.get(title) || 0) + 1);
      
      // Check if outdated (not modified in 180 days)
      if (lastModified < now - (180 * 24 * 60 * 60 * 1000)) {
        stats.outdated++;
      }
      
      // Check if oversized (> 100KB)
      if (doc.file_size && doc.file_size > 100000) {
        stats.oversized++;
      }
    });
    
    // Count duplicates
    stats.duplicates = Array.from(titleCounts.values()).filter(count => count > 1).length;
    
    setMaintenanceStats(stats);
  };

  // Run maintenance analysis
  const runMaintenanceAnalysis = async (): Promise<MaintenanceAction[]> => {
    const actions: MaintenanceAction[] = [];
    
    documents.forEach(doc => {
      const lastModified = new Date(doc.last_modified_at || doc.created_at);
      const daysSince = (Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24);
      
      // Suggest archiving old, unviewed documents
      if (daysSince > 90 && (!doc.view_count || doc.view_count === 0) && !doc.is_deleted) {
        actions.push({
          id: `archive-${doc.id}`,
          type: 'archive',
          itemId: doc.id,
          itemPath: doc.file_path,
          reason: `Not viewed and not modified in ${Math.round(daysSince)} days`,
          confidence: daysSince > 180 ? 0.9 : 0.7
        });
      }
      
      // Suggest deduplication for documents with same title
      const similarDocs = documents.filter(d => 
        d.id !== doc.id && 
        d.title.toLowerCase() === doc.title.toLowerCase()
      );
      
      if (similarDocs.length > 0) {
        actions.push({
          id: `dedupe-${doc.id}`,
          type: 'deduplicate',
          itemId: doc.id,
          itemPath: doc.file_path,
          reason: `Found ${similarDocs.length} document(s) with same title`,
          confidence: 0.8,
          relatedItems: similarDocs.map(d => d.id)
        });
      }
      
      // Suggest review for oversized documents
      if (doc.file_size && doc.file_size > 100000) {
        actions.push({
          id: `review-${doc.id}`,
          type: 'review',
          itemId: doc.id,
          itemPath: doc.file_path,
          reason: `Document is ${Math.round(doc.file_size / 1024)}KB - consider splitting or optimizing`,
          confidence: 0.6
        });
      }
    });
    
    return actions;
  };

  // Execute maintenance actions
  const executeMaintenanceActions = async (actions: MaintenanceAction[]) => {
    console.log('Executing maintenance actions:', actions);
    
    for (const action of actions) {
      if (action.type === 'archive') {
        // Mark document as deleted
        await supabase
          .from('doc_files')
          .update({ is_deleted: true })
          .eq('id', action.itemId);
      }
      // Add other action types as needed
    }
    
    // Refresh documents
    const { data } = await supabase
      .from('doc_files')
      .select('*')
      .order('last_modified_at', { ascending: false });
    
    if (data) {
      setDocuments(data);
      calculateMaintenanceStats(data);
    }
  };

  const handleDocumentSelect = async (doc: DocFile) => {
    setSelectedDocument(doc);
    
    // TODO: Increment view count when function is available
    // await supabase.rpc('increment_doc_view_count', { doc_id: doc.id });
  };

  const handleSync = async () => {
    // Show instructions for running the sync command
    const message = `To sync documents, run one of these commands from the project root:

Option 1 (recommended):
./scripts/cli-pipeline/document/doc-cli.sh sync-docs

Option 2:
./scripts/cli-pipeline/document/sync-markdown-files.sh

This will:
- Scan the repository for markdown files
- Add new files to the database
- Mark deleted files as is_deleted = true
- Update file metadata and hashes`;
    
    alert(message);
    
    // Copy the command to clipboard for convenience
    try {
      await navigator.clipboard.writeText('./scripts/cli-pipeline/document/doc-cli.sh sync-docs');
      console.log('Command copied to clipboard');
    } catch (err) {
      console.error('Failed to copy command:', err);
    }
  };

  const handleEdit = () => {
    if (selectedDocument) {
      // Copy file path to clipboard for easy opening in any editor
      navigator.clipboard.writeText(selectedDocument.file_path);
      alert(`File path copied to clipboard:\n${selectedDocument.file_path}`);
    }
  };

  const handleFindNew = async () => {
    // Show instructions for finding new files
    const message = `To find and add new markdown files, run this command from the project root:

./scripts/cli-pipeline/document/doc-cli.sh find-new

Or to find new files in a specific directory:
./scripts/cli-pipeline/document/doc-cli.sh find-new --dir docs

This will:
- Scan for markdown files not in the database
- Add them to the doc_files table
- Display a list of newly added files`;
    
    alert(message);
    
    // Copy the command to clipboard for convenience
    try {
      await navigator.clipboard.writeText('./scripts/cli-pipeline/document/doc-cli.sh find-new');
      console.log('Command copied to clipboard');
    } catch (err) {
      console.error('Failed to copy command:', err);
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
                className="flex items-center gap-1 px-3 py-1 hover:bg-gray-100 rounded"
                title="Show sync command instructions"
              >
                <RefreshCw className="w-4 h-4" />
                Sync
              </button>
              
              <button
                onClick={handleFindNew}
                className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                title="Find and add new markdown files"
              >
                <Plus className="w-4 h-4" />
                New
              </button>
              
              <button
                onClick={() => setShowMaintenance(!showMaintenance)}
                className={`flex items-center gap-1 px-3 py-1 rounded ${
                  showMaintenance ? 'bg-orange-100 text-orange-700' : 'hover:bg-gray-100'
                }`}
                title="Document maintenance tools"
              >
                <Wrench className="w-4 h-4" />
                Maintenance
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
      
      {/* Maintenance Panel */}
      {showMaintenance && (
        <MaintenancePanel
          isOpen={showMaintenance}
          onClose={() => setShowMaintenance(false)}
          stats={maintenanceStats}
          onRunAnalysis={runMaintenanceAnalysis}
          onExecuteActions={executeMaintenanceActions}
          itemType="document"
        />
      )}
      </div>
    </DashboardLayout>
  );
};