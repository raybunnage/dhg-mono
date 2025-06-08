import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { supabaseBrowser } from '../lib/supabase';

export const CompareSupabaseClients: React.FC = () => {
  const [comparison, setComparison] = useState<any>({});

  useEffect(() => {
    const compareClients = async () => {
      console.log('=== Comparing Supabase Clients ===');
      
      const client1 = supabase;
      const client2 = supabaseBrowser.getClient();
      
      console.log('Client 1 (lib/supabase):', client1);
      console.log('Client 2 (supabaseBrowser.getClient()):', client2);
      
      // Test both clients
      const results: any = {};
      
      // Test client 1
      try {
        const { data: data1, error: error1 } = await client1
          .from('filter_user_profiles')
          .select('id, name')
          .limit(1);
        
        results.client1 = {
          success: !error1,
          data: data1,
          error: error1?.message
        };
      } catch (err: any) {
        results.client1 = { success: false, error: err.message };
      }
      
      // Test client 2
      try {
        const { data: data2, error: error2 } = await client2
          .from('filter_user_profiles')
          .select('id, name')
          .limit(1);
        
        results.client2 = {
          success: !error2,
          data: data2,
          error: error2?.message
        };
      } catch (err: any) {
        results.client2 = { success: false, error: err.message };
      }
      
      // Check if they're the same instance
      results.sameInstance = client1 === client2;
      results.client1Type = typeof client1;
      results.client2Type = typeof client2;
      
      setComparison(results);
    };

    compareClients();
  }, []);

  return (
    <div className="p-4 bg-purple-50 border-2 border-purple-300 rounded-lg mb-4">
      <h3 className="font-bold text-lg mb-2">Supabase Client Comparison</h3>
      
      <div className="space-y-2 text-sm">
        <div>
          <strong>Same instance?</strong> {comparison.sameInstance ? 'Yes' : 'No'}
        </div>
        
        <div>
          <strong>Client 1 (lib/supabase):</strong>
          <pre className="bg-white p-2 rounded mt-1">
            {JSON.stringify(comparison.client1, null, 2)}
          </pre>
        </div>
        
        <div>
          <strong>Client 2 (supabaseBrowser.getClient()):</strong>
          <pre className="bg-white p-2 rounded mt-1">
            {JSON.stringify(comparison.client2, null, 2)}
          </pre>
        </div>
      </div>
      
      {comparison.client1?.success !== comparison.client2?.success && (
        <div className="mt-3 p-2 bg-yellow-100 rounded">
          <p className="text-yellow-800 font-semibold">
            ⚠️ Different results from different clients!
          </p>
        </div>
      )}
    </div>
  );
};