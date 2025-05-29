import React, { useState, useEffect } from 'react';
import { FilterService, type FilterProfile } from '../../services/filter-service/filter-service';

export interface DriveFilterComboboxProps {
  /** The FilterService instance to use */
  filterService: FilterService;
  /** Optional CSS classes to apply to the container */
  className?: string;
  /** Whether to show success messages */
  showSuccessMessages?: boolean;
  /** Whether to show error messages */
  showErrorMessages?: boolean;
  /** Callback when filter changes */
  onFilterChange?: (profileId: string | null, profile: FilterProfile | null) => void;
  /** Custom label for the dropdown */
  label?: string;
  /** Whether to show the current filter info section */
  showCurrentFilterInfo?: boolean;
}

export const DriveFilterCombobox: React.FC<DriveFilterComboboxProps> = ({
  filterService,
  className = '',
  showSuccessMessages = true,
  showErrorMessages = true,
  onFilterChange,
  label = 'Active Drive Filter',
  showCurrentFilterInfo = true
}) => {
  const [profiles, setProfiles] = useState<FilterProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Load all profiles
      const profileList = await filterService.listProfiles();
      setProfiles(profileList);
      
      // Load active profile
      const activeProfile = await filterService.loadActiveProfile();
      if (activeProfile) {
        setActiveProfileId(activeProfile.id);
      }
    } catch (error: any) {
      console.error('Error loading profiles:', error);
      if (showErrorMessages) {
        setError(error.message || 'Failed to load filter profiles');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileChange = async (profileId: string) => {
    try {
      setError(null);
      setSuccessMessage(null);
      
      if (profileId === 'none') {
        // Deactivate all profiles
        await filterService.listProfiles().then(async (allProfiles) => {
          for (const profile of allProfiles) {
            if (profile.is_active) {
              await filterService.updateProfile(profile.id, { is_active: false });
            }
          }
        });
        
        setActiveProfileId(null);
        
        if (showSuccessMessages) {
          setSuccessMessage('All filters deactivated');
          setTimeout(() => setSuccessMessage(null), 3000);
        }
        
        onFilterChange?.(null, null);
      } else {
        // Set the selected profile as active
        await filterService.setActiveProfile(profileId);
        setActiveProfileId(profileId);
        
        const profile = profiles.find(p => p.id === profileId);
        
        if (showSuccessMessages) {
          setSuccessMessage(`Filter activated: ${profile?.name || 'Unknown'}`);
          setTimeout(() => setSuccessMessage(null), 3000);
        }
        
        onFilterChange?.(profileId, profile || null);
      }
    } catch (error: any) {
      console.error('Error setting active profile:', error);
      if (showErrorMessages) {
        setError(error.message || 'Failed to update filter profile');
      }
    }
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-sm">Loading filters...</span>
      </div>
    );
  }

  const activeProfile = profiles.find(p => p.id === activeProfileId);

  return (
    <div className={className}>
      {error && showErrorMessages && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {successMessage && showSuccessMessages && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800">{successMessage}</p>
        </div>
      )}

      <div className="space-y-3">
        <label htmlFor="drive-filter-select" className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        <select
          id="drive-filter-select"
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
        
        {showCurrentFilterInfo && activeProfile && (
          <div className="mt-3 p-3 bg-gray-50 rounded-md">
            <h4 className="text-sm font-medium text-gray-700 mb-1">Current Filter</h4>
            <p className="text-sm text-gray-600">{activeProfile.name}</p>
            {activeProfile.description && (
              <p className="text-sm text-gray-500 mt-1">{activeProfile.description}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};