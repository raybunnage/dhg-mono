interface BatchProgressProps {
  batch: {
    id: string;
    total_files: number;
    processed_files: number;
    status: 'queued' | 'processing' | 'completed' | 'error';
    error_message?: string;
  };
}

export function BatchProgress({ batch }: BatchProgressProps) {
  const progress = Math.round((batch.processed_files / batch.total_files) * 100);
  
  return (
    <div className="bg-white p-4 rounded-lg shadow mb-4">
      <div className="flex justify-between items-center mb-2">
        <span className="font-medium">Batch #{batch.id.slice(-4)}</span>
        <span className="text-sm text-gray-500">
          {batch.processed_files} / {batch.total_files} files
        </span>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div 
          className={`h-2.5 rounded-full ${
            batch.status === 'error' ? 'bg-red-500' :
            batch.status === 'completed' ? 'bg-green-500' :
            'bg-blue-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {batch.status === 'error' && (
        <p className="text-sm text-red-500 mt-2">{batch.error_message}</p>
      )}
    </div>
  );
} 