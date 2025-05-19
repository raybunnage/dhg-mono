import { useState, useEffect } from 'react';
import { AudioList } from '@/components';
import { AudioAdapter, AudioFile } from '@/services/audio-adapter';

export const HomePage = () => {
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Audio Learning</h1>
        <p className="text-gray-600">
          Listen to presentations on the go. Select an audio file to begin.
        </p>
        <p className="text-sm text-amber-600 mt-2 p-2 bg-amber-50 rounded border border-amber-200">
          <strong>Note:</strong> Some browsers block audio from Google Drive due to tracking prevention. 
          For best results, use Chrome or disable tracking prevention in your browser.
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