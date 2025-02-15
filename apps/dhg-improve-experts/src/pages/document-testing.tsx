import React from 'react';
import { ExtractContentButton } from '@/components/ExtractContentButton';
import { GetContentButton } from '@/components/GetContentButton';
import { ExtractedContentViewer } from '@/components/ExtractedContentViewer';

export default function DocumentTestingPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl mb-4">Document Content Testing</h1>
      
      <div className="flex flex-col gap-6">
        {/* Step 1: Extract Content */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <h2 className="text-lg mb-2">Step 1: Extract Content</h2>
          <p className="text-sm text-gray-600 mb-4">
            First, extract content from Google Drive documents into the database.
          </p>
          <ExtractContentButton />
        </div>

        {/* Step 2: View Extracted Content */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <h2 className="text-lg mb-2">Step 2: View Extracted Content</h2>
          <p className="text-sm text-gray-600 mb-4">
            View and verify the extracted content.
          </p>
          <ExtractedContentViewer />
        </div>
      </div>
    </div>
  );
} 