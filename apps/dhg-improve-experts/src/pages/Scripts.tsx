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
        .select('*', { count: 'exact' });

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      console.log(`Fetched ${data?.length || 0} scripts`);
      
      setScripts(data || []);
      setTotalRecords(count || 0);
    } catch (error: any) {
      console.error('Error fetching scripts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle the search functionality
  const handleSearch = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('scripts')
        .select('*');

      if (searchQuery.trim()) {
        query = query.or(
          `file_path.ilike.%${searchQuery}%,` +
          `title.ilike.%${searchQuery}%,` +
          `summary.ilike.%${searchQuery}%,` +
          `ai_generated_tags.cs.{${searchQuery}},` +
          `manual_tags.cs.{${searchQuery}}`
        );
      }

      const { data, error } = await query
        .order('file_path', { ascending: true })
        .limit(100);

      if (error) throw error;

      console.log(`Search found ${data?.length || 0} scripts`);
      
      setScripts(data || []);
    } catch (error: any) {
      console.error('Error searching scripts:', error);
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
  
  // Handle script deletion
  const handleDeleteScript = async (script: Script) => {
    if (!script) {
      toast.error('Invalid script selected for deletion');
      return;
    }
    
    setLoading(true);
    try {
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

  // Initial data load
  useEffect(() => {
    fetchScripts();
  }, []);

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Main content section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left side - Script list */}
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
          
          {/* Script list */}
          <div className="p-4 overflow-auto flex-grow" style={{ maxHeight: 'calc(100vh - 250px)' }}>
            {scripts.length > 0 ? (
              <div className="space-y-2">
                {scripts.map(script => (
                  <div 
                    key={script.id}
                    className={`p-3 hover:bg-gray-100 rounded my-1 cursor-pointer ${selectedScript?.id === script.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
                    onClick={() => selectScript(script)}
                  >
                    <div className="flex items-start">
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{script.title || script.file_path.split('/').pop()}</div>
                          
                          {/* Status recommendation badge */}
                          {script.ai_assessment?.status_recommendation && (
                            <div className={`text-xs px-2 py-1 rounded-full ml-2 ${
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
                        
                        <div className="text-xs text-gray-500 mt-1">
                          <div className="flex items-center justify-between">
                            <div>
                              Size: {formatFileSize(script.metadata?.size)}
                            </div>
                            <div>
                              Created: {formatDate(script.created_at)}
                            </div>
                          </div>
                          <div className="mt-1 truncate text-gray-400">
                            {script.file_path}
                          </div>
                          <div className="mt-1">
                            {script.document_type_id && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                {documentTypes.find(dt => dt.id === script.document_type_id)?.document_type || 'Unknown Type'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
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
                
                {/* Delete button */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    
                    // Extract just the filename from the file_path
                    const fileName = selectedScript.file_path.split('/').pop();
                    
                    const confirmDelete = window.confirm(
                      `Are you sure you want to delete the script "${fileName}"?\n\nThis will remove the script from the database but will not delete the actual file.`
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
                onClick={() => setShowScriptSummary(!showScriptSummary)}
              >
                <div className="flex items-center">
                  <h2 className="text-lg font-semibold">{selectedScript.title || selectedScript.file_path.split('/').pop()}</h2>
                </div>
                <div className="flex items-center">
                  <span className="text-sm text-gray-500 mr-2">{selectedScript.file_path}</span>
                  <span>{showScriptSummary ? '▲' : '▼'}</span>
                </div>
              </div>
              
              {showScriptSummary && (
                <div className="p-4 bg-gray-50 border-b">
                  {selectedScript.summary ? (
                    <div className="bg-white p-3 rounded border mb-4">
                      <h3 className="text-sm font-medium mb-2">Summary:</h3>
                      <pre className="text-sm whitespace-pre-wrap">{selectedScript.summary}</pre>
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
                        <li>Size: {formatFileSize(selectedScript.metadata?.size)}</li>
                        <li>Created: {formatDate(selectedScript.created_at)}</li>
                        <li>Updated: {formatDate(selectedScript.updated_at)}</li>
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