import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FileListItemProps {
  file: {
    id: string;
    name: string;
    mime_type: string;
    drive_id: string;
  };
  isProcessed: boolean;
}

interface ProcessingStatus {
  [key: string]: boolean;  // Map of source_id to processing status
}

export const FileList = () => {
  const [processedStatus, setProcessedStatus] = useState<ProcessingStatus>({});

  useEffect(() => {
    const fetchProcessingStatus = async () => {
      // Get all processed documents
      const { data: expertDocs } = await supabase
        .from('google_expert_documents')
        .select('source_id, processed_content')
        .not('processed_content', 'is', null);

      if (expertDocs) {
        const statusMap = expertDocs.reduce((acc, doc) => ({
          ...acc,
          [doc.source_id]: true
        }), {});
        setProcessedStatus(statusMap);
      }
    };

    fetchProcessingStatus();
  }, []);

  const FileListItem = ({ file }: FileListItemProps) => {
    const isProcessed = processedStatus[file.id] || false;

    return (
      <div className="flex items-center gap-2">
        <input 
          type="checkbox"
          checked={isProcessed}
          readOnly
          className="form-checkbox h-4 w-4 text-blue-600"
        />
        <span className={`${isProcessed ? 'text-gray-500' : 'text-gray-900'}`}>
          {file.name}
        </span>
        {isProcessed && (
          <span className="text-green-600 text-sm">(processed)</span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {/* Your existing file list rendering logic here */}
      {files.map(file => (
        <FileListItem 
          key={file.id} 
          file={file} 
          isProcessed={processedStatus[file.id] || false}
        />
      ))}
    </div>
  );
}; 