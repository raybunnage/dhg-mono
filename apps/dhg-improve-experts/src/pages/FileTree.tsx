import { FileTree as FileTreeComp } from '@/components/FileTree';
import { supabase } from '@/integrations/supabase/client';
import React, { useState, useEffect } from 'react';

export function FileTree() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchFiles() {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('sources_google')
          .select('*');
          
        if (error) throw error;
        
        setFiles(data || []);
      } catch (err) {
        console.error('Error fetching files:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchFiles();
  }, []);

  // Helper function to identify file type for icons
  function getFileIcon(mimeType) {
    if (mimeType?.includes('audio')) return '🔊';
    if (mimeType?.includes('video')) return '🎬';
    if (mimeType?.includes('pdf')) return '📄';
    if (mimeType?.includes('document')) return '📝';
    if (mimeType?.includes('spreadsheet')) return '📊';
    if (mimeType?.includes('presentation')) return '📽️';
    if (mimeType?.includes('folder')) return '📁';
    return '📄';
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">File Explorer</h1>
      
      {loading ? (
        <div className="text-center p-8">Loading files...</div>
      ) : error ? (
        <div className="bg-red-100 text-red-700 p-4 rounded">
          Error: {error}
        </div>
      ) : (
        <FileTreeComp files={files} />
      )}
    </div>
  );
} 