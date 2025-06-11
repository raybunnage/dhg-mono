import { useState, useEffect } from 'react';
import { serverRegistry } from '@shared/services/server-registry-service';

interface ServerConnectionStatus {
  isConnected: boolean;
  url: string;
  loading: boolean;
}

export function useServerConnection(serviceName: string): ServerConnectionStatus {
  const [isConnected, setIsConnected] = useState(false);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setupConnection = async () => {
      try {
        // Get the server URL
        const serverUrl = await serverRegistry.getServerUrl(serviceName);
        setUrl(serverUrl);

        // Check initial connection status
        const connected = await serverRegistry.isServerConnected(serviceName);
        setIsConnected(connected);

        // Subscribe to connection changes
        unsubscribe = serverRegistry.onConnectionChange(serviceName, (status: boolean) => {
          setIsConnected(status);
        });
      } catch (error) {
        console.error(`Failed to setup server connection for ${serviceName}:`, error);
      } finally {
        setLoading(false);
      }
    };

    setupConnection();

    // Cleanup
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [serviceName]);

  return { isConnected, url, loading };
}