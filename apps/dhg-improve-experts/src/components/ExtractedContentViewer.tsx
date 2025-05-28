import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ExtractedDocument {
  id: string;
  source: {
    id: string;
    name: string;
    extracted_content?: {
      text: string;
      extractedAt: string;
      source: string;
      version: string;
    };
  };
  raw_content: string | null;
}

export const ExtractedContentViewer = () => {
  const [documents, setDocuments] = useState<ExtractedDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<ExtractedDocument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('google_expert_documents')
        .select(`
          id,
          raw_content,
          source:sources_google!expert_documents_source_id_fkey (
            id,
            name,
            extracted_content
          )
        `)
        .not('raw_content', 'is', null)
        .order('id');

      if (error) throw error;
      setDocuments(data || []);
      if (data?.length > 0) {
        setSelectedDoc(data[0]);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading extracted documents...</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold">Extracted Documents ({documents.length})</h3>
      
      <div className="flex gap-4">
        {/* Document List */}
        <div className="w-1/3 overflow-y-auto max-h-[500px] border rounded p-4">
          <h4 className="font-medium mb-2">Document List</h4>
          <div className="flex flex-col gap-2">
            {documents.map(doc => (
              <button
                key={doc.id}
                onClick={() => setSelectedDoc(doc)}
                className={`text-left p-2 rounded hover:bg-gray-100 ${
                  selectedDoc?.id === doc.id ? 'bg-blue-50 border border-blue-200' : ''
                }`}
              >
                <div className="font-medium">{doc.source?.name}</div>
                <div className="text-sm text-gray-500">
                  Extracted: {doc.source?.extracted_content?.extractedAt 
                    ? new Date(doc.source.extracted_content.extractedAt).toLocaleString()
                    : 'Unknown'
                  }
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Content Viewer */}
        <div className="w-2/3 border rounded p-4">
          <h4 className="font-medium mb-2">
            {selectedDoc ? selectedDoc.source?.name : 'Select a document'}
          </h4>
          {selectedDoc && (
            <div className="space-y-4">
              <div className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded max-h-[400px] overflow-y-auto">
                {selectedDoc.raw_content}
              </div>
              <div className="text-sm text-gray-500">
                Source: {selectedDoc.source?.extracted_content?.source || 'Unknown'} (v
                {selectedDoc.source?.extracted_content?.version || '?'})
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 