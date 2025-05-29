import React from 'react';
import type { FilterProfile } from '@shared/services/filter-service/filter-service';

interface ProfileWithDrives extends FilterProfile {
  driveCount?: number;
}

interface ProfileListProps {
  profiles: ProfileWithDrives[];
  activeProfileId?: string;
  selectedProfileId?: string;
  onSelectProfile: (profile: ProfileWithDrives) => void;
  onSetActive: (profileId: string) => void;
  onEdit: (profile: ProfileWithDrives) => void;
  onDelete: (profileId: string) => void;
}

export const ProfileList: React.FC<ProfileListProps> = ({
  profiles,
  activeProfileId,
  selectedProfileId,
  onSelectProfile,
  onSetActive,
  onEdit,
  onDelete,
}) => {
  if (profiles.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No filter profiles found. Create one to get started.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {profiles.map((profile) => (
        <div
          key={profile.id}
          className={`border rounded-lg p-4 cursor-pointer transition-colors ${
            selectedProfileId === profile.id
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
          onClick={() => onSelectProfile(profile)}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-gray-900">{profile.name}</h4>
                {profile.id === activeProfileId && (
                  <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                    Active
                  </span>
                )}
              </div>
              {profile.description && (
                <p className="text-sm text-gray-600 mt-1">{profile.description}</p>
              )}
              <div className="text-xs text-gray-500 mt-2">
                {profile.driveCount || 0} drive{profile.driveCount !== 1 ? 's' : ''} • 
                Created {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Unknown'}
              </div>
            </div>
            <div className="flex gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
              {profile.id !== activeProfileId && (
                <button
                  onClick={() => onSetActive(profile.id)}
                  className="text-sm text-blue-600 hover:text-blue-800 px-3 py-1 border border-blue-600 rounded hover:bg-blue-50"
                >
                  Set Active
                </button>
              )}
              <button
                onClick={() => onEdit(profile)}
                className="text-sm text-gray-600 hover:text-gray-800 px-3 py-1 border border-gray-300 rounded hover:bg-gray-50"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(profile.id)}
                className="text-sm text-red-600 hover:text-red-800 px-3 py-1 border border-red-300 rounded hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};