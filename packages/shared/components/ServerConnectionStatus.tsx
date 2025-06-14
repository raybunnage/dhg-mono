import React, { useEffect, useState } from 'react';
import { serverRegistry } from '../services/server-registry-service';

interface ServerConnectionStatusProps {
  serviceName: string;
  displayName?: string;
  className?: string;
  showDetails?: boolean;
}

export function ServerConnectionStatus({ 
  serviceName, 
  displayName,
  className = '',
  showDetails = false 
}: ServerConnectionStatusProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [serverUrl, setServerUrl] = useState('');
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  useEffect(() => {
    // Initial check
    checkConnection();
    
    // Subscribe to connection changes
    const unsubscribe = serverRegistry.onConnectionChange(serviceName, (status) => {
      setIsConnected(status);
      setLastCheck(new Date());
    });
    
    // Check connection every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [serviceName]);

  const checkConnection = async () => {
    setIsLoading(true);
    try {
      const [connected, url] = await Promise.all([
        serverRegistry.isServerConnected(serviceName),
        serverRegistry.getServerUrl(serviceName)
      ]);
      
      setIsConnected(connected);
      setServerUrl(url);
      setLastCheck(new Date());
    } catch (error) {
      console.error(`Failed to check ${serviceName} connection:`, error);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const statusColor = isLoading ? 'bg-gray-500' : isConnected ? 'bg-green-500' : 'bg-red-500';
  const statusText = isLoading ? 'Checking...' : isConnected ? 'Connected' : 'Disconnected';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`w-2 h-2 rounded-full ${statusColor} ${isConnected ? 'animate-pulse' : ''}`} />
      <span className="text-sm text-gray-600">
        {displayName || serviceName}: <span className={isConnected ? 'text-green-600' : 'text-red-600'}>{statusText}</span>
      </span>
      
      {showDetails && (
        <div className="text-xs text-gray-500 ml-2">
          {serverUrl && <span className="mr-2">{serverUrl}</span>}
          {lastCheck && <span>Last check: {lastCheck.toLocaleTimeString()}</span>}
        </div>
      )}
    </div>
  );
}

interface MultiServerStatusProps {
  services: Array<{ name: string; displayName?: string }>;
  className?: string;
  title?: string;
}

export function MultiServerStatus({ services, className = '', title = 'Server Status' }: MultiServerStatusProps) {
  const [allStatuses, setAllStatuses] = useState<Map<string, boolean>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAllConnections();
    
    // Check all connections every 30 seconds
    const interval = setInterval(checkAllConnections, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const checkAllConnections = async () => {
    setIsLoading(true);
    try {
      const statuses = await serverRegistry.getAllConnectionStatuses();
      setAllStatuses(statuses);
    } catch (error) {
      console.error('Failed to check server connections:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const connectedCount = Array.from(allStatuses.values()).filter(Boolean).length;
  const totalCount = services.length;
  const allConnected = connectedCount === totalCount;

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700">{title}</h3>
        <div className={`px-2 py-1 rounded text-xs font-medium ${
          allConnected ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
        }`}>
          {connectedCount}/{totalCount} Connected
        </div>
      </div>
      
      <div className="space-y-2">
        {services.map(service => (
          <ServerConnectionStatus
            key={service.name}
            serviceName={service.name}
            displayName={service.displayName}
          />
        ))}
      </div>
      
      {!allConnected && (
        <div className="mt-3 text-xs text-gray-500">
          Run <code className="bg-gray-100 px-1 py-0.5 rounded">pnpm servers</code> to start missing servers
        </div>
      )}
    </div>
  );
}