import React, { useState, useEffect } from 'react';
import { marked } from 'marked';
import { markdownFileService, MarkdownTreeItem } from '@/services/markdownFileService';

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
      <div className="overflow-auto flex-grow" style={{ maxHeight: 'calc(100vh - 200px)' }}>
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
      <div className="overflow-auto flex-grow p-6" style={{ maxHeight: 'calc(100vh - 200px)' }}>
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

  // Load file tree
  const loadFileTree = async () => {
    try {
      setLoading(true);
      const tree = await markdownFileService.getFileTree();
      setFileTree(tree);
      
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
      
      countItems(tree);
      
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
        
        // Show debug info in console
        console.log('Attempting to load file:', item);
        
        const fileData = await markdownFileService.getFileContent(item.path);
        
        if (fileData) {
          console.log('File content loaded successfully:', fileData);
          
          setSelectedFile({
            path: item.path,
            title: fileData.title,
            content: fileData.content || '# File content unavailable',
            lastModified: fileData.lastModifiedAt || item.lastModified
          });
        } else {
          console.warn('No file data returned for path:', item.path);
          
          setSelectedFile({
            path: item.path,
            title: item.name,
            content: '# Error\n\nCould not load file content.\n\nThis could be because the file path in the report does not match the actual file location.',
            lastModified: item.lastModified
          });
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error loading file content:', error);
        
        setSelectedFile({
          path: item.path,
          title: item.name,
          content: `# Error Loading File\n\nAn error occurred while loading the file: \`${item.path}\`\n\n## Details\n\`${error}\`\n\n## Troubleshooting\n1. Check if the file exists at the expected path\n2. Check server console for more detailed errors\n3. Ensure the file is readable by the server process`,
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
      
      // Get results from the search API
      const results = await markdownFileService.searchFiles(query);
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
        matchingPaths: allMatchingPaths
      }));
      
      setSearchResults(searchResultElements);
      setLoading(false);
      
      // Select first result if available
      if (results.length > 0) {
        setSelectedFile({
          path: results[0].filePath,
          title: results[0].title,
          content: results[0].content || '# File content unavailable',
          lastModified: results[0].lastModifiedAt?.toString()
        });
      }
    } catch (error) {
      console.error('Error searching files:', error);
      setSearchResults([]);
      setLoading(false);
    }
  };

  // Handle running the markdown report script
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
        
        // Show success message
        alert("Markdown report generated successfully!");
      } else {
        // If API failed, fall back to local method
        await loadFileTree();
        alert("Using local fallback data - server API may not be available");
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error running markdown report:', error);
      
      // Fall back to local method
      await loadFileTree();
      alert("Using local fallback data - server API failed");
      
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadFileTree();
  }, []);

  return (
    <div className="container mx-auto px-4 py-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Documentation Explorer</h1>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {stats.totalDocs} docs ({stats.totalPrompts} prompts) • {stats.totalFolders} folders
          </span>
          <ActionButton 
            label="Run Report" 
            onClick={handleRunReport} 
            icon="🔄"
            color="bg-blue-500 hover:bg-blue-600 text-sm"
          />
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
                    <div>
                      <div className="font-medium">{file.title}</div>
                      <div className="text-xs text-gray-500">{file.filePath}</div>
                      {file.summary && <p className="text-sm mt-1">{file.summary}</p>}
                      
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
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4" style={{ height: 'calc(100vh - 140px)' }}>
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