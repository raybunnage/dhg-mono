import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const FilterProfileTest: React.FC = () => {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    const testDatabaseConnection = async () => {
      console.log('=== FilterProfileTest: Starting database test ===');
      setLoading(true);
      
      try {
        // Test 1: Direct query to filter_user_profiles
        console.log('Test 1: Querying filter_user_profiles directly...');
        const { data: profileData, error: profileError } = await supabase
          .from('filter_user_profiles')
          .select('*')
          .order('name');

        console.log('Query result:', { profileData, profileError });

        if (profileError) {
          console.error('Error querying profiles:', profileError);
          setError(`Database error: ${profileError.message}`);
          setDebugInfo(prev => ({ ...prev, profileError: profileError.message }));
          return;
        }

        if (!profileData) {
          console.log('No data returned from query');
          setProfiles([]);
          setDebugInfo(prev => ({ ...prev, noData: true }));
          return;
        }

        console.log(`Found ${profileData.length} profiles:`, profileData);
        setProfiles(profileData);

        // Test 2: Check if we can query any table
        console.log('Test 2: Testing general database connectivity...');
        const { data: testData, error: testError } = await supabase
          .from('google_sources')
          .select('id')
          .limit(1);

        setDebugInfo({
          profileCount: profileData.length,
          profiles: profileData,
          generalConnectivity: testError ? `Error: ${testError.message}` : 'Success',
          timestamp: new Date().toISOString()
        });

      } catch (err: any) {
        console.error('Unexpected error:', err);
        setError(`Unexpected error: ${err.message}`);
        setDebugInfo({ unexpectedError: err.message });
      } finally {
        setLoading(false);
      }
    };

    testDatabaseConnection();
  }, []);

  return (
    <div className="p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
      <h3 className="font-bold text-lg mb-2">Filter Profile Database Test</h3>
      
      {loading && (
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
          <span>Testing database connection...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-100 p-3 rounded mb-3">
          <p className="text-red-800 font-semibold">Error: {error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-3">
          <div className="bg-white p-3 rounded shadow">
            <h4 className="font-semibold mb-2">Query Results:</h4>
            <p className="text-sm">Found {profiles.length} filter profiles in database</p>
            
            {profiles.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {profiles.map((profile) => (
                  <li key={profile.id} className="text-sm p-2 bg-gray-50 rounded">
                    <span className="font-medium">{profile.name}</span>
                    {profile.is_active && <span className="ml-2 text-xs bg-green-100 px-2 py-1 rounded">Active</span>}
                    <div className="text-xs text-gray-500 mt-1">
                      ID: {profile.id}
                      {profile.description && ` | ${profile.description}`}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 mt-2">No profiles found in filter_user_profiles table</p>
            )}
          </div>

          <div className="bg-gray-100 p-3 rounded">
            <h4 className="font-semibold mb-2">Debug Information:</h4>
            <pre className="text-xs overflow-auto">{JSON.stringify(debugInfo, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
};