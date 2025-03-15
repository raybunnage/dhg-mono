import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { markdownFileService } from '@/services/markdownFileService';
import MarkdownViewer from '@/components/MarkdownViewer';
import toast from 'react-hot-toast';
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
  const [showFileMetadata, setShowFileMetadata] = useState(false);

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
        .order('created_at', { ascending: false })
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
          // Sort files by created_at (newest first)
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
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
        
      // Create query with enhanced search criteria
      let query = supabase
        .from('documentation_files')
        .select('*');
        
      // Build advanced search for multiple fields including metadata
      if (searchQuery.trim()) {
        query = query.or(
          `file_path.ilike.%${searchQuery}%,` +
          `title.ilike.%${searchQuery}%,` +
          `summary.ilike.%${searchQuery}%,` +
          `ai_generated_tags.cs.{${searchQuery}},` +
          `manual_tags.cs.{${searchQuery}},` +
          `metadata->category.ilike.%${searchQuery}%,` +
          `status_recommendation.ilike.%${searchQuery}%`
        );
      }
        
      // Filter out soft-deleted files if the column exists
      if (hasIsDeletedColumn) {
        query = query.eq('is_deleted', false);
      }
      
      const { data, error } = await query
        .order('created_at', { ascending: false })
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

  // Run the markdown-report.sh script
  const runMarkdownReport = async () => {
    setLoading(true);
    
    // Show a toast notification that the process has started
    const toastId = toast.loading('Running markdown report...');
    
    try {
      // First, directly run markdown-report.sh with custom args to force regeneration
      console.log('Preparing to run markdown report script...');
      
      // Making sure to force regeneration 
      // (The script itself handles the file creation and will overwrite existing files)
      toast.loading('Generating markdown report...', { id: toastId });
      
      // Then generate the new report
      console.log('Calling /api/markdown-report endpoint...');
      const response = await fetch('/api/markdown-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Markdown report API response:', result);
      
      if (result.success) {
        toast.success('Markdown report generated successfully', { id: toastId });
        // After generating the report, sync with the database
        await syncDocumentationToDatabase();
        fetchDocumentationFiles(); // Refresh the data
      } else {
        toast.error(`Failed to generate markdown report: ${result.error || 'Unknown error'}`, { id: toastId });
        console.error('Markdown report error details:', result);
      }
    } catch (error) {
      console.error('Error running markdown report:', error);
      toast.error(`Error running markdown report: ${error.message}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  };
  
  // Helper function to sync documentation to database
  const syncDocumentationToDatabase = async () => {
    try {
      const response = await fetch('/api/docs-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'sync' })
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Documentation sync result:', result);
      
      if (!result.success) {
        console.error('Documentation sync error:', result.message || 'Unknown error');
      }
      
      return result;
    } catch (error) {
      console.error('Error syncing documentation to database:', error);
      return { 
        success: false, 
        message: `Error: ${error.message}` 
      };
    }
  };
  
  // Run the update-docs-database.sh script
  const updateDocsDatabase = async () => {
    setLoading(true);
    try {
      // Execute update-docs-database.sh via API endpoint
      const response = await fetch('/api/docs-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'update' })
      });
      
      const result = await response.json();
      if (result.success) {
        alert(`Documentation database updated successfully`);
        fetchDocumentationFiles(); // Refresh the data
      } else {
        alert(`Failed to update docs database: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating docs database:', error);
      alert(`Error updating docs database: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Process docs with AI batch processing
  const processDocsWithAI = async () => {
    setLoading(true);
    try {
      // Execute process-docs-batch.sh via API endpoint
      const response = await fetch('/api/docs-process-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          action: 'process',
          options: {
            all: true,
            limit: 20,
            batchSize: 5
          }
        })
      });
      
      const result = await response.json();
      if (result.success) {
        alert(`Started AI processing of documentation: ${result.message}`);
        // Wait a bit to allow processing to start before refreshing
        setTimeout(() => fetchDocumentationFiles(), 2000);
      } else {
        alert(`Failed to start AI processing: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error starting AI processing:', error);
      alert(`Error starting AI processing: ${error.message}`);
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
                <div className="flex items-center justify-between">
                  <div className="font-medium">{file.title || file.file_path.split('/').pop()}</div>
                  {file.status_recommendation && (
                    <div className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full ml-2">
                      {file.status_recommendation}
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  <div className="flex items-center justify-between">
                    <div>
                      Size: {formatFileSize(file.metadata?.size)}
                      {(file.processed_content?.assessment?.status_recommendation || 
                        file.status_recommendation || 
                        file.ai_assessment?.status_recommendation) && (
                        <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                          {file.processed_content?.assessment?.status_recommendation || 
                           file.status_recommendation || 
                           file.ai_assessment?.status_recommendation}
                        </span>
                      )}
                    </div>
                    <div>Created: {formatDate(file.created_at)}</div>
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
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Search
              </button>
              <button
                onClick={runMarkdownReport}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                title="Generate markdown report using markdown-report.sh"
              >
                Sync Database
              </button>
              <button
                onClick={updateDocsDatabase}
                className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600"
                title="Run update-docs-database.sh to update documentation in database"
              >
                Update Docs
              </button>
              <button
                onClick={processDocsWithAI}
                className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
                title="Run AI processing on documentation files (limit 20)"
              >
                Process AI
              </button>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleSearchKeyPress}
              placeholder="Search documentation files, tags, metadata..."
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
                  {selectedFile.summary && (
                    <div className="bg-white p-3 rounded border mb-4">
                      <h3 className="text-sm font-medium mb-2">Summary:</h3>
                      <div className="text-sm">
                        {(() => {
                          try {
                            // Try to parse as JSON if it looks like JSON
                            if (selectedFile.summary.trim().startsWith('{') && selectedFile.summary.trim().endsWith('}')) {
                              const summaryObj = JSON.parse(selectedFile.summary);
                              return (
                                <div>
                                  {/* Brief section */}
                                  {summaryObj.brief && (
                                    <p className="mb-3">
                                      <strong>Brief</strong>: {summaryObj.brief}
                                    </p>
                                  )}
                                  
                                  {/* Detailed section */}
                                  {summaryObj.detailed && (
                                    <div className="ml-3">
                                      {summaryObj.detailed.purpose && (
                                        <p className="mb-2">
                                          <strong>Purpose</strong>: {summaryObj.detailed.purpose}
                                        </p>
                                      )}
                                      {summaryObj.detailed.key_components && (
                                        <p className="mb-2">
                                          <strong>Key Components</strong>: {summaryObj.detailed.key_components}
                                        </p>
                                      )}
                                      {summaryObj.detailed.practical_application && (
                                        <p className="mb-2">
                                          <strong>Practical Application</strong>: {summaryObj.detailed.practical_application}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* Show status recommendation if available from any source */}
                                  {(selectedFile.status_recommendation || 
                                   selectedFile.processed_content?.assessment?.status_recommendation ||
                                   selectedFile.ai_assessment?.status_recommendation) && (
                                    <div className="mt-4 p-2 bg-amber-50 rounded-md border border-amber-200">
                                      <strong>Status Recommendation</strong>: {
                                        selectedFile.status_recommendation || 
                                        selectedFile.processed_content?.assessment?.status_recommendation ||
                                        selectedFile.ai_assessment?.status_recommendation
                                      }
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            // Fallback to simple text processing if not JSON
                            return (
                              <>
                                {selectedFile.summary
                                  .replace(/^brief\s*:\s*/i, '')
                                  .replace(/\b(brief|purpose|key_components|practical_application)\b\s*:/gi, match => (
                                    `<strong>${match.replace(/:/g, '').replace(/"/g, '')}</strong>:`
                                  ))
                                  .replace(/"/g, '')
                                  .split(/\n+/).map((paragraph, idx) => (
                                    <p key={idx} className="mb-2" dangerouslySetInnerHTML={{ __html: paragraph }} />
                                  ))}
                                
                                {/* Add status recommendation to text mode too */}
                                {(selectedFile.status_recommendation || 
                                  selectedFile.processed_content?.assessment?.status_recommendation ||
                                  selectedFile.ai_assessment?.status_recommendation) && (
                                  <div className="mt-4 p-2 bg-amber-50 rounded-md border border-amber-200">
                                    <strong>Status Recommendation</strong>: {
                                      selectedFile.status_recommendation || 
                                      selectedFile.processed_content?.assessment?.status_recommendation ||
                                      selectedFile.ai_assessment?.status_recommendation
                                    }
                                  </div>
                                )}
                              </>
                            );
                          } catch (error) {
                            // If JSON parsing fails, fall back to text display
                            return (
                              <>
                                {selectedFile.summary
                                  .replace(/^brief\s*:\s*/i, '')
                                  .replace(/\b(brief|purpose|key_components|practical_application)\b\s*:/gi, match => (
                                    `<strong>${match.replace(/:/g, '').replace(/"/g, '')}</strong>:`
                                  ))
                                  .replace(/"/g, '')
                                  .split(/\n+/).map((paragraph, idx) => (
                                    <p key={idx} className="mb-2" dangerouslySetInnerHTML={{ __html: paragraph }} />
                                  ))}
                                
                                {/* Add status recommendation to text mode too */}
                                {(selectedFile.status_recommendation || 
                                  selectedFile.processed_content?.assessment?.status_recommendation ||
                                  selectedFile.ai_assessment?.status_recommendation) && (
                                  <div className="mt-4 p-2 bg-amber-50 rounded-md border border-amber-200">
                                    <strong>Status Recommendation</strong>: {
                                      selectedFile.status_recommendation || 
                                      selectedFile.processed_content?.assessment?.status_recommendation ||
                                      selectedFile.ai_assessment?.status_recommendation
                                    }
                                  </div>
                                )}
                              </>
                            );
                          }
                        })()}
                      </div>
                    </div>
                  )}
                  {!selectedFile.summary && (
                    <div className="bg-white p-3 rounded border mb-4">
                      <h3 className="text-sm font-medium mb-2">Summary:</h3>
                      <p className="text-sm text-gray-500 italic">No summary available for this file.</p>
                    </div>
                  )}
                  
                  {/* Basic metadata and tags */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <h3 className="text-sm font-medium mb-1">File Information:</h3>
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
                  </div>
                </div>
              )}
              
              {/* Collapsible metadata section */}
              <div 
                className="p-3 bg-gray-100 flex justify-between items-center cursor-pointer border-b"
                onClick={() => setShowFileMetadata(!showFileMetadata)}
              >
                <h2 className="text-lg font-semibold">Full Document Metadata</h2>
                <span>{showFileMetadata ? '▲' : '▼'}</span>
              </div>
              
              {showFileMetadata && (
                <div className="p-4 bg-gray-50 border-b">
                  {/* Full JSON with assessment data */}
                  <div className="mb-4">
                    <h3 className="text-sm font-medium mb-1">Raw Document Data:</h3>
                    <pre className="text-xs bg-gray-900 text-gray-200 p-3 rounded overflow-auto" style={{ maxHeight: '500px' }}>
                      {JSON.stringify(
                        {
                          ...selectedFile,
                          // Skip summary since we already display it separately
                          summary: selectedFile.summary ? "[See Summary section above]" : null,
                        }, 
                        null, 
                        2
                      )}
                    </pre>
                  </div>
                  
                  {/* Assessment section if available */}
                  {selectedFile.processed_content?.assessment && (
                    <div className="mb-4">
                      <h3 className="text-sm font-medium mb-2">Assessment Data:</h3>
                      <div className="bg-white p-3 rounded border">
                        <pre className="text-xs overflow-auto" style={{ maxHeight: '400px' }}>
                          {JSON.stringify(selectedFile.processed_content.assessment, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
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