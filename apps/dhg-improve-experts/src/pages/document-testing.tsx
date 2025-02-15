import React from 'react';
import GetContentButton from '../components/GetContentButton';
import ExtractContentButton from '../components/ExtractContentButton';
import ExtractedContentViewer from '../components/ExtractedContentViewer';

export default function DocumentTestingPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl mb-4">Document Content Testing</h1>
      
      <div className="flex flex-col gap-6">
        {/* Step 1: Extract Content from Google Drive */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Step 1: Extract Content</h2>
          <p className="text-sm text-gray-600 mb-4">
            First, extract content from Google Drive documents into the database.
          </p>
          <ExtractContentButton 
            onSuccess={(docId) => {
              console.log('Successfully extracted content for document:', docId);
            }}
            onError={(error, docId) => {
              console.error('Extraction failed for document:', docId, error);
            }}
          />
        </div>

        {/* Step 2: Verify Extracted Content */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Step 2: Verify Content</h2>
          <p className="text-sm text-gray-600 mb-4">
            Then, verify the extracted content is available in the database.
          </p>
          <GetContentButton 
            onSuccess={(content, docInfo) => {
              console.log('Content verified for document:', docInfo.id);
            }}
            onError={(error, docId) => {
              console.error('Content verification failed:', docId, error);
            }}
          />
        </div>

        {/* Step 3: View Extracted Content */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <ExtractedContentViewer />
        </div>
      </div>
    </div>
  );
} 