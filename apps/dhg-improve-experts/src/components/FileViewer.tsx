import { useState, useEffect, useCallback } from 'react';
import mammoth from 'mammoth';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import type { Database } from '@/../../supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { FileNode } from '@/components/FileTree';
import { formatFileSize } from '@/utils/format';
import { getDocxContent } from '@/utils/google-drive';
import { proxyGoogleDrive } from '@/api/proxy';

// Set up PDF.js worker
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
}

type Json = Database['public']['Tables']['sources_google']['Row']['metadata'];

type ExpertDocument = Database['public']['Tables']['expert_documents']['Row'] & {
  processed_content?: string | Record<string, any>;
  batchStatus?: {
    computed_status: string | null;
    error_rate_percentage: number | null;
    processing_hours: number | null;
    top_error_types: Json | null;
  };
};

interface FileMetadata {
  size?: string | number;
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

export function FileViewer({ file }: FileViewerProps) {
  const [docContent, setDocContent] = useState<string>('');
  const [numPages, setNumPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pdfLoadingPage, setPdfLoadingPage] = useState(false);
  const [contentSource, setContentSource] = useState<'expert_doc' | 'sources_google' | 'drive' | null>(null);
  const [extractedContent, setExtractedContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
          web_view_link: file.web_view_link,
          content_extracted: file.content_extracted,
          expertDocument: file.expertDocument,
          metadata: file.metadata
        });

        // For PDFs, we'll use the web_view_link directly with PDF.js
        if (file.mime_type.includes('pdf')) {
          if (!file.web_view_link) {
            setError('No PDF link available');
            return;
          }
          console.log('Setting up PDF viewer for:', file.web_view_link);
          setContentSource('drive');
          setIsLoading(false);
          return;
        }

        // For audio files, we don't need to load content, just show the player
        if (file.mime_type.includes('audio/')) {
          setContentSource('drive');
          setIsLoading(false);
          return;
        }

        // 1. First try to get processed content from expert_documents if completed
        if (file.expertDocument?.processing_status === 'completed') {
          console.log('Checking expert_documents for completed processing...');
          const { data: expertDoc, error: expertError } = await supabase
            .from('expert_documents')
            .select('processed_content')
            .eq('source_id', file.id)
            .single();
          
          console.log('Expert doc result:', expertDoc);
          
          if (expertDoc?.processed_content) {
            console.log('Found processed content in expert_documents');
            const content = formatJsonContent(expertDoc.processed_content);
            setDocContent(content);
            setContentSource('expert_doc');
            setIsLoading(false);
            return;
          }
        }

        // 2. Then try sources_google extracted_content
        if (file.content_extracted) {
          console.log('Checking sources_google...');
          const { data: sourceDoc, error: sourceError } = await supabase
            .from('sources_google')
            .select('extracted_content')
            .eq('id', file.id)
            .single();
          
          if (sourceDoc?.extracted_content) {
            const content = typeof sourceDoc.extracted_content === 'string'
              ? sourceDoc.extracted_content
              : JSON.stringify(sourceDoc.extracted_content, null, 2);
            setDocContent(content);
            setContentSource('sources_google');
            setIsLoading(false);
            return;
          }
        }

        // 3. Finally, try to extract from Google Drive link
        if (file.web_view_link) {
          console.log('Attempting to load from Google Drive...');
          setContentSource('drive');
          
          // For Word documents, use the working extraction method
          if (file.mime_type.includes('wordprocessingml.document') || 
              file.mime_type.includes('msword')) {
            try {
              // Get the file from Supabase first
              const { data: doc } = await supabase
                .from('sources_google')
                .select('id, name, drive_id, mime_type')
                .eq('id', file.id)
                .single();

              if (!doc) {
                throw new Error('Document not found');
              }

              const accessToken = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN;
              const url = `https://www.googleapis.com/drive/v3/files/${doc.drive_id}?alt=media`;

              const downloadResponse = await fetch(url, {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                }
              });

              if (!downloadResponse.ok) {
                throw new Error(`Could not download Office document: ${downloadResponse.status}`);
              }

              const buffer = await downloadResponse.arrayBuffer();
              const result = await mammoth.convertToHtml({ arrayBuffer: buffer });

              if (!result.value) {
                throw new Error('No content extracted from document');
              }

              setDocContent(result.value);
              setContentSource('drive');

            } catch (error) {
              console.error('Word document processing error:', error);
              setError(`Error processing Word document: ${error.message}`);
            }
          } else if (file.mime_type.includes('text/plain') || 
                    file.mime_type.includes('text/csv') ||
                    file.mime_type.includes('text/tab-separated-values')) {
            const response = await fetch(file.web_view_link);
            const text = await response.text();
            console.log('Text content:', text.substring(0, 100) + '...');
            setDocContent(`<pre class="whitespace-pre-wrap">${text}</pre>`);
          }
        }
      } catch (error) {
        console.error('Content loading error:', error);
        setError('Error loading document');
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

  if (!file) {
    return (
      <div className="w-1/2 fixed top-0 right-0 h-screen bg-white border-l p-4 flex items-center justify-center text-gray-500">
        Select a file to view
      </div>
    );
  }

  const isPdf = file.mime_type.includes('pdf');
  const isDoc = file.mime_type.includes('wordprocessingml.document') || 
                file.mime_type.includes('msword');
  const isText = file.mime_type.includes('text/plain') || 
                file.mime_type.includes('text/csv') ||
                file.mime_type.includes('text/tab-separated-values');
  const isVideo = file.mime_type.includes('video');
  const isAudio = file.mime_type.includes('audio');
  const isPresentation = file.mime_type.includes('presentation') || 
                        file.mime_type.includes('powerpoint') ||
                        file.mime_type.includes('vnd.openxmlformats-officedocument.presentationml.presentation') || // .pptx
                        file.mime_type.includes('vnd.ms-powerpoint'); // .ppt

  return (
    <div className={`${isFullscreen ? 'w-full' : 'w-1/2'} fixed top-0 right-0 h-screen bg-white border-l flex flex-col`}>
      {/* Header with controls and filename */}
      <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between z-10">
        <div className="font-medium truncate flex items-center gap-2">
          {file.name}
          {contentSource && (
            <span className="text-xs px-2 py-1 rounded bg-gray-100">
              {contentSource === 'expert_doc' ? 'Processed' : 
               contentSource === 'sources_google' ? 'Extracted' : 
               'Live'}
            </span>
          )}
          {error && <span className="text-red-500 text-sm">({error})</span>}
          {isLoading && <span className="text-blue-500 text-sm animate-pulse">Loading...</span>}
        </div>
        <div className="flex items-center gap-4">
          {isPdf && (
            <>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
                  className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
                  title="Zoom Out"
                >
                  -
                </button>
                <span className="text-sm w-16 text-center">{Math.round(scale * 100)}%</span>
                <button 
                  onClick={() => setScale(s => Math.min(2, s + 0.1))}
                  className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
                  title="Zoom In"
                >
                  +
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                >
                  ←
                </button>
                <span className="text-sm w-32 text-center">
                  {pdfLoadingPage ? 
                    <span className="text-blue-500 animate-pulse">Loading...</span> :
                    `Page ${currentPage} of ${numPages}`
                  }
                </span>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                  disabled={currentPage === numPages}
                  className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                >
                  →
                </button>
              </div>
            </>
          )}
          <button
            onClick={toggleFullscreen}
            className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? "↙" : "↗"}
          </button>
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
            {isPdf && file.web_view_link && (
              <Document
                file={file.web_view_link}
                onLoadSuccess={({ numPages }) => {
                  console.log('PDF loaded successfully with', numPages, 'pages');
                  setNumPages(numPages);
                  setIsLoading(false);
                }}
                onLoadError={(error) => {
                  console.error('Error loading PDF:', error);
                  setError('Error loading PDF');
                  setIsLoading(false);
                }}
                loading={
                  <div className="flex items-center justify-center h-full">
                    <div className="text-blue-500 animate-pulse">Loading PDF...</div>
                  </div>
                }
                className="flex justify-center"
              >
                <Page 
                  pageNumber={currentPage} 
                  scale={scale}
                  className="shadow-lg bg-white"
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  loading={
                    <div className="w-full h-[800px] bg-gray-50 animate-pulse flex items-center justify-center">
                      Loading page {currentPage}...
                    </div>
                  }
                  onRenderSuccess={() => setPdfLoadingPage(false)}
                  onRenderError={() => setPdfLoadingPage(false)}
                />
              </Document>
            )}
            {(isDoc || isText) && (
              <div 
                className={`prose max-w-none font-mono ${isFullscreen ? 'bg-white p-8 rounded-lg shadow-lg mx-auto max-w-4xl' : ''}`}
                style={{ whiteSpace: 'pre-wrap', fontSize: '0.9em' }}
                dangerouslySetInnerHTML={{ 
                  __html: docContent.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                }}
              />
            )}
            {isVideo && (
              <div className={`${isFullscreen ? 'flex items-center justify-center h-full' : 'w-full'}`}>
                {isLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <div className="animate-pulse text-blue-500">Loading video...</div>
                  </div>
                ) : (
                  <>
                    <video 
                      controls 
                      className={`w-full ${isFullscreen ? 'max-h-[90vh]' : 'max-h-[70vh]'} rounded-lg shadow-lg`}
                      src={`${file.web_view_link}&download=true`}
                      onLoadStart={(e) => {
                        const videoElement = e.currentTarget;
                        console.log('Video load starting:', {
                          src: videoElement.src,
                          readyState: videoElement.readyState,
                          networkState: videoElement.networkState,
                          networkStateMessage: getNetworkStateMessage(videoElement.networkState),
                          error: videoElement.error
                        });
                        setIsLoading(true);
                      }}
                      onError={(e) => {
                        const videoElement = e.currentTarget;
                        console.error('Video loading error:', {
                          error: videoElement.error?.message,
                          code: videoElement.error?.code,
                          networkState: videoElement.networkState,
                          readyState: videoElement.readyState,
                          src: videoElement.src
                        });
                        if (!videoElement.src.includes('&download=true')) {
                          console.log('Trying alternative video URL format...');
                          videoElement.src = `${file.web_view_link}&download=true`;
                        } else {
                          setError(`Failed to load video: ${videoElement.error?.message || 'Unknown error'}`);
                          setIsLoading(false);
                        }
                      }}
                      playsInline
                    >
                      Your browser does not support the video tag.
                    </video>
                    <div className="mt-2 text-sm text-gray-500 flex flex-col">
                      <span>File: {file.name}</span>
                      <span>Type: {file.mime_type}</span>
                      <span>Size: {formatFileSize((file.metadata as FileMetadata)?.size || 0)}</span>
                    </div>
                  </>
                )}
                {error && (
                  <div className="mt-4 text-red-500 text-center">
                    {error}
                  </div>
                )}
              </div>
            )}
            {isAudio && (
              <div className="flex flex-col items-center justify-center p-4 gap-4">
                <div className="w-full max-w-2xl bg-gray-50 p-4 rounded-lg shadow">
                  <div className="mb-4">
                    <h3 className="text-lg font-medium">{file.name}</h3>
                    <p className="text-sm text-gray-500">
                      Size: {formatFileSize((file.metadata as FileMetadata)?.size || 0)}
                    </p>
                  </div>
                  <audio 
                    controls 
                    className="w-full"
                    src={file.web_view_link}
                    onLoadStart={() => setIsLoading(true)}
                    onLoadedData={() => setIsLoading(false)}
                    controlsList="nodownload"
                  >
                    Your browser does not support the audio element.
                  </audio>
                </div>
                {file.expertDocument?.processed_content && (
                  <div className="w-full max-w-2xl mt-4">
                    <h4 className="text-lg font-medium mb-2">Transcript</h4>
                    <div className="bg-white p-4 rounded-lg shadow">
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
            {isPresentation && (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <span className="text-4xl mb-4">🎯</span>
                <p className="text-gray-600">
                  {file.mime_type.includes('vnd.openxmlformats-officedocument.presentationml.presentation') ? 
                    'PowerPoint (.pptx)' : 
                    file.mime_type.includes('vnd.ms-powerpoint') ? 
                    'PowerPoint (.ppt)' : 
                    'Google Slides'} presentation
                  {file.web_view_link && (
                    <a 
                      href={file.web_view_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600 block mt-2"
                    >
                      Open in Google Drive ↗
                    </a>
                  )}
                </p>
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