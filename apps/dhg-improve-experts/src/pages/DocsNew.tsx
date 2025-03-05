import React, { useState, useEffect } from 'react';
import { marked } from 'marked';
import { supabase } from '@/integrations/supabase/client';
import { markdownFileService } from '@/services/markdownFileService';

// Main component for the DocsNew page
function DocsNew() {
  const [documentationFiles, setDocumentationFiles] = useState<any[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [fileContent, setFileContent] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch documentation files from the database
  const fetchDocumentationFiles = async () => {
    setLoading(true);
    try {
      const { data, error, count } = await supabase
        .from('documentation_files')
        .select('*', { count: 'exact' })
        .limit(30);

      if (error) throw error;

      setDocumentationFiles(data || []);
      setTotalRecords(count || 0);
    } catch (error) {
      console.error('Error fetching documentation files:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle the search functionality
  const handleSearch = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('documentation_files')
        .select('*')
        .ilike('file_path', `%${searchQuery}%`)
        .limit(30);

      if (error) throw error;

      setDocumentationFiles(data || []);
    } catch (error) {
      console.error('Error searching documentation files:', error);
    } finally {
      setLoading(false);
    }
  };

  // Sync database using the markdownFileService
  const syncDatabase = async () => {
    setLoading(true);
    try {
      const result = await markdownFileService.syncDocumentationFiles();
      if (result.success) {
        alert(`Sync successful: ${result.message}`);
        fetchDocumentationFiles(); // Refresh the data
      } else {
        alert(`Sync failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Error syncing database:', error);
      alert('Error syncing database. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  // Load file content when a file is selected
  const loadFileContent = async (file: any) => {
    setLoading(true);
    setSelectedFile(file);
    try {
      // Try to load the actual file from disk
      const fileData = await markdownFileService.getFileContent(file.file_path);
      if (fileData && fileData.content) {
        setFileContent(fileData.content);
      } else {
        // If file cannot be loaded, show a message
        setFileContent('# File Not Found\n\nThe file could not be loaded from disk.');
      }
    } catch (error) {
      console.error('Error loading file content:', error);
      setFileContent('# Error\n\nAn error occurred while loading the file content.');
    } finally {
      setLoading(false);
    }
  };

  // Initial data load
  useEffect(() => {
    fetchDocumentationFiles();
  }, []);

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header section */}
      <h1 className="text-2xl font-bold mb-6">Docs New</h1>
      
      {/* Search section */}
      <div className="mb-4 flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search documentation files..."
          className="border rounded px-3 py-2 w-1/2"
        />
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Search
        </button>
        <button
          onClick={syncDatabase}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Sync Database
        </button>
      </div>
      
      {/* Main content section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left side - Hierarchical tree viewer */}
        <div className="col-span-1 bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-2">Documentation Files</h2>
          <div className="text-sm text-gray-500 mb-4">Total Records: {totalRecords}</div>
          
          {/* Files list */}
          <div className="overflow-auto max-h-[600px]">
            {documentationFiles.map((file) => (
              <div 
                key={file.id}
                className={`p-2 cursor-pointer hover:bg-gray-100 rounded ${selectedFile?.id === file.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
                onClick={() => loadFileContent(file)}
              >
                <div className="font-medium">{file.title || file.file_path.split('/').pop()}</div>
                <div className="text-xs text-gray-500">{file.file_path}</div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Right side - File viewer */}
        <div className="col-span-2 bg-white rounded-lg shadow flex flex-col">
          {selectedFile ? (
            <>
              {/* Top section - Summary display */}
              <div className="p-4 border-b bg-gray-50">
                <h2 className="text-lg font-semibold mb-2">{selectedFile.title || selectedFile.file_path.split('/').pop()}</h2>
                <p className="text-sm text-gray-500">{selectedFile.file_path}</p>
                <div className="mt-4 bg-white p-3 rounded border">
                  <h3 className="text-sm font-medium mb-2">File Summary:</h3>
                  <p className="text-sm">{selectedFile.summary || 'No summary available for this file.'}</p>
                </div>
              </div>
              
              {/* Bottom section - Markdown viewer */}
              <div className="flex-1 overflow-auto p-4">
                <div 
                  className="prose max-w-none" 
                  dangerouslySetInnerHTML={{ __html: marked.parse(fileContent) }} 
                />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>Select a file to view its content</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg shadow">
            Loading...
          </div>
        </div>
      )}
    </div>
  );
}

export default DocsNew;