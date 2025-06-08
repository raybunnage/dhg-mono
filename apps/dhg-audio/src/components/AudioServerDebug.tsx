import React, { useState, useEffect } from 'react';

export function AudioServerDebug() {
  const [serverHealth, setServerHealth] = useState<any>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkServerHealth = async () => {
    setChecking(true);
    setError(null);
    
    try {
      // Try a simple test to see if the proxy is working
      // by checking if we can reach the audio endpoint structure
      const testId = 'test-connection';
      const response = await fetch(`/api/audio/${testId}`, {
        method: 'HEAD'
      });
      
      // We expect either 400 (bad request) or 500 (server error)
      // Both indicate the server is reachable
      if (response.status === 404) {
        throw new Error('Audio proxy server not accessible - make sure to run pnpm servers from the main dhg-mono directory');
      }
      
      setServerHealth({
        status: 'running',
        port: 3006,
        timestamp: new Date().toISOString(),
        serviceAccount: 'check-individual-files',
        note: 'Server is reachable. Check individual file debug info for details.'
      });
    } catch (error: any) {
      setError(error.message || 'Audio proxy server not reachable');
      console.error('Server health check failed:', error);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkServerHealth();
  }, []);

  const getStatusColor = () => {
    if (error) return 'bg-red-100 border-red-300';
    if (!serverHealth) return 'bg-gray-100 border-gray-300';
    return 'bg-green-100 border-green-300';
  };

  const getStatusIcon = () => {
    if (error) return '❌';
    if (!serverHealth) return '⏳';
    return '✅';
  };

  return (
    <div className={`p-4 rounded-lg border-2 ${getStatusColor()} mb-4`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <span>{getStatusIcon()}</span>
          Audio Server Status
        </h3>
        <button
          onClick={checkServerHealth}
          disabled={checking}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {checking ? 'Checking...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-3">
          <p className="text-red-700 font-semibold">Connection Error:</p>
          <p className="text-red-600 text-sm">{error}</p>
          <p className="text-red-600 text-xs mt-2">
            Make sure the audio server is running: <code className="bg-red-100 px-1">pnpm server</code>
          </p>
        </div>
      )}

      {serverHealth && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <span className="font-medium">Status:</span> {serverHealth.status}
            </div>
            <div>
              <span className="font-medium">Port:</span> {serverHealth.port}
            </div>
            <div>
              <span className="font-medium">Time:</span> {new Date(serverHealth.timestamp).toLocaleTimeString()}
            </div>
          </div>


          {serverHealth.note && (
            <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded">
              <p className="text-blue-700 text-xs">{serverHealth.note}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-gray-300">
        <p className="text-xs text-gray-600">
          The audio server handles Google Drive authentication and streams audio files to bypass browser restrictions.
        </p>
      </div>
    </div>
  );
}