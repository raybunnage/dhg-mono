import React, { useState, useEffect } from 'react';
import { serverRegistry } from '@shared/services/server-registry-service';
import { CheckCircle, AlertCircle, Loader2, Server } from 'lucide-react';

interface ServerStatus {
  serviceName: string;
  displayName: string;
  isConnected: boolean;
  port: number;
}

export const ServerHealthMonitor: React.FC = () => {
  const [servers, setServers] = useState<ServerStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkServers = async () => {
      try {
        const allServers = await serverRegistry.getAllServers();
        const statuses = await serverRegistry.getAllConnectionStatuses();
        
        const serverStatuses: ServerStatus[] = allServers.map(server => ({
          serviceName: server.service_name,
          displayName: server.display_name,
          port: server.port,
          isConnected: statuses.get(server.service_name) || false
        }));
        
        setServers(serverStatuses);
      } catch (error) {
        console.error('Failed to fetch server statuses:', error);
      } finally {
        setLoading(false);
      }
    };

    checkServers();
    
    // Refresh every 30 seconds
    const interval = setInterval(checkServers, 30000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Checking server health...</span>
        </div>
      </div>
    );
  }

  const connectedCount = servers.filter(s => s.isConnected).length;
  const allConnected = connectedCount === servers.length;

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Server className="w-5 h-5" />
          Server Health Monitor
        </h3>
        <div className={`flex items-center gap-2 text-sm ${allConnected ? 'text-green-600' : 'text-yellow-600'}`}>
          {allConnected ? (
            <>
              <CheckCircle className="w-4 h-4" />
              All servers healthy
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4" />
              {connectedCount}/{servers.length} servers connected
            </>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        {servers.map(server => (
          <div
            key={server.serviceName}
            className={`flex items-center justify-between p-2 rounded ${
              server.isConnected ? 'bg-green-50' : 'bg-red-50'
            }`}
          >
            <div className="flex items-center gap-2">
              {server.isConnected ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-500" />
              )}
              <span className="text-sm font-medium">{server.displayName}</span>
            </div>
            <span className="text-xs text-gray-500">:{server.port}</span>
          </div>
        ))}
      </div>
    </div>
  );
};