import React, { useState, useEffect } from 'react';
import { FilterServiceClient } from '@shared/services/filter-service/filter-service-client';
import type { FilterProfile } from '@shared/services/filter-service/filter-service';

interface ProfileWithDrives extends FilterProfile {
  drives?: any[];
  driveCount?: number;
}

export const DriveFilterManagement: React.FC = () => {
  const [profiles, setProfiles] = useState<ProfileWithDrives[]>([]);
  const [activeProfile, setActiveProfile] = useState<FilterProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filterService = FilterServiceClient.getInstance();

  useEffect(() => {
    loadProfiles();
    loadActiveProfile();
  }, []);

  const loadProfiles = async () => {
    try {
      setIsLoading(true);
      const data = await filterService.listProfiles();
      
      // Fetch drive counts for each profile
      const profilesWithDriveCounts = await Promise.all(
        data.map(async (profile) => {
          try {
            const driveIds = await filterService.getProfileDriveIds(profile.id);
            return { ...profile, driveCount: driveIds.length };
          } catch (error) {
            console.error(`Error loading drives for profile ${profile.id}:`, error);
            return { ...profile, driveCount: 0 };
          }
        })
      );
      
      setProfiles(profilesWithDriveCounts);
    } catch (error: any) {
      console.error('Error loading profiles:', error);
      setError(error.message || 'Failed to load profiles');
    } finally {
      setIsLoading(false);
    }
  };

  const loadActiveProfile = async () => {
    try {
      const profile = await filterService.getActiveProfile();
      setActiveProfile(profile);
    } catch (error) {
      console.error('Error loading active profile:', error);
    }
  };

  const handleSetActive = async (profileId: string) => {
    try {
      const success = await filterService.setActiveProfile(profileId);
      if (success) {
        await loadActiveProfile();
        await loadProfiles();
      }
    } catch (error: any) {
      setError(error.message || 'Failed to set active profile');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-sky-600">Loading drive filters...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
        <p className="font-semibold">Error</p>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-sky-900 mb-4">Drive Filter Profiles</h2>
        <p className="text-sky-700 mb-6">
          Manage drive filter profiles to control which Google Drive folders are included in searches and synchronization.
        </p>
      </div>

      {/* Active Profile Display */}
      {activeProfile && (
        <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-sky-900">Active Profile</h3>
              <p className="text-sky-700">{activeProfile.name}</p>
              {activeProfile.description && (
                <p className="text-sm text-sky-600 mt-1">{activeProfile.description}</p>
              )}
            </div>
            <span className="bg-sky-100 text-sky-800 px-3 py-1 rounded-full text-sm font-medium">
              Active
            </span>
          </div>
        </div>
      )}

      {/* Profile List */}
      <div className="bg-white shadow-sm rounded-lg border border-sky-100">
        <div className="px-6 py-4 border-b border-sky-100">
          <h3 className="text-lg font-semibold text-sky-900">All Profiles</h3>
        </div>
        <div className="divide-y divide-sky-100">
          {profiles.map((profile) => (
            <div key={profile.id} className="px-6 py-4 hover:bg-sky-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-sky-900">{profile.name}</h4>
                  {profile.description && (
                    <p className="text-sm text-sky-600 mt-1">{profile.description}</p>
                  )}
                  <p className="text-sm text-sky-700 mt-2">
                    {profile.driveCount || 0} drive{profile.driveCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {profile.id === activeProfile?.id ? (
                    <span className="bg-sky-100 text-sky-800 px-3 py-1 rounded-full text-sm font-medium">
                      Active
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSetActive(profile.id)}
                      className="bg-white text-sky-700 border border-sky-300 px-4 py-2 rounded-md hover:bg-sky-50 transition-colors text-sm font-medium"
                    >
                      Set Active
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {profiles.length === 0 && (
            <div className="px-6 py-8 text-center text-sky-600">
              No filter profiles found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};