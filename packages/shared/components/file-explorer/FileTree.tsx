import React, { useState, useEffect } from 'react';
import { FileNode } from '../../services/google-drive-explorer';

interface FileTreeProps {
  files: FileNode[];
  onSelectionChange?: (selectedIds: string[]) => void;
  onFileClick?: (file: FileNode) => void;
}

interface TreeNode extends FileNode {
  children: TreeNode[];
}

export const FileTree: React.FC<FileTreeProps> = ({ 
  files, 
  onSelectionChange, 
  onFileClick 
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [treeStructure, setTreeStructure] = useState<TreeNode[]>([]);

  // Build tree structure from flat file list
  useEffect(() => {
    const buildTree = (): TreeNode[] => {
      const nodeMap = new Map<string, TreeNode>();
      const rootNodes: TreeNode[] = [];

      // First pass: create all nodes
      files.forEach(file => {
        nodeMap.set(file.id, { ...file, children: [] });
      });

      // Second pass: build hierarchy
      files.forEach(file => {
        const node = nodeMap.get(file.id)!;
        
        if (file.is_root || !file.parent_folder_id) {
          rootNodes.push(node);
        } else {
          // Try to find parent by parent_folder_id
          let parent: TreeNode | undefined;
          
          // Look for parent using parent_folder_id
          files.forEach(f => {
            if (f.drive_id === file.parent_folder_id || f.id === file.parent_folder_id) {
              parent = nodeMap.get(f.id);
            }
          });

          if (parent) {
            parent.children.push(node);
          } else {
            // Orphaned file - add to root
            rootNodes.push(node);
          }
        }
      });

      // Sort children by name
      const sortNodes = (nodes: TreeNode[]) => {
        nodes.sort((a, b) => {
          // Folders first
          if (a.mime_type === 'application/vnd.google-apps.folder' && 
              b.mime_type !== 'application/vnd.google-apps.folder') return -1;
          if (a.mime_type !== 'application/vnd.google-apps.folder' && 
              b.mime_type === 'application/vnd.google-apps.folder') return 1;
          // Then by name
          return a.name.localeCompare(b.name);
        });
        nodes.forEach(node => sortNodes(node.children));
      };

      sortNodes(rootNodes);
      return rootNodes;
    };

    setTreeStructure(buildTree());
  }, [files]);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const toggleSelection = (fileId: string) => {
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

  const renderNode = (node: TreeNode, depth: number = 0): React.ReactNode => {
    const isFolder = node.mime_type === 'application/vnd.google-apps.folder';
    const isExpanded = expandedFolders.has(node.id);
    const isSelected = selectedFiles.has(node.id);

    return (
      <div key={node.id} className="select-none">
        <div 
          className={`flex items-center py-1 px-2 hover:bg-gray-100 cursor-pointer ${
            isSelected ? 'bg-blue-50' : ''
          }`}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={() => {
            if (isFolder) {
              toggleFolder(node.id);
            }
            toggleSelection(node.id);
            onFileClick?.(node);
          }}
        >
          {isFolder && (
            <span className="mr-2 text-gray-500">
              {isExpanded ? '▼' : '▶'}
            </span>
          )}
          <span className={`mr-2 ${isFolder ? 'text-blue-500' : 'text-gray-600'}`}>
            {isFolder ? '📁' : '📄'}
          </span>
          <span className="flex-1 truncate">
            {node.name}
          </span>
          {node.is_root && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
              ROOT
            </span>
          )}
        </div>
        {isFolder && isExpanded && node.children.map(child => 
          renderNode(child, depth + 1)
        )}
      </div>
    );
  };

  return (
    <div className="border rounded-lg overflow-auto" style={{ maxHeight: '600px' }}>
      {treeStructure.length === 0 ? (
        <div className="p-4 text-gray-500 text-center">
          No files found
        </div>
      ) : (
        <div className="p-2">
          {treeStructure.map(node => renderNode(node))}
        </div>
      )}
    </div>
  );
};