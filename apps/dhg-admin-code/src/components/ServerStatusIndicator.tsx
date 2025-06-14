import React from 'react';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useServerConnection } from '../hooks/useServerConnection';

interface ServerStatusIndicatorProps {
  serviceName: string;
  className?: string;
  showLabel?: boolean;
}

export const ServerStatusIndicator: React.FC<ServerStatusIndicatorProps> = ({
  serviceName,
  className = '',
  showLabel = true
}) => {
  const { isConnected, loading } = useServerConnection(serviceName);

  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-gray-500 ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin" />
        {showLabel && <span className="text-sm">Checking server...</span>}
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className={`flex items-center gap-2 text-green-600 ${className}`}>
        <CheckCircle className="w-4 h-4" />
        {showLabel && <span className="text-sm">Server connected</span>}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 text-red-500 ${className}`}>
      <AlertCircle className="w-4 h-4" />
      {showLabel && <span className="text-sm">Server offline</span>}
    </div>
  );
};