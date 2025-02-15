import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
      const { data: doc, error } = await supabase
        .from('expert_documents')
        .select(`
          id,
          raw_content,
          source:source_id (
            name,
            mime_type
          )
        `)
        .eq('id', docId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch document ${docId}: ${error.message}`);
      }

      if (!doc?.raw_content) {
        console.warn(`Document ${docId} has no content`);
        toast.error(`Document ${docId} has no content`, { id: toastId });
        return;
      }

      const docInfo: DocInfo = {
        id: doc.id,
        sourceName: doc.source?.name,
        mimeType: doc.source?.mime_type,
        index: currentIndex + 1,
        total: documents.length
      };

      console.log('Retrieved document:', {
        id: doc.id,
        contentLength: doc.raw_content.length,
        sourceName: doc.source?.name,
        mimeType: doc.source?.mime_type,
        progress: `${currentIndex + 1}/${documents.length}`,
        preview: doc.raw_content.slice(0, 200).replace(/\n/g, ' ') + '...',
        fullContent: doc.raw_content
      });

      onSuccess?.(doc.raw_content, docInfo);
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