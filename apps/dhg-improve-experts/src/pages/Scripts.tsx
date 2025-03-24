import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { scriptFileService } from '@/services/scriptFileService';
import ScriptViewer from '@/components/ScriptViewer';
import toast from 'react-hot-toast';
// Import correct types
import { Database } from '@/integrations/supabase/types';

// Type for scripts
type Script = Database['public']['Tables']['scripts']['Row'];

// Type for document types
type DocumentType = Database['public']['Tables']['document_types']['Row'];

function Scripts() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);
  const [loading, setLoading] = useState(false);
  const [showScriptSummary, setShowScriptSummary] = useState(false);
  const [showWithSummaries, setShowWithSummaries] = useState<'all' | 'withSummary' | 'withoutSummary'>('all');
  // Initialize with all folders expanded by default
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set([
    'cli-pipeline',
    'supabase',
    'packages',
    '', // root folder
    'deployment',
    'fix',
    'from-apps-dhg-improve-experts',
    'whisper'
    // Note: Other folders will be expanded when they're encountered
  ]));

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
    } catch (error: any) {
      console.error('Error fetching document types:', error);
      return [];
    }
  };

  // Fetch scripts from the database
  const fetchScripts = async () => {
    setLoading(true);
    try {
      // First fetch document types
      const types = await fetchDocumentTypes();
      
      let query = supabase
        .from('scripts')
        .select('*', { count: 'exact' })
        .not('file_path', 'ilike', '%.archived_scripts%'); // Skip archived scripts
        
      // Apply filter for scripts with or without summaries
      if (showWithSummaries === 'withSummary') {
        query = query.not('summary', 'is', null);
      } else if (showWithSummaries === 'withoutSummary') {
        query = query.is('summary', null);
      }

      // Fetch scripts ordered by created_at in descending order (newest first)
      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      console.log(`Fetched ${data?.length || 0} scripts`);
      
      // Additional client-side filtering to make sure we exclude all archived scripts
      const filteredScripts = data?.filter(script => 
        script.file_path && !script.file_path.includes('.archived_scripts')
      ) || [];
      
      setScripts(filteredScripts);
      setTotalRecords(count || 0);
    } catch (error: any) {
      console.error('Error fetching scripts:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Function to organize scripts into a folder structure
  const organizeScriptsByFolder = () => {
    // Create a folder structure based on file paths
    const folderStructure: { [folderPath: string]: Script[] } = {};
    
    scripts.forEach(script => {
      if (!script.file_path) return;
      
      // Skip any scripts in .archived_scripts folders
      if (script.file_path.includes('/.archived_scripts/')) return;
      
      const pathParts = script.file_path.split('/');
      // Remove the filename to get the folder path
      pathParts.pop();
      const folderPath = pathParts.join('/');
      
      // Skip folders with .archived_scripts in the name
      if (folderPath.includes('.archived_scripts')) return;
      
      if (!folderStructure[folderPath]) {
        folderStructure[folderPath] = [];
      }
      folderStructure[folderPath].push(script);
    });
    
    // Sort scripts in each folder by created_at (newest first)
    Object.keys(folderStructure).forEach(folder => {
      folderStructure[folder].sort((a, b) => {
        // First try to use file creation date from metadata if available
        const fileCreatedAtA = a.metadata?.file_created_at ? new Date(a.metadata.file_created_at).getTime() : null;
        const fileCreatedAtB = b.metadata?.file_created_at ? new Date(b.metadata.file_created_at).getTime() : null;
        
        // If both have metadata file dates, use those
        if (fileCreatedAtA && fileCreatedAtB) {
          return fileCreatedAtB - fileCreatedAtA; // Descending order
        }
        
        // Otherwise fall back to database created_at date
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA; // Descending order
      });
    });
    
    return folderStructure;
  };

  // Handle the search functionality
  const handleSearch = async () => {
    console.log("Search button clicked");
    setLoading(true);
    
    try {
      console.log(`Search query: "${searchQuery}"`);
      
      // First log all current scripts to see what we're working with
      console.log(`Current scripts count before search: ${scripts.length}`);
      
      if (!searchQuery.trim()) {
        // If search is empty, fetch all scripts
        await fetchScripts();
        return;
      }
      
      // Always perform client-side filtering for better performance
      // and to ensure we can search any part of the title
      console.log("Performing client-side filtering");
      const lowercaseQuery = searchQuery.toLowerCase().trim();
      
      // Fetch all scripts first if we don't have many
      // This ensures we're searching against the full set
      if (scripts.length < 100) {
        const { data: allScripts } = await supabase
          .from('scripts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500);
          
        if (allScripts && allScripts.length > 0) {
          console.log(`Fetched ${allScripts.length} scripts for comprehensive search`);
          
          // Filter from the full dataset
          const filteredScripts = allScripts.filter(script => {
            // Skip any scripts in .archived_scripts folders
            if (script.file_path && script.file_path.includes('.archived_scripts')) return false;
            
            // Get the title - if it's not available, use the filename from the path
            const scriptTitle = (script.title || (script.file_path ? script.file_path.split('/').pop() : '')).toLowerCase();
            const scriptPath = (script.file_path || '').toLowerCase();
            
            return scriptTitle.includes(lowercaseQuery) || scriptPath.includes(lowercaseQuery);
          });
          
          console.log(`Client-side filtering found ${filteredScripts.length} matching scripts`);
          setScripts(filteredScripts);
          setLoading(false);
          return;
        }
      }
      
      // If we have many scripts already loaded, just filter the current set
      const filteredScripts = scripts.filter(script => {
        // Skip any scripts in .archived_scripts folders
        if (script.file_path && script.file_path.includes('.archived_scripts')) return false;
        
        const scriptTitle = (script.title || (script.file_path ? script.file_path.split('/').pop() : '')).toLowerCase();
        const scriptPath = (script.file_path || '').toLowerCase();
        
        const matchesTitle = scriptTitle.includes(lowercaseQuery);
        const matchesPath = scriptPath.includes(lowercaseQuery);
        
        return matchesTitle || matchesPath;
      });
      
      // Sort filtered scripts by created_at in descending order (newest first)
      filteredScripts.sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA; // Sort descending
      });
      
      console.log(`Client-side filtering found ${filteredScripts.length} matching scripts`);
      setScripts(filteredScripts);
      setLoading(false);
    } catch (error: any) {
      console.error('Error searching scripts:', error);
      toast.error(`Search error: ${error.message}`);
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

  // Select a script to view
  const selectScript = (script: Script) => {
    // Verify script has a valid path
    if (!script || !script.file_path) {
      console.warn('Attempted to select a script with no path');
      alert('This script is invalid or has no path');
      return;
    }
    
    setSelectedScript(script);
  };

  // Format file size - handles both file_size and size in metadata
  const formatFileSize = (metadata: any) => {
    if (!metadata) return 'Unknown size';
    
    // Check for file_size first (new format)
    const sizeInBytes = metadata.file_size || metadata.size;
    
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
  
  // Get the actual file creation date from metadata if available, otherwise use DB created_at
  const getFileCreationDate = (script: Script) => {
    const fileCreatedAt = script.metadata?.file_created_at;
    if (fileCreatedAt) {
      return formatDate(fileCreatedAt);
    }
    return formatDate(script.created_at);
  };
  
  // Get the actual file modification date from metadata if available
  const getFileModificationDate = (script: Script) => {
    const fileModifiedAt = script.metadata?.file_modified_at;
    if (fileModifiedAt) {
      return formatDate(fileModifiedAt);
    }
    return formatDate(script.last_modified_at || script.updated_at);
  };
  
  // Handle script deletion (delete both file and database record)
  const handleDeleteScript = async (script: Script) => {
    if (!script) {
      toast.error('Invalid script selected for deletion');
      return;
    }
    
    setLoading(true);
    try {
      // First, try to delete the file from disk
      try {
        const result = await scriptFileService.deleteFile(script.file_path);
        console.log('File deletion result:', result);
        // Show toast for successful file deletion
        if (result.success) {
          toast.success(`File "${script.file_path}" deleted from disk`);
        }
      } catch (fileError: any) {
        console.error('Error deleting file:', fileError);
        // Continue with database deletion regardless of file deletion success
        // Don't show toast error since we'll delete the database record anyway
      }
      
      // Then, delete from database regardless
      const { error: deleteError } = await supabase
        .from('scripts')
        .delete()
        .eq('id', script.id);
      
      if (deleteError) {
        throw deleteError;
      }
      
      // Extract just the filename for the success message
      const fileName = script.file_path.split('/').pop();
      toast.success(`Script "${fileName}" has been deleted from the database`);
      
      // Update the UI
      setScripts(prev => prev.filter(s => s.id !== script.id));
      
      // If the currently selected script was deleted, clear selection
      if (selectedScript?.id === script.id) {
        setSelectedScript(null);
      }
    } catch (error: any) {
      console.error('Error deleting script:', error);
      toast.error(`Failed to delete script: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle script archiving (move file to .archived_scripts folder and update the database record)
  const handleArchiveScript = async (script: Script) => {
    if (!script) {
      toast.error('Invalid script selected for archiving');
      return;
    }
    
    setLoading(true);
    try {
      // First, try to archive the file (move it to .archived_scripts folder)
      const result = await scriptFileService.archiveFile(script.file_path);
      console.log('File archive result:', result);
      
      if (result.success) {
        // Update the file path in the database to the new archived location
        const { error: updateError } = await supabase
          .from('scripts')
          .update({
            file_path: result.new_path,
            updated_at: new Date().toISOString()
          })
          .eq('id', script.id);
        
        if (updateError) {
          throw updateError;
        }
        
        // Extract just the filename for the success message
        const fileName = script.file_path.split('/').pop();
        toast.success(`Script "${fileName}" has been archived`);
        
        // Update the UI by removing this script from the list
        // (archived scripts won't show in the list since they're in .archived_scripts)
        setScripts(prev => prev.filter(s => s.id !== script.id));
        
        // If the currently selected script was archived, clear selection
        if (selectedScript?.id === script.id) {
          setSelectedScript(null);
        }
      } else {
        throw new Error('Failed to archive the script file');
      }
    } catch (error: any) {
      console.error('Error archiving script:', error);
      toast.error(`Failed to archive script: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch scripts when filter changes or on initial load
  useEffect(() => {
    fetchScripts();
  }, [showWithSummaries]);

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Main content section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left side - Script list */}
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
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleSearchKeyPress}
              placeholder="Search scripts..."
              className="border rounded px-3 py-2 w-full"
            />
          </div>
          
          {/* Scripts header */}
          <div className="px-4 pt-3 pb-2 border-b">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Script Files</h2>
              <div className="text-sm text-gray-500">Total Scripts: {totalRecords}</div>
            </div>
          </div>
          
          {/* Script list with folder structure */}
          <div className="p-4 overflow-auto flex-grow" style={{ maxHeight: 'calc(100vh - 250px)' }}>
            {scripts.length > 0 ? (
              <div className="space-y-2">
                {(() => {
                  // Organize scripts by folder
                  const folderStructure = organizeScriptsByFolder();
                  
                  // Custom sort order for folders
                  const folderPriority = {
                    'cli-pipeline': 1,
                    'supabase': 2,
                    '': 4, // root folder (moved down below packages)
                    'deployment': 5,
                    'fix': 6,
                    'from-apps-dhg-improve-experts': 7
                  };
                  
                  // Custom sort function for folders with explicit order:
                  // 1. Folders starting with "Scripts"
                  // 2. cli-pipeline 
                  // 3. supabase
                  // 4. packages
                  // 5. root
                  // 6. deployment
                  // 7. fix
                  // 8. from-apps-dhg-improve-experts
                  // 9. app folders
                  // 10. whisper
                  // 11. others alphabetically
                  const folderPaths = Object.keys(folderStructure).sort((a, b) => {
                    // Function to get folder's position in the order
                    const getFolderRank = (folder) => {
                      if (folder.startsWith('Scripts') || folder.startsWith('scripts')) return 1;
                      if (folder === 'cli-pipeline') return 2;
                      if (folder === 'supabase') return 3;
                      if (folder.startsWith('packages')) return 4;
                      if (folder === '') return 5; // root folder
                      if (folder === 'deployment') return 6;
                      if (folder === 'fix') return 7;
                      if (folder === 'from-apps-dhg-improve-experts') return 8;
                      if (folder.startsWith('app')) return 9;
                      if (folder === 'whisper') return 10;
                      return 11; // other folders
                    };
                    
                    const rankA = getFolderRank(a);
                    const rankB = getFolderRank(b);
                    
                    // First sort by rank
                    if (rankA !== rankB) {
                      return rankA - rankB;
                    }
                    
                    // If same rank, sort alphabetically
                    return a.localeCompare(b);
                  });
                  
                  // Auto-expand all folders on first load
                  // We'll do this once outside of the component
                  if (folderPaths.length > 0 && expandedFolders.size < folderPaths.length + 5) { // +5 accounts for pre-defined folders
                    // Schedule this for after current render cycle
                    setTimeout(() => {
                      const allFolders = new Set(expandedFolders);
                      folderPaths.forEach(path => allFolders.add(path));
                      setExpandedFolders(allFolders);
                    }, 0);
                  }
                
                  return folderPaths.map(folderPath => {
                    const isExpanded = expandedFolders.has(folderPath);
                    const toggleFolder = () => {
                      const newExpanded = new Set(expandedFolders);
                      if (isExpanded) {
                        newExpanded.delete(folderPath);
                      } else {
                        newExpanded.add(folderPath);
                      }
                      setExpandedFolders(newExpanded);
                    };
                    
                    return (
                      <div key={folderPath} className="folder-group mb-2">
                        {/* Folder header */}
                        <div 
                          className="flex items-center p-2 bg-gray-100 rounded cursor-pointer hover:bg-gray-200"
                          onClick={(e) => {
                            // Stop propagation to prevent event bubbling
                            e.stopPropagation();
                            toggleFolder();
                          }}
                        >
                          <span 
                            className="mr-2 cursor-pointer" 
                            onClick={(e) => {
                              // Stop propagation to prevent event bubbling
                              e.stopPropagation();
                              toggleFolder();
                            }}
                          >{isExpanded ? '▼' : '▶'}</span>
                          <span className="font-medium">📁 {folderPath || 'Root'}</span>
                          <span className="ml-2 text-xs text-gray-500">({folderStructure[folderPath].length} scripts)</span>
                        </div>
                        
                        {/* Scripts in folder */}
                        {isExpanded && (
                          <div className="pl-6 mt-1 space-y-1">
                            {folderStructure[folderPath].map(script => (
                              <div 
                                key={script.id}
                                className={`p-3 hover:bg-gray-100 rounded my-1 cursor-pointer ${
                                  selectedScript?.id === script.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                                }`}
                                onClick={() => selectScript(script)}
                              >
                                <div className="flex items-start">
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                      <div className="font-medium">{script.title || script.file_path.split('/').pop()}</div>
                                      
                                      <div className="flex items-center">
                                        {/* Importance indicator */}
                                        {script.summary?.importance && (
                                          <div className="mr-1">
                                            {script.summary.importance.toLowerCase().includes('critical') && (
                                              <span className="inline-block w-3 h-3 rounded-full bg-red-500" title="Critical Importance"></span>
                                            )}
                                            {script.summary.importance.toLowerCase().includes('high') && (
                                              <span className="inline-block w-3 h-3 rounded-full bg-orange-500" title="High Importance"></span>
                                            )}
                                            {script.summary.importance.toLowerCase().includes('medium') && (
                                              <span className="inline-block w-3 h-3 rounded-full bg-yellow-400" title="Medium Importance"></span>
                                            )}
                                            {script.summary.importance.toLowerCase().includes('low') && (
                                              <span className="inline-block w-3 h-3 rounded-full bg-blue-400" title="Low Importance"></span>
                                            )}
                                          </div>
                                        )}
                                      
                                        {/* Status recommendation badge */}
                                        {script.ai_assessment?.status_recommendation && (
                                          <div className={`text-xs px-2 py-1 rounded-full ml-1 ${
                                            script.ai_assessment.status_recommendation === 'KEEP' 
                                              ? 'bg-green-100 text-green-800'
                                              : script.ai_assessment.status_recommendation === 'UPDATE'
                                                ? 'bg-yellow-100 text-yellow-800'
                                                : 'bg-amber-100 text-amber-800'
                                          }`}>
                                            {script.ai_assessment.status_recommendation}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    <div className="text-xs text-gray-500 mt-1 truncate break-all">
                                      Path: {script.file_path}
                                    </div>
                                    
                                    <div className="text-xs text-gray-500 mt-1">
                                      <div className="flex items-center justify-between">
                                        <div>
                                          Size: {formatFileSize(script.metadata)}
                                        </div>
                                        <div>
                                          Created: {getFileCreationDate(script)}
                                        </div>
                                      </div>
                                      <div className="mt-1 flex justify-between items-center">
                                        <div>
                                          {script.document_type_id && (
                                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                              Document Type: {documentTypes.find(dt => dt.id === script.document_type_id)?.document_type || 'Unknown Type'}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-10">
                {loading ? 'Loading scripts...' : 'No scripts found'}
              </div>
            )}
          </div>
        </div>
        
        {/* Right side - Script viewer */}
        <div className="col-span-2 bg-white rounded-lg shadow flex flex-col">
          {selectedScript ? (
            <>
              {/* Script actions and header section */}
              <div className="flex items-center justify-between p-3 bg-gray-100 border-b">
                {/* Status badge, if available */}
                {selectedScript.ai_assessment?.status_recommendation && (
                  <div className={`text-xs px-2 py-1 rounded-full font-medium mr-2 ${
                    selectedScript.ai_assessment.status_recommendation === 'KEEP' 
                      ? 'bg-green-100 text-green-800'
                      : selectedScript.ai_assessment.status_recommendation === 'UPDATE'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-amber-100 text-amber-800'
                  }`}>
                    {selectedScript.ai_assessment.status_recommendation}
                  </div>
                )}
                
                {/* Copy content button */}
                <button 
                  onClick={async (e) => {
                    e.stopPropagation();
                    
                    try {
                      if (!selectedScript || !selectedScript.file_path) {
                        toast.error('No script selected');
                        return;
                      }
                      
                      // Use the scriptFileService to get the file content directly from disk
                      const fileContent = await scriptFileService.getFileContent(selectedScript.file_path);
                      
                      if (!fileContent || !fileContent.content) {
                        toast.error('Could not read file content');
                        return;
                      }
                      
                      // Copy content to clipboard
                      await navigator.clipboard.writeText(fileContent.content);
                      toast.success('Script content copied to clipboard!', {
                        duration: 2000
                      });
                    } catch (error) {
                      console.error('Failed to copy content:', error);
                      toast.error('Failed to copy content to clipboard');
                    }
                  }}
                  className="ml-auto mr-3 bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 text-xs px-3 py-1 rounded-md flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  Copy Content
                </button>
                
                {/* Archive button */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    
                    // Extract just the filename from the file_path
                    const fileName = selectedScript.file_path.split('/').pop();
                    
                    const confirmArchive = window.confirm(
                      `Are you sure you want to archive the script "${fileName}"?\n\nThis will move the file to the .archived_scripts folder and update its path in the database. The script will no longer appear in the list but will still exist on disk.`
                    );
                    if (confirmArchive) {
                      handleArchiveScript(selectedScript);
                    }
                  }}
                  className="mr-3 bg-amber-50 hover:bg-amber-100 text-amber-600 hover:text-amber-700 text-xs px-3 py-1 rounded-md flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <path d="M21 8v13H3V8"></path>
                    <path d="M1 3h22v5H1z"></path>
                    <path d="M10 12h4"></path>
                  </svg>
                  Archive
                </button>
                
                {/* Delete button */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    
                    // Extract just the filename from the file_path
                    const fileName = selectedScript.file_path.split('/').pop();
                    
                    const confirmDelete = window.confirm(
                      `Are you sure you want to delete the script "${fileName}"?\n\nThis will PERMANENTLY delete both the file from disk AND remove its record from the database. This action cannot be undone.`
                    );
                    if (confirmDelete) {
                      handleDeleteScript(selectedScript);
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
                onClick={(e) => {
                  e.stopPropagation();
                  setShowScriptSummary(!showScriptSummary);
                }}
              >
                <div className="flex items-center">
                  <h2 className="text-lg font-semibold">{selectedScript.title || selectedScript.file_path.split('/').pop()}</h2>
                </div>
                <div className="flex items-center">
                  <span className="text-sm text-gray-500 mr-2">{selectedScript.file_path}</span>
                  <span 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowScriptSummary(!showScriptSummary);
                    }}
                    className="cursor-pointer"
                  >{showScriptSummary ? '▲' : '▼'}</span>
                </div>
              </div>
              
              {showScriptSummary && (
                <div className="p-4 bg-gray-50 border-b">
                  {selectedScript.summary ? (
                    <div className="bg-white p-3 rounded border mb-4">
                      <h3 className="text-sm font-medium mb-2">
                        Summary
                        {selectedScript.summary.recommendation && selectedScript.summary.importance ? 
                          <span className="text-xs text-green-600 ml-2">(Enhanced with detailed analysis)</span> : 
                          ''
                        }:
                      </h3>
                      
                      {/* Brief section - formatted with bold heading */}
                      {selectedScript.summary.brief && (
                        <div className="mb-4">
                          <h4 className="text-xs font-bold mb-1 text-gray-700">Brief</h4>
                          <p className="text-sm whitespace-pre-wrap">{selectedScript.summary.brief}</p>
                        </div>
                      )}
                      
                      {/* Display detailed fields if present */}
                      {selectedScript.summary.detailed && (
                        <div className="grid grid-cols-1 gap-4">
                          {/* Purpose section - formatted with bold heading */}
                          {selectedScript.summary.detailed.purpose && (
                            <div className="mb-4">
                              <h4 className="text-xs font-bold mb-1 text-gray-700">Purpose</h4>
                              <p className="text-sm whitespace-pre-wrap">{selectedScript.summary.detailed.purpose}</p>
                            </div>
                          )}
                          
                          {/* Recommendation section - formatted with bold heading */}
                          {selectedScript.summary.detailed.recommendation && (
                            <div className="mb-4">
                              <h4 className="text-xs font-bold mb-1 text-gray-700">Recommendation</h4>
                              <p className="text-sm whitespace-pre-wrap">{selectedScript.summary.detailed.recommendation}</p>
                            </div>
                          )}
                          
                          {/* Integration section - formatted with bold heading */}
                          {selectedScript.summary.detailed.integration && (
                            <div className="mb-4">
                              <h4 className="text-xs font-bold mb-1 text-gray-700">Integration</h4>
                              <p className="text-sm whitespace-pre-wrap">{selectedScript.summary.detailed.integration}</p>
                            </div>
                          )}
                          
                          {/* Importance section - formatted with bold heading */}
                          {selectedScript.summary.detailed.importance && (
                            <div className="mb-4">
                              <h4 className="text-xs font-bold mb-1 text-gray-700">Importance</h4>
                              <div className="flex items-center">
                                {/* Add visual importance indicator */}
                                {selectedScript.summary.detailed.importance.toLowerCase().includes('critical') && (
                                  <span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-2"></span>
                                )}
                                {selectedScript.summary.detailed.importance.toLowerCase().includes('high') && (
                                  <span className="inline-block w-3 h-3 rounded-full bg-orange-500 mr-2"></span>
                                )}
                                {selectedScript.summary.detailed.importance.toLowerCase().includes('medium') && (
                                  <span className="inline-block w-3 h-3 rounded-full bg-yellow-400 mr-2"></span>
                                )}
                                {selectedScript.summary.detailed.importance.toLowerCase().includes('low') && (
                                  <span className="inline-block w-3 h-3 rounded-full bg-blue-400 mr-2"></span>
                                )}
                                <p className="text-sm whitespace-pre-wrap">{selectedScript.summary.detailed.importance}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Legacy format support for scripts that don't use the detailed structure */}
                      {!selectedScript.summary.detailed && (
                        <div className="grid grid-cols-1 gap-4">
                          {/* Purpose section */}
                          {selectedScript.summary.purpose && (
                            <div className="mb-4">
                              <h4 className="text-xs font-bold mb-1 text-gray-700">Purpose</h4>
                              <p className="text-sm whitespace-pre-wrap">{selectedScript.summary.purpose}</p>
                            </div>
                          )}
                          
                          {/* Recommendation section */}
                          {selectedScript.summary.recommendation && (
                            <div className="mb-4">
                              <h4 className="text-xs font-bold mb-1 text-gray-700">Recommendation</h4>
                              <p className="text-sm whitespace-pre-wrap">{selectedScript.summary.recommendation}</p>
                            </div>
                          )}
                          
                          {/* Integration section */}
                          {selectedScript.summary.integration && (
                            <div className="mb-4">
                              <h4 className="text-xs font-bold mb-1 text-gray-700">Integration</h4>
                              <p className="text-sm whitespace-pre-wrap">{selectedScript.summary.integration}</p>
                            </div>
                          )}
                          
                          {/* Importance section */}
                          {selectedScript.summary.importance && (
                            <div className="mb-4">
                              <h4 className="text-xs font-bold mb-1 text-gray-700">Importance</h4>
                              <div className="flex items-center">
                                {/* Add visual importance indicator */}
                                {selectedScript.summary.importance.toLowerCase().includes('critical') && (
                                  <span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-2"></span>
                                )}
                                {selectedScript.summary.importance.toLowerCase().includes('high') && (
                                  <span className="inline-block w-3 h-3 rounded-full bg-orange-500 mr-2"></span>
                                )}
                                {selectedScript.summary.importance.toLowerCase().includes('medium') && (
                                  <span className="inline-block w-3 h-3 rounded-full bg-yellow-400 mr-2"></span>
                                )}
                                {selectedScript.summary.importance.toLowerCase().includes('low') && (
                                  <span className="inline-block w-3 h-3 rounded-full bg-blue-400 mr-2"></span>
                                )}
                                <p className="text-sm whitespace-pre-wrap">{selectedScript.summary.importance}</p>
                              </div>
                            </div>
                          )}
                          
                          {/* Dependencies section */}
                          {selectedScript.summary.dependencies && selectedScript.summary.dependencies.length > 0 && (
                            <div className="mb-4">
                              <h4 className="text-xs font-bold mb-1 text-gray-700">Dependencies</h4>
                              <ul className="list-disc pl-5 text-sm">
                                {selectedScript.summary.dependencies.map((dep, index) => (
                                  <li key={index}>{dep}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-white p-3 rounded border mb-4">
                      <h3 className="text-sm font-medium mb-2">Summary:</h3>
                      <p className="text-sm text-gray-500 italic">No summary available for this script.</p>
                    </div>
                  )}
                  
                  {/* Basic metadata */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <h3 className="text-sm font-medium mb-1">File Information:</h3>
                      <ul className="text-xs text-gray-600">
                        <li>Size: {formatFileSize(selectedScript.metadata)}</li>
                        <li>File Created: {getFileCreationDate(selectedScript)}</li>
                        <li>File Modified: {getFileModificationDate(selectedScript)}</li>
                        <li>DB Record Created: {formatDate(selectedScript.created_at)}</li>
                        <li>DB Record Updated: {formatDate(selectedScript.updated_at)}</li>
                        <li>Last Indexed: {formatDate(selectedScript.last_indexed_at)}</li>
                      </ul>
                    </div>
                    
                    {/* Tags section */}
                    {selectedScript.ai_generated_tags && selectedScript.ai_generated_tags.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium mb-1">Tags:</h3>
                        <div className="flex flex-wrap gap-1">
                          {selectedScript.ai_generated_tags.map((tag: string, index: number) => (
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
                  
                  {/* Status recommendation detail */}
                  {selectedScript.ai_assessment?.status_recommendation && (
                    <div className="mt-4">
                      <h3 className="text-sm font-medium mb-1">Status Recommendation:</h3>
                      <div className={`p-2 rounded-md border ${
                        selectedScript.ai_assessment.status_recommendation === 'KEEP' 
                          ? 'bg-green-50 border-green-200'
                          : selectedScript.ai_assessment.status_recommendation === 'UPDATE'
                            ? 'bg-yellow-50 border-yellow-200'
                            : 'bg-amber-50 border-amber-200'
                      }`}>
                        <div className="font-medium">{selectedScript.ai_assessment.status_recommendation}</div>
                        {selectedScript.ai_assessment.explanation && (
                          <div className="text-sm mt-1">{selectedScript.ai_assessment.explanation}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Script content viewer */}
              <div className="flex-1 overflow-auto p-0">
                <ScriptViewer scriptPath={selectedScript.file_path} />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>Select a script to view its content</p>
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

export default Scripts;