import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface FilterProfile {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export function FilterProfileDebug() {
  const [profiles, setProfiles] = useState<FilterProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      console.log('🔍 FilterProfileDebug: Starting to load profiles...');
      setLoading(true);
      setError(null);

      // Direct query to filter_user_profiles table
      const { data, error: queryError, status, statusText } = await supabase
        .from('filter_user_profiles')
        .select('*')
        .order('name');

      console.log('🔍 FilterProfileDebug: Query result:', {
        data,
        error: queryError,
        status,
        statusText,
        count: data?.length || 0
      });

      setDebugInfo({
        queryTime: new Date().toISOString(),
        status,
        statusText,
        dataCount: data?.length || 0,
        error: queryError,
        supabaseUrl: supabase.supabaseUrl,
        hasAuthSession: !!(await supabase.auth.getSession()).data.session
      });

      if (queryError) {
        console.error('🔍 FilterProfileDebug: Error loading profiles:', queryError);
        setError(`Error loading profiles: ${queryError.message}`);
        setProfiles([]);
      } else {
        console.log('🔍 FilterProfileDebug: Successfully loaded profiles:', data);
        setProfiles(data || []);
        
        // Auto-select first profile if available
        if (data && data.length > 0) {
          setSelectedProfile(data[0].id);
        }
      }
    } catch (err) {
      console.error('🔍 FilterProfileDebug: Unexpected error:', err);
      setError(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const profileId = e.target.value;
    setSelectedProfile(profileId);
    const profile = profiles.find(p => p.id === profileId);
    console.log('🔍 FilterProfileDebug: Selected profile:', profile);
  };

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <h3 className="text-lg font-semibold mb-4">Filter Profile Debug</h3>
      
      {/* Debug Info */}
      <details className="mb-4">
        <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
          Debug Information
        </summary>
        <pre className="mt-2 p-2 bg-white rounded border text-xs overflow-auto">
          {JSON.stringify(debugInfo, null, 2)}
        </pre>
      </details>

      {/* Loading State */}
      {loading && (
        <div className="mb-4 text-blue-600">Loading profiles...</div>
      )}

      {/* Error State */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Profiles Count */}
      <div className="mb-4 text-sm text-gray-600">
        Found {profiles.length} profile(s) in filter_user_profiles table
      </div>

      {/* Combobox */}
      <div className="mb-4">
        <label htmlFor="profile-select" className="block text-sm font-medium text-gray-700 mb-2">
          Select Filter Profile:
        </label>
        <select
          id="profile-select"
          value={selectedProfile}
          onChange={handleProfileChange}
          className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={loading || profiles.length === 0}
        >
          {profiles.length === 0 ? (
            <option value="">No profiles available</option>
          ) : (
            profiles.map(profile => (
              <option key={profile.id} value={profile.id}>
                {profile.name} {profile.is_active ? '(Active)' : ''} - {profile.description || 'No description'}
              </option>
            ))
          )}
        </select>
      </div>

      {/* Selected Profile Details */}
      {selectedProfile && (
        <div className="mt-4 p-3 bg-white rounded border">
          <h4 className="font-semibold mb-2">Selected Profile Details:</h4>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(
              profiles.find(p => p.id === selectedProfile),
              null,
              2
            )}
          </pre>
        </div>
      )}

      {/* Raw Data Display */}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
          Raw Profile Data
        </summary>
        <pre className="mt-2 p-2 bg-white rounded border text-xs overflow-auto max-h-96">
          {JSON.stringify(profiles, null, 2)}
        </pre>
      </details>

      {/* Reload Button */}
      <button
        onClick={loadProfiles}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        disabled={loading}
      >
        Reload Profiles
      </button>
    </div>
  );
}