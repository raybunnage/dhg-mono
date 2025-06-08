import { useState, useEffect } from 'react';
import { AudioList, DriveFilterSelect, TrackingStatusIndicator } from '@/components';
import { AudioAdapter, AudioFile } from '@/services/audio-adapter';

export const HomePage = () => {
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentRootDriveId, setCurrentRootDriveId] = useState<string | null>(null);

  useEffect(() => {
    const fetchAudioFiles = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const files = await AudioAdapter.getAudioFiles(currentRootDriveId);
        setAudioFiles(files);
      } catch (err) {
        console.error('Error fetching audio files:', err);
        let errorMessage = 'Failed to load audio files.';
        
        if (err instanceof Error) {
          if (err.message.includes('network') || err.message.includes('connection') || 
              err.message.includes('ERR_NAME_NOT_RESOLVED')) {
            errorMessage = 'Connection to database failed. Please check your connection.';
          }
        }
        
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAudioFiles();
  }, [currentRootDriveId]);

  const handleFilterChange = (_profileId: string | null, rootDriveId: string | null) => {
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
        <div className="flex items-center justify-between">
          <p className="text-gray-600">
            Listen to presentations on the go. Select an audio file to begin.
          </p>
          <TrackingStatusIndicator />
        </div>
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