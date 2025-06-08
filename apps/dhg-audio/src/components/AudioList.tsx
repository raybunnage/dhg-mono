import { AudioFile } from '@/services/audio-adapter';
import { Link } from 'react-router-dom';
import { AudioFileDebug } from './AudioFileDebug';
import { AudioUrlDebug } from './AudioUrlDebug';

interface AudioListProps {
  audioFiles: AudioFile[];
  isLoading: boolean;
  rawFiles?: any[]; // Raw data from the database for debugging
}

export const AudioList = ({ audioFiles, isLoading, rawFiles }: AudioListProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-52">
        <div className="text-blue-500">Loading audio files...</div>
      </div>
    );
  }

  if (audioFiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-52 p-4 text-center">
        <p className="text-gray-500 mb-2">No audio files found</p>
        <p className="text-sm text-gray-400">Check your connection or try again later</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1">
      {audioFiles.map((file, index) => {
        // Find the corresponding raw data for this file
        const rawFile = rawFiles?.find(rf => rf.id === file.id);
        
        return (
        <div key={file.id} className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 text-blue-600 p-3 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path fillRule="evenodd" d="M19.952 1.651a.75.75 0 0 1 .298.599V16.303a3 3 0 0 1-2.176 2.884l-1.32.377a2.553 2.553 0 0 1-1.403-.14L4.56 15.765A2.25 2.25 0 0 1 3 13.655V7.105a2.25 2.25 0 0 1 1.92-2.227l10.52-1.699a.75.75 0 0 1 .662.175 3.001 3.001 0 0 1 3.85.026zM15 9.75a.75.75 0 0 0-1.5 0v5.63a2.25 2.25 0 0 0 1.5 0V9.75z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-grow min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{file.name}</h3>
              {file.expert && (
                <p className="text-sm text-gray-500 truncate">
                  By {file.expert.fullName || file.expert.name}
                </p>
              )}
            </div>
            {file.hasTranscript && (
              <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                Transcript
              </span>
            )}
            
            {/* Action buttons */}
            <div className="flex gap-2">
              {/* Open in player button */}
              <Link
                to={`/audio/${file.id}`}
                className="text-blue-500 p-2 hover:bg-blue-50 rounded-full transition-colors"
                title="Open in player"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                </svg>
              </Link>
              
              {/* Download button */}
              <a
                href={file.url}
                download={file.name}
                className="text-green-600 p-2 hover:bg-green-50 rounded-full transition-colors"
                title="Download Audio"
                onClick={(e) => {
                  // Prevent the event from bubbling up to the parent
                  e.stopPropagation();
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M12 2.25a.75.75 0 0 1 .75.75v11.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V3a.75.75 0 0 1 .75-.75Zm-9 13.5a.75.75 0 0 1 .75.75v2.25a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V16.5a.75.75 0 0 1 1.5 0v2.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V16.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
                </svg>
              </a>
            </div>
          </div>
          
          {/* Debug info */}
          <AudioFileDebug file={file} rawData={rawFile} />
          <AudioUrlDebug audioFile={file} />
        </div>
      )})}
    </div>
  );
};