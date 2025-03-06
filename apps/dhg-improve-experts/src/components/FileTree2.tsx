import React, { useState, useEffect } from 'react';

// Define the most minimal type necessary
export interface FileNode {
  id: string;
  name: string;
  mime_type: string;
  path: string | null;
  parent_path: string | null;
  parent_folder_id?: string; // Added to support direct parent-child relationships
  drive_id?: string; // Added to support Google Drive IDs
  is_root?: boolean;
}

interface FileTreeProps {
  files: FileNode[];
}

export function FileTree2({ files }: FileTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  
  // Handle potential circular references by tracking visited paths
  const [safetyCheck, setSafetyCheck] = useState<Record<string, boolean>>({});
  
  // Expand root folders by default
  useEffect(() => {
    // Find root folders and expand them initially - use both IDs and paths for better compatibility
    const rootNodes = files.filter(f => f.is_root && f.mime_type === 'application/vnd.google-apps.folder');
  
    // Get both IDs and paths for maximum compatibility
    const expandKeys = [
      ...rootNodes.map(f => f.id), // Use IDs
      ...rootNodes.map(f => f.path).filter(Boolean) // Use paths as backup
    ];
      
    setExpandedFolders(new Set(expandKeys));
    
    // Build a safety check for path hierarchy to prevent circular references
    const pathHierarchy: Record<string, boolean> = {};
    for (const file of files) {
      if (file.path) {
        pathHierarchy[file.path] = true;
      }
    }
    setSafetyCheck(pathHierarchy);
    
    console.log(`Found ${rootNodes.length} root folders to expand`);
  }, [files]);
  
  // Toggle folder expansion - improved to work with both path and ID
  const toggleFolder = (pathOrId: string) => {
    console.log(`Toggling folder: ${pathOrId}`);
    if (!pathOrId) return;
    
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pathOrId)) {
        newSet.delete(pathOrId);
        console.log(`Folder collapsed: ${pathOrId}`);
      } else {
        newSet.add(pathOrId);
        console.log(`Folder expanded: ${pathOrId}`);
      }
      return newSet;
    });
  };
  
  // Expand all folders - improved to use IDs for more reliable expansion
  const expandAll = () => {
    // Get all folder IDs
    const allFolderIds = files
      .filter(f => f.mime_type === 'application/vnd.google-apps.folder')
      .map(f => f.id);
    
    // Get all folder paths (for backward compatibility)
    const allFolderPaths = files
      .filter(f => f.mime_type === 'application/vnd.google-apps.folder')
      .map(f => f.path)
      .filter(Boolean) as string[];
    
    // Combine both IDs and paths for maximum compatibility
    const expandKeys = [...allFolderIds, ...allFolderPaths];
    
    console.log(`Expanding all ${expandKeys.length} folders`);
    setExpandedFolders(new Set(expandKeys));
  };
  
  // Collapse all folders
  const collapseAll = () => {
    console.log("Collapsing all folders");
    // Create a completely new empty set to force state update
    setExpandedFolders(new Set<string>());
  };
  
  // Check if a path is a child of another path to prevent circular references
  const isChildOf = (childPath: string | null, parentPath: string | null): boolean => {
    if (!childPath || !parentPath) return false;
    if (childPath === parentPath) return false; // Prevent self-reference
    
    // Check if child path starts with parent path and is followed by "/"
    return childPath.startsWith(parentPath) && 
           (childPath.length > parentPath.length && 
            (childPath.charAt(parentPath.length) === '/' || 
             parentPath.endsWith('/')));
  };
  
  // Render file tree with enhanced lookup by parent_folder_id or parent_path
  const renderTree = (parentId: string | null, level = 0, visitedIds: Set<string> = new Set()) => {
    // Guard against excessive recursion
    if (level > 15) {
      return <div className="text-red-500">Maximum folder depth reached</div>;
    }
    
    // Track visited IDs to prevent circular references
    const newVisitedIds = new Set(visitedIds);
    if (parentId) newVisitedIds.add(parentId);
    
    // Find children at this level using parent_folder_id if available, otherwise use parent_path
    const children = files.filter(f => {
      // Skip if already visited (circular reference prevention)
      if (f.id && visitedIds.has(f.id)) {
        console.warn(`Circular reference detected for ID: ${f.id}`);
        return false;
      }
      
      // First try to match by parent_folder_id if available
      if (f.parent_folder_id) {
        return f.parent_folder_id === parentId;
      }
      
      // Fall back to parent_path for backward compatibility
      return f.parent_path === parentId;
    });
    
    // Nothing to render at this level
    if (children.length === 0) {
      return level === 0 ? <div>No files found</div> : null;
    }
    
    // Sort: folders first, then by name
    const sortedChildren = [...children].sort((a, b) => {
      const aIsFolder = a.mime_type === 'application/vnd.google-apps.folder';
      const bIsFolder = b.mime_type === 'application/vnd.google-apps.folder';
      
      if (aIsFolder && !bIsFolder) return -1;
      if (!aIsFolder && bIsFolder) return 1;
      
      return a.name.localeCompare(b.name);
    });
    
    return (
      <div className="file-tree-items">
        {sortedChildren.map(item => {
          const isFolder = item.mime_type === 'application/vnd.google-apps.folder';
          const isExpanded = isFolder && (expandedFolders.has(item.id) || expandedFolders.has(item.path || ''));
          
          // Check for children using both parent_folder_id and parent_path
          const hasChildren = isFolder && (
            files.some(f => f.parent_folder_id === item.id) || // Check by ID first
            files.some(f => f.parent_path === item.path && f.path !== item.path) // Fall back to path
          );
          
          return (
            <div key={item.id}>
              <div 
                className="flex items-center py-1 hover:bg-gray-50 cursor-pointer" 
                style={{ paddingLeft: `${level * 16}px` }}
              >
                {isFolder ? (
                  <>
                    {hasChildren ? (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          // Try to use ID first, fall back to path
                          toggleFolder(item.id || item.path || '');
                        }}
                        className="w-5 text-gray-500 hover:text-blue-500"
                        type="button"
                      >
                        {isExpanded ? '▼' : '▶'}
                      </button>
                    ) : (
                      <span className="w-5"></span>
                    )}
                    <span className="ml-1">📁 {item.is_root ? <strong>{item.name}</strong> : item.name}</span>
                  </>
                ) : (
                  <span className="ml-6">📄 {item.name}</span>
                )}
              </div>
              
              {isFolder && isExpanded && !newVisitedIds.has(item.id) && 
                renderTree(item.id, level + 1, newVisitedIds)}
            </div>
          );
        })}
      </div>
    );
  };
  
  // Debug information
  const rootFolders = files.filter(f => f.is_root && f.mime_type === 'application/vnd.google-apps.folder');
  const allFolders = files.filter(f => f.mime_type === 'application/vnd.google-apps.folder');
  
  return (
    <div className="w-full overflow-auto p-4">
      <div className="bg-gray-100 p-2 mb-4 text-xs rounded">
        <div>Total items: {files.length}</div>
        <div>Root folders: {rootFolders.length}</div>
        <div>All folders: {allFolders.length}</div>
        <div>Expanded folders: {expandedFolders.size}</div>
        
        <div className="mt-2">
          <strong>Root Folder Names:</strong>
          <ul className="list-disc pl-5 mt-1">
            {rootFolders.map((folder, i) => (
              <li key={i}>
                {folder.name}
                {folder.path ? ` (path: ${folder.path})` : ''}
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      <div className="mb-4 flex gap-2">
        <button 
          onClick={() => {
            console.log("Expand All clicked");
            expandAll();
          }}
          className="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          type="button"
        >
          Expand All
        </button>
        <button 
          onClick={() => {
            console.log("Collapse All clicked");
            collapseAll();
          }}
          className="px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          type="button"
        >
          Collapse All
        </button>
      </div>
      
      {renderTree(null)}
    </div>
  );
}