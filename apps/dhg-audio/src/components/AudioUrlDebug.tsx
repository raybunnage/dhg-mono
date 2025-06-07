import React, { useState } from 'react';
import { AudioFile } from '@/services/audio-adapter';

interface AudioUrlDebugProps {
  audioFile: AudioFile;
}

export function AudioUrlDebug({ audioFile }: AudioUrlDebugProps) {
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  const testProxyUrl = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      console.log('Testing proxy URL:', audioFile.url);
      const response = await fetch(audioFile.url, {
        method: 'HEAD',
        mode: 'cors'
      });
      
      setTestResult({
        success: true,
        status: response.status,
        statusText: response.statusText,
        headers: {
          contentType: response.headers.get('Content-Type'),
          contentLength: response.headers.get('Content-Length'),
          contentDisposition: response.headers.get('Content-Disposition')
        }
      });
    } catch (error: any) {
      setTestResult({
        success: false,
        error: error.message || 'Unknown error',
        type: error.name
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mt-2 p-3 bg-blue-50 rounded text-xs">
      <div className="font-semibold text-blue-700 mb-2">Audio URL Debug:</div>
      
      <div className="space-y-1">
        <div>
          <span className="font-medium">Proxy URL:</span> {audioFile.url}
        </div>
        <div>
          <span className="font-medium">Direct URL:</span> {audioFile.directUrl}
        </div>
        <div>
          <span className="font-medium">Drive ID:</span> {audioFile.driveId}
        </div>
      </div>

      <button
        onClick={testProxyUrl}
        disabled={testing}
        className="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
      >
        {testing ? 'Testing...' : 'Test Proxy Connection'}
      </button>

      {testResult && (
        <div className={`mt-2 p-2 rounded ${testResult.success ? 'bg-green-100' : 'bg-red-100'}`}>
          {testResult.success ? (
            <>
              <div className="font-semibold text-green-700">✓ Proxy test successful!</div>
              <div>Status: {testResult.status} {testResult.statusText}</div>
              <div>Content-Type: {testResult.headers.contentType || 'N/A'}</div>
              <div>Content-Length: {testResult.headers.contentLength || 'N/A'}</div>
            </>
          ) : (
            <>
              <div className="font-semibold text-red-700">✗ Proxy test failed!</div>
              <div>Error: {testResult.error}</div>
              <div>Type: {testResult.type}</div>
            </>
          )}
        </div>
      )}

      <div className="mt-2 text-xs text-gray-600">
        The proxy server should be running on port 3006. Make sure you've run 'pnpm servers'.
      </div>
    </div>
  );
}