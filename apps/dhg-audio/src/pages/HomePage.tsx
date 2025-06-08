import { useState, useEffect } from 'react';
import { AudioList } from '@/components';
import { AudioAdapter, AudioFile } from '@/services/audio-adapter';
import { supabase } from '@/lib/supabase';
import { FilterService } from '@shared/services/filter-service/filter-service';
import { DriveFilterCombobox } from '@shared/components/filter';

export const HomePage = () => {
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Create filter service instance with the single supabase client
  const filterService = new FilterService(supabase);

  useEffect(() => {
    const fetchAudioFiles = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log('HomePage: Starting to fetch audio files');
        const files = await AudioAdapter.getAudioFiles();
        console.log('HomePage: Successfully fetched audio files', files.length);
        setAudioFiles(files);
      } catch (err) {
        console.error('Error fetching audio files:', err);
        // Create a more detailed error message
        let errorMessage = 'Failed to load audio files. ';
        
        if (err instanceof Error) {
          errorMessage += `Error: ${err.message}`;
          
          // Check for connection-related errors
          if (err.message.includes('network') || err.message.includes('connection') || 
              err.message.includes('ERR_NAME_NOT_RESOLVED')) {
            errorMessage = 'Connection to database failed. Please check your Supabase connection settings in .env.development file.';
          }
        }
        
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAudioFiles();
  }, [refreshTrigger]);

  const handleFilterChange = (profileId: string | null, profile: any) => {
    console.log('Filter changed:', { profileId, profileName: profile?.name });
    // Trigger a refresh of the audio files
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div>
      {/* Drive Filter Selection - Prominent at the top */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">Select Drive:</span>
          <div className="flex-1 max-w-md">
            <DriveFilterCombobox
              filterService={filterService}
              onFilterChange={handleFilterChange}
              showSuccessMessages={false}
              showErrorMessages={true}
              showCurrentFilterInfo={false}
              label=""
              className="w-full"
            />
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Choose a drive filter to view audio files from specific collections
        </p>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Audio Learning</h1>
        <p className="text-gray-600">
          Listen to presentations on the go. Select an audio file to begin.
        </p>
        <p className="text-sm text-blue-600 mt-2 p-2 bg-blue-50 rounded border border-blue-200">
          <strong>New Feature:</strong> Audio files are now streamed through our server proxy to avoid 
          browser tracking prevention issues. Playback should work in all browsers!
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
          {error}
        </div>
      )}

      <AudioList audioFiles={audioFiles} isLoading={isLoading} />
    </div>
  );
};