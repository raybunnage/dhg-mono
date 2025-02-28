import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '@/integrations/supabase/client';
import { FileTreeItem } from './FileTreeItem';

interface FileNode {
  id: string;
  name: string;
  mime_type: string;
  path: string | null;
  parent_path: string | null;
  content_extracted?: boolean;
  web_view_link?: string;
  processing_status?: 'queued' | 'processing' | 'completed' | 'error';
  batch_id?: string;
  metadata?: {
    size?: string;
    quotaBytesUsed?: string;  // Google Drive sometimes uses this
    fileSize?: string;        // Or might use this
  };
}

interface FileTreeProps {
  files: FileNode[];
  onSelectionChange?: (selectedIds: string[]) => void;
}

// Add new type for supported file types
type SupportedFileType = 'pdf' | 'document' | 'other';

// Add helper function to determine file type
const getFileType = (mimeType: string): SupportedFileType => {
  if (mimeType.includes('pdf')) return 'pdf';
  if (
    mimeType === 'application/vnd.google-apps.document' ||
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) return 'document';
  return 'other';
};

// Add helper function to format file size
const formatFileSize = (bytes: string | number): string => {
  const numBytes = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (!numBytes) return '';
  const kb = numBytes / 1024;
  if (kb < 1024) {
    return `(${Math.round(kb)}KB)`;
  }
  const mb = kb / 1024;
  return `(${mb.toFixed(1)}MB)`;
};

export function FileTree({ files, onSelectionChange }: FileTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [showOnlyProcessable, setShowOnlyProcessable] = useState(true);
  const [showOnlyDocs, setShowOnlyDocs] = useState(false);

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

  // Filter function for processable files
  const isProcessableFile = (file: FileNode) => {
    // Always show folders
    if (file.mime_type === 'application/vnd.google-apps.folder') return true;

    // Get file type
    const fileType = getFileType(file.mime_type);

    // If showing only documents
    if (showOnlyDocs) {
      return fileType === 'document' || 
             file.mime_type === 'application/vnd.google-apps.document' ||
             file.name.endsWith('.doc') ||
             file.name.endsWith('.docx');
    }

    // If showing processable files (PDFs and documents)
    if (showOnlyProcessable) {
      return fileType === 'pdf' || fileType === 'document';
    }

    return true;
  };

  const renderTree = (parentPath: string | null = null, level: number = 0) => {
    const items = files.filter(f => f.parent_path === parentPath);
    
    // Add this debug log
    console.log('Files with metadata:', items.map(item => ({
      name: item.name,
      metadata: item.metadata,
      mime_type: item.mime_type
    })));
    
    // Filter out non-processable files unless it's a folder
    const filteredItems = items.filter(item => 
      item.mime_type === 'application/vnd.google-apps.folder' || isProcessableFile(item)
    );

    const sortedItems = filteredItems.sort((a, b) => {
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
      const fileSize = (() => {
        console.log('File metadata:', item.metadata); // Debug log
        if (!item.metadata?.size) return '';
        return formatFileSize(Number(item.metadata.size));
      })();

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
                  disabled={item.processing_status === 'processing'}
                  className="form-checkbox h-4 w-4"
                />
                <span className="mr-1">{getIcon(item.mime_type)}</span>
                <span className="flex-1">
                  {item.name}
                  {!isFolder && (
                    <span className="text-gray-500 text-sm ml-2">
                      {formatFileSize(item.metadata?.size || item.metadata?.quotaBytesUsed || item.metadata?.fileSize || '0')}
                    </span>
                  )}
                </span>
                <span className="ml-2">
                  {item.content_extracted ? (
                    <span title="Processed" className="text-green-500">✅</span>
                  ) : item.processing_status === 'queued' ? (
                    <span title="Queued" className="text-yellow-500">⏳</span>
                  ) : item.processing_status === 'processing' ? (
                    <span title="Processing" className="text-blue-500 animate-pulse">⚡</span>
                  ) : item.processing_status === 'error' ? (
                    <span title="Error" className="text-red-500">❌</span>
                  ) : (
                    <span title="Not Processed">⬜</span>
                  )}
                </span>
              </>
            )}
          </div>
          {isFolder && isExpanded && renderTree(item.path, level + 1)}
        </div>
      );
    });
  };

  const handleProcessSelected = async () => {
    const selectedFileNodes = Array.from(selectedFiles)
      .map(id => files.find(f => f.id === id))
      .filter(f => f && !f.content_extracted) as FileNode[]; // Only process unextracted files

    if (selectedFileNodes.length === 0) {
      toast.success('No new files to process');
      return;
    }

    // Split into batches of 10
    const batches = [];
    for (let i = 0; i < selectedFileNodes.length; i += 10) {
      batches.push(selectedFileNodes.slice(i, i + 10));
    }

    try {
      for (const batch of batches) {
        // Create batch record and expert_documents
        const { data: batchData, error: batchError } = await supabase
          .from('processing_batches')
          .insert({
            created_at: new Date().toISOString(),
            status: 'queued',
            total_files: batch.length
          })
          .select()
          .single();

        if (batchError) throw batchError;

        // Create expert_documents for each file
        const { error: docsError } = await supabase
          .from('expert_documents')
          .insert(
            batch.map(file => ({
              source_id: file.id,
              batch_id: batchData.id,
              status: 'queued',
              created_at: new Date().toISOString()
            }))
          );

        if (docsError) throw docsError;

        toast.success(`Created batch of ${batch.length} files for processing`);
      }

      // Clear selection after successful batch creation
      setSelectedFiles(new Set());
    } catch (error) {
      console.error('Error creating batch:', error);
      toast.error('Failed to create processing batch');
    }
  };

  return (
    <div className="file-tree p-4 border rounded-lg bg-white">
      <div className="mb-4 flex justify-between items-center">
        <div className="text-lg font-medium flex items-center gap-2">
          <span>🗂️</span>
          <span>Dynamic Healing Group Files</span>
        </div>
        <div className="flex items-center gap-4">
          {/* Add filter toggle */}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showOnlyProcessable}
              onChange={(e) => setShowOnlyProcessable(e.target.checked)}
              className="form-checkbox h-4 w-4"
            />
            Show only PDFs & Documents
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showOnlyDocs}
              onChange={(e) => setShowOnlyDocs(e.target.checked)}
              className="form-checkbox h-4 w-4"
            />
            Show only Documents
          </label>
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
      </div>
      
      {/* Add file type legend */}
      {showOnlyProcessable && (
        <div className="mb-4 text-sm text-gray-500 flex gap-4">
          <span>📕 PDF</span>
          <span>📄 Document</span>
          <span>📁 Folder</span>
        </div>
      )}

      {/* Only start rendering from root level (parentPath === null) */}
      {renderTree(null)}

      {/* New selected files panel - only shows when files are selected */}
      {selectedFiles.size > 0 && (
        <div className="mt-4 border-t pt-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium">
              Selected Files ({selectedFiles.size})
            </h3>
            <button
              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
              onClick={handleProcessSelected}
            >
              Process Selected
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {Array.from(selectedFiles).map(fileId => {
              const file = files.find(f => f.id === fileId);
              if (!file) return null;
              return (
                <div key={file.id} className="flex items-center gap-2 py-1 text-sm">
                  <span>{getIcon(file.mime_type)}</span>
                  <span className="flex-1">{file.name}</span>
                  <button
                    onClick={() => toggleFile(file.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
} 