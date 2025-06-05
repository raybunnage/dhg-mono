import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { deleteSyncHistoryRecord } from '@/services/syncHistoryService';
import { Button } from './ui/button';

export const DebugSyncHistory: React.FC = () => {
  const [syncHistory, setSyncHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  const fetchData = async () => {
    try {
      console.log('DebugSyncHistory: Fetching data...');
      // Get sync history
      const { data: historyData, error: historyError } = await supabase
        .from('google_sync_history')
        .select('*')
        .order('timestamp', { ascending: false });
        
      if (historyError) throw historyError;
      
      console.log('DebugSyncHistory: Data received, records:', historyData?.length || 0);
      setSyncHistory(historyData || []);
    } catch (err) {
      console.error('Error fetching debug data:', err);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    console.log('DebugSyncHistory: Component mounted');
    fetchData();
    
    // Return cleanup function
    return () => {
      console.log('DebugSyncHistory: Component unmounted');
    };
  }, []);
  
  const handleDelete = async (id: string) => {
    try {
      console.log('DebugSyncHistory: Deleting record', id);
      setDeleting(id);
      const result = await deleteSyncHistoryRecord(id);
      if (result.success) {
        console.log('DebugSyncHistory: Successfully deleted record', id);
        // Refresh the data after successful deletion
        await fetchData();
      } else {
        console.error('Failed to delete sync history record:', result.error);
      }
    } catch (err) {
      console.error('Error deleting sync history record:', err);
    } finally {
      setDeleting(null);
    }
  };
  
  if (loading) return <div>Loading debug data...</div>;
  
  console.log('DebugSyncHistory: Rendering with', syncHistory.length, 'records');
  
  return (
    <div className="mt-8 p-4 bg-gray-100 rounded border">
      <h3 className="text-lg font-semibold mb-2">Debug Sync Data</h3>
      
      <div className="mb-4">
        <h4 className="font-medium">Sync History Table: {syncHistory.length} records</h4>
        {syncHistory.length === 0 ? (
          <div className="text-red-600">No records found in google_sync_history table!</div>
        ) : (
          <div className="max-h-60 overflow-y-auto bg-white p-2 rounded text-xs">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">ID</th>
                  <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Timestamp</th>
                  <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Folder Name</th>
                  <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Files</th>
                  <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Status</th>
                  <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {syncHistory.map((record) => (
                  <tr key={record.id}>
                    <td className="px-2 py-1 whitespace-nowrap text-xs text-gray-500">{record.id.substring(0, 8)}...</td>
                    <td className="px-2 py-1 whitespace-nowrap text-xs text-gray-500">{new Date(record.timestamp).toLocaleString()}</td>
                    <td className="px-2 py-1 whitespace-nowrap text-xs font-medium text-gray-900">{record.folder_name || 'Unknown'}</td>
                    <td className="px-2 py-1 whitespace-nowrap text-xs text-gray-500">{record.files_processed || 0}</td>
                    <td className="px-2 py-1 whitespace-nowrap text-xs text-gray-500">{record.status}</td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        className="text-xs py-0 px-2 h-6"
                        onClick={() => handleDelete(record.id)}
                        disabled={deleting === record.id}
                      >
                        {deleting === record.id ? 'Deleting...' : 'Delete'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-gray-500">Show Raw Data</summary>
              <pre className="mt-2">{JSON.stringify(syncHistory, null, 2)}</pre>
            </details>
          </div>
        )}
      </div>
      
      <div className="mt-4">
        <h4 className="font-medium">LocalStorage:</h4>
        <div className="max-h-40 overflow-y-auto bg-white p-2 rounded text-xs">
          <pre>{JSON.stringify({ latest_sync_result: JSON.parse(localStorage.getItem('latest_sync_result') || 'null') }, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
};

export default DebugSyncHistory; 