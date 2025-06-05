import { useState, useEffect, useCallback } from 'react';
import mammoth from 'mammoth';
import type { Database } from '../../../../supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { FileNode, FILE_TYPE_COLORS, getFileType } from '@/components/FileTree';
import { formatFileSize } from '@/utils/format';
import { getDocxContent } from '@/utils/google-drive';
import { proxyGoogleDrive } from '@/api/proxy';
import docx4js from 'docx4js';
import { ChatContent } from '@/components/ChatContent';
import '@/styles/globals.css';  // Make sure this is imported

type Json = Database['public']['Tables']['google_sources']['Row']['metadata'];

type ExpertDocument = Database['public']['Tables']['google_expert_documents']['Row'] & {
  id: string;
  processed_content?: string | Record<string, any>;
  batchStatus?: {
    computed_status: string | null;
    error_rate_percentage: number | null;
    processing_hours: number | null;
    top_error_types: Json | null;
  };
};

interface FileMetadata {
  file_size?: string | number;
  size?: string | number; // Keep for backwards compatibility
  quotaBytesUsed?: string | number;
  fileSize?: string | number;
  [key: string]: any;
}

interface FileViewerProps {
  file: FileNode | null;
}

// Helper function to format JSON content
const formatJsonContent = (content: any): string => {
  try {
    const jsonObj = typeof content === 'string' ? JSON.parse(content) : content;
    
    return Object.entries(jsonObj)
      .map(([key, value]) => {
        if (typeof value !== 'object' || value === null) {
          return `**${key}**: ${JSON.stringify(value)}`;  // Bold the key
        }
        const valueStr = JSON.stringify(value, null, 1)
          .replace(/\n/g, ' ')
          .replace(/\s+/g, ' ');
        return `**${key}**: ${valueStr}`;  // Bold the key
      })
      .join('\n');
  } catch (e) {
    return typeof content === 'string' ? content : JSON.stringify(content, null, 1);
  }
};

// Add this helper function at the top with other helpers
const getNetworkStateMessage = (state: number) => {
  switch (state) {
    case 0: return 'NETWORK_EMPTY - No data has been loaded';
    case 1: return 'NETWORK_IDLE - Network is idle';
    case 2: return 'NETWORK_LOADING - Network is loading';
    case 3: return 'NETWORK_NO_SOURCE - No source has been found';
    default: return `Unknown network state: ${state}`;
  }
};

// Add debug helper
const debugVideoFile = (file: FileNode | null, stage: string) => {
  if (!file) return;
  
  // Extract drive ID from web_view_link if not directly available
  const extractDriveId = (url: string | null) => {
    if (!url) return null;
    const match = url.match(/\/d\/([^/]+)/);
    return match ? match[1] : null;
  };

  const extractedDriveId = extractDriveId(file.web_view_link);
  
  console.group(`🎥 Video Debug [${stage}]`);
  console.log('Basic Info:', {
    name: file.name,
    mime_type: file.mime_type,
    size: (file.metadata as FileMetadata)?.file_size || (file.metadata as FileMetadata)?.size || 'unknown'
  });
  
  console.log('IDs:', {
    supabase_id: file.id,
    drive_id: file.drive_id || 'MISSING',
    extracted_drive_id: extractedDriveId,
    parent_id: file.parent_path
  });
  
  console.log('URLs:', {
    web_view_link: file.web_view_link,
    constructed_preview: extractedDriveId ? 
      `https://drive.google.com/file/d/${extractedDriveId}/preview` : 
      'Cannot construct - No drive_id',
    alternate_preview: file.id ? 
      `https://drive.google.com/file/d/${file.id}/preview` : 
      'Cannot construct - No id'
  });

  console.log('Full File Object:', file);
  console.groupEnd();

  return extractedDriveId; // Return the extracted ID for use
};

// Add helper to extract Drive ID from URL
const extractDriveId = (url: string | null): string | null => {
  if (!url) return null;
  const match = url.match(/\/d\/([^/]+)/);
  return match ? match[1] : null;
};

// Update the debug helper to be more verbose
const debugDocumentDisplay = (file: FileNode | null) => {
  if (!file) return;
  
  console.group('📄 Document Display Debug');
  console.log('Basic Info:', {
    name: file.name,
    mime_type: file.mime_type,
    has_expert_document: !!file.expertDocument,
    has_processed_content: !!file.expertDocument?.processed_content,
    raw_processed_content: file.expertDocument?.processed_content // Log the raw content
  });

  if (file.expertDocument) {
    console.log('Expert Document:', {
      id: file.expertDocument.id,
      processing_status: file.expertDocument.processing_status,
      processed_content_type: typeof file.expertDocument.processed_content,
      content_preview: file.expertDocument.processed_content ? 
        JSON.stringify(file.expertDocument.processed_content).slice(0, 100) + '...' 
        : 'No content'
    });
  }

  // Add content parsing debug
  try {
    if (file.expertDocument?.processed_content) {
      const content = file.expertDocument.processed_content;
      console.log('Content Parsing:', {
        isString: typeof content === 'string',
        isObject: typeof content === 'object',
        parsedOK: typeof content === 'string' ? 
          JSON.parse(content) : 'Already an object',
        contentKeys: typeof content === 'object' ? 
          Object.keys(content) : 'Not an object'
      });
    }
  } catch (e) {
    console.log('Content Parsing Error:', e);
  }

  console.groupEnd();
};

// Add this near the top with other helper functions
const formatJSON = (content: any): string => {
  try {
    console.log('Formatting JSON, received content:', content);
    const obj = typeof content === 'string' ? JSON.parse(content) : content;
    console.log('Parsed object:', obj);
    
    const formatValue = (value: any, key: string, level: number): string => {
      const indent = '  '.repeat(level);
      console.log('Formatting value:', { key, value, level });
      
      // Special handling for research_summary
      if (key === 'research_summary') {
        console.log('Formatting research summary');
        const formattedSummary = `${indent}"<span class="json-key">${key}</span>": <div class="research-summary">${value.replace(/\n/g, '<br/>')}</div>`;
        console.log('Formatted summary:', formattedSummary);
        return formattedSummary;
      }
      
      if (Array.isArray(value)) {
        if (value.length === 0) return `${indent}[]`;
        const items = value.map(item => {
          if (typeof item === 'object' && item !== null) {
            return formatValue(item, '', level + 1);
          }
          return `${indent}  "${item}"`;
        }).join(',\n');
        return `[\n${items}\n${indent}]`;
      }
      
      if (typeof value === 'object' && value !== null) {
        if (Object.keys(value).length === 0) return `${indent}{}`;
        const entries = Object.entries(value).map(([k, v]) => {
          return `${indent}  "<span class="json-key">${k}</span>": ${formatValue(v, k, level + 1)}`;
        }).join(',\n');
        return `{\n${entries}\n${indent}}`;
      }
      
      if (typeof value === 'string') {
        return `"<span class="json-string">${value}</span>"`;
      }
      
      if (typeof value === 'number') {
        return `<span class="json-number">${value}</span>`;
      }
      
      return JSON.stringify(value);
    };

    const result = formatValue(obj, '', 0);
    console.log('Final formatted result:', result);
    return result;
  } catch (e) {
    console.error('Error formatting JSON:', e);
    return 'Error formatting JSON content';
  }
};

// Add getIcon function to FileViewer
const getIcon = (file: FileNode) => {
  if (file.mime_type === 'application/vnd.google-apps.folder') return '📁';
  
  // Check if file has processed content
  const hasProcessedContent = file.expertDocument?.processed_content || file.content_extracted;
  
  const fileType = getFileType(file.mime_type);
  const colors = FILE_TYPE_COLORS[fileType] || FILE_TYPE_COLORS.other;
  
  // Return special "processed" icon if content has been processed
  if (hasProcessedContent) {
    switch (fileType) {
      case 'pdf': return '🔍';
      case 'document': return '📊';
      case 'presentation': return '🎯';
      case 'audio': return '📝';
      case 'video': return '📝';
      case 'text': return '📈';
      default: return '✨';
    }
  }
  
  return colors.emoji;
};

export function FileViewer({ file }: FileViewerProps) {
  const [docContent, setDocContent] = useState<string>('');
  const [numPages, setNumPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pdfLoadingPage, setPdfLoadingPage] = useState(false);
  const [contentSource, setContentSource] = useState<'expert_doc' | 'google_sources' | 'drive' | null>(null);
  const [extractedContent, setExtractedContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Add helper to check if file is video
  const isVideo = file?.mime_type?.includes('video/');

  // First, update the isAudio check to specifically handle m4a
  const isAudio = file?.mime_type?.includes('audio');
  const isM4A = file?.mime_type?.includes('x-m4a') || file?.mime_type?.includes('mp4a');

  // Update other file type checks with optional chaining
  const isPdf = file?.mime_type?.includes('pdf');
  const isDoc = file?.mime_type?.includes('wordprocessingml.document') || 
                file?.mime_type?.includes('msword');
  const isText = file?.mime_type?.includes('text/plain') || 
                file?.mime_type?.includes('text/csv') ||
                file?.mime_type?.includes('text/tab-separated-values');
  
  // Move isSpreadsheet check inside component
  const isSpreadsheet = file?.mime_type?.includes('spreadsheet') || 
                       file?.mime_type?.includes('excel') ||
                       file?.mime_type?.includes('xlsx') ||
                       file?.mime_type?.includes('sheet') ||
                       file?.mime_type === 'application/vnd.google-apps.spreadsheet' ||
                       file?.mime_type === 'application/vnd.ms-excel' ||
                       file?.mime_type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  // Move the isPowerPoint check inside the component
  const isPresentation = file?.mime_type?.includes('presentation') || 
                        file?.mime_type?.includes('powerpoint') ||
                        file?.mime_type?.includes('vnd.openxmlformats-officedocument.presentationml.presentation') || 
                        file?.mime_type?.includes('vnd.ms-powerpoint');

  // Handle fullscreen
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
    if (!file) return;
    setError(null);
    setIsLoading(true);
    setDocContent('');
    
    const loadContent = async () => {
      try {
        console.log('Loading content for file:', {
          id: file.id,
          name: file.name,
          mime_type: file.mime_type,
          has_expert_doc: !!file.expertDocument,
          expert_doc_status: file.expertDocument?.processing_status
        });

        // If we have an expert document with completed status, fetch its content
        if (file.expertDocument?.processing_status === 'completed') {
          console.log('Fetching processed content for completed document...');
          const { data: expertDoc, error: expertError } = await supabase
            .from('google_expert_documents')
            .select('processed_content')
            .eq('source_id', file.id)  // Use source_id instead of id
            .single();

          if (expertError) {
            console.error('Error fetching expert document:', expertError);
            throw expertError;
          }

          if (expertDoc?.processed_content) {
            console.log('Found processed content:', expertDoc.processed_content);
            setDocContent(expertDoc.processed_content);
            setContentSource('expert_doc');
            setIsLoading(false);
            return;
          }
        }

        // Fall back to Drive preview
        if (file.web_view_link) {
          console.log('Using Drive preview');
          setContentSource('drive');
          setIsLoading(false);
          return;
        }

        setError('No content source available');
      } catch (e) {
        console.error('Error loading content:', e);
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadContent();
  }, [file]);

  const handleExtractContent = async () => {
    if (!file?.drive_id) return;
    
    setLoading(true);
    try {
      const accessToken = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN;
      const url = `https://www.googleapis.com/drive/v3/files/${file.drive_id}?alt=media`;

      const downloadResponse = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      });

      if (!downloadResponse.ok) {
        throw new Error(`Could not download document: ${downloadResponse.status}`);
      }

      const buffer = await downloadResponse.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer: buffer });

      if (result.value) {
        setExtractedContent(result.value);
      }
    } catch (error) {
      console.error('Content extraction failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Add debug effect
  useEffect(() => {
    if (isVideo && file) {
      debugVideoFile(file, 'Initial Mount');
    }
  }, [file, isVideo]);

  if (!file) {
    return (
      <div className="w-1/2 fixed top-0 right-0 h-screen bg-white border-l p-4 flex items-center justify-center text-gray-500">
        Select a file to view
      </div>
    );
  }

  return (
    <div className={`${isFullscreen ? 'w-full' : 'w-1/2'} fixed top-0 right-0 h-screen bg-white border-l flex flex-col`}>
      {/* Header with controls and filename */}
      <div className="sticky top-0 bg-white border-b p-4 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">
                Currently Viewing
              </div>
              <h1 className="text-2xl font-semibold flex items-center gap-3">
                <span className={`${FILE_TYPE_COLORS[getFileType(file.mime_type)].icon.bg} 
                  ${FILE_TYPE_COLORS[getFileType(file.mime_type)].icon.text} p-1.5 rounded`}
                >
                  {getIcon(file)}
                </span>
                <span className="truncate">{file.name}</span>
                {contentSource && (
                  <span className="text-sm px-2 py-1 rounded bg-gray-100 font-normal">
                    {contentSource === 'expert_doc' ? 'Processed' : 
                     contentSource === 'google_sources' ? 'Extracted' : 
                     'Live'}
                  </span>
                )}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={toggleFullscreen}
                className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200"
                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              >
                {isFullscreen ? "↙" : "↗"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className={`flex-1 overflow-auto p-4 ${isFullscreen ? 'bg-gray-100' : ''}`}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-blue-500 animate-pulse">Loading document...</div>
          </div>
        ) : (
          <>
            {isVideo && file.web_view_link && (
              <div className="flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-4xl aspect-video">
                  <iframe
                    src={`https://drive.google.com/file/d/${extractDriveId(file.web_view_link)}/preview`}
                    className="w-full h-full rounded-lg shadow-lg"
                    allow="autoplay"
                  />
                </div>
              </div>
            )}
            {isPdf && file.web_view_link && (
              <div className={`${isFullscreen ? 'flex items-center justify-center h-full' : 'w-full'}`}>
                <iframe
                  src={`https://drive.google.com/file/d/${extractDriveId(file.web_view_link)}/preview`}
                  className="w-full h-[calc(100vh-9.5rem)] rounded-lg shadow-lg"
                  title="PDF Preview"
                  onLoad={() => console.log('📄 PDF iframe loaded with ID:', extractDriveId(file.web_view_link))}
                />
              </div>
            )}
            {(isDoc || isText) && (
              <div className={`${isFullscreen ? 'flex items-center justify-center h-full' : 'w-full'}`}>
                {contentSource === 'expert_doc' && docContent ? (
                  <div className="w-full h-[calc(100vh-8.5rem)] bg-white p-4 rounded-lg shadow-lg overflow-y-auto">
                    <pre 
                      className="json-viewer"
                      dangerouslySetInnerHTML={{ 
                        __html: formatJSON(docContent)
                      }} 
                    />
                  </div>
                ) : (
                  <iframe
                    src={`https://drive.google.com/file/d/${extractDriveId(file.web_view_link)}/preview`}
                    className="w-full h-[calc(100vh-8.5rem)] rounded-lg shadow-lg"
                    title="Document Preview"
                    onLoad={() => debugDocumentDisplay(file)}
                  />
                )}
              </div>
            )}
            {isAudio && file.web_view_link && (
              <div className="flex flex-col items-center justify-center p-4 gap-4">
                <div className="w-full max-w-2xl bg-gray-50 p-4 rounded-lg shadow">
                  <div className="mb-4">
                    <h3 className="text-lg font-medium">{file.name}</h3>
                    <p className="text-sm text-gray-500">
                      Size: {formatFileSize((file.metadata as FileMetadata)?.file_size || (file.metadata as FileMetadata)?.size || 0)}
                    </p>
                  </div>
                  
                  <div>
                    <iframe
                      src={`https://drive.google.com/file/d/${extractDriveId(file.web_view_link)}/preview`}
                      className="w-full h-20"
                      allow="autoplay"
                      onLoad={() => console.log('🎵 Iframe loaded')}
                    />
                  </div>

                  <div className="text-center mt-2">
                    <a 
                      href={file.web_view_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600"
                    >
                      Open in Google Drive ↗
                    </a>
                  </div>
                </div>

                {file.expertDocument?.processed_content && (
                  <div className="w-full max-w-2xl mt-4">
                    <h4 className="text-lg font-medium mb-2">Transcript</h4>
                    <div className="bg-white p-4 rounded-lg shadow max-h-[50vh] overflow-y-auto">
                      <pre className="whitespace-pre-wrap">
                        {typeof file.expertDocument.processed_content === 'string' 
                          ? file.expertDocument.processed_content
                          : JSON.stringify(file.expertDocument.processed_content, null, 2)
                        }
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
            {isPresentation && file.web_view_link && (
              <div className={`${isFullscreen ? 'flex items-center justify-center h-full' : 'w-full'}`}>
                {/* Debug info */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="p-2 bg-black/50 text-white text-xs space-y-1">
                    <div className="font-bold text-yellow-400">Presentation Debug Info:</div>
                    <div>Extracted ID: {extractDriveId(file.web_view_link)}</div>
                    <div>Original URL: {file.web_view_link}</div>
                    <div>MIME: {file.mime_type}</div>
                  </div>
                )}
                <iframe
                  src={`https://drive.google.com/file/d/${extractDriveId(file.web_view_link)}/preview`}
                  className="w-full h-[calc(100vh-8rem)] rounded-lg shadow-lg"
                  title="Presentation Preview"
                  onLoad={() => console.log('🎯 Presentation iframe loaded with ID:', extractDriveId(file.web_view_link))}
                />
              </div>
            )}
            {isSpreadsheet && file.web_view_link && (
              <div className={`${isFullscreen ? 'flex items-center justify-center h-full' : 'w-full'}`}>
                <iframe
                  src={`https://drive.google.com/file/d/${extractDriveId(file.web_view_link)}/preview`}
                  className="w-full h-[calc(100vh-9.5rem)] rounded-lg shadow-lg"
                  title="Spreadsheet Preview"
                  onLoad={() => console.log('📊 Spreadsheet iframe loaded with ID:', extractDriveId(file.web_view_link))}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Add debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-0 right-0 p-2 bg-black/50 text-white text-xs">
          <div>Content Source: {contentSource}</div>
          <div>Content Length: {docContent.length}</div>
          <div>MIME Type: {file.mime_type}</div>
        </div>
      )}
    </div>
  );
} 