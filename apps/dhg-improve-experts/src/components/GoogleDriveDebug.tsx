import React, { useState } from 'react';
import { getTableStructure } from '@/services/googleDriveService';
import { supabase } from '@/integrations/supabase/client';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

export const GoogleDriveDebug: React.FC = () => {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  const testTableAccess = async () => {
    setLoading(true);
    try {
      // Test with regular client
      console.log('Testing with regular client...');
      const { data: regularData, error: regularError } = await supabase
        .from('sources_google')
        .select('count(*)')
        .limit(1);
        
      // Test with admin client
      console.log('Testing with admin client...');
      const supabaseAdmin = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
      );
      
      const { data: adminData, error: adminError } = await supabaseAdmin
        .from('sources_google')
        .select('count(*)')
        .limit(1);
      
      setResult({
        regularClient: {
          success: !regularError,
          data: regularData,
          error: regularError
        },
        adminClient: {
          success: !adminError,
          data: adminData,
          error: adminError
        }
      });
    } catch (err) {
      console.error('Error in testTableAccess:', err);
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };
  
  const testMinimalInsert = async () => {
    setLoading(true);
    try {
      // Create admin client
      const supabaseAdmin = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
      );
      
      // Test with minimal record
      const testRecord = {
        drive_id: 'test-' + Date.now(),
        name: 'Test File',
        mime_type: 'application/octet-stream',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      console.log('Inserting minimal record:', testRecord);
      
      const { data, error } = await supabaseAdmin
        .from('sources_google')
        .insert(testRecord)
        .select();
      
      setResult({
        success: !error,
        data,
        error
      });
    } catch (err) {
      console.error('Error in testMinimalInsert:', err);
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };
  
  const getStructure = async () => {
    setLoading(true);
    try {
      const data = await getTableStructure('sources_google');
      setResult(data);
    } catch (err) {
      console.error('Error getting table structure:', err);
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="mt-6 p-4 bg-gray-100 rounded border">
      <h3 className="text-lg font-semibold mb-4">Google Drive Debug</h3>
      
      <div className="flex space-x-2 mb-4">
        <button
          onClick={testTableAccess}
          disabled={loading}
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          Test Table Access
        </button>
        
        <button
          onClick={testMinimalInsert}
          disabled={loading}
          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
        >
          Test Minimal Insert
        </button>
        
        <button
          onClick={getStructure}
          disabled={loading}
          className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400"
        >
          Get Table Structure
        </button>
      </div>
      
      {loading && <div className="text-blue-700">Loading...</div>}
      
      {result && (
        <div className="mt-4">
          <h4 className="font-medium mb-2">Result:</h4>
          <div className="max-h-96 overflow-y-auto bg-white p-2 rounded text-xs">
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleDriveDebug; 