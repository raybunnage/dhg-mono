import React, { useState } from 'react';
import { toast } from 'sonner';
import { DocumentInfo } from '@/services/content-service';
import { contentServiceAdapter } from '@/services/content-service-adapter';
import { documentPipelineAdapter } from '@/services/document-pipeline-adapter';
import { Button } from '@/components/ui/button';
import { ChevronRight, RotateCw } from 'lucide-react';

interface GetContentButtonProps {
  onSuccess?: (content: string, docInfo: DocumentInfo) => void;
  onError?: (error: Error, docId?: string) => void;
  processAfterRetrieve?: boolean;
}

const GetContentButton: React.FC<GetContentButtonProps> = ({ 
  onSuccess, 
  onError,
  processAfterRetrieve = false 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [documents, setDocuments] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Initialize document list
  const initializeDocuments = async () => {
    setIsLoading(true);
    const toastId = toast.loading('Getting document list...');

    try {
      const docIds = await contentServiceAdapter.getDocumentIds();
      
      if (docIds.length === 0) {
        throw new Error('No documents found');
      }

      console.log(`Found ${docIds.length} documents to process`);
      setDocuments(docIds);
      setCurrentIndex(0);
      setInitialized(true);
      toast.success(`Ready to process ${docIds.length} documents`, { id: toastId });

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
    const docId = documents[currentIndex];
    const toastId = toast.loading(`Processing document ${currentIndex + 1} of ${documents.length}`);

    try {
      const result = await contentServiceAdapter.getDocumentContent(docId);
      
      // Update the document info with index and total
      result.documentInfo.index = currentIndex + 1;
      result.documentInfo.total = documents.length;
      
      // If the document needs extraction, skip it
      if (result.needsExtraction) {
        toast.warning(`Document ${result.documentInfo.sourceName || docId} needs content extraction first`, { id: toastId });
        
        // Skip to next document
        if (currentIndex < documents.length - 1) {
          setCurrentIndex(prev => prev + 1);
        }
        return;
      }
      
      // If there's an error or no content, skip to next document
      if (result.error || !result.content) {
        toast.error(`Document ${docId} has no usable content: ${result.error || 'Unknown reason'}`, { id: toastId });
        
        // Continue to next document automatically
        if (currentIndex < documents.length - 1) {
          setCurrentIndex(prev => prev + 1);
        }
        return;
      }
      
      // Log success
      console.log('Retrieved document:', {
        id: result.documentInfo.id,
        contentLength: result.content.length,
        sourceName: result.documentInfo.sourceName,
        mimeType: result.documentInfo.mimeType,
        progress: `${currentIndex + 1}/${documents.length}`,
        preview: result.content.slice(0, 200).replace(/\n/g, ' ') + '...'
      });

      // Optional document processing after retrieval
      if (processAfterRetrieve) {
        toast.loading(`Processing content for document ${docId}...`, { id: toastId });
        const success = await documentPipelineAdapter.processDocument(docId);
        
        if (success) {
          toast.success(`Document processed successfully via pipeline`, { id: toastId });
        } else {
          toast.error(`Document pipeline processing failed`, { id: toastId });
        }
      } else {
        toast.success('Document content retrieved successfully', { id: toastId });
      }

      onSuccess?.(result.content, result.documentInfo);

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
      <Button 
        onClick={handleClick}
        disabled={isLoading}
        variant="default"
      >
        {isLoading ? (
          <>
            <RotateCw className="h-4 w-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : !initialized ? (
          'Start Processing'
        ) : (
          'Process Current'
        )}
      </Button>

      {initialized && currentIndex < documents.length - 1 && (
        <Button
          onClick={handleNext}
          disabled={isLoading}
          variant="outline"
        >
          <ChevronRight className="h-4 w-4 mr-1" />
          Next Document
        </Button>
      )}

      {initialized && (
        <span className="text-sm text-muted-foreground">
          Document {currentIndex + 1} of {documents.length}
        </span>
      )}
    </div>
  );
};

export default GetContentButton;