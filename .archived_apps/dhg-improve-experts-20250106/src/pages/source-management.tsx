import React, { useState } from 'react';
import { SourceButtons } from '@/components/SourceButtons';

export default function SourceManagementPage() {
  const [status, setStatus] = useState('');

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold mb-8">Source Management</h1>
        
        {/* Original working source buttons */}
        <SourceButtons />

        {/* Status Message */}
        {status && (
          <div className={`p-2 rounded ${
            status.startsWith('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
          }`}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
} 