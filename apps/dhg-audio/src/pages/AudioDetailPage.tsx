import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AudioAdapter, AudioFile } from '@/services/audio-adapter';
import { AudioPlayer, Transcript } from '@/components';

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
        <div className="mt-3 flex items-center">
          <a 
            href={audioFile.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-md hover:bg-blue-100 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M15.75 2.25H21a.75.75 0 0 1 .75.75v5.25a.75.75 0 0 1-1.5 0V4.81L8.03 17.03a.75.75 0 0 1-1.06-1.06L19.19 3.75h-3.44a.75.75 0 0 1 0-1.5Zm-10.5 4.5a1.5 1.5 0 0 0-1.5 1.5v10.5a1.5 1.5 0 0 0 1.5 1.5h10.5a1.5 1.5 0 0 0 1.5-1.5V10.5a.75.75 0 0 1 1.5 0v8.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V8.25a3 3 0 0 1 3-3h8.25a.75.75 0 0 1 0 1.5H5.25Z" clipRule="evenodd" />
            </svg>
            Open in new tab (try this if audio doesn't play)
          </a>
        </div>
      </div>

      <div className="mb-8">
        <AudioPlayer 
          url={audioFile.url} 
          title={audioFile.name} 
        />
      </div>
      
      <div className="mb-8 bg-amber-50 border border-amber-200 rounded-md p-4 text-amber-800">
        <h2 className="text-lg font-bold mb-2">Having trouble playing this audio?</h2>
        <p className="mb-2">
          Some browsers block audio from Google Drive due to tracking prevention settings. Try these options:
        </p>
        <ul className="list-disc ml-5 space-y-1">
          <li>Click the "Open in new tab" button above to play directly in a new tab</li>
          <li>Try using Chrome browser which typically allows Google Drive content</li>
          <li>In Safari settings, go to Privacy → Tracking and turn off "Prevent Cross-Site Tracking"</li>
        </ul>
      </div>

      <Transcript 
        content={transcript} 
        isLoading={isTranscriptLoading} 
      />
    </div>
  );
};