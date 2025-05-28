import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '../../../../../supabase/types';

type SourcesGoogle = Database['public']['Tables']['google_sources']['Row'];
type Presentation = Database['public']['Tables']['presentations']['Row'];

interface FileTreeItemProps {
  file: SourcesGoogle;
  level?: number;
  showOnlyDocs?: boolean;
}

// Add this helper function at the top of the component
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

export const FileTreeItem = ({ file, level = 0, showOnlyDocs = false }: FileTreeItemProps) => {
  const [isProcessed, setIsProcessed] = useState(false);
  const [presentationInfo, setPresentationInfo] = useState<Presentation | null>(null);

  // Helper function to determine if file is a document
  const isDocument = (file: { mime_type: string; name: string }) => {
    return (
      file.mime_type === 'application/vnd.google-apps.document' ||
      file.mime_type === 'application/msword' ||
      file.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.name.endsWith('.doc') ||
      file.name.endsWith('.docx') ||
      file.name.endsWith('.txt')
    ) && !file.name.endsWith('.pdf'); // Explicitly exclude PDFs
  };

  // Helper function to determine if item should be shown
  const shouldShow = () => {
    if (!showOnlyDocs) return true;
    if (file.mime_type === 'application/vnd.google-apps.folder') return true;
    return isDocument(file);
  };

  useEffect(() => {
    const checkProcessingStatus = async () => {
      const { data } = await supabase
        .from('expert_documents')
        .select('processed_content')
        .eq('source_id', file.id)
        .single();
      
      setIsProcessed(!!data?.processed_content);
    };

    if (file.mime_type !== 'application/vnd.google-apps.folder') {
      checkProcessingStatus();
    }
  }, [file.id, file.mime_type]);

  useEffect(() => {
    // If file has a presentation_id, fetch the presentation info
    if (file.presentation_id) {
      const fetchPresentation = async () => {
        const { data: presentation } = await supabase
          .from('presentations')
          .select('*')
          .eq('id', file.presentation_id)
          .single();
        
        if (presentation) {
          setPresentationInfo(presentation);
        }
      };
      
      fetchPresentation();
    }
  }, [file.presentation_id]);

  if (!shouldShow()) return null;

  const paddingLeft = `${(level * 20) + 20}px`;

  // Add isFolder constant
  const isFolder = file.mime_type === 'application/vnd.google-apps.folder';

  return (
    <div className="file-tree-item">
      <div 
        className="flex items-center gap-2 py-1 hover:bg-gray-50 rounded cursor-pointer" 
        style={{ paddingLeft }}
      >
        {/* Checkbox showing processing status */}
        {!isFolder && (  // Use isFolder here
          <input 
            type="checkbox"
            checked={isProcessed}
            readOnly
            className="form-checkbox h-4 w-4 text-blue-600"
          />
        )}
        
        {/* File/Folder Icon */}
        <span className="mr-1">
          {isFolder ? '📁' :  // And here
           isDocument(file) ? '📝' : '📄'}
        </span>
        
        {/* File Name */}
        <span className={`flex-1 ${isProcessed ? 'text-gray-500' : 'text-gray-900'}`}>
          {file.name}
          {!isFolder && (file.metadata?.file_size || file.metadata?.size) && (  // Check for file_size or fallback to size
            <span className="text-gray-500 text-sm ml-2">
              {formatFileSize(file.metadata.file_size || file.metadata.size)}
            </span>
          )}
          {presentationInfo && (
            <span className="text-blue-500 text-sm ml-2">
              → Presentation: {presentationInfo.filename}
            </span>
          )}
        </span>
        
        {/* Processing Status Indicator */}
        {isProcessed && (
          <span className="text-green-600 text-sm mr-2">✓</span>
        )}
      </div>
    </div>
  );
}; 