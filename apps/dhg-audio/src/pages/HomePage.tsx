import { useState, useEffect } from 'react';
import { AudioList } from '@/components';
import { AudioAdapter, AudioFile } from '@/services/audio-adapter';
import { DriveFilterSelect } from '@/components/DriveFilterSelect';

export const HomePage = () => {
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [rawFiles, setRawFiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentRootDriveId, setCurrentRootDriveId] = useState<string | null>(null);

  useEffect(() => {
    const fetchAudioFiles = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log('HomePage: Starting to fetch audio files', { rootDriveId: currentRootDriveId });
        const result = await AudioAdapter.getAudioFilesWithDebug(currentRootDriveId);
        console.log('HomePage: Successfully fetched audio files', result.files.length);
        console.log('HomePage: Raw data sample:', result.rawData[0]);
        setAudioFiles(result.files);
        setRawFiles(result.rawData);
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
  }, [currentRootDriveId]);

  const handleFilterChange = (profileId: string | null, rootDriveId: string | null) => {
    console.log('Filter changed:', { profileId, rootDriveId });
    setCurrentRootDriveId(rootDriveId);
  };

  return (
    <div>
      {/* Drive Filter Selection - Prominent at the top */}
      <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">Select Collection:</span>
          <div className="flex-1">
            <DriveFilterSelect
              onFilterChange={handleFilterChange}
              className="w-full"
            />
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-2">
          Filter audio files by collection. Your selection is saved automatically.
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


      <AudioList audioFiles={audioFiles} isLoading={isLoading} rawFiles={rawFiles} />
    </div>
  );
};