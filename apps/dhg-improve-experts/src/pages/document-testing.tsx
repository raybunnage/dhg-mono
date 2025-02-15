import React from 'react';
import GetContentButton from '../components/GetContentButton';

export default function DocumentTestingPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl mb-4">Document Content Testing</h1>
      <div className="text-red-500">Test Message - If you see this, the route is working</div>
      
      <div className="mb-8 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-lg mb-4">Test Document Content Retrieval</h2>
        <GetContentButton 
          onSuccess={(content, docInfo) => {
            console.log(`Document ${docInfo.index}/${docInfo.total}:`, {
              id: docInfo.id,
              length: content.length,
              preview: content.slice(0, 200),
              source: docInfo.sourceName
            });
          }}
          onError={(error, docId) => {
            console.error('Document processing error:', { docId, error });
          }}
        />
      </div>
    </div>
  );
} 