import React, { useEffect, useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import type { Database } from '../types/supabase';

type ExtractedDocument = {
  id: string;
  name: string;
  content: string;
  mimeType: string;
  extractedAt: string;
  status: string;
};

export default function ExtractedContentViewer() {
  const [documents, setDocuments] = useState<ExtractedDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<ExtractedDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadExtractedDocuments();
  }, []);

  const loadExtractedDocuments = async () => {
    try {
      // First get all expert_documents
      const { data: docs, error } = await supabase
        .from('expert_documents')
        .select(`
          id,
          raw_content,
          processing_status,
          updated_at,
          source_id,
          source:sources_google!expert_documents_source_id_fkey (
            id,
            name,
            mime_type,
            drive_id,
            content_extracted,
            extracted_content,
            extraction_error
          )
        `)
        .not('source_id', 'is', null)  // Must have a source document
        .order('id');

      if (error) throw error;

      // Debug log to see all documents and their status
      console.log('Expert Documents Status:', {
        totalFound: docs.length,
        documents: docs.map(d => ({
          id: d.id,
          sourceId: d.source_id,
          sourceName: d.source?.name,
          driveId: d.source?.drive_id,
          hasRawContent: !!d.raw_content,
          hasExtractedContent: !!d.source?.extracted_content,
          status: d.processing_status,
          error: d.source?.extraction_error
        }))
      });

      // Filter to show any document that has content in either place
      const extractedDocs = docs
        .filter(doc => doc.source?.name)  // Must have a source name
        .map(doc => ({
          id: doc.id,
          name: doc.source?.name || 'Unnamed Document',
          content: doc.raw_content || doc.source?.extracted_content || '',
          mimeType: doc.source?.mime_type || '',
          extractedAt: doc.updated_at,
          status: doc.processing_status || 'unknown'
        }));

      console.log('Content Status:', {
        total: extractedDocs.length,
        withContent: extractedDocs.filter(d => d.content).length,
        docs: extractedDocs.map(d => ({
          name: d.name,
          hasContent: !!d.content,
          contentLength: d.content?.length || 0,
          status: d.status
        }))
      });

      setDocuments(extractedDocs);
      if (extractedDocs.length > 0) {
        setSelectedDoc(extractedDocs[0]);
      }
    } catch (error) {
      console.error('Error loading expert documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="text-gray-600">Loading extracted documents...</div>;
  }

  if (documents.length === 0) {
    return <div className="text-gray-600">No extracted documents found.</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Extracted Documents ({documents.length})</h2>
      
      <div className="flex gap-6">
        {/* Document List */}
        <div className="w-1/3">
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b">
              <h3 className="font-medium">Document List</h3>
            </div>
            <div className="divide-y max-h-96 overflow-y-auto">
              {documents.map(doc => (
                <button
                  key={doc.id}
                  onClick={() => setSelectedDoc(doc)}
                  className={`w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors ${
                    selectedDoc?.id === doc.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="font-medium truncate">{doc.name}</div>
                  <div className="text-sm text-gray-500">
                    Extracted: {new Date(doc.extractedAt).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Viewer */}
        <div className="w-2/3">
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b">
              <h3 className="font-medium">
                {selectedDoc ? selectedDoc.name : 'Select a document'}
              </h3>
            </div>
            <div className="p-4">
              {selectedDoc ? (
                <pre className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                  {selectedDoc.content}
                </pre>
              ) : (
                <div className="text-gray-500">Select a document to view its content</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 