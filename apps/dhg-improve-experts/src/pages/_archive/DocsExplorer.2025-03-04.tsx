import React, { useState, useEffect } from 'react';
import { marked } from 'marked';
import { markdownFileService, MarkdownTreeItem } from '@/services/markdownFileService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'react-hot-toast';

// Icons for UI
const ICONS = {
  folder: '📁',
  folderOpen: '📂',
  file: '📄',
  prompt: '📜',
  search: '🔍',
  spinner: '⏳'
};

// Tree Item Component
interface TreeItemProps {
  item: MarkdownTreeItem;
  onSelect: (item: MarkdownTreeItem) => void;
  toggleFolder: (item: MarkdownTreeItem) => void;
  level?: number;
  selectedPath?: string;
  searchQuery?: string;
  searchResults?: string[];
}

const TreeItem: React.FC<TreeItemProps> = ({ 
  item, 
  onSelect, 
  toggleFolder,
  level = 0,
  selectedPath,
  searchQuery = '',
  searchResults = []
}) => {
  const isSelected = selectedPath === item.path;
  const isSearchMatch = searchQuery && searchResults.includes(item.path);
  
  return (
    <div>
      <div 
        className={`flex items-center py-1 px-2 rounded cursor-pointer hover:bg-gray-100 
          ${isSelected ? 'bg-blue-100' : ''}
          ${isSearchMatch ? 'bg-yellow-50 border border-yellow-200' : ''}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => item.type === 'file' ? onSelect(item) : toggleFolder(item)}
      >
        {item.type === 'folder' && (
          <span className="mr-2" aria-label={item.isOpen ? 'Open folder' : 'Closed folder'}>
            {item.isOpen ? ICONS.folderOpen : ICONS.folder}
          </span>
        )}
        {item.type === 'file' && (
          <span className="mr-2" aria-label={item.isPrompt ? 'Prompt file' : 'Markdown file'}>
            {item.isPrompt ? ICONS.prompt : ICONS.file}
          </span>
        )}
        <span className={`${isSelected ? 'font-medium' : ''}`}>
          {item.name}
          {isSearchMatch && (
            <span className="ml-2 text-xs px-1 bg-yellow-200 text-yellow-800 rounded">match</span>
          )}
        </span>
      </div>
      
      {item.type === 'folder' && item.isOpen && item.children && (
        <div>
          {item.children.map(child => (
            <TreeItem 
              key={child.id} 
              item={child} 
              onSelect={onSelect} 
              toggleFolder={toggleFolder}
              level={level + 1}
              selectedPath={selectedPath}
              searchQuery={searchQuery}
              searchResults={searchResults}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Tree View Component
interface TreeViewProps {
  items: MarkdownTreeItem[];
  onSelect: (item: MarkdownTreeItem) => void;
  selectedPath?: string;
  searchQuery?: string;
  searchResults?: string[];
}

const TreeView: React.FC<TreeViewProps> = ({ 
  items, 
  onSelect, 
  selectedPath,
  searchQuery = '',
  searchResults = [] 
}) => {
  const [treeItems, setTreeItems] = useState<MarkdownTreeItem[]>(items);

  // Update when items change from parent
  useEffect(() => {
    setTreeItems(items);
  }, [items]);

  const toggleFolder = (item: MarkdownTreeItem) => {
    const updateItems = (items: MarkdownTreeItem[]): MarkdownTreeItem[] => {
      return items.map(i => {
        if (i.id === item.id) {
          return { ...i, isOpen: !i.isOpen };
        } else if (i.children) {
          return { ...i, children: updateItems(i.children) };
        }
        return i;
      });
    };

    setTreeItems(updateItems(treeItems));
  };
  
  // Auto-expand folders that contain search matches
  useEffect(() => {
    if (searchQuery && searchResults.length > 0) {
      const expandFoldersWithSearchMatches = (items: MarkdownTreeItem[]): MarkdownTreeItem[] => {
        return items.map(item => {
          if (item.type === 'folder') {
            // Check if this folder or any child has a match
            const hasMatch = searchResults.some(path => 
              path === item.path || 
              path.startsWith(item.path + '/')
            );
            
            // Recursively process children
            const updatedChildren = item.children ? 
              expandFoldersWithSearchMatches(item.children) : 
              item.children;
              
            // Return updated item with open state set if it has matches
            return { 
              ...item, 
              isOpen: hasMatch ? true : item.isOpen,
              children: updatedChildren
            };
          }
          return item;
        });
      };
      
      setTreeItems(expandFoldersWithSearchMatches(treeItems));
    }
  }, [searchQuery, searchResults]);

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col h-full">
      <div className="p-3 border-b bg-gray-50 flex justify-between items-center">
        <h3 className="text-gray-700 font-medium">Files</h3>
        <span className="text-xs text-gray-500">{treeItems.length} items</span>
      </div>
      <div className="overflow-auto flex-grow">
        {treeItems.map(item => (
          <TreeItem 
            key={item.id} 
            item={item} 
            onSelect={onSelect}
            toggleFolder={toggleFolder}
            selectedPath={selectedPath}
            searchQuery={searchQuery}
            searchResults={searchResults}
          />
        ))}
      </div>
    </div>
  );
};

// Search Bar Component
interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, placeholder = "Search files..." }) => {
  const [query, setQuery] = useState('');
  
  // Debounce search to avoid excessive searches while typing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query.trim()) {
        onSearch(query);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [query, onSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    
    // Clear search if query is empty
    if (!newQuery.trim()) {
      onSearch('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <input
        type="text"
        className="w-full px-4 py-2 pl-10 pr-20 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder={placeholder}
        value={query}
        onChange={handleChange}
      />
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        <span className="text-gray-400">{ICONS.search}</span>
      </div>
      {query && (
        <button 
          type="button"
          onClick={() => {
            setQuery('');
            onSearch('');
          }}
          className="absolute inset-y-0 right-16 flex items-center px-2 text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      )}
      <button 
        type="submit" 
        className="absolute inset-y-0 right-0 flex items-center px-4 bg-blue-500 text-white rounded-r-lg hover:bg-blue-600"
      >
        Search
      </button>
    </form>
  );
};

// Markdown Viewer Component
interface MarkdownViewerProps {
  markdown: string;
  title?: string;
  filePath?: string;
  lastModified?: string;
}

const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ 
  markdown, 
  title,
  filePath,
  lastModified
}) => {
  const getHtml = () => {
    try {
      return { __html: marked.parse(markdown) };
    } catch (error) {
      console.error('Error parsing markdown:', error);
      return { __html: '<p>Error rendering markdown</p>' };
    }
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col h-full">
      {(title || filePath) && (
        <div className="border-b p-3 bg-gray-50">
          <div className="flex justify-between items-start">
            <div>
              {title && <h2 className="text-lg font-bold">{title}</h2>}
              {filePath && <p className="text-xs text-gray-500 mt-1">{filePath}</p>}
            </div>
            {lastModified && (
              <span className="text-xs text-gray-400 bg-white px-2 py-1 rounded border">
                {lastModified}
              </span>
            )}
          </div>
        </div>
      )}
      <div className="overflow-auto flex-grow p-6">
        <div className="prose max-w-none" dangerouslySetInnerHTML={getHtml()} />
      </div>
    </div>
  );
};

// Status Card Component
interface StatusCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
}

const StatusCard: React.FC<StatusCardProps> = ({ title, value, icon }) => (
  <div className="bg-white rounded-lg shadow p-6 flex flex-col">
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-gray-700 font-medium">{title}</h3>
      <div className="p-2 rounded-full bg-gray-100">{icon}</div>
    </div>
    <div className="flex items-end">
      <span className="text-2xl font-bold">{value}</span>
    </div>
  </div>
);

// Action Button Component
interface ActionButtonProps {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  color?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({ 
  label, 
  onClick, 
  icon, 
  color = 'bg-blue-500 hover:bg-blue-600' 
}) => (
  <button
    onClick={onClick}
    className={`${color} text-white px-4 py-2 rounded-lg shadow flex items-center justify-center`}
  >
    {icon && <span className="mr-2">{icon}</span>}
    {label}
  </button>
);

// Main Docs Explorer Component
function DocsExplorer() {
  const [fileTree, setFileTree] = useState<MarkdownTreeItem[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<{
    path: string;
    title: string;
    content: string;
    lastModified?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalDocs: 0,
    totalPrompts: 0,
    totalFolders: 0
  });

  // Load file tree with enhanced extraction
  const loadFileTree = async () => {
    try {
      setLoading(true);
      console.log('Loading file tree with enhanced extraction...');
      
      // Force all folders to be open by default to show all markdown files
      const tree = await markdownFileService.getFileTree();
      
      // Recursively open all folders
      const openAllFolders = (items: MarkdownTreeItem[]): MarkdownTreeItem[] => {
        return items.map(item => {
          if (item.type === 'folder') {
            return {
              ...item,
              isOpen: true,
              children: item.children ? openAllFolders(item.children) : []
            };
          }
          return item;
        });
      };
      
      const expandedTree = openAllFolders(tree);
      console.log(`Got file tree with ${expandedTree.length} root items`);
      
      // Log the first few entries for debugging
      if (expandedTree.length > 0) {
        console.log('First few entries in file tree:');
        expandedTree.slice(0, 3).forEach((item, i) => {
          if (item.type === 'folder') {
            console.log(`${i+1}. Folder: ${item.name} with ${item.children?.length || 0} children`);
          } else {
            console.log(`${i+1}. File: ${item.name} (${item.path})`);
          }
        });
      }
      
      setFileTree(expandedTree);
      
      // Count stats
      let totalDocs = 0;
      let totalPrompts = 0;
      let totalFolders = 0;
      
      const countItems = (items: MarkdownTreeItem[]) => {
        for (const item of items) {
          if (item.type === 'file') {
            totalDocs++;
            if (item.isPrompt) totalPrompts++;
          } else if (item.type === 'folder') {
            totalFolders++;
            if (item.children) countItems(item.children);
          }
        }
      };
      
      countItems(expandedTree);
      console.log(`Counted stats: ${totalDocs} docs, ${totalPrompts} prompts, ${totalFolders} folders`);
      
      setStats({
        totalDocs,
        totalPrompts,
        totalFolders
      });
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading file tree:', error);
      setLoading(false);
    }
  };

  // Handle file selection
  const handleFileSelect = async (item: MarkdownTreeItem) => {
    if (item.type === 'file') {
      try {
        setLoading(true);
        
        const fileData = await markdownFileService.getFileContent(item.path);
        
        if (fileData) {
          setSelectedFile({
            path: item.path,
            title: fileData.title,
            content: fileData.content || '# File content unavailable',
            lastModified: fileData.lastModifiedAt || item.lastModified
          });
        } else {
          setSelectedFile({
            path: item.path,
            title: item.name,
            content: '# Error\n\nCould not load file content.\n\nThis could be because the file path in the report does not match the actual file location.',
            lastModified: item.lastModified
          });
        }
        
        setLoading(false);
      } catch (error) {
        // Handle error gracefully
        setSelectedFile({
          path: item.path,
          title: item.name,
          content: `# Error Loading File\n\nAn error occurred while loading the file: \`${item.path}\`\n\n## Troubleshooting\n1. Check if the file exists at the expected path\n2. Check server console for more detailed errors\n3. Ensure the file is readable by the server process`,
          lastModified: item.lastModified
        });
        
        setLoading(false);
      }
    }
  };

  // Handle search
  const handleSearch = async (query: string) => {
    try {
      setLoading(true);
      setSearchQuery(query); // Store the current search query
      
      if (!query.trim()) {
        setSearchResults([]);
        setLoading(false);
        return;
      }
      
      // Let the markdownFileService handle the search and fallback logic
      // It will internally decide whether to use database or file-based search
      const results = await markdownFileService.searchDocumentation(query);
      
      setSearchResults(results);
      
      // Also perform a client-side search in the file tree
      const matchingFilePaths: string[] = [];
      
      // Recursive function to search in file tree
      const searchInTree = (items: MarkdownTreeItem[], query: string) => {
        for (const item of items) {
          // Check if name matches search query
          if (item.name.toLowerCase().includes(query.toLowerCase())) {
            matchingFilePaths.push(item.path);
          }
          
          // Recursively search in children if it's a folder
          if (item.type === 'folder' && item.children) {
            searchInTree(item.children, query);
          }
        }
      };
      
      // Execute the search on the current file tree
      searchInTree(fileTree, query);
      
      // Update UI with search results
      const filePaths = results.map(result => result.filePath);
      const allMatchingPaths = [...new Set([...matchingFilePaths, ...filePaths])];
      
      // Update the UI with search results
      const searchResultElements = results.map(result => ({
        id: result.id,
        filePath: result.filePath,
        title: result.title,
        content: result.content,
        lastModifiedAt: result.lastModifiedAt,
        summary: result.summary,
        aiGeneratedTags: result.aiGeneratedTags,
        manualTags: result.manualTags,
        matchingPaths: allMatchingPaths
      }));
      
      setSearchResults(searchResultElements);
      setLoading(false);
      
      // Select first result if available
      if (results.length > 0) {
        // If the result doesn't have content yet, fetch it
        let content = results[0].content;
        if (!content) {
          try {
            const fileData = await markdownFileService.getFileContent(results[0].filePath);
            if (fileData && fileData.content) {
              content = fileData.content;
            }
          } catch (fetchError) {
            // Handle fetch error silently
            content = '# Content Unavailable\n\nCould not load file content.';
          }
        }
        
        setSelectedFile({
          path: results[0].filePath,
          title: results[0].title,
          content: content || '# File content unavailable',
          lastModified: results[0].lastModifiedAt?.toString()
        });
      }
    } catch (error) {
      // Handle search error gracefully
      setSearchResults([]);
      setLoading(false);
    }
  };

  // Handle running the markdown report script and sync to database
  const handleRunReport = async () => {
    try {
      setLoading(true);
      
      // Run the markdown report script via API
      const result = await markdownFileService.runMarkdownReport();
      
      if (result.success && result.fileTree) {
        // Use the file tree returned from the API
        setFileTree(result.fileTree);
        
        // Recalculate stats
        let totalDocs = 0;
        let totalPrompts = 0;
        let totalFolders = 0;
        
        const countItems = (items: MarkdownTreeItem[]) => {
          for (const item of items) {
            if (item.type === 'file') {
              totalDocs++;
              if (item.isPrompt) totalPrompts++;
            } else if (item.type === 'folder') {
              totalFolders++;
              if (item.children) countItems(item.children);
            }
          }
        };
        
        countItems(result.fileTree);
        
        setStats({
          totalDocs,
          totalPrompts,
          totalFolders
        });
        // Report was generated successfully
        alert("Markdown report generated successfully! Use the 'Sync Database' button to sync the data to the database.");
      } else {
        // If API failed, fall back to local method
        await loadFileTree();
        alert("Using local fallback data - server API may not be available");
      }
      
      setLoading(false);
    } catch (error) {
      // Handle error silently
      await loadFileTree();
      alert("Using local fallback data - server API failed");
      
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadFileTree();
  }, []);

  // Fetch database statistics
  const [dbStats, setDbStats] = useState({
    totalFiles: 0,
    indexedFiles: 0,
    pendingQueue: 0,
    processingQueue: 0,
    completedQueue: 0,
    failedQueue: 0,
    lastUpdated: null
  });

  // Check if Supabase is properly configured and usable
  const isSupabaseUsable = (): boolean => {
    // We're now using the correct Supabase client from integrations,
    // which already has proper credentials
    return true;
  };

  // Function to fetch database stats
  const fetchDatabaseStats = async () => {
    try {
      console.log('Fetching database stats...');
      
      // Get total files count
      const { data: filesData, error: filesError } = await supabase
        .from('documentation_files')
        .select('id, summary', { count: 'exact' });
      
      if (filesError) {
        console.error('Could not fetch documentation files:', filesError.message, filesError.code, filesError.details);
        // If we can't fetch files, use empty data
        setDbStats({
          ...dbStats,
          lastUpdated: new Date()
        });
        return;
      }
      
      console.log('Documentation files fetched:', filesData?.length || 0, 'files found');
      
      // Log the files found for easier debugging
      if (filesData && filesData.length > 0) {
        console.log('Files in database:');
        filesData.forEach((file, index) => {
          console.log(`${index + 1}. ID: ${file.id}, Has summary: ${file.summary ? 'Yes' : 'No'}`);
        });
      } else {
        console.warn('No files found in the database');
      }
      
      // Count indexed files (those with summaries)
      const indexedFiles = filesData?.filter(file => file.summary !== null).length || 0;
      
      // Get queue counts
      const { data: queueData, error: queueError } = await supabase
        .from('documentation_processing_queue')
        .select('status');
      
      if (queueError) {
        console.error('Could not fetch queue data:', queueError.message, queueError.code, queueError.details);
      } else {
        console.log('Queue data fetched:', queueData?.length || 0, 'queue items found');
      }
      
      // Initialize counts
      let pendingCount = 0;
      let processingCount = 0;
      let completedCount = 0;
      let failedCount = 0;
      
      // Only count if we have queue data
      if (!queueError && queueData) {
        pendingCount = queueData.filter(item => item.status === 'pending').length || 0;
        processingCount = queueData.filter(item => item.status === 'processing').length || 0;
        completedCount = queueData.filter(item => item.status === 'completed').length || 0;
        failedCount = queueData.filter(item => item.status === 'failed').length || 0;
      }
      
      setDbStats({
        totalFiles: filesData?.length || 0,
        indexedFiles,
        pendingQueue: pendingCount,
        processingQueue: processingCount,
        completedQueue: completedCount,
        failedQueue: failedCount,
        lastUpdated: new Date()
      });
    } catch (error) {
      // Silent failure - just keep existing stats
      setDbStats({
        ...dbStats,
        lastUpdated: new Date()
      });
    }
  };

  // Fetch database stats initially and after actions
  useEffect(() => {
    fetchDatabaseStats();
    // Set up interval to refresh stats
    const intervalId = setInterval(() => {
      fetchDatabaseStats();
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="container mx-auto px-4 py-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Docs</h1>
        
        <div className="flex items-center gap-2">
          <div className="flex gap-2">
            <ActionButton 
              label="Sync Database" 
              onClick={async () => {
                try {
                  console.log('Database sync button clicked');
                  setLoading(true);
                  const loadingToast = toast.loading('Syncing documentation files to database...');
                  
                  // Use the simplified direct method
                  const result = await markdownFileService.syncDocumentationFiles();
                  console.log('Sync result:', result);
                  
                  // Dismiss the loading toast
                  toast.dismiss(loadingToast);
                  
                  if (result && result.success) {
                    const successMessage = `Database sync completed: ${result.message}`;
                    console.log(successMessage);
                    toast.success(successMessage);
                    
                    // Log detailed information if available
                    if (result.details) {
                      console.log('Detailed sync results:', result.details);
                      
                      if (result.details.totalFound) {
                        console.log(`Files found: ${result.details.totalFound}`);
                      }
                      
                      if (result.details.filesPaths && result.details.filesPaths.length > 0) {
                        console.log('Processed files:');
                        result.details.filesPaths.forEach((path, index) => {
                          console.log(`${index + 1}. ${path}`);
                        });
                      }
                    }
                    
                    // Log detailed counts of what happened
                    const counts = result.message.match(/(\d+) added, (\d+) updated, (\d+) unchanged, (\d+) failed/);
                    if (counts) {
                      const [_, added, updated, unchanged, failed] = counts;
                      console.log(`
Sync completed with detailed results:
- Added: ${added} files
- Updated: ${updated} files
- Unchanged: ${unchanged} files
- Failed: ${failed} files
                      `);
                      
                      // Show a more detailed toast if there were issues
                      if (parseInt(failed) > 0) {
                        toast.error(`Warning: Failed to process ${failed} files. Check console for details.`);
                      }
                      
                      // Show warning if low number of files processed
                      if ((parseInt(added) + parseInt(updated)) < 5) {
                        toast(`Note: Only ${parseInt(added) + parseInt(updated)} files were processed. Expected at least 9 files.`, {
                          icon: '⚠️',
                          style: {
                            borderRadius: '10px',
                            background: '#FFF9C4',
                            color: '#6D4C41',
                          },
                        });
                      }
                    }
                    
                    // Refresh stats after sync
                    fetchDatabaseStats();
                  } else {
                    const errorMessage = `Database sync failed: ${result?.message || 'Unknown error'}`;
                    console.error(errorMessage);
                    toast.error(errorMessage);
                  }
                  
                  setLoading(false);
                } catch (error) {
                  console.error('Error in database sync:', error);
                  toast.error(`Sync error: ${error.message || 'Unknown error'}`);
                  toast.dismiss(); // Dismiss any loading toasts
                  setLoading(false);
                }
              }} 
              icon="📊"
              color="bg-green-500 hover:bg-green-600 text-sm"
            />
          </div>
        </div>
      </div>
      
      {/* Search Bar */}
      <div className="mb-4">
        <SearchBar onSearch={handleSearch} />
      </div>
      
      {/* Search Results (conditionally shown) */}
      {searchResults.length > 0 && searchQuery && (
        <div className="mb-4 mt-2">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold">Search Results</h2>
            <span className="text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
              {searchResults.length} matches for "{searchQuery}"
            </span>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-yellow-200">
            <ul className="divide-y">
              {searchResults.map(file => (
                <li key={file.id} className="py-2">
                  <button
                    className="text-left w-full hover:bg-blue-50 p-2 rounded flex items-start"
                    onClick={() => setSelectedFile({
                      path: file.filePath,
                      title: file.title,
                      content: file.content || '# File content unavailable',
                      lastModified: file.lastModifiedAt?.toString()
                    })}
                  >
                    <span className="mr-2 text-yellow-800">{ICONS.file}</span>
                    <div className="w-full">
                      <div className="font-medium">{file.title}</div>
                      <div className="text-xs text-gray-500">{file.filePath}</div>
                      
                      {/* Display database-generated summary if available */}
                      {file.summary && (
                        <p className="text-sm mt-1 text-gray-700">{file.summary}</p>
                      )}
                      
                      {/* Display tags if available */}
                      {(file.aiGeneratedTags || file.manualTags) && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {file.manualTags?.map(tag => (
                            <span key={tag} className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                              {tag}
                            </span>
                          ))}
                          {file.aiGeneratedTags?.map(tag => (
                            <span key={tag} className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      {/* Show an excerpt of content with match highlight if available */}
                      {file.content && searchQuery && (
                        <div className="mt-2 text-sm bg-gray-50 p-2 rounded border-l-2 border-yellow-400">
                          {(() => {
                            const content = file.content;
                            const searchIndex = content.toLowerCase().indexOf(searchQuery.toLowerCase());
                            if (searchIndex >= 0) {
                              const startIndex = Math.max(0, searchIndex - 40);
                              const endIndex = Math.min(content.length, searchIndex + searchQuery.length + 40);
                              const excerpt = content.substring(startIndex, endIndex);
                              return startIndex > 0 ? `...${excerpt}...` : `${excerpt}...`;
                            }
                            return null;
                          })()}
                        </div>
                      )}
                      
                      {/* Show last modified date */}
                      <div className="mt-2 flex justify-between items-center">
                        <div className="flex-grow"></div>
                        <span className="text-xs text-gray-400">
                          {file.lastModifiedAt 
                            ? new Date(file.lastModifiedAt).toLocaleDateString() 
                            : "Unknown date"}
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      
      {/* Loading State */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg shadow flex items-center space-x-3">
            <span className="text-xl animate-spin">{ICONS.spinner}</span>
            <span>Loading...</span>
          </div>
        </div>
      )}
      
      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-full">
        {/* File Tree */}
        <div className="lg:col-span-1 h-full">
          <TreeView 
            items={fileTree} 
            onSelect={handleFileSelect}
            selectedPath={selectedFile?.path}
            searchQuery={searchQuery}
            searchResults={searchResults.map(result => result.filePath || '')}
          />
        </div>
        
        {/* Markdown Viewer */}
        <div className="lg:col-span-3 h-full">
          {selectedFile ? (
            <MarkdownViewer 
              markdown={selectedFile.content}
              title={selectedFile.title}
              filePath={selectedFile.path}
              lastModified={selectedFile.lastModified}
            />
          ) : (
            <div className="bg-white rounded-lg shadow h-full flex items-center justify-center">
              <div className="text-center text-gray-500">
                <p className="text-xl mb-2">Select a document to view</p>
                <p className="text-sm">Or use the search bar to find specific content</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DocsExplorer;