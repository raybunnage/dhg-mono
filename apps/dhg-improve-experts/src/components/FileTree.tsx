import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '@/integrations/supabase/client';
import { FileTreeItem } from './FileTreeItem';
import type { Database } from '@/../../supabase/types';

type ExpertDocument = Database['public']['Tables']['expert_documents']['Row'];
type SourcesGoogle = Database['public']['Tables']['sources_google']['Row'];
type BatchProcessingStatus = Database['public']['Views']['batch_processing_status']['Row'];
type Json = Database['public']['Tables']['sources_google']['Row']['metadata'];

// First, let's define a proper metadata type based on what we know exists
interface FileMetadata {
  size?: string | number;
  quotaBytesUsed?: string | number;
  fileSize?: string | number;
  [key: string]: any; // Allow other properties since it's Json type
}

// Update FileNode interface
export interface FileNode {
  id: string;
  name: string;
  mime_type: string;
  path: string | null;
  parent_path: string | null;
  content_extracted: boolean | null;
  web_view_link: string | null;
  metadata: Json | null;
  expertDocument?: {
    processing_status: string | null;
    batch_id: string | null;
    error_message: string | null;
    queued_at: string | null;
    processing_started_at: string | null;
    processing_completed_at: string | null;
    processing_error: string | null;
    retry_count: number | null;
    processed_content?: string | Record<string, any>;
  };
  drive_id?: string;
}

interface FileTreeProps {
  files: FileNode[];
  onSelectionChange?: (selectedIds: string[]) => void;
  onFileClick?: (file: FileNode) => void;
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

// Define common MIME types with friendly names
const MIME_TYPE_FILTERS = [
  { 
    type: 'application/pdf', 
    label: 'PDF',
    tooltip: 'application/pdf'
  },
  { 
    type: [
      'application/vnd.google-apps.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ], 
    label: 'Word',
    tooltip: '.doc, .docx, Google Docs'
  },
  { 
    type: [
      'application/vnd.google-apps.presentation',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ], 
    label: 'PowerPoint',
    tooltip: '.ppt, .pptx, Google Slides'
  },
  { 
    type: [
      'text/plain',
      'text/csv',
      'text/tab-separated-values'
    ], 
    label: 'Chats',
    tooltip: '.txt, .csv files (Zoom chat summaries)'
  },
  { 
    type: 'video/mp4', 
    label: 'Video',
    tooltip: 'video/mp4'
  },
  { 
    type: [
      'audio/mpeg',
      'audio/mp4',
      'audio/m4a',
      'audio/wav',
      'audio/ogg',
      'audio/webm',
      'audio/aac',
      'audio/x-m4a'
    ], 
    label: 'Audio',
    tooltip: '.mp3, .m4a, .wav, .ogg, .webm, .aac'
  }
];

export function FileTree({ files, onSelectionChange, onFileClick }: FileTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [activeMimeTypes, setActiveMimeTypes] = useState<Set<string>>(new Set());

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

  const toggleMimeType = (mimeType: string | string[]) => {
    setActiveMimeTypes(prev => {
      const next = new Set(prev);
      const types = Array.isArray(mimeType) ? mimeType : [mimeType];
      
      // Check if any of the types are already active
      const hasActive = types.some(type => prev.has(type));
      
      // If any are active, remove all. Otherwise, add all
      types.forEach(type => {
        if (hasActive) {
          next.delete(type);
        } else {
          next.add(type);
        }
      });
      
      return next;
    });
  };

  const clearMimeFilters = () => {
    setActiveMimeTypes(new Set());
  };

  // Filter function for processable files
  const isProcessableFile = (file: FileNode) => {
    if (file.mime_type === 'application/vnd.google-apps.folder') return true;
    if (activeMimeTypes.size === 0) return true; // Show all if no filters
    return Array.from(activeMimeTypes).some(type => {
      // Handle both string and array types
      if (Array.isArray(type)) {
        return type.includes(file.mime_type);
      }
      return type === file.mime_type;
    });
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

      return (
        <div key={item.id} className="file-tree-item">
          <div 
            className={`flex items-center gap-2 py-1 hover:bg-gray-50 rounded cursor-pointer
              ${!isFolder && item.content_extracted ? 'bg-green-50' : ''}`}
            style={{ paddingLeft: `${level * 20}px` }}
            onClick={() => !isFolder && onFileClick?.(item)}
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
                  disabled={item.content_extracted === null}
                  className="form-checkbox h-4 w-4"
                />
                <span className="mr-1">{getIcon(item.mime_type)}</span>
                <span className={`flex-1 flex items-center gap-2 
                  ${item.content_extracted ? 'text-green-700' : ''}`}
                >
                  <span>{item.name}</span>
                  <span className="text-gray-500 text-sm">
                    {formatFileSize(
                      (item.metadata as FileMetadata)?.size || 
                      (item.metadata as FileMetadata)?.quotaBytesUsed || 
                      (item.metadata as FileMetadata)?.fileSize || 
                      '0'
                    )}
                  </span>
                </span>
              </>
            )}
            {!isFolder && (
              <span className="flex items-center gap-1">
                {item.expertDocument ? (
                  <>
                    {item.expertDocument.processing_status === 'completed' && (
                      <span title="Processed" className="text-green-600 text-sm">✓</span>
                    )}
                    {item.expertDocument.processing_status === 'queued' && (
                      <span title="Queued" className="text-yellow-500">⏳</span>
                    )}
                    {item.expertDocument.processing_status === 'processing' && (
                      <span title="Processing" className="text-blue-500 animate-pulse">⚡</span>
                    )}
                    {item.expertDocument.processing_status === 'failed' && (
                      <span title={item.expertDocument.error_message || 'Error'} className="text-red-500">❌</span>
                    )}
                  </>
                ) : item.content_extracted ? (
                  <span title="Content Extracted" className="text-green-600 text-sm">✓</span>
                ) : null}
              </span>
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
      .filter(f => f && f.content_extracted === null) as FileNode[]; // Only process unextracted files

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

  // Add function to count files by MIME type
  const getFileCountByMimeType = (mimeType: string | string[]) => {
    const mimeTypes = Array.isArray(mimeType) ? mimeType : [mimeType];
    return files.filter(file => mimeTypes.includes(file.mime_type)).length;
  };

  // Add function to get misc files count
  const getMiscFilesCount = () => {
    const knownMimeTypes = MIME_TYPE_FILTERS.flatMap(filter => 
      Array.isArray(filter.type) ? filter.type : [filter.type]
    );
    return files.filter(file => 
      !knownMimeTypes.includes(file.mime_type) && 
      file.mime_type !== 'application/vnd.google-apps.folder'
    ).length;
  };

  return (
    <div className="file-tree p-4 border rounded-lg bg-white">
      {/* Add debug ID at the top */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-400 mb-2">
          FileTree v1.0 [DEBUG-ID: FT-2025-02-16]
        </div>
      )}
      
      {/* Updated MIME type filter pills */}
      <div className="mb-4">
        <div className="flex-1">
          <div className="flex flex-wrap gap-2 mb-2">
            {MIME_TYPE_FILTERS.map(({ type, label, tooltip }) => {
              const count = getFileCountByMimeType(type);
              if (count === 0) return null;
              
              const isActive = Array.isArray(type) 
                ? type.some(t => activeMimeTypes.has(t))
                : activeMimeTypes.has(type);
              
              return (
                <button
                  key={Array.isArray(type) ? type[0] : type}
                  onClick={() => toggleMimeType(type)}
                  title={tooltip}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors
                    ${isActive
                      ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  {label} ({count})
                </button>
              );
            })}
            
            {/* Misc pill */}
            {getMiscFilesCount() > 0 && (
              <button
                onClick={() => {
                  const knownTypes = new Set(MIME_TYPE_FILTERS.flatMap(f => 
                    Array.isArray(f.type) ? f.type : [f.type]
                  ));
                  const miscTypes = Array.from(new Set(
                    files
                      .filter(f => !knownTypes.has(f.mime_type) && 
                        f.mime_type !== 'application/vnd.google-apps.folder'
                      )
                      .map(f => f.mime_type)
                  ));
                  
                  const hasActiveMisc = miscTypes.some(type => activeMimeTypes.has(type));
                  setActiveMimeTypes(prev => {
                    const next = new Set(prev);
                    miscTypes.forEach(type => {
                      if (hasActiveMisc) {
                        next.delete(type);
                      } else {
                        next.add(type);
                      }
                    });
                    return next;
                  });
                }}
                title={`Other file types:\n${Array.from(new Set(
                  files
                    .filter(f => !MIME_TYPE_FILTERS.flatMap(filter => 
                      Array.isArray(filter.type) ? filter.type : [filter.type]
                    ).includes(f.mime_type) && 
                    f.mime_type !== 'application/vnd.google-apps.folder'
                    )
                    .map(f => f.mime_type)
                )).join('\n')}`}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors
                  ${files.some(f => 
                    !MIME_TYPE_FILTERS.flatMap(filter => 
                      Array.isArray(filter.type) ? filter.type : [filter.type]
                    ).includes(f.mime_type) && 
                    activeMimeTypes.has(f.mime_type)
                  )
                    ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                Misc ({getMiscFilesCount()})
              </button>
            )}

            {/* Add a separator */}
            <div className="h-6 w-px bg-gray-200 mx-1"></div>

            {/* Move expand/collapse buttons here */}
            <button
              onClick={expandAll}
              className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Collapse All
            </button>
          </div>
          
          {activeMimeTypes.size > 0 && (
            <button
              onClick={clearMimeFilters}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <span>✕</span>
              Clear Filters
            </button>
          )}
        </div>
      </div>
      
      <div className="mb-4 flex justify-between items-center">
        <div className="text-lg font-medium flex items-center gap-2">
          <span>🗂️</span>
          <span>Dynamic Healing Group Files</span>
        </div>
      </div>
      
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