import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FilterService } from '@shared/services/filter-service/filter-service';

export const FilterServiceTest: React.FC = () => {
  const [result, setResult] = useState<any>({
    loading: true,
    data: null,
    error: null
  });

  useEffect(() => {
    const testFilterService = async () => {
      console.log('=== FilterServiceTest Starting ===');
      
      try {
        // Create FilterService with our supabase client
        console.log('Creating FilterService with supabase client...');
        const filterService = new FilterService(supabase);
        
        // Test listProfiles
        console.log('Calling filterService.listProfiles()...');
        const profiles = await filterService.listProfiles();
        console.log('listProfiles result:', profiles);
        
        // Test loadActiveProfile
        console.log('Calling filterService.loadActiveProfile()...');
        const activeProfile = await filterService.loadActiveProfile();
        console.log('loadActiveProfile result:', activeProfile);
        
        setResult({
          loading: false,
          data: {
            profiles,
            activeProfile,
            profileCount: profiles.length
          },
          error: null
        });
        
      } catch (err: any) {
        console.error('FilterServiceTest error:', err);
        setResult({
          loading: false,
          data: null,
          error: err.message || 'Unknown error'
        });
      }
    };

    testFilterService();
  }, []);

  return (
    <div className="p-4 bg-green-50 border-2 border-green-300 rounded-lg mb-4">
      <h3 className="font-bold text-lg mb-2">Filter Service Test</h3>
      
      {result.loading && <p>Testing FilterService...</p>}
      
      {!result.loading && result.error && (
        <div className="bg-red-100 p-2 rounded">
          <p className="text-red-800">Error: {result.error}</p>
        </div>
      )}
      
      {!result.loading && !result.error && result.data && (
        <div>
          <div className="mb-3">
            <p className="font-semibold">FilterService Results:</p>
            <p className="text-sm">Profile count: {result.data.profileCount}</p>
            <p className="text-sm">Active profile: {result.data.activeProfile?.name || 'None'}</p>
          </div>
          
          {result.data.profiles.length > 0 ? (
            <div>
              <p className="font-semibold text-sm">Profiles from FilterService:</p>
              <ul className="mt-1 space-y-1">
                {result.data.profiles.map((p: any) => (
                  <li key={p.id} className="text-sm bg-white p-2 rounded">
                    {p.name} (ID: {p.id.substring(0, 8)}...)
                    {p.is_active && <span className="ml-2 text-green-600">(Active)</span>}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No profiles returned by FilterService</p>
          )}
          
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-gray-600">Raw FilterService Data</summary>
            <pre className="text-xs mt-2 bg-white p-2 rounded overflow-auto">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
};