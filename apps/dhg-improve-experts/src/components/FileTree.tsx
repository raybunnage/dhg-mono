import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '@/integrations/supabase/client';
import { FileTreeItem } from './FileTreeItem';
import type { Database } from '../../../../supabase/types';

type ExpertDocument = Database['public']['Tables']['expert_documents']['Row'];
type SourcesGoogle = Database['public']['Tables']['google_sources']['Row'];
type BatchProcessingStatus = Database['public']['Views']['batch_processing_status']['Row'];
type Json = Database['public']['Tables']['google_sources']['Row']['metadata'];

// First, let's define a proper metadata type based on what we know exists
interface FileMetadata {
  file_size?: string | number; // Primary field for file size
  size?: string | number; // Keep for backwards compatibility
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
    id: string;
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
  content?: string | null;
  is_root?: boolean;  // Added is_root flag to identify root folders
}

interface FileTreeProps {
  files: FileNode[];
  onSelectionChange?: (selectedIds: string[]) => void;
  onFileClick?: (file: FileNode) => void;
}

// Add new type for supported file types
type SupportedFileType = 'pdf' | 'document' | 'other';

// Add helper function to determine file type
export const getFileType = (mimeType: string): keyof typeof FILE_TYPE_COLORS => {
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('document') || 
      mimeType.includes('msword') || 
      mimeType.includes('wordprocessingml')) return 'document';
  if (mimeType.includes('presentation') || 
      mimeType.includes('powerpoint') ||
      mimeType.includes('pptx') ||
      mimeType.includes('ppt') ||
      mimeType === 'application/vnd.google-apps.presentation') return 'presentation';
  if (mimeType.includes('spreadsheet') || 
      mimeType.includes('excel')) return 'spreadsheet';
  if (mimeType.includes('audio') || 
      mimeType.includes('mp3') || 
      mimeType.includes('wav')) return 'audio';
  if (mimeType.includes('video') || 
      mimeType.includes('mp4')) return 'video';
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

// Rearrange MIME_TYPE_FILTERS
const MIME_TYPE_FILTERS = [
  { 
    type: 'video/mp4', 
    label: 'Video',
    tooltip: 'video/mp4'
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
      'text/plain',
      'text/csv',
      'text/tab-separated-values'
    ], 
    label: 'Chats',
    tooltip: '.txt, .csv files (Zoom chat summaries)'
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

// Update FILE_TYPE_COLORS with better color coordination
export const FILE_TYPE_COLORS = {
  pdf: {
    pill: 'bg-red-50 text-red-700',
    icon: { bg: 'bg-red-100', text: 'text-red-700' },
    emoji: '📕'  // Back to red book emoji
  },
  document: {
    pill: 'bg-blue-50 text-blue-700',
    icon: { bg: 'bg-blue-100', text: 'text-blue-700' },
    emoji: '📘'  // Blue book emoji
  },
  presentation: {
    pill: 'bg-orange-50 text-orange-700',
    icon: { bg: 'bg-orange-100', text: 'text-orange-700' },
    emoji: '📙'  // Orange book emoji
  },
  spreadsheet: {
    pill: 'bg-green-50 text-green-700',
    icon: { bg: 'bg-green-100', text: 'text-green-700' },
    emoji: '📗'  // Green book emoji
  },
  audio: {
    pill: 'bg-purple-50 text-purple-700',
    icon: { bg: 'bg-purple-100', text: 'text-purple-700' },
    emoji: '🎵'
  },
  video: {
    pill: 'bg-pink-50 text-pink-700',
    icon: { bg: 'bg-pink-100', text: 'text-pink-700' },
    emoji: '🎬'
  },
  text: {
    pill: 'bg-slate-50 text-slate-700',
    icon: { bg: 'bg-slate-100', text: 'text-slate-700' },
    emoji: '📄'  // Changed to a simple document icon
  },
  other: {
    pill: 'bg-gray-50 text-gray-600',
    icon: { bg: 'bg-gray-100', text: 'text-gray-600' },
    emoji: '📎'  // Changed to paperclip for misc files
  }
} as const;

export function FileTree({ files, onSelectionChange, onFileClick }: FileTreeProps) {
  // Get root folder paths initially for automatic expansion
  const rootFolderPaths = new Set(
    files
      .filter(f => f.mime_type === 'application/vnd.google-apps.folder' && f.is_root === true)
      .map(f => f.path || '')
      .filter(Boolean)
  );
  
  // Start with root folders expanded by default
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(rootFolderPaths);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [activeMimeTypes, setActiveMimeTypes] = useState<Set<string>>(new Set());
  const [hideProcessedFiles, setHideProcessedFiles] = useState(false);
  const [processingStage, setProcessingStage] = useState<'idle' | 'analyzing' | 'processing'>('idle');
  const [processingStatus, setProcessingStatus] = useState<Record<string, string>>({});
  const [hideSubfolders, setHideSubfolders] = useState(true);

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
    const file = files.find(f => f.id === fileId);
    if (!file) return;

    const fileType = getFileType(file.mime_type || ''); // Provide default empty string
    const colors = FILE_TYPE_COLORS[fileType] || FILE_TYPE_COLORS.other; // Fallback to 'other' if type not found

    setSelectedFiles(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(fileId)) {
        newSelected.delete(fileId);
      } else {
        newSelected.add(fileId);
      }
      // Call the callback if provided
      onSelectionChange?.(Array.from(newSelected));
      return newSelected;
    });
  };

  const getIcon = (file: FileNode) => {
    if (file.mime_type === 'application/vnd.google-apps.folder') return '📁';
    
    // Check if file has processed content
    const hasProcessedContent = file.expertDocument?.processed_content || file.content_extracted;
    
    const fileType = getFileType(file.mime_type);
    const baseEmoji = FILE_TYPE_COLORS[fileType].emoji;
    
    // Return special "processed" icon if content has been processed
    if (hasProcessedContent) {
      switch (fileType) {
        case 'pdf': return '🔍';
        case 'document': return '📊';
        case 'presentation': return '🎯';
        case 'audio': return '📝';
        case 'video': return '📝';
        case 'text': return '📋';  // Changed to clipboard for processed text
        default: return '✨';
      }
    }
    
    return baseEmoji;
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
    if (hideProcessedFiles && 
        file.expertDocument?.processing_status === 'completed') {
      return false;
    }
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

  const renderTree = (parentPath: string | null, level: number = 0) => {
    // Add debug info at the start
    if (level === 0) {
      console.log(`Starting to render tree at root level - found ${files.filter(f => f.is_root).length} root items`);
      
      // DEBUG: Let's analyze the files to find structural issues
      console.log(`%c ==== FILETREE DEBUGGING INFO ====`, 'background: #000; color: #ff0; font-size: 14px');
      
      // Log root folders
      const rootFolders = files.filter(f => f.is_root === true && f.mime_type === 'application/vnd.google-apps.folder');
      console.log(`Root folders (${rootFolders.length}):`);
      rootFolders.forEach(folder => {
        console.log(`%c${folder.name}`, 'color: #0a0; font-weight: bold', {
          id: folder.id,
          path: folder.path,
          parent_path: folder.parent_path,
          parent_folder_id: folder.parent_folder_id,
          is_root: folder.is_root
        });
      });
      
      // For each root folder, check children
      rootFolders.forEach(folder => {
        if (!folder.path) {
          console.log(`%cWARNING: Root folder has no path: ${folder.name}`, 'color: #f00; font-weight: bold');
          return;
        }
        
        // Find children by parent_path
        const pathChildren = files.filter(f => f.parent_path === folder.path);
        console.log(`Children for "${folder.name}" by parent_path: ${pathChildren.length}`);
        
        // Also find by parent_folder_id for comparison
        const idChildren = folder.id ? files.filter(f => f.parent_folder_id === folder.id) : [];
        const driveIdChildren = folder.drive_id ? files.filter(f => f.parent_folder_id === folder.drive_id) : [];
        
        console.log(`Children for "${folder.name}" by parent_folder_id: ${idChildren.length}`);
        console.log(`Children for "${folder.name}" by drive_id: ${driveIdChildren.length}`);
        
        // Report detailed issues
        if (pathChildren.length === 0 && (idChildren.length > 0 || driveIdChildren.length > 0)) {
          console.log(`%cMISSING PATH RELATIONSHIP: "${folder.name}" has children by ID but not by path`, 'color: #f00');
        }
      });
      
      console.log(`%c ================================`, 'background: #000; color: #ff0; font-size: 14px');
    }
    // At the top level (level 0), we want to show only root folders if they exist
    if (level === 0) {
      // Find all folders marked as root
      const rootFolders = files.filter(item => 
        item.mime_type === 'application/vnd.google-apps.folder' && 
        item.is_root === true
      );
      
      console.log(`Found ${rootFolders.length} root folders for top level`);
      
      // If we have root folders, only show those at the top level
      if (rootFolders.length > 0) {
        // Sort the root folders alphabetically
        const sortedRootFolders = [...rootFolders].sort((a, b) => a.name.localeCompare(b.name));
        
        return sortedRootFolders.map(folder => {
          const isExpanded = expandedFolders.has(folder.path || '');
          
          return (
            <div key={folder.id} className="file-tree-item">
              <div 
                className="flex items-center gap-2 py-1 hover:bg-gray-50 rounded cursor-pointer"
                style={{ paddingLeft: `${level * 20}px` }}
              >
                <span 
                  className="text-gray-500 hover:text-gray-700" 
                  onClick={() => toggleFolder(folder.path || '')}
                >
                  {isExpanded ? '▼' : '▶'}
                </span>
                <span className="bg-blue-100 text-blue-700 p-1 rounded flex items-center gap-1">
                  <span>📁</span>
                  <span className="font-semibold">{folder.name}</span>
                  <span className="text-xs bg-blue-200 px-1.5 py-0.5 rounded-full">root</span>
                </span>
              </div>
              {isExpanded && folder.path && renderTree(folder.path, level + 1)}
            </div>
          );
        });
      }
    }
    
    // Regular file tree rendering logic for non-root levels
    // Find items at this level using BOTH path and parent_folder_id
    const itemsByPath = files.filter(item => item.parent_path === parentPath);
    
    // Also find items by parent_folder_id if we have a parent folder
    let itemsByFolderId: FileNode[] = [];
    if (parentPath) {
      // Try to find the folder with this path
      const parentFolder = files.find(f => f.path === parentPath);
      if (parentFolder) {
        // Include items that have this as parent_folder_id
        itemsByFolderId = files.filter(item => 
          item.parent_folder_id === parentFolder.id
        );
      }
    }
    
    // Combine the results, deduplicating by ID
    const combinedItems = new Map<string, FileNode>();
    itemsByPath.forEach(item => combinedItems.set(item.id, item));
    itemsByFolderId.forEach(item => {
      if (!combinedItems.has(item.id)) {
        combinedItems.set(item.id, item);
      }
    });
    
    // Convert back to array
    let items = Array.from(combinedItems.values());
    
    // Add debugging output for folders with lots of children or at important levels
    if (items.length > 5 || level <= 1) {
      if (parentPath) {
        const parentFolder = files.find(f => f.path === parentPath);
        console.log(
          `Level ${level}: "${parentPath?.split('/').pop() || 'root'}" has ${items.length} children ` +
          `(${itemsByPath.length} by path, ${itemsByFolderId.length} by parent_folder_id)` +
          `${parentFolder ? ' [Folder ID: ' + parentFolder.id + ']' : ''}`
        );
      }
    }
    
    // Apply subfolder hiding if needed
    if (hideSubfolders) {
      items = items.filter(item => {
        const isFile = item.mime_type !== 'application/vnd.google-apps.folder';
        const isTopOrFirstLevelFolder = (level === 0 || level === 1) && !isFile;
        return (isFile || isTopOrFirstLevelFolder);
      });
    }
    
    // Filter out root folders if we're not at the top level
    // This prevents root folders from showing up as regular folders in the hierarchy
    const nonRootItems = level === 0 
      ? items.filter(item => !(item.is_root === true && item.mime_type === 'application/vnd.google-apps.folder'))
      : items;
    
    // Filter out non-processable files unless it's a folder
    const filteredItems = nonRootItems.filter(item => 
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
      // Check for children using BOTH parent_path and parent_folder_id
      const hasChildren = files.some(f => 
        (f.parent_path === item.path) || 
        (f.parent_folder_id === item.id)
      );

      const fileType = getFileType(item.mime_type);
      const colors = FILE_TYPE_COLORS[fileType] || FILE_TYPE_COLORS.other;

      return (
        <div key={item.id} className="file-tree-item">
          <div 
            className={`flex items-center gap-2 py-1 hover:bg-gray-50 rounded cursor-pointer
              ${!isFolder && item.content_extracted ? 'bg-green-50' : ''}
              ${!isFolder ? colors.pill : ''}`}
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
                <span className={`${colors.icon.bg} ${colors.icon.text} p-1 rounded`}>
                  {isFolder ? '📁' : colors.emoji}
                </span>
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
                <span className={`${colors.icon.bg} ${colors.icon.text} p-1 rounded`}>
                  {getIcon(item)}
                </span>
                <span className={`flex-1 flex items-center gap-2 
                  ${item.content_extracted ? 'text-green-700' : ''}`}
                >
                  <span>{item.name}</span>
                  <span className="text-gray-500 text-sm">
                    {formatFileSize(
                      (item.metadata as FileMetadata)?.file_size || 
                      (item.metadata as FileMetadata)?.size || 
                      (item.metadata as FileMetadata)?.quotaBytesUsed || 
                      (item.metadata as FileMetadata)?.fileSize || 
                      '0'
                    )}
                  </span>
                </span>
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
              </>
            )}
          </div>
          {isFolder && isExpanded && (
            // Pass folder ID as alternative param when path is missing
            renderTree(item.path, level + 1)
          )}
        </div>
      );
    });
  };

  const handleProcessSelected = async () => {
    const selectedFilesList = Array.from(selectedFiles)
      .map(id => files.find(f => f.id === id))
      .filter((f): f is FileNode => f !== undefined);

    setProcessingStage('analyzing');
    
    for (const file of selectedFilesList) {
      try {
        setProcessingStatus(prev => ({ ...prev, [file.id]: 'Analyzing document type...' }));
        
        // Step 1: Ensure content is in sources_google
        if (!file.content) {
          setProcessingStatus(prev => ({ ...prev, [file.id]: 'Extracting content...' }));
          // Add content extraction logic here
        }

        // Step 2: Determine processing type
        setProcessingStatus(prev => ({ ...prev, [file.id]: 'Determining processing approach...' }));
        const processingType = await determineProcessingType(file);

        // Step 3: Process based on type
        setProcessingStatus(prev => ({ ...prev, [file.id]: 'Processing content...' }));
        await processContent(file, processingType);

        setProcessingStatus(prev => ({ ...prev, [file.id]: 'Completed' }));
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        setProcessingStatus(prev => ({ ...prev, [file.id]: 'Error: ' + (error as Error).message }));
      }
    }

    setProcessingStage('idle');
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

  const determineProcessingType = async (file: FileNode) => {
    const types = {
      EXPERT_INFO: 'expert_info',
      PDF_EXTRACT: 'pdf_extract',
      TRANSCRIPT: 'transcript',
      CHAT_SUMMARY: 'chat_summary'
    } as const;

    if (file.mime_type.includes('pdf')) return types.PDF_EXTRACT;
    if (file.mime_type.includes('document')) return types.EXPERT_INFO;
    if (file.mime_type.includes('text')) return types.TRANSCRIPT;
    return types.EXPERT_INFO; // default
  };

  const processContent = async (file: FileNode, processingType: string) => {
    // Implementation will come later
    console.log(`Processing ${file.name} with type ${processingType}`);
  };

  return (
    <div className="w-full h-full overflow-y-auto pl-6">
      {/* Updated MIME type filter pills */}
      <div className="mb-4">
        <div className="flex-1">
          <div className="flex flex-wrap gap-2 mb-2">
            {/* File type filters */}
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
                    ? 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
              >
                Misc ({getMiscFilesCount()})
              </button>
            )}

            {/* Add a separator */}
            <div className="h-6 w-px bg-gray-200 mx-1"></div>

            {/* Expand/Collapse and Hide Processed buttons */}
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
            <button
              onClick={() => setHideProcessedFiles(!hideProcessedFiles)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors
                ${hideProcessedFiles
                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              {hideProcessedFiles ? 'Show Processed' : 'Hide Processed'}
            </button>
            
            {/* New subfolder toggle button */}
            <button
              onClick={() => setHideSubfolders(!hideSubfolders)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors
                ${hideSubfolders
                  ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              {hideSubfolders ? 'Show Subfolders' : 'Hide Subfolders'}
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
      
      <div className="mb-6">
        <div className="text-xl font-semibold flex items-center gap-3 px-2 py-3 border-b">
          <span className="text-2xl">🗂️</span>
          <span className="bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
            Files by Root Folders
          </span>
        </div>
      </div>
      
      {/* Only start rendering from root level (parentPath === null) */}
      {renderTree(null)}

      {/* Updated selected files panel */}
      {selectedFiles.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <h3 className="font-medium">Selected Files ({selectedFiles.size})</h3>
              </div>
              
              {/* Processing options */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleProcessSelected('extract_content')}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <span>📄</span> Extract Content
                </button>
                <button
                  onClick={() => handleProcessSelected('expert_info')}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <span>👤</span> Extract Expert Info
                </button>
                <button
                  onClick={() => handleProcessSelected('transcribe')}
                  className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <span>🎙️</span> Transcribe Audio/Video
                </button>
                <button
                  onClick={() => handleProcessSelected('summarize')}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <span>📝</span> Summarize Content
                </button>
              </div>

              {/* Selected files list */}
              <div className="max-h-32 overflow-y-auto">
                {Array.from(selectedFiles).map(fileId => {
                  const file = files.find(f => f.id === fileId);
                  if (!file) return null;
                  const fileType = getFileType(file.mime_type || '');
                  const colors = FILE_TYPE_COLORS[fileType] || FILE_TYPE_COLORS.other;
                  return (
                    <div key={file.id} 
                      className={`flex items-center gap-2 py-1 ${colors.pill} rounded px-2 mb-1`}
                    >
                      <span className={`${colors.icon.bg} ${colors.icon.text} p-1 rounded`}>
                        {getIcon(file)}
                      </span>
                      <span className="flex-1">{file.name}</span>
                      <button
                        onClick={() => toggleFile(file.id)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 