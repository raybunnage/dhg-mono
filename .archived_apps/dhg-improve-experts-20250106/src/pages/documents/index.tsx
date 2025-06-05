import React from 'react';
import GetContentButton from '@/components/GetContentButton';
import DocumentActions from '@/components/DocumentActions';

export default function DocumentsPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Document Processing</h1>
      
      {/* This will show the Get Content and Next buttons */}
      <DocumentActions />
    </div>
  );
} 