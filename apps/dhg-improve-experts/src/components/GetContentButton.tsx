import React, { useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import type { Database } from '../types/supabase';
import { toast } from 'react-hot-toast';

interface GetContentButtonProps {
  onSuccess?: (content: string, docInfo: DocInfo) => void;
  onError?: (error: Error, docId?: string) => void;
}

interface DocInfo {
  id: string;
  sourceName?: string;
  mimeType?: string;
  index: number;
  total: number;
}

type ExpertDocument = Database['public']['Tables']['expert_documents']['Row'];

function GetContentButton({ onSuccess, onError }: GetContentButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [documents, setDocuments] = useState<{ id: string }[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Initialize document list
  const initializeDocuments = async () => {
    setIsLoading(true);
    const toastId = toast.loading('Getting document list...');

    try {
      const { data: docs, error: listError } = await supabase
        .from('expert_documents')
        .select('id')
        .order('id');

      if (listError) {
        throw new Error(`Failed to fetch document list: ${listError.message}`);
      }

      if (!docs || docs.length === 0) {
        throw new Error('No documents found');
      }

      console.log(`Found ${docs.length} documents to process`);
      setDocuments(docs);
      setCurrentIndex(0);
      setInitialized(true);
      toast.success(`Ready to process ${docs.length} documents`, { id: toastId });

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error occurred');
      console.error('Initialization error:', error);
      toast.error(error.message, { id: toastId });
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Process current document
  const processCurrentDocument = async () => {
    if (currentIndex < 0 || currentIndex >= documents.length) return;

    setIsLoading(true);
    const docId = documents[currentIndex].id;
    const toastId = toast.loading(`Processing document ${currentIndex + 1} of ${documents.length}`);

    try {
      // First get the document and its source with detailed logging
      const { data: doc, error } = await supabase
        .from('expert_documents')
        .select(`
          id,
          raw_content,
          content_type,
          processing_status,
          source_id,
          error_message,
          processing_error,
          source:sources_google!expert_documents_source_id_fkey (
            id,
            name,
            mime_type,
            drive_id,
            content_extracted,
            extraction_error,
            extracted_content,
            metadata
          )
        `)
        .eq('id', docId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch document ${docId}: ${error.message}`);
      }

      // Debug log the complete document structure
      console.log('Complete document structure:', JSON.stringify({
        document: {
          id: doc.id,
          allFields: doc,
          source: doc.source
        }
      }, null, 2));

      // Also log the source_id to make sure we're linking to the right source
      console.log('Document source relationship:', {
        documentId: doc.id,
        sourceId: doc.source_id,
        sourceRecord: doc.source ? {
          id: doc.source.id,
          name: doc.source.name,
          hasContent: !!doc.source.extracted_content
        } : 'No source record found'
      });

      // Handle content whether it's an object or string
      let contentToUse = null;
      if (doc?.raw_content) {
        contentToUse = typeof doc.raw_content === 'object' 
          ? JSON.stringify(doc.raw_content)
          : doc.raw_content;
      } else if (doc?.source?.extracted_content) {
        contentToUse = typeof doc.source.extracted_content === 'object'
          ? JSON.stringify(doc.source.extracted_content)
          : doc.source.extracted_content;
      }

      if (!contentToUse && doc?.source?.drive_id && !doc.source.content_extracted) {
        console.log('Document needs content extraction:', {
          name: doc.source.name,
          driveId: doc.source.drive_id,
          mimeType: doc.source.mime_type
        });
        
        toast.info(`Document ${doc.source.name} needs content extraction first`, { id: toastId });
        
        // Skip to next document
        if (currentIndex < documents.length - 1) {
          setCurrentIndex(prev => prev + 1);
        }
        return;
      }

      if (!contentToUse) {
        // More informative warning about missing content
        console.warn(`Document ${docId} has no usable content:`, {
          rawContentType: typeof doc?.raw_content,
          rawContent: doc?.raw_content,
          sourceContentType: typeof doc?.source?.extracted_content,
          sourceContent: doc?.source?.extracted_content,
          status: doc?.processing_status,
          source: {
            id: doc?.source?.id,
            contentExtracted: doc?.source?.content_extracted,
            extractionError: doc?.source?.extraction_error
          },
          contentType: doc?.content_type
        });
        
        toast.error(`Document ${docId} has no usable content. Check console for details.`, { id: toastId });
        
        // Continue to next document automatically
        if (currentIndex < documents.length - 1) {
          setCurrentIndex(prev => prev + 1);
        }
        return;
      }

      // If we got here, we have content to use
      const docInfo: DocInfo = {
        id: doc.id,
        sourceName: doc.source?.name,
        mimeType: doc.source?.mime_type,
        index: currentIndex + 1,
        total: documents.length
      };

      console.log('Retrieved document:', {
        id: doc.id,
        contentLength: contentToUse.length,
        sourceName: doc.source?.name,
        mimeType: doc.source?.mime_type,
        progress: `${currentIndex + 1}/${documents.length}`,
        preview: contentToUse.slice(0, 200).replace(/\n/g, ' ') + '...'
      });

      onSuccess?.(contentToUse, docInfo);
      toast.success('Document processed successfully', { id: toastId });

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error occurred');
      console.error(`Error processing document ${docId}:`, error);
      toast.error(error.message, { id: toastId });
      onError?.(error, docId);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle next document
  const handleNext = () => {
    if (currentIndex < documents.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  // Start or process next
  const handleClick = async () => {
    if (!initialized) {
      await initializeDocuments();
    } else {
      await processCurrentDocument();
    }
  };

  return (
    <div className="flex gap-2 items-center">
      <button 
        onClick={handleClick}
        disabled={isLoading}
        className="bg-green-600 text-white rounded-md px-4 py-2 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        aria-busy={isLoading}
      >
        {isLoading ? (
          <>
            <span className="animate-spin mr-2">⟳</span>
            Processing...
          </>
        ) : !initialized ? (
          'Start Processing'
        ) : (
          'Process Current'
        )}
      </button>

      {initialized && currentIndex < documents.length - 1 && (
        <button
          onClick={handleNext}
          disabled={isLoading}
          className="bg-blue-600 text-white rounded-md px-4 py-2 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Next Document
        </button>
      )}

      {initialized && (
        <span className="text-sm text-gray-600">
          Document {currentIndex + 1} of {documents.length}
        </span>
      )}
    </div>
  );
}

export default GetContentButton; 