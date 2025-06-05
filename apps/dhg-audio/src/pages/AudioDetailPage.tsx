import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AudioAdapter, AudioFile } from '@/services/audio-adapter';
import { Transcript, TrackedAudioPlayer } from '@/components';

export const AudioDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [audioFile, setAudioFile] = useState<AudioFile | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTranscriptLoading, setIsTranscriptLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAudio = async () => {
      if (!id) return;

      try {
        setIsLoading(true);
        setError(null);
        
        const file = await AudioAdapter.getAudioFile(id);
        setAudioFile(file);
        
        if (file) {
          setIsTranscriptLoading(true);
          const transcriptText = await AudioAdapter.getTranscript(id);
          setTranscript(transcriptText);
          setIsTranscriptLoading(false);
        }
      } catch (err) {
        console.error('Error fetching audio file:', err);
        setError('Failed to load audio file. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAudio();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-52">
        <div className="text-blue-500">Loading audio file...</div>
      </div>
    );
  }

  if (error || !audioFile) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
        <p>{error || 'Audio file not found'}</p>
        <Link to="/" className="mt-4 inline-block text-blue-500 hover:text-blue-600">
          &larr; Back to audio files
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Link to="/" className="text-blue-500 hover:text-blue-600 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-1">
            <path fillRule="evenodd" d="M18 10a.75.75 0 0 1-.75.75H4.66l2.1 1.95a.75.75 0 1 1-1.02 1.1l-3.5-3.25a.75.75 0 0 1 0-1.1l3.5-3.25a.75.75 0 1 1 1.02 1.1l-2.1 1.95h12.59A.75.75 0 0 1 18 10Z" clipRule="evenodd" />
          </svg>
          Back to all audio
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{audioFile.name}</h1>
        {audioFile.expert && (
          <p className="text-gray-600">
            By {audioFile.expert.fullName || audioFile.expert.name}
          </p>
        )}
        <div className="mt-3 flex items-center gap-2">
          {audioFile.directUrl && (
            <a 
              href={audioFile.directUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-md hover:bg-blue-100 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M15.75 2.25H21a.75.75 0 0 1 .75.75v5.25a.75.75 0 0 1-1.5 0V4.81L8.03 17.03a.75.75 0 0 1-1.06-1.06L19.19 3.75h-3.44a.75.75 0 0 1 0-1.5Zm-10.5 4.5a1.5 1.5 0 0 0-1.5 1.5v10.5a1.5 1.5 0 0 0 1.5 1.5h10.5a1.5 1.5 0 0 0 1.5-1.5V10.5a.75.75 0 0 1 1.5 0v8.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V8.25a3 3 0 0 1 3-3h8.25a.75.75 0 0 1 0 1.5H5.25Z" clipRule="evenodd" />
              </svg>
              Direct Google Drive Link
            </a>
          )}
          <a 
            href={audioFile.url}
            download={audioFile.name}
            className="inline-flex items-center gap-1 text-sm font-medium text-green-600 bg-green-50 px-3 py-1 rounded-md hover:bg-green-100 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M12 2.25a.75.75 0 0 1 .75.75v11.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V3a.75.75 0 0 1 .75-.75Zm-9 13.5a.75.75 0 0 1 .75.75v2.25a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V16.5a.75.75 0 0 1 1.5 0v2.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V16.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
            </svg>
            Download Audio
          </a>
        </div>
      </div>

      <div className="mb-8">
        <TrackedAudioPlayer 
          url={audioFile.url} 
          title={audioFile.name}
          mediaId={audioFile.id}
          enableTracking={true}
        />
      </div>
      
      <div className="mb-8 bg-blue-50 border border-blue-200 rounded-md p-4 text-blue-800">
        <h2 className="text-lg font-bold mb-2">About Audio Playback</h2>
        <p className="mb-2">
          This audio is being streamed through our server proxy to avoid browser tracking prevention issues.
        </p>
        <ul className="list-disc ml-5 space-y-1">
          <li>Audio should play in all browsers without tracking prevention issues</li>
          <li>If you have problems, try the "Download Audio" button to save the file</li>
          <li>Alternatively, use the "Direct Google Drive Link" if you prefer</li>
        </ul>
        <p className="mt-2 text-sm">
          <strong>Note:</strong> The proxy server must be running on port 3001 for streaming to work properly.
        </p>
      </div>

      <Transcript 
        content={transcript} 
        isLoading={isTranscriptLoading} 
      />
    </div>
  );
};