import React, { useState, useEffect, useCallback } from 'react';
import { FileNode } from '../../services/google-drive-explorer';

interface FileViewerProps {
  file: FileNode | null;
  defaultViewMode?: 'native' | 'processed';
}

interface FileMetadata {
  file_size?: string | number;
  size?: string | number;
  quotaBytesUsed?: string | number;
  fileSize?: string | number;
  [key: string]: any;
}

export const FileViewer: React.FC<FileViewerProps> = ({ file, defaultViewMode = 'native' }) => {
  const [viewMode, setViewMode] = useState<'native' | 'processed'>(defaultViewMode);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Debug log to verify component is loaded
  useEffect(() => {
    console.log('🚀 FileViewer component loaded - Version: ENHANCED_WITH_FULL_HEIGHT');
    if (file) {
      console.log('📄 Current file:', file.name, 'Type:', file.mime_type);
    }
  }, [file]);

  // Helper function to extract Drive ID from web_view_link
  const extractDriveId = (url: string | null): string | null => {
    if (!url) return null;
    const match = url.match(/\/d\/([^/]+)/);
    return match ? match[1] : null;
  };

  // Check if file type is supported by native viewer
  const isNativeViewerSupported = () => {
    if (!file || !file.web_view_link) return false;
    const mimeType = file.mime_type || '';
    
    // All file types are supported by Google Drive viewer except .docx
    // (though .docx might work too, but keeping the original logic)
    return !mimeType.includes('vnd.openxmlformats-officedocument.wordprocessingml.document');
  };

  // Determine if we should show native viewer
  const shouldShowNativeViewer = viewMode === 'native' && isNativeViewerSupported();
  const hasProcessedContent = file?.expertDocument?.processed_content || file?.content_extracted;

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!file) {
      setContent('');
      return;
    }

    // Only load content if we're in processed view mode
    if (viewMode === 'processed') {
      setLoading(true);
      setError(null);

      const displayContent = async () => {
        try {
          let contentToShow = '';
          
          // File info section
          contentToShow += `## File Information\n\n`;
          contentToShow += `**Name:** ${file.name}\n`;
          contentToShow += `**Type:** ${file.mime_type}\n`;
          contentToShow += `**Path:** ${file.path || 'N/A'}\n`;
          
          if (file.drive_id) {
            contentToShow += `**Drive ID:** ${file.drive_id}\n`;
          }
          
          if (file.web_view_link) {
            contentToShow += `**Google Drive Link:** [View in Drive](${file.web_view_link})\n`;
          }

          // Metadata section
          if (file.metadata && Object.keys(file.metadata).length > 0) {
            contentToShow += `\n## Metadata\n\n`;
            contentToShow += '```json\n';
            contentToShow += JSON.stringify(file.metadata, null, 2);
            contentToShow += '\n```\n';
          }

          // Content section
          if (file.content_extracted) {
            contentToShow += `\n## Extracted Content\n\n`;
            contentToShow += file.content_extracted;
          }

          // Expert document info if available
          if (file.expertDocument) {
            contentToShow += `\n## Processing Information\n\n`;
            contentToShow += `**Status:** ${file.expertDocument.processing_status || 'Not processed'}\n`;
            
            if (file.expertDocument.processed_content) {
              contentToShow += `\n### Processed Content\n\n`;
              if (typeof file.expertDocument.processed_content === 'string') {
                contentToShow += file.expertDocument.processed_content;
              } else {
                contentToShow += '```json\n';
                contentToShow += JSON.stringify(file.expertDocument.processed_content, null, 2);
                contentToShow += '\n```\n';
              }
            }
          }

          setContent(contentToShow);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load file content');
        } finally {
          setLoading(false);
        }
      };

      displayContent();
    }
  }, [file, viewMode]);

  // Format file size
  const formatFileSize = (size: string | number | undefined): string => {
    if (!size) return 'Unknown';
    const bytes = typeof size === 'string' ? parseInt(size, 10) : size;
    if (isNaN(bytes)) return 'Unknown';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    let unitIndex = 0;
    let fileSize = bytes;
    
    while (fileSize >= 1024 && unitIndex < units.length - 1) {
      fileSize /= 1024;
      unitIndex++;
    }
    
    return `${fileSize.toFixed(1)} ${units[unitIndex]}`;
  };

  if (!file) {
    return (
      <div className="w-1/2 fixed top-0 right-0 h-screen bg-white border-l p-4 flex items-center justify-center text-gray-500">
        Select a file to view
      </div>
    );
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('folder')) return '📁';
    if (mimeType.includes('pdf')) return '📑';
    if (mimeType.includes('document') || mimeType.includes('text')) return '📄';
    if (mimeType.includes('spreadsheet')) return '📊';
    if (mimeType.includes('presentation')) return '📈';
    if (mimeType.includes('image')) return '🖼️';
    if (mimeType.includes('video')) return '🎥';
    if (mimeType.includes('audio')) return '🎵';
    return '📎';
  };

  // Determine file type for specific handling
  const getFileType = () => {
    const mimeType = file.mime_type || '';
    
    // Video types
    if (mimeType.includes('video')) return 'video';
    
    // Audio types
    if (mimeType.includes('audio')) return 'audio';
    
    // PDF
    if (mimeType.includes('pdf')) return 'pdf';
    
    // Spreadsheets
    if (mimeType.includes('spreadsheet') || 
        mimeType.includes('excel') ||
        mimeType.includes('xlsx') ||
        mimeType === 'application/vnd.google-apps.spreadsheet' ||
        mimeType === 'application/vnd.ms-excel' ||
        mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'spreadsheet';
    
    // Presentations
    if (mimeType.includes('presentation') || 
        mimeType.includes('powerpoint') ||
        mimeType.includes('pptx') ||
        mimeType === 'application/vnd.google-apps.presentation' ||
        mimeType === 'application/vnd.ms-powerpoint' ||
        mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return 'presentation';
    
    // Documents (Word, Google Docs, etc)
    if (mimeType.includes('document') || 
        mimeType.includes('msword') ||
        mimeType.includes('wordprocessingml') ||
        mimeType === 'application/vnd.google-apps.document' ||
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'document';
    
    // Text files
    if (mimeType.includes('text/plain') || 
        mimeType.includes('text/csv') ||
        mimeType.includes('text/tab-separated-values')) return 'document';
    
    // Images
    if (mimeType.includes('image')) return 'image';
    
    return 'other';
  };

  return (
    <div className={`${isFullscreen ? 'w-full' : 'w-1/2'} fixed top-0 right-0 h-screen bg-white border-l flex flex-col`}>
      {/* Header with controls */}
      <div className="sticky top-0 bg-white border-b p-4 z-10">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <span>{getFileIcon(file.mime_type)}</span>
              <span className="truncate">{file.name}</span>
            </h2>
            <div className="text-sm text-gray-600 mt-1">
              <span>Type: {file.mime_type}</span>
              {file.metadata && (
                <span className="ml-4">
                  Size: {formatFileSize(
                    (file.metadata as FileMetadata)?.file_size || 
                    (file.metadata as FileMetadata)?.size
                  )}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            {hasProcessedContent && (
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('native')}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    viewMode === 'native' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                  disabled={!isNativeViewerSupported()}
                  title={!isNativeViewerSupported() ? 'Native viewer not available for this file type' : ''}
                >
                  Native View
                </button>
                <button
                  onClick={() => setViewMode('processed')}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    viewMode === 'processed' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Processed
                </button>
              </div>
            )}
            {/* Fullscreen toggle */}
            <button
              onClick={toggleFullscreen}
              className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-sm"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? "↙" : "↗"}
            </button>
            {/* Open in Drive link */}
            {file.web_view_link && (
              <a
                href={file.web_view_link}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded bg-blue-100 hover:bg-blue-200 text-blue-700 text-sm"
              >
                Open in Drive ↗
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {shouldShowNativeViewer ? (
          // Native Google Drive viewer
          (() => {
            const fileType = getFileType();
            const isDocument = ['pdf', 'presentation', 'document', 'spreadsheet', 'other'].includes(fileType);
            const isVideo = fileType === 'video';
            const isAudio = fileType === 'audio';
            
            console.log('🎯 Rendering file:', file.name, 'FileType:', fileType, 'isDocument:', isDocument);
            
            if (isDocument) {
              // For documents, use full height without padding
              console.log('📋 Rendering as DOCUMENT with full height');
              return (
                <div className="h-full">
                  {file.web_view_link && (
                    <iframe
                      src={`https://drive.google.com/file/d/${extractDriveId(file.web_view_link)}/preview`}
                      className="w-full h-full"
                      allow="autoplay"
                      title={`${file.name} preview`}
                    />
                  )}
                </div>
              );
            } else if (isVideo) {
              // For videos, center with aspect ratio
              return (
                <div className="h-full flex items-center justify-center p-4 bg-gray-100">
                  {file.web_view_link && (
                    <iframe
                      src={`https://drive.google.com/file/d/${extractDriveId(file.web_view_link)}/preview`}
                      className="w-full max-w-5xl aspect-video rounded-lg shadow-lg"
                      allow="autoplay"
                      title={`${file.name} preview`}
                    />
                  )}
                </div>
              );
            } else if (isAudio) {
              // For audio, small player at top
              return (
                <div className="flex items-start justify-center p-4">
                  {file.web_view_link && (
                    <iframe
                      src={`https://drive.google.com/file/d/${extractDriveId(file.web_view_link)}/preview`}
                      className="w-full max-w-2xl h-20 rounded-lg shadow-lg"
                      allow="autoplay"
                      title={`${file.name} preview`}
                    />
                  )}
                </div>
              );
            }
            return null;
          })()
        ) : (
          // Processed content viewer
          <div className="p-4">
            {loading && (
              <div className="text-blue-500 animate-pulse">
                Loading file content...
              </div>
            )}

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                Error: {error}
              </div>
            )}

            {!loading && !error && content && (
              <div className="prose max-w-none">
                <div 
                  className="whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ 
                    __html: content.replace(/\n/g, '<br/>').replace(/##/g, '<h3>').replace(/\*\*/g, '<strong>') 
                  }} 
                />
              </div>
            )}

            {!loading && !error && !content && viewMode === 'processed' && (
              <div className="text-gray-500 text-center mt-8">
                <p>No processed content available for this file.</p>
                {isNativeViewerSupported() && (
                  <button
                    onClick={() => setViewMode('native')}
                    className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Switch to Native View
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-0 right-0 p-2 bg-black/50 text-white text-xs">
          <div>View Mode: {viewMode}</div>
          <div>File Type: {getFileType()}</div>
          <div>MIME Type: {file.mime_type}</div>
          <div>Native Supported: {isNativeViewerSupported() ? 'Yes' : 'No'}</div>
          <div>Has Processed: {hasProcessedContent ? 'Yes' : 'No'}</div>
          <div>Drive ID: {extractDriveId(file.web_view_link) || 'N/A'}</div>
        </div>
      )}
    </div>
  );
};