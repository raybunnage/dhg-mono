import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { markdownFileService } from '@/services/markdownFileService';
import MarkdownViewer from '@/components/MarkdownViewer';
// Import correct types
import { Database } from '@/integrations/supabase/types';

// Type for documentation files
type DocumentationFile = Database['public']['Tables']['documentation_files']['Row'];

// Type for document types
type DocumentType = Database['public']['Tables']['document_types']['Row'];

// Type for our document type grouping
interface DocumentTypeGroup {
  id: string;
  name: string;
  files: DocumentationFile[];
  isExpanded: boolean;
}

// Main component for the Docs page
function Docs() {
  const [documentationFiles, setDocumentationFiles] = useState<DocumentationFile[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [documentTypeGroups, setDocumentTypeGroups] = useState<DocumentTypeGroup[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<DocumentationFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFileSummary, setShowFileSummary] = useState(false);

  // Fetch document types from the database
  const fetchDocumentTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('document_types')
        .select('*')
        .order('document_type', { ascending: true });

      if (error) throw error;
      setDocumentTypes(data || []);
      return data || [];
    } catch (error) {
      console.error('Error fetching document types:', error);
      return [];
    }
  };

  // Fetch documentation files from the database
  const fetchDocumentationFiles = async () => {
    setLoading(true);
    try {
      // First fetch document types
      const types = await fetchDocumentTypes();
      
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
        .order('updated_at', { ascending: false })
        .limit(500);

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
      
      // Build document type groups
      const groups = buildDocumentTypeGroups(validFiles, types);
      setDocumentTypeGroups(groups);
    } catch (error) {
      console.error('Error fetching documentation files:', error);
    } finally {
      setLoading(false);
    }
  };

  // Build document type groups from files
  const buildDocumentTypeGroups = (files: DocumentationFile[], types: DocumentType[]): DocumentTypeGroup[] => {
    // Create a map for quick document type lookup
    const typeMap = new Map<string, DocumentType>();
    types.forEach(type => typeMap.set(type.id, type));
    
    // Create a default "Unknown" type for files without a document_type_id
    const defaultGroup: DocumentTypeGroup = {
      id: 'unknown',
      name: 'Uncategorized',
      files: [],
      isExpanded: true
    };
    
    // Group files by document_type_id
    const groups: Record<string, DocumentationFile[]> = {};
    
    files.forEach(file => {
      // Skip invalid files
      if (!file.file_path) {
        console.warn(`File ${file.id} has no file_path, skipping`);
        return;
      }
      
      if (file.is_deleted) {
        console.warn(`File ${file.file_path} is marked as deleted, skipping`);
        return;
      }
      
      // Get document_type_id, defaulting to unknown if not found
      const typeId = file.document_type_id || 'unknown';
      
      // Create group array if it doesn't exist
      if (!groups[typeId]) {
        groups[typeId] = [];
      }
      
      // Add file to its group
      groups[typeId].push(file);
    });
    
    // Convert groups to array of DocumentTypeGroup
    const result: DocumentTypeGroup[] = [];
    
    Object.entries(groups).forEach(([typeId, files]) => {
      // Skip empty groups
      if (files.length === 0) return;
      
      // Get document type from map
      const documentType = typeMap.get(typeId);
      
      // Create group
      const group: DocumentTypeGroup = {
        id: typeId,
        name: documentType ? documentType.document_type : 'Uncategorized',
        files: files.sort((a, b) => {
          // Sort files by updated_at (newest first)
          const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
          const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
          return dateB - dateA;
        }),
        isExpanded: true
      };
      
      result.push(group);
    });
    
    // Sort groups alphabetically by name
    result.sort((a, b) => a.name.localeCompare(b.name));
    
    // Move "Uncategorized" to the end if it exists
    const uncategorizedIndex = result.findIndex(group => group.id === 'unknown');
    if (uncategorizedIndex !== -1) {
      const uncategorized = result.splice(uncategorizedIndex, 1)[0];
      result.push(uncategorized);
    }
    
    return result;
  };

  // Handle the search functionality
  const handleSearch = async () => {
    setLoading(true);
    try {
      // Get document types first
      const types = await fetchDocumentTypes();
      
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
        .or(`file_path.ilike.%${searchQuery}%,title.ilike.%${searchQuery}%,summary.ilike.%${searchQuery}%`);
        
      // Filter out soft-deleted files if the column exists
      if (hasIsDeletedColumn) {
        query = query.eq('is_deleted', false);
      }
      
      const { data, error } = await query
        .order('updated_at', { ascending: false })
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
      
      // Update document type groups
      const groups = buildDocumentTypeGroups(validFiles, types);
      setDocumentTypeGroups(groups);
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
  
  // Toggle document type group expanded state
  const toggleDocumentTypeGroup = (groupId: string) => {
    setDocumentTypeGroups(
      documentTypeGroups.map(group => 
        group.id === groupId 
          ? { ...group, isExpanded: !group.isExpanded }
          : group
      )
    );
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

  // Render document type groups and their files
  const renderDocumentTypeGroups = () => {
    return documentTypeGroups.map(group => (
      <div key={group.id} className="mb-4">
        <div 
          className="flex items-center p-2 cursor-pointer hover:bg-gray-100 rounded bg-gray-50"
          onClick={() => toggleDocumentTypeGroup(group.id)}
        >
          <span className="mr-2">{group.isExpanded ? '▼' : '►'}</span>
          <span className="font-medium text-lg">{group.name}</span>
          <span className="ml-2 text-sm text-gray-500">({group.files.length})</span>
        </div>
        
        {group.isExpanded && (
          <div className="ml-4 border-l border-gray-200">
            {group.files.map(file => (
              <div 
                key={file.id}
                className={`p-3 cursor-pointer hover:bg-gray-100 rounded my-1 ${selectedFile?.id === file.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
                onClick={() => selectFile(file)}
              >
                <div className="font-medium">{file.title || file.file_path.split('/').pop()}</div>
                <div className="text-xs text-gray-500 mt-1">
                  <div className="flex items-center justify-between">
                    <div>Size: {formatFileSize(file.metadata?.size)}</div>
                    <div>Updated: {formatDate(file.updated_at)}</div>
                  </div>
                  <div className="mt-1 truncate text-gray-400">
                    {file.file_path}
                  </div>
                </div>
              </div>
            ))}
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
          
          {/* Document types header */}
          <div className="px-4 pt-3 pb-2 border-b">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Documentation Types</h2>
              <div className="text-sm text-gray-500">Total Files: {totalRecords}</div>
            </div>
          </div>
          
          {/* Document types and files */}
          <div className="p-4 overflow-auto flex-grow" style={{ maxHeight: 'calc(100vh - 250px)' }}>
            {documentTypeGroups.length > 0 ? (
              renderDocumentTypeGroups()
            ) : (
              <div className="text-center text-gray-500 py-10">
                {loading ? 'Loading document types...' : 'No documentation files found'}
              </div>
            )}
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