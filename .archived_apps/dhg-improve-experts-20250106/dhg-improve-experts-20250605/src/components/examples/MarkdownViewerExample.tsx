import React, { useState, useEffect } from 'react';
import MarkdownViewer from '@/components/MarkdownViewer';
import { supabase } from '@/integrations/supabase/client';

interface MarkdownViewerExampleProps {
  documentId?: string;
  title?: string;
}

/**
 * Example component showing how to use the MarkdownViewer
 * 
 * This can be included in any page to add markdown file viewing capabilities.
 * 
 * @example
 * // With a specific document ID
 * <MarkdownViewerExample documentId="12345" />
 * 
 * // With automatic document selection (shows document picker)
 * <MarkdownViewerExample title="Documentation Viewer" />
 */
function MarkdownViewerExample({ documentId, title = 'Markdown Viewer Example' }: MarkdownViewerExampleProps) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | undefined>(documentId);
  const [loading, setLoading] = useState(false);

  // Fetch available documents
  useEffect(() => {
    if (!documentId) {
      fetchDocuments();
    }
  }, [documentId]);

  // Fetch documents from the database
  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('documentation_files')
        .select('id, title, file_path, summary')
        .order('title', { ascending: true })
        .limit(100);

      if (error) throw error;
      setDocuments(data || []);
      
      // Auto-select the first document if none provided
      if (!selectedDocumentId && data && data.length > 0) {
        setSelectedDocumentId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="markdown-viewer-example">
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      
      {/* Document selector (only shown when no documentId is provided) */}
      {!documentId && documents.length > 0 && (
        <div className="mb-4">
          <label htmlFor="document-select" className="block text-sm font-medium text-gray-700 mb-1">
            Select Document:
          </label>
          <select
            id="document-select"
            value={selectedDocumentId || ''}
            onChange={(e) => setSelectedDocumentId(e.target.value)}
            className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">-- Select a document --</option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.title || doc.file_path.split('/').pop()}
              </option>
            ))}
          </select>
        </div>
      )}
      
      {/* Markdown Viewer Component */}
      <div className="bg-gray-800 shadow rounded-lg p-4">
        {selectedDocumentId ? (
          <MarkdownViewer documentId={selectedDocumentId} />
        ) : (
          <div className="p-4 text-gray-300 text-center bg-gray-900 rounded">
            {loading ? 'Loading documents...' : 'Select a document to view'}
          </div>
        )}
      </div>
    </div>
  );
}

export default MarkdownViewerExample;