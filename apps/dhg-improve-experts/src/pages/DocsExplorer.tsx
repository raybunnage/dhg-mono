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
}

const TreeItem: React.FC<TreeItemProps> = ({ 
  item, 
  onSelect, 
  toggleFolder,
  level = 0,
  selectedPath 
}) => {
  const isSelected = selectedPath === item.path;
  
  return (
    <div>
      <div 
        className={`flex items-center py-1 px-2 rounded cursor-pointer hover:bg-gray-100 ${isSelected ? 'bg-blue-100' : ''}`}
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
        <span className={`${isSelected ? 'font-medium' : ''}`}>{item.name}</span>
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
}

const TreeView: React.FC<TreeViewProps> = ({ items, onSelect, selectedPath }) => {
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

  return (
    <div className="bg-white rounded-lg shadow p-4 overflow-auto h-full">
      <div className="mb-4 flex items-center">
        <h3 className="text-lg font-semibold">Files</h3>
      </div>
      <div className="border-t pt-2">
        {treeItems.map(item => (
          <TreeItem 
            key={item.id} 
            item={item} 
            onSelect={onSelect}
            toggleFolder={toggleFolder}
            selectedPath={selectedPath}
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <input
        type="text"
        className="w-full px-4 py-2 pl-10 pr-4 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder={placeholder}
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        <span className="text-gray-400">{ICONS.search}</span>
      </div>
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
    <div className="bg-white rounded-lg shadow h-full flex flex-col">
      {(title || filePath) && (
        <div className="border-b p-4">
          {title && <h2 className="text-xl font-bold mb-1">{title}</h2>}
          {filePath && <p className="text-sm text-gray-500">{filePath}</p>}
          {lastModified && <p className="text-xs text-gray-400 mt-1">Last modified: {lastModified}</p>}
        </div>
      )}
      <div className="p-6 overflow-auto flex-1">
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
      
      if (!query.trim()) {
        setSearchResults([]);
        setLoading(false);
        return;
      }
      
      const results = await markdownFileService.searchFiles(query);
      setSearchResults(results);
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
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Documentation Explorer</h1>
      
      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <StatusCard 
          title="Total Documents" 
          value={stats.totalDocs} 
          icon={ICONS.file} 
        />
        <StatusCard 
          title="Prompt Files" 
          value={stats.totalPrompts} 
          icon={ICONS.prompt} 
        />
        <StatusCard 
          title="Folders" 
          value={stats.totalFolders} 
          icon={ICONS.folder} 
        />
      </div>
      
      {/* Search Bar */}
      <div className="mb-6">
        <SearchBar onSearch={handleSearch} />
      </div>
      
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-4 mb-6">
        <ActionButton 
          label="Run Markdown Report" 
          onClick={handleRunReport} 
          icon="🔄"
        />
      </div>
      
      {/* Search Results (conditionally shown) */}
      {searchResults.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Search Results</h2>
          <div className="bg-white rounded-lg shadow p-4">
            <ul className="divide-y">
              {searchResults.map(file => (
                <li key={file.id} className="py-3">
                  <button
                    className="text-left w-full hover:bg-blue-50 p-2 rounded"
                    onClick={() => setSelectedFile({
                      path: file.filePath,
                      title: file.title,
                      content: file.content || '# File content unavailable',
                      lastModified: file.lastModifiedAt?.toString()
                    })}
                  >
                    <div className="font-medium">{file.title}</div>
                    <div className="text-sm text-gray-500">{file.filePath}</div>
                    {file.summary && <p className="text-sm mt-1">{file.summary}</p>}
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: '60vh' }}>
        {/* File Tree */}
        <div className="lg:col-span-1">
          <TreeView 
            items={fileTree} 
            onSelect={handleFileSelect}
            selectedPath={selectedFile?.path}
          />
        </div>
        
        {/* Markdown Viewer */}
        <div className="lg:col-span-2">
          {selectedFile ? (
            <MarkdownViewer 
              markdown={selectedFile.content}
              title={selectedFile.title}
              filePath={selectedFile.path}
              lastModified={selectedFile.lastModified}
            />
          ) : (
            <div className="bg-white rounded-lg shadow p-6 h-full flex items-center justify-center">
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