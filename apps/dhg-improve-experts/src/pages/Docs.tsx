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
  const [tags, setTags] = useState<{tag: string, count: number}[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedFilesForProcessing, setSelectedFilesForProcessing] = useState<string[]>([]);
  const [selectedDocumentType, setSelectedDocumentType] = useState<string | null>(null);

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
      console.log('Starting search with query:', searchQuery, 'Selected tags:', selectedTags);
      
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
      
      // Filter out soft-deleted files if the column exists
      if (hasIsDeletedColumn) {
        query = query.eq('is_deleted', false);
      }
      
      let hasTextSearch = false;
      
      // Build advanced search for multiple fields including metadata
      if (searchQuery.trim()) {
        hasTextSearch = true;
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
      
      // Filter by selected tags (if any)
      if (selectedTags.length > 0) {
        console.log('Filtering by selected tags:', selectedTags);
        
        // Use Postgres array contains operator to find exact tag matches
        let tagConditions = [];
        
        // Use array containment operator (@>) for exact matches
        // For each tag, check if it's exactly in either of the tag arrays
        selectedTags.forEach(tag => {
          // Since our selectedTags are normalized, convert both arrays to lowercase for comparison
          // Use array_to_string + lower for case-insensitive array matching of exact tags
          const normalizedTag = tag.trim().toLowerCase();
          
          // Escape the tag for SQL safety by replacing single quotes
          const escapedTag = normalizedTag.replace(/'/g, "''");
          
          // Use simple containment with array operators - most compatible approach
          tagConditions.push(`'${escapedTag}' = ANY(ai_generated_tags)`);
          tagConditions.push(`'${escapedTag}' = ANY(manual_tags)`);
          
          // Also try with lowercase for case-insensitive matching
          tagConditions.push(`'${escapedTag}' = ANY(ARRAY(SELECT lower(unnest(ai_generated_tags))))`);
          tagConditions.push(`'${escapedTag}' = ANY(ARRAY(SELECT lower(unnest(manual_tags))))`);
          
          // Try direct array containment too, in case the previous methods don't work
          tagConditions.push(`ai_generated_tags && ARRAY['${escapedTag}']`);
          tagConditions.push(`manual_tags && ARRAY['${escapedTag}']`);
        });
        
        // Add this condition to our query
        const filterCondition = tagConditions.join(' or ');
        console.log('Using exact tag filter condition:', filterCondition);
        
        // Apply the filter to the query
        if (hasTextSearch) {
          query = query.or(filterCondition);
        } else {
          query = query.filter(filterCondition);
        }
      }
      
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Filter out files with missing file_path or any other issues
      let validFiles = (data || []).filter(file => 
        file && file.file_path && 
        // Only include files that exist (should be all, but double-check)
        !(hasIsDeletedColumn && file.is_deleted === true)
      );
      
      // If only one tag is selected, the database query should be sufficient
      // But if multiple tags are selected, we still need client-side filtering for the AND condition
      if (selectedTags.length > 1) {
        console.log(`Client-side filtering for documents with ALL ${selectedTags.length} selected tags`);
        
        validFiles = validFiles.filter(file => {
          try {
            // Extract and normalize all tags from this file
            const fileTags: string[] = [];
            
            // Process ai_generated_tags
            if (file.ai_generated_tags && Array.isArray(file.ai_generated_tags)) {
              fileTags.push(...file.ai_generated_tags
                .filter(Boolean)
                .map(tag => tag.toString().toLowerCase().trim()));
            }
            
            // Process manual_tags
            if (file.manual_tags && Array.isArray(file.manual_tags)) {
              fileTags.push(...file.manual_tags
                .filter(Boolean)
                .map(tag => tag.toString().toLowerCase().trim()));
            }
            
            // Check if ALL selected tags are in this file's tags
            const hasAllTags = selectedTags.every(selectedTag => {
              const normalizedSelectedTag = selectedTag.toLowerCase().trim();
              return fileTags.includes(normalizedSelectedTag);
            });
            
            // Debug logging for important cases
            if (hasAllTags) {
              console.log(`✅ MATCH: ${file.file_path} has ALL selected tags:`, 
                selectedTags.map(t => t.toLowerCase().trim()));
            }
            
            return hasAllTags;
          } catch (error) {
            console.error('Error in client-side tag filtering:', error);
            return false;
          }
        });
      }

      // Log detailed results if tag filtering was applied
      if (selectedTags.length > 0) {
        console.log(`Tag filtering results:
          - Initial database query found: ${data?.length || 0} files
          - After client-side filtering: ${validFiles.length} files
          - Selected tags: ${JSON.stringify(selectedTags)}
        `);
        
        // Log first 5 matching files for debugging
        if (validFiles.length > 0) {
          console.log('Sample matching files:');
          validFiles.slice(0, 5).forEach((file, index) => {
            console.log(`${index + 1}. ${file.file_path}`);
          });
        }
      } else {
        console.log(`Search found ${data?.length || 0} files, ${validFiles.length} valid files after filtering`);
      }
      
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
      // Run directly with a shell script instead of using API
      // This avoids potential 404 errors with the API endpoint
      console.log('Preparing to run markdown report script using direct fetch...');
      
      // Making sure to force regeneration 
      // (The script itself handles the file creation and will overwrite existing files)
      toast.loading('Generating markdown report...', { id: toastId });
      
      // Uses fetch to trigger both of the required scripts in sequence
      // We're using a GET request to a local shell script that runs markdown-report.sh
      const startReport = await fetch('/scripts/generate-report-and-sync-db.sh', { 
        method: 'GET',
        cache: 'no-cache' // Ensure fresh execution
      });
      
      // If this fails, we'll try the backup API method
      if (!startReport.ok) {
        console.warn('Direct script execution failed, trying API fallback...');
        
        // Fallback to API
        const response = await fetch('/api/docs-sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ action: 'report' })
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
          toast.error(`Failed to generate markdown report: ${result.message || 'Unknown error'}`, { id: toastId });
          console.error('Markdown report error details:', result);
        }
      } else {
        // Direct script approach worked
        toast.success('Markdown report generated successfully', { id: toastId });
        console.log('Markdown report script executed directly');
        
        // Refresh the data after a short delay to allow processing
        setTimeout(() => fetchDocumentationFiles(), 2000);
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
  
  // Handle document deletion
  const handleDeleteFile = async (file: DocumentationFile) => {
    if (!file || !file.id) {
      toast.error('Invalid file selected for deletion');
      return;
    }
    
    setLoading(true);
    try {
      // Mark the file as deleted in the database
      const { error: updateError } = await supabase
        .from('documentation_files')
        .update({ is_deleted: true })
        .eq('id', file.id);
      
      if (updateError) {
        throw updateError;
      }
      
      // Call API to request physical file deletion (if needed)
      try {
        const response = await fetch('/api/docs-sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            action: 'delete-file',
            fileId: file.id,
            filePath: file.file_path 
          })
        });
        
        if (!response.ok) {
          console.warn(`API returned status ${response.status} when attempting to delete file physically`);
        }
      } catch (apiError) {
        console.error('Error calling delete file API:', apiError);
        // Continue anyway as the db update is more important
      }
      
      // Extract just the filename for the success message
      const fileName = file.file_path.split('/').pop();
      toast.success(`File "${fileName}" has been marked as deleted`);
      
      // Update the UI
      // Remove the file from the current documentationFiles list
      setDocumentationFiles(prev => prev.filter(f => f.id !== file.id));
      
      // Rebuild groups to reflect the deleted file
      const updatedGroups = buildDocumentTypeGroups(
        documentationFiles.filter(f => f.id !== file.id),
        documentTypes
      );
      setDocumentTypeGroups(updatedGroups);
      
      // If the currently selected file was deleted, clear selection
      if (selectedFile?.id === file.id) {
        setSelectedFile(null);
      }
      
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error(`Failed to delete file: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Helper to get existing metadata for a file
  const getExistingMetadata = async (fileId: string) => {
    try {
      // Fetch the current metadata
      const { data, error } = await supabase
        .from('documentation_files')
        .select('metadata')
        .eq('id', fileId)
        .single();
      
      if (error) {
        console.warn('Error fetching existing metadata:', error);
        return {}; // Return empty object if there's an error
      }
      
      // Return the existing metadata or empty object
      return data?.metadata || {};
    } catch (e) {
      console.error('Exception fetching metadata:', e);
      return {}; // Return empty object on exception
    }
  };
  
  // Handle updating document types for selected files
  const updateDocumentTypeForSelectedFiles = async () => {
    if (selectedFilesForProcessing.length === 0) {
      toast.error('No files selected for processing');
      return;
    }
    
    if (!selectedDocumentType) {
      toast.error('Please select a document type to assign');
      return;
    }
    
    setLoading(true);
    const toastId = toast.loading(`Updating ${selectedFilesForProcessing.length} files...`);
    
    try {
      // Try batch update first (faster, but might not work with metadata)
      try {
        const { error } = await supabase
          .from('documentation_files')
          .update({ 
            document_type_id: selectedDocumentType,
            // Only use columns that exist in the database schema
            summary: null,
            ai_generated_tags: null
          })
          .in('id', selectedFilesForProcessing);
        
        if (error) {
          throw error;
        }
      } catch (batchError) {
        console.warn('Batch update failed, falling back to individual updates:', batchError);
        
        // If batch update fails, fallback to updating files one by one
        let successCount = 0;
        let failCount = 0;
        
        toast.loading(`Batch update failed. Updating files individually...`, { id: toastId });
        
        for (const fileId of selectedFilesForProcessing) {
          try {
            // Get existing metadata for this specific file
            const metadata = await getExistingMetadata(fileId);
            
            // Update this file individually
            const { error } = await supabase
              .from('documentation_files')
              .update({ 
                document_type_id: selectedDocumentType,
                summary: null,
                ai_generated_tags: null,
                metadata: {
                  ...metadata,
                  needs_processing: true,
                  last_processed: null
                }
              })
              .eq('id', fileId);
            
            if (error) {
              console.error(`Error updating file ${fileId}:`, error);
              failCount++;
            } else {
              successCount++;
            }
          } catch (individualError) {
            console.error(`Error in individual update for file ${fileId}:`, individualError);
            failCount++;
          }
          
          // Update progress in toast message
          if ((successCount + failCount) % 5 === 0 || successCount + failCount === selectedFilesForProcessing.length) {
            toast.loading(`Updated ${successCount}/${selectedFilesForProcessing.length} files...`, { id: toastId });
          }
        }
        
        if (failCount > 0) {
          throw new Error(`Failed to update ${failCount} of ${selectedFilesForProcessing.length} files`);
        }
      }
      
      toast.success(`Updated ${selectedFilesForProcessing.length} files for reprocessing`, { id: toastId });
      
      // Clear selection after successful update
      setSelectedFilesForProcessing([]);
      setSelectedDocumentType(null);
      
      // Refresh data to reflect changes
      await fetchDocumentationFiles();
      
    } catch (error) {
      console.error('Error updating document types:', error);
      toast.error(`Failed to update files: ${error.message || 'Unknown error'}`, { id: toastId });
    } finally {
      setLoading(false);
    }
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
                className={`p-3 hover:bg-gray-100 rounded my-1 ${selectedFile?.id === file.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
              >
                <div className="flex items-start">
                  {/* Selection checkbox for reprocessing */}
                  <input
                    type="checkbox"
                    className="mt-1 mr-2 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={selectedFilesForProcessing.includes(file.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleFileSelection(file.id);
                    }}
                  />
                  
                  {/* File details - clickable for selection */}
                  <div 
                    className="flex-1 cursor-pointer"
                    onClick={() => selectFile(file)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{file.title || file.file_path.split('/').pop()}</div>
                      
                      {/* Status recommendation badge with conditional styling */}
                      {(file.status_recommendation || 
                        file.processed_content?.assessment?.status_recommendation || 
                        file.ai_assessment?.status_recommendation) && (
                        <div className={`text-xs px-2 py-1 rounded-full ml-2 ${
                          (file.status_recommendation === 'KEEP' || 
                           file.processed_content?.assessment?.status_recommendation === 'KEEP' ||
                           file.ai_assessment?.status_recommendation === 'KEEP') 
                            ? 'bg-green-100 text-green-800'
                            : (file.status_recommendation === 'UPDATE' ||
                               file.processed_content?.assessment?.status_recommendation === 'UPDATE' ||
                               file.ai_assessment?.status_recommendation === 'UPDATE')
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-amber-100 text-amber-800'
                        }`}>
                          {file.status_recommendation || 
                           file.processed_content?.assessment?.status_recommendation || 
                           file.ai_assessment?.status_recommendation}
                        </div>
                      )}
                    </div>
                    
                    <div className="text-xs text-gray-500 mt-1">
                      <div className="flex items-center justify-between">
                        <div>Size: {formatFileSize(file.metadata?.size)}</div>
                        <div>Created: {formatDate(file.created_at)}</div>
                      </div>
                      <div className="mt-1 truncate text-gray-400">
                        {file.file_path}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    ));
  };

  // Function to fetch and count tags
  const fetchTags = async () => {
    try {
      // Skip trying to use the database function since it's not available
      // Instead, directly use the client-side extraction
      console.log('Using client-side tag extraction');
      const extractedTags = extractTagsFromFiles(documentationFiles);
      setTags(extractedTags);
    } catch (error) {
      console.error('Error in tag fetching:', error);
      // Set empty tags array in case of error
      setTags([]);
    }
  };
  
  // Helper function to extract tags from files on the client side
  const extractTagsFromFiles = (files: DocumentationFile[]) => {
    // Create a map to count tag occurrences
    const tagMap = new Map<string, number>();
    
    // Process each file
    files.forEach(file => {
      if (!file) return;
      
      try {
        // Extract AI generated tags (handle both string[] and JSON string)
        let aiTags: string[] = [];
        if (file.ai_generated_tags) {
          if (Array.isArray(file.ai_generated_tags)) {
            aiTags = file.ai_generated_tags;
          } else if (typeof file.ai_generated_tags === 'string') {
            // Try to parse JSON string if that's how it's stored
            try {
              aiTags = JSON.parse(file.ai_generated_tags);
            } catch (e) {
              // If it's not valid JSON, maybe it's a comma-separated string?
              aiTags = file.ai_generated_tags.split(',').map(t => t.trim());
            }
          }
        }
        
        // Extract manual tags (handle both string[] and JSON string)
        let manualTags: string[] = [];
        if (file.manual_tags) {
          if (Array.isArray(file.manual_tags)) {
            manualTags = file.manual_tags;
          } else if (typeof file.manual_tags === 'string') {
            // Try to parse JSON string if that's how it's stored
            try {
              manualTags = JSON.parse(file.manual_tags);
            } catch (e) {
              // If it's not valid JSON, maybe it's a comma-separated string?
              manualTags = file.manual_tags.split(',').map(t => t.trim());
            }
          }
        }
        
        // Combine and count all tags
        [...aiTags, ...manualTags].forEach(tag => {
          if (tag && typeof tag === 'string' && tag.trim() !== '') {
            // Normalize the tag (lowercase, trim)
            const normalizedTag = tag.trim().toLowerCase();
            const count = tagMap.get(normalizedTag) || 0;
            tagMap.set(normalizedTag, count + 1);
          }
        });
      } catch (error) {
        console.error('Error processing tags for file:', file.file_path, error);
      }
    });
    
    // Convert map to array and sort by count
    const tagArray = Array.from(tagMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30); // Limit to top 30 tags
    
    return tagArray;
  };
  
  // Toggle tag selection
  const toggleTag = (tag: string) => {
    // Always work with lowercase normalized tags for consistency
    const normalizedTag = tag.trim().toLowerCase();
    
    setSelectedTags(prev => {
      // If tag is already selected, remove it
      if (prev.includes(normalizedTag)) {
        return prev.filter(t => t !== normalizedTag);
      }
      // Otherwise, add it
      return [...prev, normalizedTag];
    });
  };
  
  // Toggle file selection for reprocessing
  const toggleFileSelection = (fileId: string) => {
    setSelectedFilesForProcessing(prev => {
      if (prev.includes(fileId)) {
        return prev.filter(id => id !== fileId);
      }
      return [...prev, fileId];
    });
  };
  
  // Select/deselect all files in the current view
  const toggleSelectAllFiles = () => {
    if (selectedFilesForProcessing.length === documentationFiles.length) {
      // If all are selected, deselect all
      setSelectedFilesForProcessing([]);
    } else {
      // Otherwise, select all visible files
      setSelectedFilesForProcessing(documentationFiles.map(file => file.id));
    }
  };
  
  // Initial data load
  useEffect(() => {
    fetchDocumentationFiles();
  }, []);
  
  // Fetch tags whenever documentation files change
  useEffect(() => {
    if (documentationFiles.length > 0) {
      fetchTags();
    }
  }, [documentationFiles]);

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
            
            {/* File selection and reprocessing controls */}
            <div className={`p-3 mb-3 rounded-md border ${selectedFilesForProcessing.length > 0 ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className="mb-2 flex justify-between items-center">
                <h3 className="text-sm font-medium">
                  {selectedFilesForProcessing.length > 0 
                    ? `${selectedFilesForProcessing.length} files selected` 
                    : 'Select files to reprocess'}
                </h3>
                <button 
                  onClick={toggleSelectAllFiles}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  {selectedFilesForProcessing.length === documentationFiles.length 
                    ? 'Deselect All' 
                    : 'Select All'}
                </button>
              </div>
              
              <div className="flex gap-2 items-center">
                <select
                  value={selectedDocumentType || ''}
                  onChange={(e) => setSelectedDocumentType(e.target.value || null)}
                  className="border rounded px-2 py-1 text-sm flex-1"
                  disabled={selectedFilesForProcessing.length === 0}
                >
                  <option value="">Select Document Type...</option>
                  {documentTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.document_type}</option>
                  ))}
                </select>
                
                <button
                  onClick={updateDocumentTypeForSelectedFiles}
                  disabled={selectedFilesForProcessing.length === 0 || !selectedDocumentType}
                  className={`px-3 py-1 text-sm rounded ${
                    selectedFilesForProcessing.length > 0 && selectedDocumentType
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                  title="Update document type for selected files and mark for reprocessing"
                >
                  Reprocess Selected
                </button>
              </div>
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
          
          {/* Tag filtering section */}
          <div className="px-4 pt-3 pb-3 border-b">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-md font-medium">Filter by Tags</h2>
              {selectedTags.length > 0 && (
                <button 
                  onClick={() => {
                    setSelectedTags([]);
                    setTimeout(handleSearch, 0); // Schedule a search after state update
                  }} 
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Clear Filters
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1">
              {tags.length === 0 ? (
                <div className="text-sm text-gray-500 italic p-2">
                  Loading tags or no tags found in current documents...
                </div>
              ) : (
                tags.map(({tag, count}) => {
                  // Format the tag for display (capitalize first letter of each word)
                  const displayTag = tag
                    .split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
                  
                  return (
                    <button
                      key={tag}
                      onClick={() => {
                        toggleTag(tag);
                        // Use setTimeout to ensure state update completes before search
                        setTimeout(() => handleSearch(), 0);
                      }}
                      className={`text-xs px-3 py-1.5 rounded-full flex items-center transition-colors ${
                        selectedTags.includes(tag.trim().toLowerCase())
                          ? 'bg-blue-500 text-white font-medium shadow-sm'
                          : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                      }`}
                      title={`Filter by '${displayTag}' tag (${count} documents)`}
                    >
                      <span>{displayTag}</span>
                      <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                        selectedTags.includes(tag.trim().toLowerCase())
                          ? 'bg-blue-400 text-white'
                          : 'bg-blue-100 text-blue-800'
                      }`}>{count}</span>
                    </button>
                  );
                })
              )}
            </div>
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
              {/* File actions and header section */}
              <div className="flex items-center justify-between p-3 bg-gray-100 border-b">
                {/* Status badge, if available */}
                {(selectedFile.status_recommendation || 
                 selectedFile.processed_content?.assessment?.status_recommendation ||
                 selectedFile.ai_assessment?.status_recommendation) && (
                  <div className={`text-xs px-2 py-1 rounded-full font-medium mr-2 ${
                    (selectedFile.status_recommendation === 'KEEP' || 
                     selectedFile.processed_content?.assessment?.status_recommendation === 'KEEP' ||
                     selectedFile.ai_assessment?.status_recommendation === 'KEEP') 
                      ? 'bg-green-100 text-green-800'
                      : (selectedFile.status_recommendation === 'UPDATE' ||
                         selectedFile.processed_content?.assessment?.status_recommendation === 'UPDATE' ||
                         selectedFile.ai_assessment?.status_recommendation === 'UPDATE')
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-amber-100 text-amber-800'
                  }`}>
                    {selectedFile.status_recommendation || 
                     selectedFile.processed_content?.assessment?.status_recommendation ||
                     selectedFile.ai_assessment?.status_recommendation}
                  </div>
                )}
                
                {/* Delete button */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent summary toggle
                    
                    // Extract just the filename from the file_path
                    const fileName = selectedFile.file_path.split('/').pop();
                    
                    const confirmDelete = window.confirm(
                      `Are you sure you want to delete the file "${fileName}"?\n\nThis will mark the file as deleted in the database and can be used to remove the file from the filesystem.`
                    );
                    if (confirmDelete) {
                      handleDeleteFile(selectedFile);
                    }
                  }}
                  className="ml-auto mr-3 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 text-xs px-3 py-1 rounded-md flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <path d="M3 6h18"></path>
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                  Delete
                </button>
              </div>

              {/* Collapsible summary section */}
              <div 
                className="p-3 bg-gray-50 flex justify-between items-center cursor-pointer border-b"
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
                                    <div className={`mt-4 p-2 rounded-md border ${
                                      (selectedFile.status_recommendation === 'KEEP' || 
                                       selectedFile.processed_content?.assessment?.status_recommendation === 'KEEP' ||
                                       selectedFile.ai_assessment?.status_recommendation === 'KEEP') 
                                        ? 'bg-green-50 border-green-200'
                                        : (selectedFile.status_recommendation === 'UPDATE' ||
                                           selectedFile.processed_content?.assessment?.status_recommendation === 'UPDATE' ||
                                           selectedFile.ai_assessment?.status_recommendation === 'UPDATE')
                                          ? 'bg-yellow-50 border-yellow-200'
                                          : 'bg-amber-50 border-amber-200'
                                    }`}>
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
                                  <div className={`mt-4 p-2 rounded-md border ${
                                    (selectedFile.status_recommendation === 'KEEP' || 
                                     selectedFile.processed_content?.assessment?.status_recommendation === 'KEEP' ||
                                     selectedFile.ai_assessment?.status_recommendation === 'KEEP') 
                                      ? 'bg-green-50 border-green-200'
                                      : (selectedFile.status_recommendation === 'UPDATE' ||
                                         selectedFile.processed_content?.assessment?.status_recommendation === 'UPDATE' ||
                                         selectedFile.ai_assessment?.status_recommendation === 'UPDATE')
                                        ? 'bg-yellow-50 border-yellow-200'
                                        : 'bg-amber-50 border-amber-200'
                                  }`}>
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
                                  <div className={`mt-4 p-2 rounded-md border ${
                                    (selectedFile.status_recommendation === 'KEEP' || 
                                     selectedFile.processed_content?.assessment?.status_recommendation === 'KEEP' ||
                                     selectedFile.ai_assessment?.status_recommendation === 'KEEP') 
                                      ? 'bg-green-50 border-green-200'
                                      : (selectedFile.status_recommendation === 'UPDATE' ||
                                         selectedFile.processed_content?.assessment?.status_recommendation === 'UPDATE' ||
                                         selectedFile.ai_assessment?.status_recommendation === 'UPDATE')
                                        ? 'bg-yellow-50 border-yellow-200'
                                        : 'bg-amber-50 border-amber-200'
                                  }`}>
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