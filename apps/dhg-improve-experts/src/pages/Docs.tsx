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
  const [showDuplicatePopup, setShowDuplicatePopup] = useState(false);
  const [duplicateFileInfo, setDuplicateFileInfo] = useState<DocumentationFile | null>(null);
  const [showWithSummaries, setShowWithSummaries] = useState<'all' | 'withSummary' | 'withoutSummary'>('all');

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
      
      // Simple query since we no longer have is_deleted column - files in the DB are all valid
      let query = supabase
        .from('documentation_files')
        .select('*', { count: 'exact' });
      
      // Apply filter for files with or without summaries
      if (showWithSummaries === 'withSummary') {
        query = query.not('summary', 'is', null);
      } else if (showWithSummaries === 'withoutSummary') {
        query = query.is('summary', null);
      }
      
      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      // Filter out files with missing file_path or any other issues
      // Also exclude files under the file_types folder, .txt files, and files in .archive_docs folders
      const validFiles = (data || []).filter(file => 
        file && file.file_path && 
        // Exclude files under the file_types folder at the repo root
        // The path could be like "/file_types/..." or start with "file_types/..."
        !file.file_path.includes('/file_types/') && 
        !file.file_path.startsWith('file_types/') &&
        // Exclude files in .archive_docs folders
        !file.file_path.includes('/.archive_docs/') &&
        !file.file_path.startsWith('.archive_docs/') &&
        // Exclude .txt files
        !file.file_path.endsWith('.txt')
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

  // Document type mapping to define which folders files should be grouped into
  const DEFAULT_DOCUMENT_TYPE_MAPPING = {
    'Code Documentation Markdown': 'code-documentation',
    'Deployment Environment Guide': 'deployment-environment',
    'Git Repository Journal': 'git-repository',
    'Script Report': 'script-reports',
    'Solution Guide': 'solution-guides',
    'Technical Specification': 'technical-specs',
    'Cli Pipeline Markdown' : 'cli-pipeline',
    'README': 'readmes',
    'External Library Documentation': 'external-library',
    'No document type' : "Uncategorized" 
  };

  // Build document type groups based on folder path rather than document type
  const buildDocumentTypeGroups = (files: DocumentationFile[], types: DocumentType[]): DocumentTypeGroup[] => {
    // Create a map for quick document type lookup (still needed for duplicate detection)
    const typeMap = new Map<string, DocumentType>();
    types.forEach(type => typeMap.set(type.id, type));
    
    // Create a map to track filename occurrences for detecting duplicates
    // We'll store file paths in a map keyed by filename
    const filenameMap = new Map<string, string[]>();
    
    // First pass: group files by filename
    files.forEach(file => {
      if (file.file_path) {
        const filename = file.file_path.split('/').pop() || '';
        const paths = filenameMap.get(filename) || [];
        paths.push(file.file_path);
        filenameMap.set(filename, paths);
      }
    });
    
    // Create another map that for each file path, stores the path of its duplicate (if any)
    const duplicatePathMap = new Map<string, string>();
    
    // Loop through each group of files with the same filename
    filenameMap.forEach((paths, filename) => {
      // If there are multiple paths and none are in file_types
      if (paths.length > 1 && !paths.some(path => 
        path.includes('/file_types/') || path.startsWith('file_types/')
      )) {
        // For each path, store the first different path as its duplicate
        paths.forEach((path, index) => {
          // Find the first path that's different from this one
          const otherPath = paths.find(p => p !== path);
          if (otherPath) {
            duplicatePathMap.set(path, otherPath);
          }
        });
      }
    });
    
    // Log duplicate files for debugging - but exclude duplicates where one is in file_types folder
    const duplicatesFound = Array.from(filenameMap.entries())
      .filter(([_, paths]) => {
        // Only count as duplicate if there are multiple paths AND 
        // they're not just duplicates because one is in file_types
        if (paths.length <= 1) return false;
        
        // Check if any of the duplicates are in file_types - if so, don't count as true duplicate
        const hasFileTypesPath = paths.some(path => 
          path.includes('/file_types/') || path.startsWith('file_types/')
        );
        
        // If it has a path in file_types, and other paths elsewhere, don't count as duplicate
        return !hasFileTypesPath;
      })
      .map(([name, paths]) => `${name} (${paths.length} copies)`);
      
    if (duplicatesFound.length > 0) {
      console.log(`Found ${duplicatesFound.length} genuine duplicate filenames:`, duplicatesFound);
    }
    
    // Group files by their folder path instead of document_type_id
    const groups: Record<string, DocumentationFile[]> = {};
    
    files.forEach(file => {
      // Skip invalid files
      if (!file.file_path) {
        console.warn(`File ${file.id} has no file_path, skipping`);
        return;
      }
      
      // No need to check is_deleted anymore as deleted files are now removed from the database
      
      // Extract the directory path from file_path
      const pathParts = file.file_path.split('/');
      // Get the folder name (ignoring the filename at the end)
      // We focus on the first part after 'docs/' or 'prompts/' if it exists
      let folderName = 'Uncategorized';
      
      // Check if the file is in the docs directory
      const docsIndex = pathParts.indexOf('docs');
      if (docsIndex !== -1 && pathParts.length > docsIndex + 1) {
        folderName = pathParts[docsIndex + 1];
      }
      
      // Check if the file is in the prompts directory
      const promptsIndex = pathParts.indexOf('prompts');
      if (promptsIndex !== -1) {
        folderName = 'Prompts';
      }
      
      // Create group array if it doesn't exist
      if (!groups[folderName]) {
        groups[folderName] = [];
      }
      
      // Check if this file has duplicate filenames
      const filename = file.file_path.split('/').pop() || '';
      const paths = filenameMap.get(filename) || [];
      
      // Only mark as duplicate if:
      // 1. There are multiple paths with the same filename, AND
      // 2. None of the paths are in the file_types folder
      const isDuplicate = paths.length > 1 && !paths.some(path => 
        path.includes('/file_types/') || path.startsWith('file_types/')
      );
      
      // Get the path to the other duplicate file (if any)
      const duplicatePath = duplicatePathMap.get(file.file_path);
      
      // Add the file to its group with the duplicate flag and duplicate path
      groups[folderName].push({
        ...file,
        // Add custom properties to indicate duplicate and duplicate path
        metadata: {
          ...file.metadata,
          hasDuplicateFilename: isDuplicate,
          duplicateFilePath: duplicatePath // Path to the other file with the same name
        }
      });
    });
    
    // Convert groups to array of DocumentTypeGroup
    const result: DocumentTypeGroup[] = [];
    
    Object.entries(groups).forEach(([folderName, files]) => {
      // Skip empty groups
      if (files.length === 0) return;
      
      // Determine if this group should be expanded by default
      const shouldBeExpanded = 
        folderName !== 'external-library' && 
        folderName !== 'readmes';
      
      // Map folder names to display names
      const displayName = folderName.charAt(0).toUpperCase() + folderName.slice(1).replace(/-/g, ' ');
      
      // Create group
      const group: DocumentTypeGroup = {
        id: folderName, // Use folder name as ID
        name: displayName, // Use folder name as display name
        files: files.sort((a, b) => {
          // Sort files by created_at (newest first)
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        }),
        isExpanded: shouldBeExpanded
      };
      
      result.push(group);
    });
    
    // Sort groups alphabetically by name
    result.sort((a, b) => a.name.localeCompare(b.name));
    
    // Extract the "Prompts" group if it exists
    const promptsIndex = result.findIndex(group => group.name === 'Prompts');
    if (promptsIndex !== -1) {
      // Remove it from current position
      const prompts = result.splice(promptsIndex, 1)[0];
      // Ensure it's expanded by default
      prompts.isExpanded = true;
      // Insert it roughly halfway through the list
      const halfwayIndex = Math.floor(result.length / 2);
      result.splice(halfwayIndex, 0, prompts);
    }
    
    // Move "External Library" and "Readmes" to the end
    // and make them collapsed by default
    const externalLibIndex = result.findIndex(group => 
      group.name === 'External library'
    );
    
    if (externalLibIndex !== -1) {
      const externalLib = result.splice(externalLibIndex, 1)[0];
      externalLib.isExpanded = false; // Collapsed by default
      result.push(externalLib);
    }
    
    const readmeIndex = result.findIndex(group => 
      group.name === 'Readmes'
    );
    
    if (readmeIndex !== -1) {
      const readme = result.splice(readmeIndex, 1)[0];
      readme.isExpanded = false; // Collapsed by default
      result.push(readme);
    }
    
    // Move "Uncategorized" to the end if it exists
    const uncategorizedIndex = result.findIndex(group => group.id === 'Uncategorized');
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
      
      // If there's no search query and tags are selected, use the more reliable tag toggle function
      if (!searchQuery.trim() && selectedTags.length > 0) {
        console.log('Delegating to toggleTag for more reliable filtering');
        toggleTag(selectedTags[0]);
        return;
      }
      
      // Get document types first
      const types = await fetchDocumentTypes();
      
      // Fetch all documentation files since we'll need to filter client-side for tags
      let query = supabase
        .from('documentation_files')
        .select('*');
      
      // Apply filter for files with or without summaries
      if (showWithSummaries === 'withSummary') {
        query = query.not('summary', 'is', null);
      } else if (showWithSummaries === 'withoutSummary') {
        query = query.is('summary', null);
      }
      
      // Use server-side filtering for search text if no tags are selected
      if (searchQuery.trim() && selectedTags.length === 0) {
        query = query.or(
          `title.ilike.%${searchQuery}%,` +
          `file_path.ilike.%${searchQuery}%`
        );
        
        console.log(`Added text search criteria for title/file_path: "${searchQuery}"`);
      }
      
      // Execute the query
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      console.log(`Database query returned ${data?.length || 0} files`);

      // Filter out files with missing file_path or any other issues
      let validFiles = (data || []).filter(file => 
        file && file.file_path && 
        !file.file_path.includes('/file_types/') && 
        !file.file_path.startsWith('file_types/') &&
        !file.file_path.includes('/.archive_docs/') &&
        !file.file_path.startsWith('.archive_docs/') &&
        !file.file_path.endsWith('.txt')
      );
      
      // Apply text search if we're searching both text and tags
      if (searchQuery.trim() && selectedTags.length > 0) {
        console.log(`[DEBUG SEARCH] Applying client-side text search for "${searchQuery}"`);
        validFiles = validFiles.filter(file => 
          (file.title && file.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (file.file_path && file.file_path.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      }
      
      // Apply tag filtering client-side
      if (selectedTags.length > 0) {
        console.log(`[DEBUG SEARCH] Applying tag filter for tag: ${selectedTags[0]}`);
        const selectedTag = selectedTags[0].toLowerCase().trim();
        
        validFiles = validFiles.filter(file => {
          // Check if this file has the selected tag
          let hasTag = false;
          
          // Process AI generated tags - handle different formats
          if (file.ai_generated_tags) {
            const aiTags = extractTagsFromField(file.ai_generated_tags);
            hasTag = aiTags.some(tag => {
              const fileTag = tag.toLowerCase().trim();
              return fileTag === selectedTag || fileTag.includes(selectedTag) || selectedTag.includes(fileTag);
            });
          }
          
          // Also check manual_tags if exists and we haven't found a match yet
          if (!hasTag && file.manual_tags) {
            const manualTags = extractTagsFromField(file.manual_tags);
            hasTag = manualTags.some(tag => {
              const fileTag = tag.toLowerCase().trim();
              return fileTag === selectedTag || fileTag.includes(selectedTag) || selectedTag.includes(fileTag);
            });
          }
          
          return hasTag;
        });
        
        console.log(`[DEBUG SEARCH] Tag filtering found ${validFiles.length} matching files`);
      }
      
      console.log(`Search found ${validFiles.length} valid files after all filtering`);
      
      // Log sample results
      if (validFiles.length > 0) {
        console.log('Sample matching files:');
        validFiles.slice(0, 5).forEach((file, index) => {
          console.log(`${index + 1}. ${file.file_path}`);
        });
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

  // These functions have been removed from the UI
  // Documentation processing is now handled by CLI scripts:
  //  - scripts/cli-pipeline/document-pipeline-main.sh
  //
  // Functions previously here:
  // - runMarkdownReport
  // - syncDocumentationToDatabase
  // - updateDocsDatabase 
  // - processDocsWithAI

  // Fetch file details by path
  const fetchFileDetailsByPath = async (filePath: string): Promise<DocumentationFile | null> => {
    try {
      const { data, error } = await supabase
        .from('documentation_files')
        .select('*')
        .eq('file_path', filePath)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching file details by path:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Exception fetching file details by path:', error);
      return null;
    }
  };
  
  // Show duplicate file info popup
  const showDuplicateFileInfo = async (filePath: string) => {
    if (!filePath) {
      toast.error("No duplicate file path available");
      return;
    }
    
    // First try to find the file in our current loaded files (faster)
    const fileInMemory = documentationFiles.find(f => f.file_path === filePath);
    
    if (fileInMemory) {
      setDuplicateFileInfo(fileInMemory);
      setShowDuplicatePopup(true);
      return;
    }
    
    // If not found in memory, fetch from database
    const fileFromDb = await fetchFileDetailsByPath(filePath);
    
    if (fileFromDb) {
      setDuplicateFileInfo(fileFromDb);
      setShowDuplicatePopup(true);
    } else {
      // If we can't find it in the database, create a minimal file object
      setDuplicateFileInfo({
        id: '',
        file_path: filePath,
        created_at: null,
        updated_at: null,
        title: filePath.split('/').pop() || '',
        metadata: {
          file_size: 0
        }
      } as DocumentationFile);
      setShowDuplicatePopup(true);
    }
  };
  
  // Select a file to view
  const selectFile = (file: DocumentationFile) => {
    // No need to check is_deleted anymore as deleted files are removed from the database
    
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
  
  // Handle document archiving (move to .archive_docs folder)
  const handleArchiveFile = async (file: DocumentationFile) => {
    if (!file) {
      toast.error('Invalid file selected for archiving');
      return;
    }
    
    setLoading(true);
    try {
      // Use markdownFileService to archive the file
      const result = await markdownFileService.archiveFile(file.file_path);
      
      if (result.success) {
        // Update the file path in the database to reflect the new archived location
        const { error: updateError } = await supabase
          .from('documentation_files')
          .update({
            file_path: result.newPath,
            updated_at: new Date().toISOString()
          })
          .eq('id', file.id);
        
        if (updateError) {
          throw updateError;
        }
        
        // Extract just the filename for the success message
        const fileName = file.file_path.split('/').pop();
        toast.success(`File "${fileName}" has been archived`);
        
        // Update the UI
        // Since we filter out archived files, just remove this file from the list
        setDocumentationFiles(prev => prev.filter(f => f.id !== file.id));
        
        // Rebuild groups to reflect the archived file
        const updatedGroups = buildDocumentTypeGroups(
          documentationFiles.filter(f => f.id !== file.id),
          documentTypes
        );
        setDocumentTypeGroups(updatedGroups);
        
        // If the currently selected file was archived, clear selection
        if (selectedFile?.id === file.id) {
          setSelectedFile(null);
        }
      } else {
        throw new Error(result.message || 'Failed to archive file');
      }
    } catch (error) {
      console.error('Error archiving file:', error);
      toast.error(`Failed to archive file: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle document deletion
  const handleDeleteFile = async (file: DocumentationFile, byPath: boolean = false) => {
    if (!file) {
      toast.error('Invalid file selected for deletion');
      return;
    }
    
    setLoading(true);
    try {
      // First, try to delete the file from disk using markdownFileService
      try {
        const result = await markdownFileService.deleteFile(file.file_path);
        console.log('File deletion result:', result);
        // Show toast for successful file deletion
        if (result.success) {
          toast.success(`File "${file.file_path.split('/').pop()}" deleted from disk`);
        }
      } catch (fileError: any) {
        console.error('Error deleting file from disk:', fileError);
        // Continue with database deletion regardless of file deletion success
        // Don't show toast error since we'll delete the database record anyway
      }
      
      // Then, delete from database regardless of whether the file deletion succeeded
      let deleteResult;
      
      // Check if we're deleting by ID or by path
      if (!byPath && file.id) {
        // Delete the file from the database by ID
        const { error: deleteError, data } = await supabase
          .from('documentation_files')
          .delete()
          .eq('id', file.id);
        
        if (deleteError) {
          throw deleteError;
        }
        
        deleteResult = { success: true };
      } else if (byPath && file.file_path) {
        // Delete the file from the database by file_path
        const { error: deleteError, data } = await supabase
          .from('documentation_files')
          .delete()
          .eq('file_path', file.file_path);
        
        if (deleteError) {
          throw deleteError;
        }
        
        deleteResult = { success: true };
      } else {
        throw new Error('Missing file ID or path for deletion');
      }
      
      if (deleteResult.success) {
        // Extract just the filename for the success message
        const fileName = file.file_path.split('/').pop();
        toast.success(`File "${fileName}" has been removed from the database`);
        
        // Update the UI
        // Remove the file from the current documentationFiles list
        setDocumentationFiles(prev => prev.filter(f => 
          (f.id && file.id) ? f.id !== file.id : f.file_path !== file.file_path
        ));
        
        // Rebuild groups to reflect the deleted file
        const updatedGroups = buildDocumentTypeGroups(
          documentationFiles.filter(f => 
            (f.id && file.id) ? f.id !== file.id : f.file_path !== file.file_path
          ),
          documentTypes
        );
        setDocumentTypeGroups(updatedGroups);
        
        // If the currently selected file was deleted, clear selection
        if ((selectedFile?.id && file.id && selectedFile.id === file.id) || 
            (selectedFile?.file_path === file.file_path)) {
          setSelectedFile(null);
        }
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
                      <div className="flex items-center">
                        <div className="font-medium">{file.title || file.file_path.split('/').pop()}</div>
                        
                        {/* Duplicate filename indicator */}
                        {file.metadata?.hasDuplicateFilename && (
                          <div 
                            className="ml-2 px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full flex items-center font-medium cursor-pointer hover:bg-red-200"
                            title={`Click to view duplicate file info. Filename: ${file.file_path.split('/').pop()}`}
                            onClick={async (e) => {
                              e.stopPropagation(); // Prevent file selection
                              
                              // Get the path to the duplicate file
                              const duplicatePath = file.metadata?.duplicateFilePath;
                              
                              if (!duplicatePath) {
                                toast.error("Couldn't find the duplicate file path");
                                return;
                              }
                              
                              // Copy the duplicate file path to clipboard
                              navigator.clipboard.writeText(duplicatePath)
                                .then(() => {
                                  // Show a toast notification with longer duration
                                  toast.success(`Duplicate file path copied: ${duplicatePath}`, {
                                    duration: 10000, // 10 seconds
                                    position: 'bottom-center',
                                    style: {
                                      maxWidth: '80vw',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis'
                                    }
                                  });
                                  
                                  // Show the duplicate file info popup
                                  showDuplicateFileInfo(duplicatePath);
                                })
                                .catch(err => {
                                  console.error('Failed to copy path:', err);
                                  toast.error('Failed to copy path to clipboard');
                                });
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            Duplicate
                          </div>
                        )}
                      </div>
                      
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
                        <div>Size: {formatFileSize(file.metadata?.file_size || file.metadata?.size)}</div>
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
      console.log('[DEBUG TAGS] Using client-side tag extraction');
      console.log(`[DEBUG TAGS] Processing ${documentationFiles.length} files for tag extraction`);
      
      // Show sample of input files
      console.log('[DEBUG TAGS] Sample input files:', documentationFiles.slice(0, 3).map(file => ({
        path: file.file_path,
        ai_tags_type: file.ai_generated_tags ? typeof file.ai_generated_tags : 'undefined',
        ai_tags: file.ai_generated_tags,
        manual_tags_type: file.manual_tags ? typeof file.manual_tags : 'undefined',
        manual_tags: file.manual_tags
      })));
      
      const extractedTags = extractTagsFromFiles(documentationFiles);
      console.log(`[DEBUG TAGS] Extracted ${extractedTags.length} unique tags`);
      setTags(extractedTags);
    } catch (error) {
      console.error('[DEBUG TAGS] Error in tag fetching:', error);
      // Set empty tags array in case of error
      setTags([]);
    }
  };
  
  // Helper function to extract tags from files on the client side
  const extractTagsFromFiles = (files: DocumentationFile[]) => {
    // Create a map to count tag occurrences
    const tagMap = new Map<string, number>();
    
    console.log(`[DEBUG EXTRACT] Starting tag extraction from ${files.length} files`);
    
    // Process each file
    files.forEach(file => {
      if (!file) return;
      
      try {
        // Process AI generated tags
        if (file.ai_generated_tags) {
          const aiTags = extractTagsFromField(file.ai_generated_tags);
          
          // Add each tag to the map
          aiTags.forEach(tag => {
            if (tag && tag.trim() !== '') {
              const normalizedTag = tag.trim().toLowerCase();
              const count = tagMap.get(normalizedTag) || 0;
              tagMap.set(normalizedTag, count + 1);
            }
          });
        }
        
        // Process manual tags
        if (file.manual_tags) {
          const manualTags = extractTagsFromField(file.manual_tags);
          
          // Add each tag to the map
          manualTags.forEach(tag => {
            if (tag && tag.trim() !== '') {
              const normalizedTag = tag.trim().toLowerCase();
              const count = tagMap.get(normalizedTag) || 0;
              tagMap.set(normalizedTag, count + 1);
            }
          });
        }
      } catch (error) {
        console.error('[DEBUG EXTRACT] Error processing tags for file:', file.file_path, error);
      }
    });
    
    // Convert map to array and sort by count
    const tagArray = Array.from(tagMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30); // Limit to top 30 tags
    
    console.log(`[DEBUG EXTRACT] Extracted ${tagArray.length} unique tags`);
    return tagArray;
  };
  
  // Helper function to extract tags from a field that could be array, string, or JSON
  const extractTagsFromField = (field: any): string[] => {
    const tags: string[] = [];
    
    // If field is null or undefined, return empty array
    if (!field) return tags;
    
    // Case 1: Field is already an array
    if (Array.isArray(field)) {
      field.forEach(item => {
        if (typeof item === 'string' && item.trim() !== '') {
          tags.push(item);
        }
      });
      return tags;
    }
    
    // Case 2: Field is a string
    if (typeof field === 'string') {
      // Try to parse as JSON
      try {
        const parsed = JSON.parse(field);
        
        // If parsed result is an array
        if (Array.isArray(parsed)) {
          parsed.forEach(item => {
            if (typeof item === 'string' && item.trim() !== '') {
              tags.push(item);
            }
          });
        }
        // If parsed result is an object
        else if (parsed && typeof parsed === 'object') {
          Object.values(parsed).forEach(item => {
            if (typeof item === 'string' && item.trim() !== '') {
              tags.push(item);
            }
          });
        }
      } catch (e) {
        // If JSON parsing fails, treat as comma-separated string
        field.split(',')
          .map((t: string) => t.trim())
          .filter((t: string) => t !== '')
          .forEach((t: string) => tags.push(t));
      }
    }
    
    return tags;
  };
  
  // Toggle tag selection and perform immediate filtering
  const toggleTag = async (tag: string) => {
    // Always work with lowercase normalized tags for consistency
    const normalizedTag = tag.trim().toLowerCase();
    console.log(`[DEBUG FILTER] Tag clicked: "${normalizedTag}"`);
    
    // If tag is already selected, clear selection
    if (selectedTags.includes(normalizedTag)) {
      console.log(`[DEBUG FILTER] Clearing tag: "${normalizedTag}"`);
      await setSelectedTags([]);
      // Fetch all files when clearing filters
      fetchDocumentationFiles();
    } else {
      // Otherwise, set it as the only selected tag
      console.log(`[DEBUG FILTER] Setting tag: "${normalizedTag}"`);
      await setSelectedTags([normalizedTag]);
      
      // Directly filter the files by tag
      setLoading(true);
      try {
        console.log(`[DEBUG FILTER] Directly filtering for tag: "${normalizedTag}"`);
        
        // Fetch all documentation files first
        const { data, error } = await supabase
          .from('documentation_files')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500);
        
        if (error) {
          console.error('[DEBUG FILTER] Supabase query error:', error);
          throw error;
        }
        
        console.log(`[DEBUG FILTER] Supabase query returned ${data?.length || 0} raw results`);
        
        // Filter out files with missing file_path or any other issues
        const validFiles = (data || []).filter(file => 
          file && file.file_path && 
          !file.file_path.includes('/file_types/') && 
          !file.file_path.startsWith('file_types/') &&
          !file.file_path.includes('/.archive_docs/') &&
          !file.file_path.startsWith('.archive_docs/') &&
          !file.file_path.endsWith('.txt')
        );
        
        console.log(`[DEBUG FILTER] After path filtering: ${validFiles.length} valid files`);
        
        // Perform client-side filtering for tags
        const filteredFiles = validFiles.filter(file => {
          // Check if this file has the selected tag
          let hasTag = false;
          
          // Process AI generated tags - handle different formats
          if (file.ai_generated_tags) {
            // Case 1: If ai_generated_tags is an array
            if (Array.isArray(file.ai_generated_tags)) {
              hasTag = file.ai_generated_tags.some(tag => {
                if (typeof tag === 'string') {
                  const fileTag = tag.toLowerCase().trim();
                  return fileTag === normalizedTag || fileTag.includes(normalizedTag);
                }
                return false;
              });
            }
            // Case 2: If ai_generated_tags is a string (possibly JSON)
            else if (typeof file.ai_generated_tags === 'string') {
              // Try to parse as JSON
              try {
                const parsedTags = JSON.parse(file.ai_generated_tags);
                
                // If parsed result is an array
                if (Array.isArray(parsedTags)) {
                  hasTag = parsedTags.some(tag => {
                    if (typeof tag === 'string') {
                      const fileTag = tag.toLowerCase().trim();
                      return fileTag === normalizedTag || fileTag.includes(normalizedTag);
                    }
                    return false;
                  });
                }
                // If parsed result is an object
                else if (parsedTags && typeof parsedTags === 'object') {
                  hasTag = Object.values(parsedTags).some(tag => {
                    if (typeof tag === 'string') {
                      const fileTag = tag.toLowerCase().trim();
                      return fileTag === normalizedTag || fileTag.includes(normalizedTag);
                    }
                    return false;
                  });
                }
              } catch (e) {
                // If not valid JSON, check if the string itself contains the tag
                if (file.ai_generated_tags.toLowerCase().includes(normalizedTag)) {
                  hasTag = true;
                }
              }
            }
          }
          
          // Also check manual_tags if exists and we haven't found a match yet
          if (!hasTag && file.manual_tags) {
            // Same logic as for ai_generated_tags
            if (Array.isArray(file.manual_tags)) {
              hasTag = file.manual_tags.some(tag => {
                if (typeof tag === 'string') {
                  const fileTag = tag.toLowerCase().trim();
                  return fileTag === normalizedTag || fileTag.includes(normalizedTag);
                }
                return false;
              });
            } else if (typeof file.manual_tags === 'string') {
              try {
                const parsedTags = JSON.parse(file.manual_tags);
                if (Array.isArray(parsedTags)) {
                  hasTag = parsedTags.some(tag => {
                    if (typeof tag === 'string') {
                      const fileTag = tag.toLowerCase().trim();
                      return fileTag === normalizedTag || fileTag.includes(normalizedTag);
                    }
                    return false;
                  });
                } else if (parsedTags && typeof parsedTags === 'object') {
                  hasTag = Object.values(parsedTags).some(tag => {
                    if (typeof tag === 'string') {
                      const fileTag = tag.toLowerCase().trim();
                      return fileTag === normalizedTag || fileTag.includes(normalizedTag);
                    }
                    return false;
                  });
                }
              } catch (e) {
                if (file.manual_tags.toLowerCase().includes(normalizedTag)) {
                  hasTag = true;
                }
              }
            }
          }
          
          // Debug output for the first few files to understand the filtering
          if (validFiles.indexOf(file) < 10) {
            console.log(`[DEBUG FILTER] File ${file.file_path} - Has tag "${normalizedTag}": ${hasTag}`);
            console.log(`  ai_generated_tags:`, file.ai_generated_tags);
            console.log(`  manual_tags:`, file.manual_tags);
          }
          
          return hasTag;
        });
        
        console.log(`[DEBUG FILTER] Found ${filteredFiles.length} files with tag "${normalizedTag}"`);
        
        // Update the state with the filtered files
        setDocumentationFiles(filteredFiles);
        
        // Update document type groups with filtered files
        const types = await fetchDocumentTypes();
        const groups = buildDocumentTypeGroups(filteredFiles, types);
        setDocumentTypeGroups(groups);
        
        // Log sample of displayed files for debugging
        if (filteredFiles.length > 0) {
          console.log('[DEBUG FILTER] Sample filtered files:', 
            filteredFiles.slice(0, 5).map(f => f.file_path));
        } else {
          console.log('[DEBUG FILTER] No files matched the tag filter.');
        }
      } catch (error) {
        console.error('[DEBUG FILTER] Error filtering by tag:', error);
        fetchDocumentationFiles(); // fallback to fetching all
      } finally {
        setLoading(false);
      }
    }
  };
  
  // Helper function for debugging tag issues
  const debugTagFilter = (docTags, selectedTag) => {
    if (!docTags || !Array.isArray(docTags)) {
      console.log("Document tags not available or not an array");
      return [];
    }
    
    // Map all tags and show if they match the selected tag
    return docTags.map(tag => {
      const normalizedTag = String(tag).toLowerCase().trim();
      const normalizedSelectedTag = selectedTag.toLowerCase().trim();
      const isMatch = normalizedTag === normalizedSelectedTag;
      
      return {
        original: tag,
        normalized: normalizedTag,
        selectedTag: normalizedSelectedTag,
        isMatch
      };
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
  
  // Initial data load and refetch when filter changes
  useEffect(() => {
    fetchDocumentationFiles();
  }, [showWithSummaries]);
  
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
            <div className="flex flex-wrap justify-between gap-2 mb-3">
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Search
              </button>
              
              {/* Summary filter toggle */}
              <div className="flex gap-1">
                <button
                  onClick={() => setShowWithSummaries('all')}
                  className={`px-2 py-1 text-xs rounded ${
                    showWithSummaries === 'all' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setShowWithSummaries('withSummary')}
                  className={`px-2 py-1 text-xs rounded ${
                    showWithSummaries === 'withSummary' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  With Summary
                </button>
                <button
                  onClick={() => setShowWithSummaries('withoutSummary')}
                  className={`px-2 py-1 text-xs rounded ${
                    showWithSummaries === 'withoutSummary' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  No Summary
                </button>
              </div>
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
                    fetchDocumentationFiles(); // Refresh all files when clearing tags
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
                (() => {
                  console.log('[DEBUG PILLS] Rendering tag pills with tags:', tags);
                  console.log('[DEBUG PILLS] Selected tags:', selectedTags);
                  
                  return tags.map(({tag, count}, index) => {
                    // Format the tag for display (capitalize first letter of each word)
                    const displayTag = tag
                      .split(' ')
                      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                      .join(' ');
                    
                    const normalizedTag = tag.trim().toLowerCase();
                    const isSelected = selectedTags.includes(normalizedTag);
                    
                    console.log(`[DEBUG PILLS] Tag ${index+1}: "${tag}" (normalized: "${normalizedTag}"), count: ${count}, selected: ${isSelected}`);
                    
                    return (
                      <button
                        key={tag}
                        onClick={() => {
                          console.log('[DEBUG PILLS] Tag button clicked:', tag);
                          toggleTag(tag);
                        }}
                        className={`text-xs px-3 py-1.5 rounded-full flex items-center transition-colors ${
                          isSelected
                            ? 'bg-blue-500 text-white font-medium shadow-sm'
                            : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                        }`}
                        title={`Filter by '${displayTag}' tag (${count} documents)`}
                      >
                        <span>{displayTag}</span>
                        <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                          isSelected
                            ? 'bg-blue-400 text-white'
                            : 'bg-blue-100 text-blue-800'
                        }`}>{count}</span>
                      </button>
                    );
                  });
                })()
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
                
                {/* Archive button */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent summary toggle
                    
                    // Extract just the filename from the file_path
                    const fileName = selectedFile.file_path.split('/').pop();
                    
                    const confirmArchive = window.confirm(
                      `Are you sure you want to archive the file "${fileName}"?\n\nThis will move the file to an .archive_docs folder and update its path in the database. The file will no longer appear in the list but will still exist on disk.`
                    );
                    if (confirmArchive) {
                      handleArchiveFile(selectedFile);
                    }
                  }}
                  className="ml-auto mr-3 bg-amber-50 hover:bg-amber-100 text-amber-600 hover:text-amber-700 text-xs px-3 py-1 rounded-md flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <path d="M21 8v13H3V8"></path>
                    <path d="M1 3h22v5H1z"></path>
                    <path d="M10 12h4"></path>
                  </svg>
                  Archive
                </button>

                {/* Copy content button */}
                <button 
                  onClick={async (e) => {
                    e.stopPropagation(); // Prevent summary toggle
                    
                    try {
                      if (!selectedFile || !selectedFile.file_path) {
                        toast.error('No file selected');
                        return;
                      }
                      
                      // Use the markdownFileService to get the file content directly from disk
                      const fileContent = await markdownFileService.getFileContent(selectedFile.file_path);
                      
                      if (!fileContent || !fileContent.content) {
                        toast.error('Could not read file content');
                        return;
                      }
                      
                      // Copy content to clipboard
                      await navigator.clipboard.writeText(fileContent.content);
                      toast.success('Document content copied to clipboard!', {
                        duration: 2000
                      });
                    } catch (error) {
                      console.error('Failed to copy content:', error);
                      toast.error('Failed to copy content to clipboard');
                    }
                  }}
                  className="mr-3 bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 text-xs px-3 py-1 rounded-md flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  Copy Content
                </button>
                
                {/* Delete button */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent summary toggle
                    
                    // Extract just the filename from the file_path
                    const fileName = selectedFile.file_path.split('/').pop();
                    
                    const confirmDelete = window.confirm(
                      `Are you sure you want to delete the file "${fileName}"?\n\nWARNING: This will permanently delete the file from both the database and filesystem. This action cannot be undone.\n\nFull path: ${selectedFile.file_path}`
                    );
                    if (confirmDelete) {
                      // Show a loading toast that we'll update with the result
                      const toastId = toast.loading(`Attempting to delete ${fileName}...`);
                      
                      // Try with absolute path first as a test
                      markdownFileService.deleteFile(selectedFile.file_path)
                        .then(result => {
                          console.log('File deletion result:', result);
                          
                          // Now call handleDeleteFile to update the database
                          handleDeleteFile(selectedFile)
                            .then(() => {
                              // Update the toast on success
                              toast.success(`File "${fileName}" has been permanently deleted`, {
                                id: toastId,
                                duration: 5000
                              });
                            })
                            .catch(error => {
                              // Even if DB update failed, file might be deleted
                              toast.error(`Database update failed: ${error.message}`, {
                                id: toastId,
                                duration: 5000
                              });
                            });
                        })
                        .catch(error => {
                          toast.error(`Failed to delete file: ${error.message}`, {
                            id: toastId,
                            duration: 5000
                          });
                        });
                    }
                  }}
                  className="mr-3 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 text-xs px-3 py-1 rounded-md flex items-center"
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
                <div className="flex items-center">
                  <h2 className="text-lg font-semibold">{selectedFile.title || selectedFile.file_path.split('/').pop()}</h2>
                  
                  {/* Duplicate indicator in file detail view */}
                  {selectedFile.metadata?.hasDuplicateFilename && (
                    <div 
                      className="ml-3 px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full flex items-center font-medium cursor-pointer hover:bg-red-200"
                      title={`Click to view duplicate file info. Filename: ${selectedFile.file_path.split('/').pop()}`}
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent summary toggle
                        
                        // Get the path to the duplicate file
                        const duplicatePath = selectedFile.metadata?.duplicateFilePath;
                        
                        if (!duplicatePath) {
                          toast.error("Couldn't find the duplicate file path");
                          return;
                        }
                        
                        // Copy the duplicate file path to clipboard
                        navigator.clipboard.writeText(duplicatePath)
                          .then(() => {
                            // Show a toast notification with longer duration
                            toast.success(`Duplicate file path copied: ${duplicatePath}`, {
                              duration: 10000, // 10 seconds
                              position: 'bottom-center',
                              style: {
                                maxWidth: '80vw',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }
                            });
                            
                            // Show the duplicate file info popup
                            showDuplicateFileInfo(duplicatePath);
                          })
                          .catch(err => {
                            console.error('Failed to copy path:', err);
                            toast.error('Failed to copy path to clipboard');
                          });
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Duplicate Filename
                    </div>
                  )}
                </div>
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
                                  
                                  {/* Document details section for type and status recommendation */}
                                  <div className="mt-4 grid grid-cols-2 gap-4">
                                    {/* Document Type */}
                                    <div className="p-2 rounded-md border bg-blue-50 border-blue-200">
                                      <strong>Document Type</strong>: {
                                        (() => {
                                          const docType = documentTypes.find(type => type.id === selectedFile.document_type_id);
                                          return docType ? docType.document_type : 'Uncategorized';
                                        })()
                                      }
                                    </div>
                                    
                                    {/* Status Recommendation */}
                                    <div className={`p-2 rounded-md border ${
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
                                        selectedFile.ai_assessment?.status_recommendation || 
                                        'Not evaluated'
                                      }
                                    </div>
                                  </div>
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
                                
                                {/* Document details section for type and status recommendation */}
                                <div className="mt-4 grid grid-cols-2 gap-4">
                                  {/* Document Type */}
                                  <div className="p-2 rounded-md border bg-blue-50 border-blue-200">
                                    <strong>Document Type</strong>: {
                                      (() => {
                                        const docType = documentTypes.find(type => type.id === selectedFile.document_type_id);
                                        return docType ? docType.document_type : 'Uncategorized';
                                      })()
                                    }
                                  </div>
                                  
                                  {/* Status Recommendation */}
                                  <div className={`p-2 rounded-md border ${
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
                                      selectedFile.ai_assessment?.status_recommendation ||
                                      'Not evaluated'
                                    }
                                  </div>
                                </div>
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
                                
                                {/* Document details section for type and status recommendation */}
                                <div className="mt-4 grid grid-cols-2 gap-4">
                                  {/* Document Type */}
                                  <div className="p-2 rounded-md border bg-blue-50 border-blue-200">
                                    <strong>Document Type</strong>: {
                                      (() => {
                                        const docType = documentTypes.find(type => type.id === selectedFile.document_type_id);
                                        return docType ? docType.document_type : 'Uncategorized';
                                      })()
                                    }
                                  </div>
                                  
                                  {/* Status Recommendation */}
                                  <div className={`p-2 rounded-md border ${
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
                                      selectedFile.ai_assessment?.status_recommendation ||
                                      'Not evaluated'
                                    }
                                  </div>
                                </div>
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
                      
                      {/* Document details section for type and status recommendation even when no summary */}
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        {/* Document Type */}
                        <div className="p-2 rounded-md border bg-blue-50 border-blue-200">
                          <strong>Document Type</strong>: {
                            (() => {
                              const docType = documentTypes.find(type => type.id === selectedFile.document_type_id);
                              return docType ? docType.document_type : 'Uncategorized';
                            })()
                          }
                        </div>
                        
                        {/* Status Recommendation */}
                        <div className={`p-2 rounded-md border ${
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
                            selectedFile.ai_assessment?.status_recommendation || 
                            'Not evaluated'
                          }
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Basic metadata and tags */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <h3 className="text-sm font-medium mb-1">File Information:</h3>
                      <ul className="text-xs text-gray-600">
                        <li>Size: {formatFileSize(selectedFile.metadata?.file_size || selectedFile.metadata?.size)}</li>
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
      
      {/* Duplicate file info popup */}
      {showDuplicatePopup && duplicateFileInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-5 rounded-lg shadow-lg max-w-md w-full">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold">Duplicate File Information</h3>
              <button 
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setShowDuplicatePopup(false)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            
            <div className="mb-4 pb-3 border-b">
              <div className="font-medium text-blue-800 mb-1">Filename</div>
              <div className="text-md">{duplicateFileInfo.file_path.split('/').pop()}</div>
            </div>
            
            <div className="mb-4 pb-3 border-b">
              <div className="font-medium text-blue-800 mb-1">Full Path</div>
              <div className="text-sm bg-gray-50 p-2 rounded overflow-x-auto">{duplicateFileInfo.file_path}</div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4 pb-3 border-b">
              <div>
                <div className="font-medium text-blue-800 mb-1">Size</div>
                <div>{formatFileSize(duplicateFileInfo.metadata?.file_size || duplicateFileInfo.metadata?.size)}</div>
              </div>
              <div>
                <div className="font-medium text-blue-800 mb-1">Created</div>
                <div>{formatDate(duplicateFileInfo.created_at)}</div>
              </div>
            </div>
            
            <div className="flex justify-between">
              <button 
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                onClick={() => setShowDuplicatePopup(false)}
              >
                Close
              </button>
              <button 
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 flex items-center"
                onClick={() => {
                  // Confirm deletion
                  const confirmDelete = window.confirm(
                    `Are you sure you want to delete the duplicate file: "${duplicateFileInfo.file_path}"?\n\nWARNING: This will permanently delete the file from both the database and filesystem. This action cannot be undone.`
                  );
                  
                  if (confirmDelete) {
                    // Close popup
                    setShowDuplicatePopup(false);
                    
                    // Delete the file
                    handleDeleteFile(duplicateFileInfo, true);
                  }
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Docs;