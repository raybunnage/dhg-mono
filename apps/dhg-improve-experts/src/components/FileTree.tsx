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
  onSelectionChange?: (selectedIds: string[]) => void;
}

export function FileTree({ files, onSelectionChange }: FileTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const expandAll = () => {
    // Get all possible folder paths
    const allPaths = files
      .filter(f => f.mime_type === 'application/vnd.google-apps.folder')
      .map(f => f.path || '')
      .filter(Boolean);
    setExpandedFolders(new Set(allPaths));
  };

  const collapseAll = () => {
    setExpandedFolders(new Set());
  };

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const toggleFile = (fileId: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      onSelectionChange?.(Array.from(next));
      return next;
    });
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
    const items = files.filter(f => f.parent_path === parentPath);

    const sortedItems = items.sort((a, b) => {
      const aIsFolder = a.mime_type === 'application/vnd.google-apps.folder';
      const bIsFolder = b.mime_type === 'application/vnd.google-apps.folder';

      // First sort by folder/file
      if (aIsFolder && !bIsFolder) return -1;
      if (!aIsFolder && bIsFolder) return 1;

      // Then sort by date if both are folders
      if (aIsFolder && bIsFolder) {
        // Extract full date strings (YYYY-MM-DD)
        const dateA = a.name.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
        const dateB = b.name.match(/^\d{4}-\d{2}-\d{2}/)?.[0];

        // If both have dates, compare them directly
        if (dateA && dateB) {
          // Convert to timestamps for accurate comparison
          const timeA = new Date(dateA).getTime();
          const timeB = new Date(dateB).getTime();
          return timeB - timeA; // Descending order (newest first)
        }
        
        // If only one has a date, put it first
        if (dateA) return -1;
        if (dateB) return 1;
      }

      // Finally sort by name
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
            {isFolder ? (
              <>
                {hasChildren && (
                  <span 
                    className="text-gray-500 hover:text-gray-700" 
                    onClick={() => toggleFolder(item.path || '')}
                  >
                    {isExpanded ? '▼' : '▶'}
                  </span>
                )}
                <span className="mr-1">{getIcon(item.mime_type)}</span>
                <span className="flex-1">{item.name}</span>
              </>
            ) : (
              <>
                <input
                  type="checkbox"
                  checked={selectedFiles.has(item.id)}
                  onChange={() => toggleFile(item.id)}
                  className="form-checkbox h-4 w-4"
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="mr-1">{getIcon(item.mime_type)}</span>
                <span className="flex-1">{item.name}</span>
                <span className="ml-2">
                  {item.content_extracted ? '✅' : '⬜'}
                </span>
              </>
            )}
          </div>
          {isFolder && isExpanded && renderTree(item.path, level + 1)}
        </div>
      );
    });
  };

  return (
    <div className="file-tree p-4 border rounded-lg bg-white">
      <div className="mb-4 flex justify-between items-center">
        <div className="text-lg font-medium flex items-center gap-2">
          <span>🗂️</span>
          <span>Dynamic Healing Group Files</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          >
            Collapse All
          </button>
        </div>
      </div>
      {/* Only start rendering from root level (parentPath === null) */}
      {renderTree(null)}
    </div>
  );
} 