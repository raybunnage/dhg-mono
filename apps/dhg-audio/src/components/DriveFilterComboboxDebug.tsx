import React, { useState, useEffect } from 'react';
import { FilterService, type FilterProfile } from '@shared/services/filter-service/filter-service';

export interface DriveFilterComboboxDebugProps {
  /** The FilterService instance to use */
  filterService: FilterService;
  /** Callback when filter changes */
  onFilterChange?: (profileId: string | null, profile: FilterProfile | null) => void;
}

export const DriveFilterComboboxDebug: React.FC<DriveFilterComboboxDebugProps> = ({
  filterService,
  onFilterChange,
}) => {
  const [profiles, setProfiles] = useState<FilterProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[DriveFilterDebug ${timestamp}] ${message}`);
    setDebugLog(prev => [...prev, `${timestamp}: ${message}`]);
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      addLog('Starting loadProfiles...');
      setIsLoading(true);
      setError(null);
      
      // Load all profiles
      addLog('Calling filterService.listProfiles()...');
      const profileList = await filterService.listProfiles();
      addLog(`listProfiles returned: ${profileList.length} profiles`);
      
      if (profileList.length > 0) {
        addLog('Profile names: ' + profileList.map(p => p.name).join(', '));
      }
      
      setProfiles(profileList);
      
      // Load active profile
      addLog('Calling filterService.loadActiveProfile()...');
      const activeProfile = await filterService.loadActiveProfile();
      
      if (activeProfile) {
        addLog(`Active profile found: ${activeProfile.name} (ID: ${activeProfile.id})`);
        setActiveProfileId(activeProfile.id);
      } else {
        addLog('No active profile found');
      }
      
      addLog('Profile loading completed successfully');
    } catch (error: any) {
      const errorMsg = `Error loading profiles: ${error.message}`;
      addLog(errorMsg);
      console.error('Error loading profiles:', error);
      setError(error.message || 'Failed to load filter profiles');
    } finally {
      setIsLoading(false);
      addLog('Loading state set to false');
    }
  };

  const handleProfileChange = async (profileId: string) => {
    try {
      addLog(`Profile change requested: ${profileId}`);
      setError(null);
      
      if (profileId === 'none') {
        addLog('Deactivating all profiles...');
        
        // Deactivate all profiles
        const allProfiles = await filterService.listProfiles();
        for (const profile of allProfiles) {
          if (profile.is_active) {
            await filterService.updateProfile(profile.id, { is_active: false });
          }
        }
        
        setActiveProfileId(null);
        onFilterChange?.(null, null);
        addLog('All profiles deactivated');
      } else {
        addLog(`Setting active profile to: ${profileId}`);
        
        // Set the selected profile as active
        await filterService.setActiveProfile(profileId);
        setActiveProfileId(profileId);
        
        const profile = profiles.find(p => p.id === profileId);
        onFilterChange?.(profileId, profile || null);
        
        addLog(`Profile activated: ${profile?.name || 'Unknown'}`);
      }
    } catch (error: any) {
      const errorMsg = `Error setting active profile: ${error.message}`;
      addLog(errorMsg);
      console.error('Error setting active profile:', error);
      setError(error.message || 'Failed to update filter profile');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="font-bold text-lg mb-3">Drive Filter Combobox (Debug Version)</h3>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
            <span>Loading filter profiles...</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label htmlFor="drive-filter-debug" className="block text-sm font-medium text-gray-700 mb-2">
                Filter Selection ({profiles.length} profiles available)
              </label>
              <select
                id="drive-filter-debug"
                value={activeProfileId || 'none'}
                onChange={(e) => handleProfileChange(e.target.value)}
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value="none">No filter (show all files)</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                    {profile.description && ` - ${profile.description}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-sm">
              <p><strong>Profiles loaded:</strong> {profiles.length}</p>
              <p><strong>Active profile ID:</strong> {activeProfileId || 'None'}</p>
              <p><strong>Loading state:</strong> {isLoading ? 'Loading' : 'Loaded'}</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-gray-100 p-4 rounded-lg">
        <h4 className="font-semibold mb-2">Debug Log:</h4>
        <div className="text-xs font-mono space-y-1 max-h-40 overflow-y-auto">
          {debugLog.map((log, index) => (
            <div key={index} className="text-gray-600">{log}</div>
          ))}
        </div>
      </div>
    </div>
  );
};