import React, { useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useSearchParams } from 'react-router-dom';
import { FileTree, type FileNode } from '@/components/FileTree';
import { FileViewer } from '@/components/FileViewer';

// Import any required components
// You'll need to implement or import the FileTree and ExpertDocumentView components

function Viewer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch files from sources_google
  useEffect(() => {
    async function fetchFiles() {
      try {
        setLoading(true);
        
        // First, fetch sources_google entries
        const { data: sourcesData, error: sourcesError } = await supabase
          .from('sources_google')
          .select(`
            *,
            expert_documents(id, processing_status, processed_content, batch_id, error_message, 
                            queued_at, processing_started_at, processing_completed_at, 
                            processing_error, retry_count)
          `)
          .order('name');
          
        if (sourcesError) throw sourcesError;
        
        // Transform the data to match FileNode interface
        const fileNodes: FileNode[] = sourcesData.map(source => ({
          id: source.id,
          name: source.name,
          mime_type: source.mime_type || '',
          path: source.path,
          parent_path: source.parent_path,
          content_extracted: source.content_extracted,
          web_view_link: source.web_view_link,
          metadata: source.metadata,
          expertDocument: source.expert_documents?.[0] || null,
          drive_id: source.drive_id,
          is_root: source.is_root  // Include is_root field from the database
        }));
        
        // Count the root folders
        const rootFolders = fileNodes.filter(node => 
          node.is_root === true && 
          node.mime_type === 'application/vnd.google-apps.folder'
        );
        console.log(`Found ${rootFolders.length} root folders`);
        
        setFiles(fileNodes);
      } catch (err: any) {
        console.error('Error fetching files:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchFiles();
  }, []);

  // Handle file selection
  const handleFileSelect = (fileIds: string[]) => {
    if (fileIds.length > 0) {
      const selectedFileId = fileIds[0]; // Take the first one if multiple are selected
      const file = files.find(f => f.id === selectedFileId);
      if (file) {
        setSelectedFile(file);
        // Update URL with the selected file ID
        setSearchParams({ fileId: selectedFileId });
      }
    } else {
      setSelectedFile(null);
    }
  };
  
  // Handle file click from the tree
  const handleFileClick = (file: FileNode) => {
    setSelectedFile(file);
    // Update URL with the selected file ID
    setSearchParams({ fileId: file.id });
  };

  // Calculate the number of root folders
  const rootFolderCount = files.filter(node => 
    node.is_root === true && 
    node.mime_type === 'application/vnd.google-apps.folder'
  ).length;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Root Folder Counter Badge */}
      <div className="bg-blue-100 text-blue-800 px-4 py-2 mb-4 rounded-lg shadow-sm border border-blue-200">
        <span className="font-bold">Root Folders:</span> {rootFolderCount}
        <span className="ml-2 text-xs bg-blue-200 px-2 py-1 rounded-full">
          Updated {new Date().toLocaleTimeString()}
        </span>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {error}
        </div>
      )}
      
      <div className="flex">
        <div className={`w-1/2 ${selectedFile ? 'pr-4' : ''}`}>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-blue-500 animate-pulse">Loading files...</div>
            </div>
          ) : (
            <>
              <div className="mb-2 text-sm bg-green-100 p-2 rounded border border-green-200">
                <p><strong>File Tree Statistics:</strong></p>
                <ul className="list-disc pl-5 mt-1">
                  <li>Total items: {files.length}</li>
                  <li>Root folders: {rootFolderCount}</li>
                  <li>Files only: {files.filter(f => f.mime_type !== 'application/vnd.google-apps.folder').length}</li>
                </ul>
              </div>
              <FileTree 
                files={files}
                onSelectionChange={handleFileSelect}
                onFileClick={handleFileClick}
              />
            </>
          )}
        </div>
        
        {selectedFile && (
          <FileViewer file={selectedFile} />
        )}
      </div>
    </div>
  );
}

export default Viewer; 