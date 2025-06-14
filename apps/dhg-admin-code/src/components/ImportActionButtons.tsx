import React from 'react';
import { Play, Pause, RotateCcw, CheckCircle, XCircle } from 'lucide-react';

interface ImportActionButtonsProps {
  importId: number;
  currentStatus: string | null;
  onStatusChange: (id: number, status: string, notes?: string) => void;
}

export const ImportActionButtons: React.FC<ImportActionButtonsProps> = ({
  importId,
  currentStatus,
  onStatusChange
}) => {
  const handleStatusChange = (newStatus: string) => {
    let notes: string | undefined;
    
    if (newStatus === 'error' || newStatus === 'skipped') {
      notes = prompt(`Reason for ${newStatus}:`) || undefined;
    }
    
    onStatusChange(importId, newStatus, notes);
  };

  return (
    <div className="flex space-x-1">
      {(currentStatus === 'pending' || currentStatus === 'error') && (
        <button
          onClick={() => handleStatusChange('in_progress')}
          className="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded"
          title="Start import"
        >
          <Play className="w-4 h-4" />
        </button>
      )}
      
      {currentStatus === 'in_progress' && (
        <button
          onClick={() => handleStatusChange('pending')}
          className="p-1 text-yellow-600 hover:text-yellow-900 hover:bg-yellow-50 rounded"
          title="Pause import"
        >
          <Pause className="w-4 h-4" />
        </button>
      )}
      
      {currentStatus === 'in_progress' && (
        <button
          onClick={() => handleStatusChange('completed')}
          className="p-1 text-green-600 hover:text-green-900 hover:bg-green-50 rounded"
          title="Mark as completed"
        >
          <CheckCircle className="w-4 h-4" />
        </button>
      )}
      
      {(currentStatus !== 'completed' && currentStatus !== 'skipped') && (
        <button
          onClick={() => handleStatusChange('skipped')}
          className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded"
          title="Skip this table"
        >
          <XCircle className="w-4 h-4" />
        </button>
      )}
      
      {currentStatus === 'completed' && (
        <button
          onClick={() => handleStatusChange('pending')}
          className="p-1 text-purple-600 hover:text-purple-900 hover:bg-purple-50 rounded"
          title="Re-import"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      )}
      
      {currentStatus === 'error' && (
        <button
          onClick={() => handleStatusChange('pending')}
          className="p-1 text-red-600 hover:text-red-900 hover:bg-red-50 rounded"
          title="Retry"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};