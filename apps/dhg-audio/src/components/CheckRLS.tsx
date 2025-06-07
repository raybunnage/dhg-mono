import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const CheckRLS: React.FC = () => {
  const [rlsInfo, setRlsInfo] = useState<any>({
    loading: true,
    filterTables: null,
    rlsEnabled: null,
    policies: null,
    error: null
  });

  useEffect(() => {
    const checkRLS = async () => {
      console.log('=== Checking RLS on filter tables ===');
      
      try {
        // Check if RLS is enabled on the tables
        const { data: rlsStatus, error: rlsError } = await supabase.rpc('check_table_rls_status', {
          table_names: ['filter_user_profiles', 'filter_user_profile_drives']
        }).single();

        if (rlsError) {
          console.log('RLS status check failed, trying direct query');
          
          // Try a simpler approach - just query the tables
          const { data: profiles, error: profilesError, count: profilesCount } = await supabase
            .from('filter_user_profiles')
            .select('*', { count: 'exact' });

          const { data: drives, error: drivesError, count: drivesCount } = await supabase
            .from('filter_user_profile_drives')
            .select('*', { count: 'exact' });

          setRlsInfo({
            loading: false,
            filterTables: {
              profiles: { data: profiles, error: profilesError, count: profilesCount },
              drives: { data: drives, error: drivesError, count: drivesCount }
            },
            rlsEnabled: 'Unknown (RPC failed)',
            policies: null,
            error: null
          });
          
          return;
        }

        setRlsInfo({
          loading: false,
          filterTables: null,
          rlsEnabled: rlsStatus,
          policies: null,
          error: null
        });

      } catch (err: any) {
        console.error('RLS check error:', err);
        setRlsInfo({
          loading: false,
          filterTables: null,
          rlsEnabled: null,
          policies: null,
          error: err.message
        });
      }
    };

    checkRLS();
  }, []);

  return (
    <div className="p-4 bg-orange-50 border-2 border-orange-300 rounded-lg mb-4">
      <h3 className="font-bold text-lg mb-2">RLS (Row Level Security) Check</h3>
      
      {rlsInfo.loading && <p>Checking RLS status...</p>}
      
      {!rlsInfo.loading && rlsInfo.error && (
        <div className="bg-red-100 p-2 rounded">
          <p className="text-red-800">Error: {rlsInfo.error}</p>
        </div>
      )}
      
      {!rlsInfo.loading && !rlsInfo.error && rlsInfo.filterTables && (
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold">filter_user_profiles:</h4>
            {rlsInfo.filterTables.profiles.error ? (
              <p className="text-red-600">Error: {rlsInfo.filterTables.profiles.error.message}</p>
            ) : (
              <p className="text-green-600">
                Successfully queried - {rlsInfo.filterTables.profiles.count || 0} records
                {rlsInfo.filterTables.profiles.count === 0 && ' (but table might have records with RLS blocking)'}
              </p>
            )}
          </div>
          
          <div>
            <h4 className="font-semibold">filter_user_profile_drives:</h4>
            {rlsInfo.filterTables.drives.error ? (
              <p className="text-red-600">Error: {rlsInfo.filterTables.drives.error.message}</p>
            ) : (
              <p className="text-green-600">
                Successfully queried - {rlsInfo.filterTables.drives.count || 0} records
                {rlsInfo.filterTables.drives.count === 0 && ' (but table might have records with RLS blocking)'}
              </p>
            )}
          </div>
          
          <div className="mt-4 p-3 bg-yellow-100 rounded">
            <p className="text-sm font-semibold">⚠️ If you see 0 records but know the tables have data:</p>
            <ul className="text-sm mt-2 list-disc list-inside">
              <li>RLS (Row Level Security) is likely enabled and blocking access</li>
              <li>The tables might need public read policies</li>
              <li>Or the app might need to use a service role key</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};