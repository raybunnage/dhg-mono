import { useState, useEffect } from 'react';
import { FileTree, FileNode } from '@/components/FileTree';
import { supabase } from '@/integrations/supabase/client';
import { SourceButtons } from "@/components/SourceButtons";
import { FileViewer } from '@/components/FileViewer';
import { useNavigate } from 'react-router-dom';
import type { Database } from '../../../../file_types/supabase/types';
import { toast } from 'react-hot-toast';

type SourcesGoogleRow = Database['public']['Tables']['google_sources']['Row'];
type ExpertDocument = Database['public']['Tables']['google_expert_documents']['Row'];
type BatchProcessingStatus = Database['public']['Views']['batch_processing_status']['Row'];

interface FileMetadata {
  size?: string | number;
  quotaBytesUsed?: string | number;
  fileSize?: string | number;
  [key: string]: any; // Allow other properties since it's Json type
}

export default function ExpertProfiles() {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadFiles() {
      try {
        const { data, error } = await supabase
          .from('google_sources')
          .select(`
            *,
            expert_documents (
              processing_status,
              batch_id,
              error_message,
              queued_at,
              processing_started_at,
              processing_completed_at,
              processing_error,
              retry_count,
              batch_processing_status (
                computed_status,
                error_rate_percentage,
                processing_hours,
                top_error_types
              )
            )
          `)
          .eq('deleted', false)
          .order('name');

        if (error) {
          console.error('Error loading files:', error);
          toast.error('Failed to load files');
          return;
        }

        // Log the response to help debug
        console.log('Files loaded:', {
          count: data?.length,
          sample: data?.[0],
          error
        });

        const mapToFileNode = (sourceData: SourcesGoogleRow & { 
          expert_documents: (ExpertDocument & {
            batch_processing_status: BatchProcessingStatus
          })[] 
        }): FileNode => ({
          id: sourceData.id,
          name: sourceData.name,
          mime_type: sourceData.mime_type,
          path: sourceData.path,
          parent_path: sourceData.parent_path,
          content_extracted: sourceData.content_extracted,
          web_view_link: sourceData.web_view_link,
          metadata: sourceData.metadata as FileMetadata,
          expertDocument: sourceData.expert_documents?.[0] ? {
            ...sourceData.expert_documents[0],
            batchStatus: sourceData.expert_documents[0].batch_processing_status
          } : undefined
        });

        setFiles((data || []).map(mapToFileNode));
        setLoading(false);
      } catch (error) {
        console.error('Failed to load files:', error);
        toast.error('Failed to load files');
        setLoading(false);
      }
    }

    loadFiles();
  }, []);

  const handleSelectionChange = (selectedIds: string[]) => {
    // Handle selection change if needed
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex">
        <div className="w-1/2">
          <FileTree 
            files={files} 
            onSelectionChange={handleSelectionChange}
            onFileClick={(file) => setSelectedFile(file)}
          />
        </div>
        <FileViewer file={selectedFile} />
      </div>
    </div>
  );
} 