import React from 'react';
import { supabase } from '../lib/supabase';
import { FilterService } from '@shared/services/filter-service/filter-service';
import { DriveFilterCombobox } from '@shared/components/filter';

export const DriveFilterPage: React.FC = () => {
  // Create filter service instance
  const filterService = new FilterService(supabase as any);

  const handleFilterChange = (profileId: string | null, profile: any) => {
    console.log('Filter changed:', { profileId, profileName: profile?.name });
    // Could add additional logic here if needed
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">Drive Filter Settings</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-gray-600 mb-6">
          Select a drive filter to limit which audio files are displayed in the app. 
          This helps you focus on specific content collections.
        </p>

        <DriveFilterCombobox
          filterService={filterService}
          onFilterChange={handleFilterChange}
          showSuccessMessages={true}
          showErrorMessages={true}
          showCurrentFilterInfo={true}
        />
        
        <div className="mt-6 p-4 bg-blue-50 rounded-md">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Changes take effect immediately. The audio list will refresh automatically when you change the filter.
          </p>
        </div>
      </div>
    </div>
  );
};