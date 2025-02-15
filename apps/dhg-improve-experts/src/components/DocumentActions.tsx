import React, { useState } from 'react';
import GetContentButton from './GetContentButton';
import ExtractButton from './ExtractButton';

interface DocumentActionsProps {
  documentId?: string; // Made optional since we're processing all docs
}

function DocumentActions({ documentId }: DocumentActionsProps) {
  const [processedDocs, setProcessedDocs] = useState<string[]>([]);

  const handleContentRetrieved = (content: string, docInfo: DocInfo) => {
    const preview = content.slice(0, 100).replace(/\n/g, ' ');
    console.log(`Document ${docInfo.index}/${docInfo.total}:`, {
      id: docInfo.id,
      length: content.length,
      preview: preview + '...',
      source: docInfo.sourceName,
      mimeType: docInfo.mimeType
    });

    setProcessedDocs(prev => [...prev, docInfo.id]);
  };

  const handleError = (error: Error, docId?: string) => {
    console.error('Operation failed:', {
      documentId: docId,
      error: error.message,
      stack: error.stack
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <GetContentButton 
          onSuccess={handleContentRetrieved}
          onError={handleError}
        />
        {documentId && (
          <ExtractButton 
            documentId={documentId}
            onError={handleError}
          />
        )}
      </div>
      {processedDocs.length > 0 && (
        <div className="text-sm text-gray-600">
          Processed {processedDocs.length} documents
        </div>
      )}
    </div>
  );
}

export default DocumentActions; 