import { useState, useEffect } from 'react';

interface AudioSourceDebugProps {
  url: string;
}

interface ServerInfo {
  source: 'local-google-drive' | 'google-drive-api' | 'unknown';
  responseTime: number;
  contentLength?: string;
  lastChecked: Date;
}

export const AudioSourceDebug = ({ url }: AudioSourceDebugProps) => {
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const checkAudioSource = async () => {
      setIsLoading(true);
      const startTime = Date.now();
      
      try {
        // Make a HEAD request to get headers without downloading the file
        const response = await fetch(url, { 
          method: 'HEAD',
          headers: {
            'Range': 'bytes=0-1' // Minimal range request
          }
        });
        
        const responseTime = Date.now() - startTime;
        const servedFrom = response.headers.get('X-Served-From') || 'unknown';
        const contentLength = response.headers.get('Content-Length');
        
        setServerInfo({
          source: servedFrom as ServerInfo['source'],
          responseTime,
          contentLength: contentLength || undefined,
          lastChecked: new Date()
        });
      } catch (error) {
        console.error('Error checking audio source:', error);
        setServerInfo({
          source: 'unknown',
          responseTime: Date.now() - startTime,
          lastChecked: new Date()
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (url) {
      checkAudioSource();
    }
  }, [url]);

  if (!serverInfo && !isLoading) {
    return null;
  }

  const getSourceDisplay = (source: ServerInfo['source']) => {
    switch (source) {
      case 'local-google-drive':
        return {
          text: 'Local Google Drive',
          color: 'text-green-700 bg-green-50 border-green-200',
          icon: '💾'
        };
      case 'google-drive-api':
        return {
          text: 'Google Drive API',
          color: 'text-blue-700 bg-blue-50 border-blue-200',
          icon: '☁️'
        };
      default:
        return {
          text: 'Unknown Source',
          color: 'text-gray-700 bg-gray-50 border-gray-200',
          icon: '❓'
        };
    }
  };

  const getPerformanceColor = (responseTime: number) => {
    if (responseTime < 50) return 'text-green-600';
    if (responseTime < 200) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="mt-2 p-3 border rounded-lg bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-700">Audio Source Debug</h4>
        <button
          onClick={() => window.location.reload()}
          className="text-xs text-gray-500 hover:text-gray-700 underline"
        >
          Refresh
        </button>
      </div>
      
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
          Checking source...
        </div>
      ) : serverInfo ? (
        <div className="space-y-2">
          {/* Source indicator */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Source:</span>
            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium ${getSourceDisplay(serverInfo.source).color}`}>
              <span>{getSourceDisplay(serverInfo.source).icon}</span>
              {getSourceDisplay(serverInfo.source).text}
            </div>
          </div>
          
          {/* Performance metrics */}
          <div className="flex items-center gap-4 text-xs text-gray-600">
            <span>
              Response time: 
              <span className={`ml-1 font-medium ${getPerformanceColor(serverInfo.responseTime)}`}>
                {serverInfo.responseTime}ms
              </span>
            </span>
            {serverInfo.contentLength && (
              <span>
                Size: {(parseInt(serverInfo.contentLength) / (1024 * 1024)).toFixed(1)}MB
              </span>
            )}
            <span>
              Checked: {serverInfo.lastChecked.toLocaleTimeString()}
            </span>
          </div>
          
          {/* Performance interpretation */}
          <div className="text-xs text-gray-500">
            {serverInfo.source === 'local-google-drive' && (
              <span className="text-green-600">
                ⚡ Local files are typically 10-100x faster than API calls
              </span>
            )}
            {serverInfo.source === 'google-drive-api' && (
              <span className="text-blue-600">
                ☁️ Using Google Drive API - consider local file setup for better performance
              </span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};