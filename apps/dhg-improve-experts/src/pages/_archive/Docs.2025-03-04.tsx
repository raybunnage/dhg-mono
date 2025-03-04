import React, { useState, useEffect } from 'react';
import { marked } from 'marked';
import { supabase } from '@/lib/supabase';
import type { DocumentFile, DocumentSection } from '@/services/documentationService';

// Icons for the dashboard
const DocsIcon = () => <span className="text-blue-500 text-xl">📄</span>;
const PromptIcon = () => <span className="text-purple-500 text-xl">🤖</span>;
const FolderIcon = () => <span className="text-yellow-500 text-xl">📁</span>;
const SearchIcon = () => <span className="text-green-500 text-xl">🔍</span>;

// Status Card Component
interface StatusCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

const StatusCard: React.FC<StatusCardProps> = ({ title, value, icon, trend }) => (
  <div className="bg-white rounded-lg shadow p-6 flex flex-col">
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-gray-700 font-medium">{title}</h3>
      <div className="p-2 rounded-full bg-gray-100">{icon}</div>
    </div>
    <div className="flex items-end">
      <span className="text-2xl font-bold">{value}</span>
      {trend && (
        <span className={`ml-2 text-sm ${trend.isPositive ? 'text-green-500' : 'text-red-500'}`}>
          {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
        </span>
      )}
    </div>
  </div>
);

// Tree View Item Component
interface TreeItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: TreeItem[];
  isOpen?: boolean;
}

interface TreeViewItemProps {
  item: TreeItem;
  onSelect: (item: TreeItem) => void;
  toggleFolder: (item: TreeItem) => void;
  level?: number;
  selectedPath?: string;
}

const TreeViewItem: React.FC<TreeViewItemProps> = ({ 
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
          <span className="mr-2">{item.isOpen ? '📂' : '📁'}</span>
        )}
        {item.type === 'file' && (
          <span className="mr-2">{item.name.endsWith('.md') ? '📝' : '📄'}</span>
        )}
        <span className={`${isSelected ? 'font-medium' : ''}`}>{item.name}</span>
      </div>
      
      {item.type === 'folder' && item.isOpen && item.children && (
        <div>
          {item.children.map(child => (
            <TreeViewItem 
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
  items: TreeItem[];
  onSelect: (item: TreeItem) => void;
  selectedPath?: string;
}

const TreeView: React.FC<TreeViewProps> = ({ items, onSelect, selectedPath }) => {
  const [treeItems, setTreeItems] = useState<TreeItem[]>(items);

  // Update when items change from parent
  useEffect(() => {
    setTreeItems(items);
  }, [items]);

  const toggleFolder = (item: TreeItem) => {
    const updateItems = (items: TreeItem[]): TreeItem[] => {
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
          <TreeViewItem 
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

// Search Component
interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, placeholder = "Search documentation..." }) => {
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
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
        </svg>
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

// Filter and Tag Component
interface FilterTagsProps {
  tags: string[];
  onTagSelect: (tag: string) => void;
  selectedTag?: string;
}

const FilterTags: React.FC<FilterTagsProps> = ({ tags, onTagSelect, selectedTag }) => {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {tags.map(tag => (
        <button
          key={tag}
          onClick={() => onTagSelect(tag)}
          className={`px-3 py-1 rounded-full text-sm ${
            selectedTag === tag 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {tag}
        </button>
      ))}
    </div>
  );
};

// Main Docs Page Component
function Docs() {
  const [fileTree, setFileTree] = useState<TreeItem[]>([]);
  const [searchResults, setSearchResults] = useState<DocumentFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<{
    path: string;
    title: string;
    content: string;
    lastModified?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>();
  const [stats, setStats] = useState({
    totalDocs: 0,
    totalPrompts: 0,
    totalFolders: 0,
    recentlyUpdated: 0
  });

  // Fetch documentation stats
  const fetchStats = async () => {
    try {
      // Start with default values in case the table doesn't exist yet
      let totalDocs = 0;
      let totalPrompts = 0;
      let recentlyUpdated = 0;
      
      try {
        // Get total docs count
        const { data: docsCount, error: docsError } = await supabase
          .from('documentation_files')
          .select('count');
        
        if (!docsError && docsCount?.length > 0) {
          totalDocs = docsCount[0].count;
        }
        
        // Get prompt files count (files in prompts directory)
        const { data: promptsCount, error: promptsError } = await supabase
          .from('documentation_files')
          .select('count')
          .like('file_path', '%prompts/%');
        
        if (!promptsError && promptsCount?.length > 0) {
          totalPrompts = promptsCount[0].count;
        }
        
        // Get recently updated count (last 7 days)
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        
        const { data: recentCount, error: recentError } = await supabase
          .from('documentation_files')
          .select('count')
          .gte('last_modified_at', lastWeek.toISOString());
        
        if (!recentError && recentCount?.length > 0) {
          recentlyUpdated = recentCount[0].count;
        }
      } catch (innerError) {
        console.warn('Table might not exist yet:', innerError);
      }
      
      // Update stats with either real data or fallbacks
      setStats({
        totalDocs: totalDocs,
        totalPrompts: totalPrompts,
        totalFolders: Math.floor(totalDocs / 5 || 0), // Estimate
        recentlyUpdated: recentlyUpdated
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Fetch documentation file tree
  const fetchFileTree = async () => {
    try {
      setLoading(true);
      
      // Start with some mock data in case the table doesn't exist yet
      let filesData = [];
      
      try {
        const { data, error } = await supabase
          .from('documentation_files')
          .select('id, file_path, title, last_modified_at')
          .order('file_path');
        
        if (!error && data) {
          filesData = data;
        }
      } catch (innerError) {
        console.warn('Table might not exist yet:', innerError);
        
        // Add some mock data for demo purposes
        filesData = [
          { 
            id: 'mock-1', 
            file_path: 'README.md', 
            title: 'Documentation Overview', 
            last_modified_at: new Date().toISOString() 
          },
          { 
            id: 'mock-2', 
            file_path: 'prompts/expert-extraction-prompt.md', 
            title: 'Expert Extraction Prompt', 
            last_modified_at: new Date().toISOString() 
          },
          { 
            id: 'mock-3', 
            file_path: 'prompts/document-classification-prompt.md', 
            title: 'Document Classification Prompt', 
            last_modified_at: new Date().toISOString() 
          }
        ];
      }
      
      // Build tree structure
      const root: TreeItem[] = [];
      const map: Record<string, TreeItem> = {};
      
      filesData.forEach(file => {
        const parts = file.file_path.split('/');
        let currentPath = '';
        
        parts.forEach((part, index) => {
          const isLast = index === parts.length - 1;
          const path = currentPath ? `${currentPath}/${part}` : part;
          currentPath = path;
          
          if (isLast) {
            // This is a file
            const fileItem: TreeItem = {
              id: file.id,
              name: part,
              type: 'file',
              path: file.file_path
            };
            
            if (parts.length === 1) {
              // File at root level
              root.push(fileItem);
            } else {
              // File within folder
              const parentPath = parts.slice(0, -1).join('/');
              const parent = map[parentPath];
              if (parent) {
                if (!parent.children) parent.children = [];
                parent.children.push(fileItem);
              }
            }
          } else if (!map[path]) {
            // This is a folder that we haven't seen before
            const folderItem: TreeItem = {
              id: `folder_${path}`,
              name: part,
              type: 'folder',
              path: path,
              children: [],
              isOpen: true // Open by default for mock data
            };
            
            map[path] = folderItem;
            
            if (index === 0) {
              // Root level folder
              root.push(folderItem);
            } else {
              // Nested folder
              const parentPath = parts.slice(0, index).join('/');
              const parent = map[parentPath];
              if (parent) {
                if (!parent.children) parent.children = [];
                parent.children.push(folderItem);
              }
            }
          }
        });
      });
      
      setFileTree(root);
    } catch (error) {
      console.error('Error fetching file tree:', error);
      // Fallback to empty tree
      setFileTree([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all tags
  const fetchTags = async () => {
    try {
      // For now, use a direct query instead of RPC since the function might not exist yet
      const { data, error } = await supabase
        .from('documentation_files')
        .select('ai_generated_tags, manual_tags');
      
      if (error) throw error;
      
      if (data) {
        const allTags = [...new Set(data.flatMap(item => 
          [...(item.ai_generated_tags || []), ...(item.manual_tags || [])]
        ))];
        
        setTags(allTags);
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  // Load file content
  const loadFileContent = async (path: string) => {
    try {
      setLoading(true);
      
      // Start with default values
      let title = path.split('/').pop() || 'Untitled';
      let lastModified = new Date().toLocaleString();
      
      // Try to get file details from database if it exists
      try {
        const { data: fileData, error: fileError } = await supabase
          .from('documentation_files')
          .select('id, title, last_modified_at')
          .eq('file_path', path)
          .single();
        
        if (!fileError && fileData) {
          title = fileData.title;
          lastModified = new Date(fileData.last_modified_at).toLocaleString();
        }
      } catch (innerError) {
        console.warn('Table might not exist yet or file not found:', innerError);
      }
      
      // Check for mock data first
      if (path === 'README.md') {
        setSelectedFile({
          path,
          title: 'Documentation Overview',
          content: `# Documentation Overview\n\nThis is the central hub for managing your markdown documentation files.\n\n## Features\n\n- Search across all documentation\n- Tag-based organization\n- File tree navigation\n- Markdown rendering\n\n## Getting Started\n\n1. Use the file tree to browse documentation\n2. Use the search bar to find specific content\n3. Click on tags to filter by category`,
          lastModified
        });
        setLoading(false);
        return;
      } else if (path === 'prompts/expert-extraction-prompt.md') {
        setSelectedFile({
          path,
          title: 'Expert Extraction Prompt',
          content: `# Expert Extraction Prompt\n\nThis prompt is used to extract expert information from various document types.\n\n## Prompt Template\n\n\`\`\`\nYou are an AI assistant tasked with extracting expert profiles from documents.\nFor each expert mentioned in the document, please extract the following information:\n\n1. Name\n2. Title/Position\n3. Organization\n4. Specialization/Expertise\n5. Contact Information (if available)\n6. Brief Biography (if available)\n\nPlease format your response as structured JSON.\n\`\`\``,
          lastModified
        });
        setLoading(false);
        return;
      } else if (path === 'prompts/document-classification-prompt.md') {
        setSelectedFile({
          path,
          title: 'Document Classification Prompt',
          content: `# Document Classification Prompt\n\nThis prompt is used to classify incoming documents by type and subject matter.\n\n## Prompt Template\n\n\`\`\`\nYou are an AI assistant tasked with classifying documents.\nPlease analyze the content of this document and classify it according to:\n\n1. Document Type (e.g., research paper, presentation, email, resume, etc.)\n2. Primary Subject Matter (e.g., technology, healthcare, finance, etc.)\n3. Secondary Subject Matter (if applicable)\n4. Target Audience (e.g., technical, general, executive, etc.)\n5. Estimated Reading Level (basic, intermediate, advanced)\n\nPlease format your response as structured JSON.\n\`\`\``,
          lastModified
        });
        setLoading(false);
        return;
      }
      
      // Try to fetch file content from public folder
      try {
        // First try to load from project public folder
        const publicPaths = [
          `/docs/${path}`,
          `/public/docs/${path}`,
          `/prompts/${path}`,
          `/public/prompts/${path}`
        ];
        
        for (const publicPath of publicPaths) {
          try {
            const response = await fetch(publicPath);
            if (response.ok) {
              const content = await response.text();
              setSelectedFile({
                path,
                title,
                content,
                lastModified
              });
              setLoading(false);
              return;
            }
          } catch (fetchError) {
            console.warn(`Failed to fetch from ${publicPath}:`, fetchError);
          }
        }
        
        // If we reached here, we couldn't find the file
        setSelectedFile({
          path,
          title,
          content: `# ${title}\n\n*This is a placeholder for content that couldn't be loaded from the file system.*\n\nIn a full implementation, an API endpoint would load content from the file system or database.\n\n## Path\n\n\`${path}\``,
          lastModified
        });
      } catch (error) {
        setSelectedFile({
          path,
          title,
          content: `# Error\nCouldn't load content for ${path}.\n\nError: ${error}`,
          lastModified
        });
      }
    } catch (error) {
      console.error('Error loading file content:', error);
      setSelectedFile({
        path: path,
        title: path.split('/').pop() || 'Error',
        content: `# Error\nFailed to load file: ${path}\n\nError: ${error}`
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle search
  const handleSearch = async (query: string) => {
    try {
      setLoading(true);
      
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }
      
      // For now, use a simpler search method since the RPC might not exist yet
      const { data, error } = await supabase
        .from('documentation_files')
        .select('*')
        .or(`title.ilike.%${query}%,file_path.ilike.%${query}%`)
        .limit(20);
      
      if (error) throw error;
      
      // Convert to DocumentFile format
      const results: DocumentFile[] = data.map(file => ({
        id: file.id,
        filePath: file.file_path,
        title: file.title,
        summary: file.summary,
        aiGeneratedTags: file.ai_generated_tags,
        manualTags: file.manual_tags
      }));
      
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching documentation:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle tag selection
  const handleTagSelect = async (tag: string) => {
    try {
      setLoading(true);
      
      if (selectedTag === tag) {
        setSelectedTag(undefined);
        setSearchResults([]);
        return;
      }
      
      setSelectedTag(tag);
      
      // For now, use a direct query since the RPC might not exist yet
      const { data, error } = await supabase
        .from('documentation_files')
        .select('*')
        .or(`ai_generated_tags.cs.{${tag}},manual_tags.cs.{${tag}}`)
        .limit(20);
      
      if (error) throw error;
      
      // Convert to DocumentFile format
      const results: DocumentFile[] = data.map(file => ({
        id: file.id,
        filePath: file.file_path,
        title: file.title,
        summary: file.summary,
        aiGeneratedTags: file.ai_generated_tags,
        manualTags: file.manual_tags
      }));
      
      setSearchResults(results);
    } catch (error) {
      console.error('Error filtering by tag:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle file selection from tree
  const handleFileSelect = (item: TreeItem) => {
    if (item.type === 'file') {
      loadFileContent(item.path);
    }
  };

  // Handle running the documentation scanner
  const handleScanDocumentation = async () => {
    try {
      // In a real app, this would call an API endpoint
      alert('Scanning documentation would call an API to run the scanner');
      // After scanning, refresh the data
      await Promise.all([fetchFileTree(), fetchStats(), fetchTags()]);
    } catch (error) {
      console.error('Error scanning documentation:', error);
    }
  };

  // Handle organizing prompts
  const handleOrganizePrompts = () => {
    alert('This would open a modal for organizing prompt files');
  };

  // Load initial data
  useEffect(() => {
    Promise.all([fetchFileTree(), fetchStats(), fetchTags()]);
  }, []);

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Documentation Manager</h1>
      
      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatusCard 
          title="Total Documents" 
          value={stats.totalDocs} 
          icon={<DocsIcon />} 
        />
        <StatusCard 
          title="Prompt Files" 
          value={stats.totalPrompts} 
          icon={<PromptIcon />} 
        />
        <StatusCard 
          title="Folders" 
          value={stats.totalFolders} 
          icon={<FolderIcon />} 
        />
        <StatusCard 
          title="Recently Updated" 
          value={stats.recentlyUpdated} 
          icon={<SearchIcon />} 
          trend={{ value: 8, isPositive: true }}
        />
      </div>
      
      {/* Search and Tags */}
      <div className="mb-6">
        <SearchBar onSearch={handleSearch} />
        
        {tags.length > 0 && (
          <div className="mt-4">
            <FilterTags 
              tags={tags} 
              onTagSelect={handleTagSelect} 
              selectedTag={selectedTag}
            />
          </div>
        )}
      </div>
      
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-4 mb-6">
        <ActionButton 
          label="Scan Documentation" 
          onClick={handleScanDocumentation} 
          icon="🔄"
        />
        <ActionButton 
          label="Organize Prompts" 
          onClick={handleOrganizePrompts} 
          icon="🤖"
          color="bg-purple-500 hover:bg-purple-600"
        />
        <ActionButton 
          label="Create New Document" 
          onClick={() => alert('This would open a modal for creating a new document')} 
          icon="📝"
          color="bg-green-500 hover:bg-green-600"
        />
      </div>
      
      {/* Search Results (conditionally shown) */}
      {searchResults.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">
            {selectedTag 
              ? `Documents tagged with "${selectedTag}"` 
              : 'Search Results'}
          </h2>
          <div className="bg-white rounded-lg shadow p-4">
            <ul className="divide-y">
              {searchResults.map(doc => (
                <li key={doc.id} className="py-3">
                  <button
                    className="text-left w-full hover:bg-blue-50 p-2 rounded"
                    onClick={() => loadFileContent(doc.filePath)}
                  >
                    <div className="font-medium">{doc.title}</div>
                    <div className="text-sm text-gray-500">{doc.filePath}</div>
                    {doc.summary && <p className="text-sm mt-1">{doc.summary}</p>}
                  </button>
                </li>
              ))}
            </ul>
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

export default Docs;