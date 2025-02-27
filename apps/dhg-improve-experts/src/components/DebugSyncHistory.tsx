import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const DebugSyncHistory: React.FC = () => {
  const [syncHistory, setSyncHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get sync history
        const { data: historyData, error: historyError } = await supabase
          .from('sync_history')
          .select('*')
          .order('timestamp', { ascending: false });
          
        if (historyError) throw historyError;
        
        setSyncHistory(historyData || []);
      } catch (err) {
        console.error('Error fetching debug data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  if (loading) return <div>Loading debug data...</div>;
  
  return (
    <div className="mt-8 p-4 bg-gray-100 rounded border">
      <h3 className="text-lg font-semibold mb-2">Debug Sync Data</h3>
      
      <div className="mb-4">
        <h4 className="font-medium">Sync History Table: {syncHistory.length} records</h4>
        {syncHistory.length === 0 ? (
          <div className="text-red-600">No records found in sync_history table!</div>
        ) : (
          <div className="max-h-60 overflow-y-auto bg-white p-2 rounded text-xs">
            <pre>{JSON.stringify(syncHistory, null, 2)}</pre>
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