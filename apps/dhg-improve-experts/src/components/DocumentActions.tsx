import React, { useState } from 'react';
import { ExtractContentButton } from './ExtractContentButton';
import { GetContentButton } from './GetContentButton';
import ExtractButton from './ExtractButton';

export default function DocumentActions() {
  const [extractedDocs, setExtractedDocs] = useState<string[]>([]);

  return (
    <div className="flex flex-col gap-4">
      <div className="p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-medium mb-4">1. Extract Content from Documents</h3>
        <ExtractContentButton 
          onSuccess={(docId) => setExtractedDocs(prev => [...prev, docId])}
        />
      </div>

      <div className="p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-medium mb-4">2. Verify Extracted Content</h3>
        <GetContentButton />
      </div>

      <div className="p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-medium mb-4">3. Process with AI</h3>
        <ExtractButton />
      </div>
    </div>
  );
} 