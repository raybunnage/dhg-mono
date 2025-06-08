import React, { useState, useEffect } from 'react';
import { supabaseBrowser } from '../lib/supabase';
import { FilterService } from '@shared/services/filter-service/filter-service';

export const DriveFilterDebug: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<any>({
    profiles: [],
    profileDrives: [],
    activeProfile: null,
    sampleSources: [],
    error: null
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDebugInfo = async () => {
      try {
        setIsLoading(true);
        const client = supabaseBrowser.getClient();
        const filterService = new FilterService(client);

        // Check filter_user_profiles
        const { data: profiles, error: profilesError } = await client
          .from('filter_user_profiles')
          .select('*')
          .order('name');

        if (profilesError) {
          console.error('Error loading profiles:', profilesError);
          setDebugInfo((prev: any) => ({ ...prev, error: profilesError.message }));
          return;
        }

        // Check filter_user_profile_drives
        const { data: profileDrives, error: drivesError } = await client
          .from('filter_user_profile_drives')
          .select('*');

        if (drivesError) {
          console.error('Error loading profile drives:', drivesError);
        }

        // Get active profile
        const activeProfile = await filterService.loadActiveProfile();

        // Get sample sources with root_drive_id
        const { data: sampleSources, error: sourcesError } = await client
          .from('google_sources')
          .select('id, name, root_drive_id, mime_type')
          .not('root_drive_id', 'is', null)
          .limit(10);

        if (sourcesError) {
          console.error('Error loading sample sources:', sourcesError);
        }

        // Get unique root_drive_ids
        const { data: uniqueDriveIds } = await client
          .from('google_sources')
          .select('root_drive_id')
          .not('root_drive_id', 'is', null)
          .limit(100);

        const uniqueDrives = [...new Set(uniqueDriveIds?.map((s: any) => s.root_drive_id) || [])];

        setDebugInfo({
          profiles: profiles || [],
          profileDrives: profileDrives || [],
          activeProfile,
          sampleSources: sampleSources || [],
          uniqueDriveIds: uniqueDrives,
          error: null
        });
      } catch (error: any) {
        console.error('Debug load error:', error);
        setDebugInfo((prev: any) => ({ ...prev, error: error.message }));
      } finally {
        setIsLoading(false);
      }
    };

    loadDebugInfo();
  }, []);

  if (isLoading) {
    return <div className="p-4">Loading debug info...</div>;
  }

  return (
    <div className="p-4 bg-gray-100 rounded-lg space-y-4 text-sm">
      <h3 className="font-bold text-lg">Drive Filter Debug Info</h3>
      
      {debugInfo.error && (
        <div className="bg-red-50 p-3 rounded border border-red-200">
          <p className="text-red-800">Error: {debugInfo.error}</p>
        </div>
      )}

      <div className="bg-white p-3 rounded shadow">
        <h4 className="font-semibold mb-2">Filter Profiles ({debugInfo.profiles.length})</h4>
        {debugInfo.profiles.length === 0 ? (
          <p className="text-gray-500">No filter profiles found in database</p>
        ) : (
          <ul className="space-y-1">
            {debugInfo.profiles.map((profile: any) => (
              <li key={profile.id} className="flex items-center gap-2">
                <span className={profile.is_active ? 'font-bold text-green-600' : ''}>
                  {profile.name}
                </span>
                {profile.is_active && <span className="text-xs bg-green-100 px-2 py-1 rounded">Active</span>}
                <span className="text-gray-500 text-xs">ID: {profile.id}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white p-3 rounded shadow">
        <h4 className="font-semibold mb-2">Profile Drive Mappings ({debugInfo.profileDrives.length})</h4>
        {debugInfo.profileDrives.length === 0 ? (
          <p className="text-gray-500">No drive mappings found</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {debugInfo.profileDrives.map((drive: any) => (
              <li key={drive.id}>
                Profile: {drive.profile_id?.substring(0, 8)}... → Drive: {drive.root_drive_id}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white p-3 rounded shadow">
        <h4 className="font-semibold mb-2">Sample Root Drive IDs ({debugInfo.uniqueDriveIds?.length || 0})</h4>
        <ul className="space-y-1 text-xs">
          {debugInfo.uniqueDriveIds?.slice(0, 10).map((driveId: string, idx: number) => (
            <li key={idx}>{driveId}</li>
          ))}
        </ul>
      </div>

      <div className="bg-white p-3 rounded shadow">
        <h4 className="font-semibold mb-2">Sample Sources with root_drive_id</h4>
        <ul className="space-y-1 text-xs">
          {debugInfo.sampleSources.map((source: any) => (
            <li key={source.id}>
              {source.name} - Drive: {source.root_drive_id}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};