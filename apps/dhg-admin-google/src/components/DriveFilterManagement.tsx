import React, { useState, useEffect } from 'react';
import { filterServiceMethods } from '../services/drive-filter-service';
import { ProfileList } from './drive-filters/ProfileList';
import { ProfileForm } from './drive-filters/ProfileForm';
import { DriveList } from './drive-filters/DriveList';
import type { FilterProfile } from '@shared/services/filter-service/filter-service';

interface ProfileWithDrives extends FilterProfile {
  drives?: any[];
  driveCount?: number;
}

export const DriveFilterManagement: React.FC = () => {
  const [profiles, setProfiles] = useState<ProfileWithDrives[]>([]);
  const [activeProfile, setActiveProfile] = useState<FilterProfile | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<ProfileWithDrives | null>(null);
  const [selectedProfileDrives, setSelectedProfileDrives] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProfiles();
    loadActiveProfile();
  }, []);

  const loadProfiles = async () => {
    try {
      setIsLoading(true);
      const data = await filterServiceMethods.listProfiles();
      
      // Fetch drive counts for each profile
      const profilesWithDriveCounts = await Promise.all(
        data.map(async (profile) => {
          try {
            const driveIds = await filterServiceMethods.getProfileDriveIds(profile.id);
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
      const profile = await filterServiceMethods.loadActiveProfile();
      setActiveProfile(profile);
    } catch (error) {
      console.error('Error loading active profile:', error);
    }
  };

  const handleCreateProfile = async (name: string, description?: string) => {
    try {
      await filterServiceMethods.createProfile(name, description);
      await loadProfiles();
      setIsCreating(false);
    } catch (error: any) {
      console.error('Error creating profile:', error);
      setError(error.message || 'Failed to create profile');
    }
  };

  const handleUpdateProfile = async (profileId: string, updates: { name?: string; description?: string }) => {
    try {
      await filterServiceMethods.updateProfile(profileId, updates);
      await loadProfiles();
      setSelectedProfile(null);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setError(error.message || 'Failed to update profile');
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (!confirm('Are you sure you want to delete this profile?')) return;
    
    try {
      await filterServiceMethods.deleteProfile(profileId);
      await loadProfiles();
      if (selectedProfile?.id === profileId) {
        setSelectedProfile(null);
      }
    } catch (error: any) {
      console.error('Error deleting profile:', error);
      setError(error.message || 'Failed to delete profile');
    }
  };

  const handleSetActiveProfile = async (profileId: string) => {
    try {
      await filterServiceMethods.setActiveProfile(profileId);
      // Reload both active profile and profiles list to ensure UI is in sync
      await loadActiveProfile();
      await loadProfiles();
    } catch (error: any) {
      console.error('Error setting active profile:', error);
      setError(error.message || 'Failed to set active profile');
    }
  };

  const handleAddDrives = async (profileId: string, driveIds: string[]) => {
    try {
      await filterServiceMethods.addDrivesToProfile(profileId, driveIds);
      // Refresh the selected profile to show updated drives
      const updatedProfiles = await filterServiceMethods.listProfiles();
      setProfiles(updatedProfiles);
      const updated = updatedProfiles.find(p => p.id === profileId);
      if (updated) setSelectedProfile(updated);
    } catch (error: any) {
      console.error('Error adding drives:', error);
      setError(error.message || 'Failed to add drives');
    }
  };

  const handleRemoveDrives = async (profileId: string, driveIds: string[]) => {
    try {
      await filterServiceMethods.removeDrivesFromProfile(profileId, driveIds);
      // Refresh the selected profile to show updated drives
      const updatedProfiles = await filterServiceMethods.listProfiles();
      setProfiles(updatedProfiles);
      const updated = updatedProfiles.find(p => p.id === profileId);
      if (updated) setSelectedProfile(updated);
    } catch (error: any) {
      console.error('Error removing drives:', error);
      setError(error.message || 'Failed to remove drives');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading profiles...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Prominent Active Profile Display */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm uppercase tracking-wide opacity-90 mb-1">Currently Active Profile</h2>
            {activeProfile ? (
              <>
                <h1 className="text-2xl font-bold">{activeProfile.name}</h1>
                {activeProfile.description && (
                  <p className="text-blue-100 mt-2">{activeProfile.description}</p>
                )}
              </>
            ) : (
              <p className="text-xl">No profile active</p>
            )}
          </div>
          {activeProfile && (
            <div className="text-right">
              <div className="bg-white/20 backdrop-blur rounded-lg px-4 py-2">
                <span className="text-3xl font-bold">{profiles.find(p => p.id === activeProfile.id)?.driveCount || 0}</span>
                <p className="text-sm opacity-90">drives</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
          <button 
            onClick={() => setError(null)}
            className="text-red-600 underline text-sm mt-2"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">All Filter Profiles</h2>
          <button
            onClick={() => setIsCreating(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Create Profile
          </button>
        </div>

        {isCreating && (
          <ProfileForm
            onSubmit={handleCreateProfile}
            onCancel={() => setIsCreating(false)}
          />
        )}

        <ProfileList
          profiles={profiles}
          activeProfileId={activeProfile?.id}
          selectedProfileId={selectedProfile?.id}
          onSelectProfile={async (profile) => {
            setSelectedProfile(profile);
            // Load drives for the selected profile
            try {
              const driveIds = await filterServiceMethods.getProfileDriveIds(profile.id);
              // Transform drive IDs into the expected format
              const drives = driveIds.map((driveId, index) => ({
                id: `${profile.id}-${index}`,
                profile_id: profile.id,
                root_drive_id: driveId,
                include_children: true,
                created_at: new Date().toISOString()
              }));
              setSelectedProfileDrives(drives);
            } catch (error) {
              console.error('Error loading profile drives:', error);
              setSelectedProfileDrives([]);
            }
          }}
          onSetActive={handleSetActiveProfile}
          onEdit={async (profile) => {
            setSelectedProfile(profile);
            // Load drives for the selected profile
            try {
              const driveIds = await filterServiceMethods.getProfileDriveIds(profile.id);
              const drives = driveIds.map((driveId, index) => ({
                id: `${profile.id}-${index}`,
                profile_id: profile.id,
                root_drive_id: driveId,
                include_children: true,
                created_at: new Date().toISOString()
              }));
              setSelectedProfileDrives(drives);
            } catch (error) {
              console.error('Error loading profile drives:', error);
              setSelectedProfileDrives([]);
            }
          }}
          onDelete={handleDeleteProfile}
        />
      </div>

      {selectedProfile && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              Edit Profile: {selectedProfile.name}
            </h3>
            <button
              onClick={() => setSelectedProfile(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          <ProfileForm
            profile={selectedProfile}
            onSubmit={(name, description) => handleUpdateProfile(selectedProfile.id, { name, description })}
            onCancel={() => setSelectedProfile(null)}
          />

          <div className="mt-8">
            <h4 className="text-md font-semibold text-gray-900 mb-4">Associated Drives</h4>
            <DriveList
              profileId={selectedProfile.id}
              drives={selectedProfileDrives}
              onAddDrives={handleAddDrives}
              onRemoveDrives={handleRemoveDrives}
            />
          </div>
        </div>
      )}
    </div>
  );
};