import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FilterService, type FilterProfile } from '@shared/services/filter-service/filter-service';

interface DriveFilterSelectProps {
  onFilterChange: (profileId: string | null, rootDriveId: string | null) => void;
  className?: string;
}

const STORAGE_KEY = 'dhg-audio-selected-filter';

export function DriveFilterSelect({ onFilterChange, className = '' }: DriveFilterSelectProps) {
  const [profiles, setProfiles] = useState<FilterProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [rootDriveId, setRootDriveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create filter service instance
  const filterService = new FilterService(supabase);

  useEffect(() => {
    loadProfiles();
  }, []);

  // Load profiles and restore selection from localStorage
  const loadProfiles = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Load all profiles
      const profileList = await filterService.listProfiles();
      console.log('Loaded profiles:', profileList);
      setProfiles(profileList);
      
      // Restore saved selection from localStorage
      const savedProfileId = localStorage.getItem(STORAGE_KEY);
      if (savedProfileId && profileList.some(p => p.id === savedProfileId)) {
        await selectProfile(savedProfileId, profileList);
      } else {
        // No saved selection or invalid saved selection
        onFilterChange(null, null);
      }
    } catch (error: any) {
      console.error('Error loading profiles:', error);
      setError(error.message || 'Failed to load filter profiles');
    } finally {
      setIsLoading(false);
    }
  };

  // Select a profile and load its root drive ID
  const selectProfile = async (profileId: string | null, profileList?: FilterProfile[]) => {
    const currentProfiles = profileList || profiles;
    
    if (!profileId || profileId === 'none') {
      setSelectedProfileId(null);
      setRootDriveId(null);
      localStorage.removeItem(STORAGE_KEY);
      onFilterChange(null, null);
      return;
    }

    try {
      // Get the profile's drives
      const drives = await filterService.getProfileDrives(profileId);
      console.log('Profile drives:', drives);
      
      if (drives && drives.length > 0) {
        // Use the first drive as the root drive ID
        const rootDrive = drives[0].root_drive_id;
        setRootDriveId(rootDrive);
        setSelectedProfileId(profileId);
        localStorage.setItem(STORAGE_KEY, profileId);
        onFilterChange(profileId, rootDrive);
      } else {
        console.warn('No drives found for profile:', profileId);
        setRootDriveId(null);
        onFilterChange(profileId, null);
      }
    } catch (error) {
      console.error('Error loading profile drives:', error);
      setError('Failed to load profile drives');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const profileId = e.target.value === 'none' ? null : e.target.value;
    selectProfile(profileId);
  };

  if (isLoading) {
    return (
      <div className={`flex items-center ${className}`}>
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-sm text-gray-600">Loading filters...</span>
      </div>
    );
  }

  const selectedProfile = profiles.find(p => p.id === selectedProfileId);

  return (
    <div className={className}>
      {error && (
        <div className="mb-2 text-sm text-red-600">
          {error}
        </div>
      )}
      
      <div className="relative">
        <select
          value={selectedProfileId || 'none'}
          onChange={handleChange}
          className="block w-full appearance-none bg-white border border-gray-300 rounded-lg px-4 py-3 pr-8 text-sm leading-tight focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
          style={{ minWidth: '400px' }}
        >
          <option value="none" className="py-2">
            📁 All Files - No filtering
          </option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id} className="py-2">
              {profile.is_active ? '✓ ' : '  '}{profile.name}
              {profile.description && ` — ${profile.description}`}
            </option>
          ))}
        </select>
        
        {/* Custom dropdown arrow */}
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
          </svg>
        </div>
      </div>

      {/* Show selected filter info */}
      {selectedProfile && (
        <div className="mt-2 text-xs text-gray-600">
          <span className="font-medium">Active filter:</span> {selectedProfile.name}
          {rootDriveId && (
            <span className="ml-2 text-gray-500">
              (Drive: {rootDriveId.substring(0, 8)}...)
            </span>
          )}
        </div>
      )}
    </div>
  );
}