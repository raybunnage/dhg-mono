import React, { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RotateCw, Play } from 'lucide-react';
import { DocumentInfo } from '@/services/content-service';
import { contentServiceAdapter } from '@/services/content-service-adapter';
import { documentPipelineAdapter } from '@/services/document-pipeline-adapter';

interface BatchProcessButtonProps {
  limit?: number;
  onComplete?: (results: { processed: number; skipped: number; errors: number }) => void;
}

const BatchProcessButton: React.FC<BatchProcessButtonProps> = ({ 
  limit = 20,
  onComplete
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentDocument, setCurrentDocument] = useState<DocumentInfo | null>(null);

  const handleProcessDocument = async (content: string, info: DocumentInfo) => {
    // Update the UI with current document info
    setCurrentDocument(info);

    // Process the document
    await documentPipelineAdapter.processDocument(info.id);
    
    // Simulated processing delay for UI feedback
    await new Promise(resolve => setTimeout(resolve, 500));
  };

  const startBatchProcessing = async () => {
    setIsProcessing(true);
    const toastId = toast.loading('Starting batch processing...');

    try {
      // Use the adapter instead of direct service
      const results = await contentServiceAdapter.batchProcessDocuments(handleProcessDocument, limit);
      
      toast.success(
        `Batch processing complete: ${results.processed} processed, ${results.skipped} skipped, ${results.errors} errors`, 
        { id: toastId }
      );
      
      if (onComplete) {
        onComplete(results);
      }
    } catch (error) {
      console.error('Batch processing error:', error);
      toast.error('Batch processing failed', { id: toastId });
    } finally {
      setIsProcessing(false);
      setCurrentDocument(null);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={startBatchProcessing}
        disabled={isProcessing}
        className="w-full"
      >
        {isProcessing ? (
          <>
            <RotateCw className="h-4 w-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Play className="h-4 w-4 mr-2" />
            Batch Process Documents
          </>
        )}
      </Button>
      
      {isProcessing && currentDocument && (
        <div className="text-sm text-muted-foreground">
          Processing {currentDocument.index} of {currentDocument.total}: 
          {currentDocument.sourceName || currentDocument.id}
        </div>
      )}
    </div>
  );
};

export default BatchProcessButton;