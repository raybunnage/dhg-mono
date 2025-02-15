import { useState } from 'react';

interface FileNode {
  id: string;
  name: string;
  mime_type: string;
  path: string | null;
  parent_path: string | null;
  content_extracted?: boolean;
  web_view_link?: string;
}

interface FileTreeProps {
  files: FileNode[];
}

export function FileTree({ files }: FileTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const getIcon = (mimeType: string) => {
    if (mimeType === 'application/vnd.google-apps.folder') return '📁';
    if (mimeType.includes('pdf')) return '📕';
    if (mimeType.includes('document')) return '📄';
    if (mimeType.includes('spreadsheet')) return '📊';
    if (mimeType.includes('presentation')) return '📑';
    if (mimeType.includes('video')) return '📹';
    return '📎';
  };

  const renderTree = (parentPath: string | null = null, level: number = 0) => {
    // Only get items that belong directly to this parent
    const items = files.filter(f => f.parent_path === parentPath);

    // Sort folders first, then by name
    const sortedItems = items.sort((a, b) => {
      const aIsFolder = a.mime_type === 'application/vnd.google-apps.folder';
      const bIsFolder = b.mime_type === 'application/vnd.google-apps.folder';
      if (aIsFolder && !bIsFolder) return -1;
      if (!aIsFolder && bIsFolder) return 1;
      return a.name.localeCompare(b.name);
    });

    return sortedItems.map(item => {
      const isFolder = item.mime_type === 'application/vnd.google-apps.folder';
      const isExpanded = expandedFolders.has(item.path || '');
      const hasChildren = files.some(f => f.parent_path === item.path);

      return (
        <div key={item.id} className="file-tree-item">
          <div 
            className="flex items-center gap-2 py-1 hover:bg-gray-50 rounded cursor-pointer"
            style={{ paddingLeft: `${level * 20}px` }}
          >
            {isFolder && hasChildren && (
              <span 
                className="text-gray-500 hover:text-gray-700" 
                onClick={() => toggleFolder(item.path || '')}
              >
                {isExpanded ? '▼' : '▶'}
              </span>
            )}
            {isFolder && !hasChildren && (
              <div className="inline-block w-4" />
            )}
            <span className="mr-1">{getIcon(item.mime_type)}</span>
            <span className="flex-1">{item.name}</span>
            {!isFolder && (
              <span className="ml-2">
                {item.content_extracted ? '✅' : '⬜'}
              </span>
            )}
            {item.web_view_link && (
              <a 
                href={item.web_view_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline ml-2 text-sm"
                onClick={(e) => e.stopPropagation()}
              >
                View
              </a>
            )}
          </div>
          {/* Only render children if this is a folder and it's expanded */}
          {isFolder && isExpanded && renderTree(item.path, level + 1)}
        </div>
      );
    });
  };

  return (
    <div className="file-tree p-4 border rounded-lg bg-white">
      <div className="mb-4 text-lg font-medium flex items-center gap-2">
        <span>🗂️</span>
        <span>Dynamic Healing Group Files</span>
      </div>
      {/* Only start rendering from root level (parentPath === null) */}
      {renderTree(null)}
    </div>
  );
} 