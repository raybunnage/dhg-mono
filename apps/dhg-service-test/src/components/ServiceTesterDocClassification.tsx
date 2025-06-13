import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { getDocumentClassificationService } from '@shared/services/document-classification-service';

export function ServiceTesterDocClassification() {
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string>('');

  const testService = async () => {
    setStatus('testing');
    setError('');

    try {
      // Test getting the service instance with supabase client
      console.log('Getting DocumentClassificationService instance...');
      const service = getDocumentClassificationService(supabase);
      
      // Test that we can access service methods
      console.log('Service instance created successfully!');
      console.log('Testing fallback classification method...');
      
      // Test the fallback classification method
      const fallbackResult = service.createFallbackClassification({
        name: 'test-document.docx',
        mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      
      console.log('Fallback classification result:', fallbackResult);
      
      setStatus('success');
    } catch (err) {
      console.error('Error testing DocumentClassificationService:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Document Classification Service Test</h1>
      
      <button
        onClick={testService}
        disabled={status === 'testing'}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
      >
        {status === 'testing' ? 'Testing...' : 'Test Service'}
      </button>
      
      <div className="mt-4">
        {status === 'idle' && (
          <p className="text-gray-600">Click the button to test DocumentClassificationService</p>
        )}
        {status === 'testing' && (
          <p className="text-blue-600">Testing service initialization...</p>
        )}
        {status === 'success' && (
          <p className="text-green-600">✅ DocumentClassificationService is working correctly!</p>
        )}
        {status === 'error' && (
          <div className="text-red-600">
            <p>❌ Error:</p>
            <pre className="mt-2 p-2 bg-red-50 rounded text-sm">{error}</pre>
          </div>
        )}
      </div>
    </div>
  );
}