import React, { useState } from 'react';
import { processDocumentWithAI } from '../utils/ai-processing';
import { toast } from 'react-hot-toast';

interface ExtractButtonProps {
  documentId: string;
  onSuccess?: (profile: ExpertProfile) => void;
  onError?: (error: Error) => void;
}

function ExtractButton({ documentId, onSuccess, onError }: ExtractButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleExtract = async () => {
    setIsProcessing(true);
    
    try {
      // Show processing toast
      const toastId = toast.loading('Processing document...');
      
      const profile = await processDocumentWithAI(documentId);
      
      // Update toast on success
      toast.success('Expert profile extracted successfully', { id: toastId });
      onSuccess?.(profile);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error occurred');
      
      // Show error toast
      toast.error(error.message);
      onError?.(error);
      
      // Log error for debugging
      console.error('Extraction error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <button 
      onClick={handleExtract}
      disabled={isProcessing}
      className="bg-blue-600 text-white rounded-md px-4 py-2 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      aria-busy={isProcessing}
    >
      {isProcessing ? (
        <>
          <span className="animate-spin mr-2">⟳</span>
          Processing...
        </>
      ) : (
        'Extract with AI'
      )}
    </button>
  );
}

export default ExtractButton; 