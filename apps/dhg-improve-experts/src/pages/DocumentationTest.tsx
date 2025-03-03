import React from 'react';
import DocumentationTableViewer from '@/components/DocumentationTableViewer';

const DocumentationTest: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Documentation System Test</h1>
      <p className="mb-6">
        This page demonstrates the documentation system's functionality. Use the controls below to test syncing files and processing the queue.
      </p>
      
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">How to Test</h2>
        <ol className="list-decimal pl-8 space-y-2">
          <li>Click "Sync Test File" to index the test documentation file</li>
          <li>Verify that the file appears in the "Files" tab</li>
          <li>Check the "Sections" tab to see extracted headings</li>
          <li>Check the "Queue" tab to see the file in the processing queue</li>
          <li>Click "Process Next Queue Item" to process the file</li>
          <li>Check the "Files" tab again to see updated summary and AI-generated tags</li>
          <li>Check the "Relations" tab to see detected relationships between documents</li>
        </ol>
      </div>
      
      <DocumentationTableViewer />
    </div>
  );
};

export default DocumentationTest;