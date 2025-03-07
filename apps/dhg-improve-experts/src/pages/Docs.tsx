import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { markdownFileService } from '@/services/markdownFileService';
import MarkdownViewer from '@/components/MarkdownViewer';
// Import correct types
import { Database } from '@/integrations/supabase/types';

// Type for documentation files
type DocumentationFile = Database['public']['Tables']['documentation_files']['Row'];

// Type for our hierarchical file structure
interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileNode[];
  file?: DocumentationFile;
  isExpanded: boolean;
}

// Main component for the Docs page
function Docs() {
  const [documentationFiles, setDocumentationFiles] = useState<DocumentationFile[]>([]);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<DocumentationFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFileSummary, setShowFileSummary] = useState(false);

  // Fetch documentation files from the database
  const fetchDocumentationFiles = async () => {
    setLoading(true);
    try {
      // Check if the is_deleted column exists by trying to filter by it
      const checkResponse = await supabase
        .from('documentation_files')
        .select('id')
        .limit(1);
      
      const hasIsDeletedColumn = !checkResponse.error || 
        !checkResponse.error.message.includes('column "is_deleted" does not exist');
        
      // Query adjusted based on whether is_deleted column exists
      let query = supabase
        .from('documentation_files')
        .select('*', { count: 'exact' });
        
      // Filter out soft-deleted files if the column exists
      if (hasIsDeletedColumn) {
        query = query.eq('is_deleted', false);
      } else {
        console.log('Note: is_deleted column not found, not filtering deleted files');
      }
      
      const { data, error, count } = await query
        .order('file_path', { ascending: true })
        .limit(100);

      if (error) throw error;

      // Filter out files with missing file_path or any other issues
      const validFiles = (data || []).filter(file => 
        file && file.file_path && 
        // Only include files that exist (should be all, but double-check)
        !(hasIsDeletedColumn && file.is_deleted === true)
      );

      console.log(`Fetched ${data?.length || 0} files, ${validFiles.length} valid files after filtering`);
      
      setDocumentationFiles(validFiles);
      setTotalRecords(count || 0);
      
      // Build file tree
      const tree = buildFileTree(validFiles);
      setFileTree(tree);
    } catch (error) {
      console.error('Error fetching documentation files:', error);
    } finally {
      setLoading(false);
    }
  };

  // Build hierarchical file tree from flat list
  const buildFileTree = (files: DocumentationFile[]): FileNode[] => {
    const root: FileNode[] = [];
    const folderMap: Record<string, FileNode> = {};
    
    // Skip soft-deleted files or files with invalid paths
    // This is a safety check in case the database query didn't filter them
    const validFiles = files.filter(file => {
      if (!file.file_path) {
        console.warn(`File ${file.id} has no file_path, skipping`);
        return false;
      }
      
      if (file.is_deleted) {
        console.warn(`File ${file.file_path} is marked as deleted, skipping`);
        return false;
      }
      
      return true;
    });
    
    console.log(`Building file tree from ${validFiles.length} valid files out of ${files.length} total`);
    
    // First pass: create all folder nodes
    validFiles.forEach(file => {
      const pathParts = file.file_path.split('/');
      
      // Create folder nodes for each part of the path
      let currentPath = '';
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        
        if (!folderMap[currentPath]) {
          folderMap[currentPath] = {
            id: `folder_${currentPath}`,
            name: part,
            type: 'folder',
            path: currentPath,
            children: [],
            isExpanded: true
          };
        }
      }
    });
    
    // Second pass: create file nodes and add to parent folders
    validFiles.forEach(file => {
      const pathParts = file.file_path.split('/');
      const fileName = pathParts[pathParts.length - 1];
      
      const fileNode: FileNode = {
        id: file.id,
        name: file.title || fileName,
        type: 'file',
        path: file.file_path,
        file: file,
        isExpanded: true
      };
      
      // Add file to parent folder or root
      if (pathParts.length === 1) {
        // Root-level file
        root.push(fileNode);
      } else {
        // Nested file
        const parentPath = pathParts.slice(0, pathParts.length - 1).join('/');
        if (folderMap[parentPath]) {
          folderMap[parentPath].children?.push(fileNode);
        } else {
          // Fallback: add to root if parent folder not found
          root.push(fileNode);
        }
      }
    });
    
    // Third pass: add folder hierarchy
    Object.keys(folderMap).forEach(path => {
      const pathParts = path.split('/');
      
      if (pathParts.length === 1) {
        // Root-level folder
        root.push(folderMap[path]);
      } else {
        // Nested folder
        const parentPath = pathParts.slice(0, pathParts.length - 1).join('/');
        if (folderMap[parentPath]) {
          folderMap[parentPath].children?.push(folderMap[path]);
        } else {
          // Fallback: add to root if parent folder not found
          root.push(folderMap[path]);
        }
      }
    });
    
    // Fourth pass: remove empty folders
    const removeEmptyFolders = (nodes: FileNode[]): FileNode[] => {
      return nodes.filter(node => {
        if (node.type === 'folder' && node.children) {
          node.children = removeEmptyFolders(node.children);
          return node.children.length > 0;
        }
        return true;
      });
    };
    
    const cleanedRoot = removeEmptyFolders(root);
    
    // Sort root nodes
    cleanedRoot.sort((a, b) => {
      // Folders come before files
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      // Alphabetical sorting
      return a.name.localeCompare(b.name);
    });
    
    // Sort children recursively
    const sortFolderContents = (node: FileNode) => {
      if (node.type === 'folder' && node.children && node.children.length > 0) {
        node.children.sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === 'folder' ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
        
        // Recursively sort children
        node.children.forEach(sortFolderContents);
      }
    };
    
    // Apply sorting to all folders
    cleanedRoot.forEach(sortFolderContents);
    
    return cleanedRoot;
  };

  // Handle the search functionality
  const handleSearch = async () => {
    setLoading(true);
    try {
      // Check if the is_deleted column exists
      const checkResponse = await supabase
        .from('documentation_files')
        .select('id')
        .limit(1);
      
      const hasIsDeletedColumn = !checkResponse.error || 
        !checkResponse.error.message.includes('column "is_deleted" does not exist');
        
      // Create query with search criteria
      let query = supabase
        .from('documentation_files')
        .select('*')
        .ilike('file_path', `%${searchQuery}%`);
        
      // Filter out soft-deleted files if the column exists
      if (hasIsDeletedColumn) {
        query = query.eq('is_deleted', false);
      }
      
      const { data, error } = await query
        .order('file_path', { ascending: true })
        .limit(100);

      if (error) throw error;

      // Filter out files with missing file_path or any other issues
      const validFiles = (data || []).filter(file => 
        file && file.file_path && 
        // Only include files that exist (should be all, but double-check)
        !(hasIsDeletedColumn && file.is_deleted === true)
      );

      console.log(`Search found ${data?.length || 0} files, ${validFiles.length} valid files after filtering`);
      
      setDocumentationFiles(validFiles);
      
      // Update tree view
      const tree = buildFileTree(validFiles);
      setFileTree(tree);
    } catch (error) {
      console.error('Error searching documentation files:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle Enter key for search
  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
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

  // Select a file to view
  const selectFile = (file: DocumentationFile) => {
    // Verify file is not deleted before selecting
    if (file && file.is_deleted) {
      console.warn(`Attempted to select deleted file: ${file.file_path}`);
      alert(`This file has been deleted or is no longer available: ${file.file_path}`);
      return;
    }
    
    // Verify file has a valid path
    if (!file || !file.file_path) {
      console.warn('Attempted to select a file with no path');
      alert('This file is invalid or has no path');
      return;
    }
    
    setSelectedFile(file);
  };
  
  // Toggle folder expanded state
  const toggleFolder = (nodePath: string) => {
    // Create a deep copy of the tree
    const updateNodeExpanded = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(node => {
        if (node.path === nodePath && node.type === 'folder') {
          return { ...node, isExpanded: !node.isExpanded };
        } else if (node.children) {
          return { ...node, children: updateNodeExpanded(node.children) };
        }
        return node;
      });
    };
    
    setFileTree(updateNodeExpanded(fileTree));
  };
  
  // Format file size
  const formatFileSize = (sizeInBytes: number | undefined) => {
    if (!sizeInBytes) return 'Unknown size';
    if (sizeInBytes < 1024) return `${sizeInBytes} B`;
    if (sizeInBytes < 1024 * 1024) return `${(sizeInBytes / 1024).toFixed(1)} KB`;
    return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // Recursive component to render file tree
  const renderFileTree = (nodes: FileNode[]) => {
    return nodes.map(node => (
      <div key={node.id} className="pl-2">
        {node.type === 'folder' ? (
          <div>
            <div 
              className="flex items-center p-2 cursor-pointer hover:bg-gray-100 rounded"
              onClick={() => toggleFolder(node.path)}
            >
              <span className="mr-1">{node.isExpanded ? '▼' : '►'}</span>
              <span className="font-medium">{node.name}/</span>
            </div>
            {node.isExpanded && node.children && node.children.length > 0 && (
              <div className="ml-4 border-l border-gray-200">
                {renderFileTree(node.children)}
              </div>
            )}
          </div>
        ) : (
          <div 
            className={`p-2 cursor-pointer hover:bg-gray-100 rounded ${selectedFile?.id === node.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
            onClick={() => node.file && selectFile(node.file)}
          >
            <div className="font-medium">{node.name}</div>
            {node.file && (
              <div className="text-xs text-gray-500">
                <div>Size: {formatFileSize(node.file.metadata?.size)}</div>
                <div>Updated: {formatDate(node.file.updated_at)}</div>
              </div>
            )}
          </div>
        )}
      </div>
    ));
  };

  // Initial data load
  useEffect(() => {
    fetchDocumentationFiles();
  }, []);

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Main content section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left side - Hierarchical tree viewer */}
        <div className="col-span-1 flex flex-col bg-white rounded-lg shadow">
          {/* Search and Actions section */}
          <div className="p-4 border-b">
            <div className="flex gap-2 mb-3">
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Search
              </button>
              <button
                onClick={syncDatabase}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                title="Sync database with files on disk, handling updates and soft deletions"
              >
                Sync Database
              </button>
              <button
                onClick={() => {
                  setLoading(true);
                  // First call the script to update the markdown report
                  fetch('/api/markdown-report', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    }
                  })
                  .then(response => response.json())
                  .then(result => {
                    if (result.success) {
                      console.log('Markdown report generated successfully');
                      // Then sync the database
                      return syncDatabase();
                    } else {
                      alert(`Error generating markdown report: ${result.error || 'Unknown error'}`);
                      setLoading(false);
                    }
                  })
                  .catch(error => {
                    console.error('Error running markdown report:', error);
                    alert(`Error running markdown report: ${error.message}`);
                    setLoading(false);
                  });
                }}
                className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600"
                title="Run the markdown-report.sh script first, then sync database with files on disk"
              >
                Run Report + Sync
              </button>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleSearchKeyPress}
              placeholder="Search documentation files..."
              className="border rounded px-3 py-2 w-full"
            />
          </div>
          
          {/* Files tree header */}
          <div className="px-4 pt-3 pb-2 border-b">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Documentation Files</h2>
              <div className="text-sm text-gray-500">Total: {totalRecords}</div>
            </div>
          </div>
          
          {/* Files tree content */}
          <div className="p-4 overflow-auto flex-grow" style={{ maxHeight: 'calc(100vh - 250px)' }}>
            {renderFileTree(fileTree)}
          </div>
        </div>
        
        {/* Right side - File viewer */}
        <div className="col-span-2 bg-white rounded-lg shadow flex flex-col">
          {selectedFile ? (
            <>
              {/* Collapsible summary section */}
              <div 
                className="p-3 bg-gray-100 flex justify-between items-center cursor-pointer border-b"
                onClick={() => setShowFileSummary(!showFileSummary)}
              >
                <h2 className="text-lg font-semibold">{selectedFile.title || selectedFile.file_path.split('/').pop()}</h2>
                <div className="flex items-center">
                  <span className="text-sm text-gray-500 mr-2">{selectedFile.file_path}</span>
                  <span>{showFileSummary ? '▲' : '▼'}</span>
                </div>
              </div>
              
              {showFileSummary && (
                <div className="p-4 bg-gray-50 border-b">
                  <div className="bg-white p-3 rounded border mb-2">
                    <h3 className="text-sm font-medium mb-2">File Summary:</h3>
                    <p className="text-sm">{selectedFile.summary || 'No summary available for this file.'}</p>
                  </div>
                  
                  {/* Detailed metadata */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-medium mb-1">File Metadata:</h3>
                      <ul className="text-xs text-gray-600">
                        <li>Size: {formatFileSize(selectedFile.metadata?.size)}</li>
                        <li>Created: {formatDate(selectedFile.created_at)}</li>
                        <li>Updated: {formatDate(selectedFile.updated_at)}</li>
                        <li>Last Modified: {formatDate(selectedFile.last_modified_at)}</li>
                        <li>Last Indexed: {formatDate(selectedFile.last_indexed_at)}</li>
                      </ul>
                    </div>
                    
                    {/* Tags section */}
                    {selectedFile.ai_generated_tags && selectedFile.ai_generated_tags.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium mb-1">Tags:</h3>
                        <div className="flex flex-wrap gap-1">
                          {selectedFile.ai_generated_tags.map((tag: string, index: number) => (
                            <span 
                              key={index} 
                              className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* JSON preview */}
                    <div className="col-span-2">
                      <h3 className="text-sm font-medium mb-1">Raw JSON:</h3>
                      <pre className="text-xs bg-gray-900 text-gray-200 p-2 rounded overflow-auto max-h-24">
                        {JSON.stringify(selectedFile, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Markdown viewer section - directly below collapsible section */}
              <div className="flex-1 overflow-auto">
                <MarkdownViewer documentId={selectedFile.id} />
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
            <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mr-2 inline-block"></div>
            Loading...
          </div>
        </div>
      )}
    </div>
  );
}

export default Docs;