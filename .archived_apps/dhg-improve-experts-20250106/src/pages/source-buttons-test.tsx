import React from 'react';
import { SourceButtons } from '@/components/SourceButtons';
import { ExtractContentButton } from '@/components/ExtractContentButton';
import DocumentActions from '@/components/DocumentActions';

export default function SourceButtonsTestPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-8">Source Buttons Test Page</h1>
      
      <div className="space-y-8">
        {/* Original Source Buttons */}
        <section className="p-6 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Source Buttons</h2>
          <SourceButtons />
        </section>

        {/* Extract Content Button */}
        <section className="p-6 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Extract Content</h2>
          <ExtractContentButton />
        </section>

        {/* Document Actions */}
        <section className="p-6 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Document Actions</h2>
          <DocumentActions />
        </section>
      </div>
    </div>
  );
} 