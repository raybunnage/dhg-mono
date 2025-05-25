import React, { useState } from 'react';
import { Play, Square, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';

interface ServerStatus {
  name: string;
  description: string;
  path: string;
  command: string;
  port: number;
  isRunning: boolean;
  url: string;
}

export const ServerManagement: React.FC = () => {
  const [servers, setServers] = useState<ServerStatus[]>([
    {
      name: 'DHG Audio Proxy Server',
      description: 'CORS proxy server for Google Drive audio files in dhg-audio app',
      path: '/Users/raybunnage/Documents/github/dhg-mono/apps/dhg-audio',
      command: 'pnpm server',
      port: 3001,
      isRunning: false,
      url: 'http://localhost:3001'
    }
  ]);

  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const startServer = async (serverName: string) => {
    setLoading(prev => ({ ...prev, [serverName]: true }));
    
    try {
      // In a real implementation, this would make an API call to start the server
      // For now, we'll simulate the action
      
      // Find the server
      const server = servers.find(s => s.name === serverName);
      if (!server) return;

      // Show instructions to user since we can't actually start processes from browser
      const message = `To start the ${serverName}:
      
1. Open a new terminal
2. Navigate to: ${server.path}
3. Run: ${server.command}
4. Server will be available at: ${server.url}

The server should start on port ${server.port}.`;

      alert(message);

      // For demo purposes, mark as "running" after showing instructions
      setTimeout(() => {
        setServers(prev => prev.map(s => 
          s.name === serverName 
            ? { ...s, isRunning: true }
            : s
        ));
        setLoading(prev => ({ ...prev, [serverName]: false }));
      }, 1000);
    } catch (error) {
      console.error('Error starting server:', error);
      setLoading(prev => ({ ...prev, [serverName]: false }));
    }
  };

  const stopServer = (serverName: string) => {
    setServers(prev => prev.map(s => 
      s.name === serverName 
        ? { ...s, isRunning: false }
        : s
    ));
  };

  const openServerUrl = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Server Management</h2>
        <p className="text-sm text-gray-600">
          Manage development servers for DHG applications
        </p>
      </div>

      <div className="grid gap-4">
        {servers.map((server) => (
          <div
            key={server.name}
            className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-medium text-gray-900">{server.name}</h3>
                  <div className="flex items-center gap-1">
                    {server.isRunning ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-600 font-medium">Running</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-500 font-medium">Stopped</span>
                      </>
                    )}
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 mb-3">{server.description}</p>
                
                <div className="space-y-1 text-xs text-gray-500">
                  <div><strong>Path:</strong> {server.path}</div>
                  <div><strong>Command:</strong> {server.command}</div>
                  <div><strong>Port:</strong> {server.port}</div>
                  <div><strong>URL:</strong> {server.url}</div>
                </div>
              </div>
              
              <div className="flex flex-col gap-2 ml-4">
                {server.isRunning ? (
                  <>
                    <button
                      onClick={() => openServerUrl(server.url)}
                      className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open
                    </button>
                    <button
                      onClick={() => stopServer(server.name)}
                      className="flex items-center gap-2 px-3 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                    >
                      <Square className="w-4 h-4" />
                      Stop
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => startServer(server.name)}
                    disabled={loading[server.name]}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    {loading[server.name] ? 'Starting...' : 'Start'}
                  </button>
                )}
              </div>
            </div>
            
            {server.isRunning && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-800">
                  <strong>Server is running!</strong> The audio proxy is now available for the dhg-audio app.
                  Audio files from Google Drive will be proxied through this server to avoid CORS issues.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-medium text-blue-800 mb-1">Important Notes</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• The audio proxy server is required for the dhg-audio app to play Google Drive audio files</li>
              <li>• Without this server, audio playback will fail due to CORS restrictions</li>
              <li>• The server needs to be manually started in a terminal as shown in the instructions</li>
              <li>• Make sure you have the required Google service account credentials configured</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};