import React, { useState, useEffect } from 'react';

export function AudioServerDebug() {
  const [serverHealth, setServerHealth] = useState<any>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkServerConnectivity = async () => {
    setChecking(true);
    setError(null);
    
    try {
      // Test server connectivity by making a direct request to enhanced server
      // This bypasses Vite proxy dependency issues
      const testId = 'connectivity-test';
      const response = await fetch(`http://localhost:3006/api/audio/${testId}`, {
        method: 'HEAD'
      });
      
      // Any response (even 404/500) indicates server is reachable
      const isServerReachable = response.status !== 0;
      
      if (isServerReachable) {
        setServerHealth({
          status: 'reachable',
          port: 3006,
          timestamp: new Date().toISOString(),
          note: `Enhanced audio server responded with status ${response.status}. Server is running and accessible directly on port 3006.`,
          responseStatus: response.status
        });
      } else {
        throw new Error('Server not reachable');
      }
    } catch (error: any) {
      if (error.message.includes('fetch') || error.name === 'TypeError') {
        setError('Enhanced audio server not running - start it with: pnpm servers');
      } else {
        setError(error.message || 'Unable to connect to audio server');
      }
      console.error('Server connectivity check failed:', error);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkServerConnectivity();
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
          onClick={checkServerConnectivity}
          disabled={checking}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {checking ? 'Checking...' : 'Test Connection'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-3">
          <p className="text-red-700 font-semibold">Connection Error:</p>
          <p className="text-red-600 text-sm">{error}</p>
          <p className="text-red-600 text-xs mt-2">
            Start all servers: <code className="bg-red-100 px-1">pnpm servers</code> (from main directory)
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
              <span className="font-medium">Response:</span> {serverHealth.responseStatus}
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