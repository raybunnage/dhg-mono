import React, { useState, useEffect } from 'react';
import { FileNode } from '../../services/google-drive-explorer';

interface FileViewerProps {
  file: FileNode | null;
}

export const FileViewer: React.FC<FileViewerProps> = ({ file }) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setContent('');
      return;
    }

    setLoading(true);
    setError(null);

    // For now, just show file info and extracted content if available
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
  }, [file]);

  if (!file) {
    return (
      <div className="w-1/2 p-4 border-l">
        <div className="text-gray-500 text-center">
          Select a file to view its contents
        </div>
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

  return (
    <div className="w-1/2 p-4 border-l">
      <div className="mb-4 pb-4 border-b">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <span>{getFileIcon(file.mime_type)}</span>
          <span>{file.name}</span>
        </h2>
      </div>

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
    </div>
  );
};