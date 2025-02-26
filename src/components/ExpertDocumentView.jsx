import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

function ExpertDocumentView({ documentId }) {
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    async function fetchDocument() {
      if (!documentId) return;
      
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('expert_documents')
          .select(`
            *,
            experts(name, email),
            document_type:document_type_id(name),
            source:source_id(name, file_type, mime_type, drive_id)
          `)
          .eq('id', documentId)
          .single();
          
        if (error) throw error;
        setDocument(data);
      } catch (err) {
        console.error('Error fetching document:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchDocument();
  }, [documentId]);
  
  if (loading) {
    return <div className="animate-pulse">Loading document...</div>;
  }
  
  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }
  
  if (!document) {
    return <div className="text-gray-500">Document not found</div>;
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">{document.title || document.filename}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="text-lg font-semibold mb-2">Document Details</h3>
          <div className="bg-gray-50 p-4 rounded">
            <p><span className="font-medium">Expert:</span> {document.experts?.name || 'Unknown'}</p>
            <p><span className="font-medium">Type:</span> {document.document_type?.name || 'Unknown'}</p>
            <p><span className="font-medium">Created:</span> {new Date(document.created_at).toLocaleString()}</p>
          </div>
        </div>
        
        <div>
          <h3 className="text-lg font-semibold mb-2">Source Information</h3>
          <div className="bg-gray-50 p-4 rounded">
            <p><span className="font-medium">Source:</span> {document.source?.name || 'N/A'}</p>
            <p><span className="font-medium">File Type:</span> {document.source?.file_type || 'N/A'}</p>
            {document.source?.drive_id && (
              <p><span className="font-medium">Drive ID:</span> {document.source.drive_id}</p>
            )}
          </div>
        </div>
      </div>
      
      {document.content && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">Content</h3>
          <div className="bg-white border border-gray-200 p-4 rounded max-h-[50vh] overflow-y-auto">
            {document.content_type === 'html' ? (
              <div dangerouslySetInnerHTML={{ __html: document.content }} />
            ) : (
              <pre className="whitespace-pre-wrap">{document.content}</pre>
            )}
          </div>
        </div>
      )}
      
      {document.metadata && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">Metadata</h3>
          <div className="bg-gray-50 p-4 rounded">
            <pre className="whitespace-pre-wrap text-sm">
              {JSON.stringify(document.metadata, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExpertDocumentView; 