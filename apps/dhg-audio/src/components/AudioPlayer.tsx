import { useState, useEffect, useRef } from 'react';
import { getAudioUrlOptions } from '../utils/google-drive-utils';

interface AudioPlayerProps {
  url: string;
  title: string;
  onTimeUpdate?: (currentTime: number) => void;
  initialTime?: number;
}

export const AudioPlayer = ({ url, title, onTimeUpdate, initialTime = 0 }: AudioPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(initialTime);
  const [volume, setVolume] = useState(0.7);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const urlOptions = getAudioUrlOptions(url);
  
  useEffect(() => {
    // Reset states when URL changes
    setError(null);
    setLoadingState('loading');
    setIsPlaying(false);
    setCurrentUrlIndex(0);
    
    // Set the initial time when the component mounts or URL changes
    if (audioRef.current) {
      audioRef.current.currentTime = initialTime;
      // Set the first URL option (Google Drive direct download)
      if (urlOptions.length > 0) {
        audioRef.current.src = urlOptions[0];
        console.log('Using Google Drive URL:', urlOptions[0]);
      }
    }
  }, [url, initialTime, urlOptions]);
  
  useEffect(() => {
    // Set up event listeners for the audio element
    const audio = audioRef.current;
    if (!audio) return;
    
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setLoadingState('loaded');
      console.log('Audio loaded successfully:', title);
    };
    
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      onTimeUpdate?.(audio.currentTime);
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
    };
    
    const handleError = (e: ErrorEvent) => {
      console.error('Audio error for URL:', urlOptions[currentUrlIndex], e);
      
      // Try the next URL option if available
      if (currentUrlIndex < urlOptions.length - 1) {
        console.log(`Trying next URL option (${currentUrlIndex + 1}/${urlOptions.length})`);
        setCurrentUrlIndex(prev => prev + 1);
        setLoadingState('loading');
        
        // Load the next URL
        if (audio) {
          audio.src = urlOptions[currentUrlIndex + 1];
          audio.load();
        }
      } else {
        // All URL options failed
        setError('Failed to load audio through proxy server and direct Google Drive access. Check that the audio proxy server is running.');
        setLoadingState('error');
        setIsPlaying(false);
      }
    };
    
    // Add event listeners
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError as EventListener);
    
    // Clean up event listeners
    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError as EventListener);
    };
  }, [onTimeUpdate, title]);
  
  // Play/pause toggle
  const togglePlay = () => {
    if (loadingState === 'error') {
      // If in error state, try to reload from the first URL option
      setError(null);
      setLoadingState('loading');
      setCurrentUrlIndex(0);
      
      if (audioRef.current && urlOptions.length > 0) {
        audioRef.current.src = urlOptions[0];
        audioRef.current.load();
        return;
      }
    }
    
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        const playPromise = audioRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
            })
            .catch((err) => {
              console.error('Play error:', err);
              setError(`Couldn't play audio: ${err.message}`);
              setIsPlaying(false);
            });
        }
      }
    }
  };
  
  // Seek to a specific time
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = parseFloat(e.target.value);
    setCurrentTime(seekTime);
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
    }
  };
  
  // Handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };
  
  // Handle playback rate change
  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };
  
  // Format time in mm:ss
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };
  
  return (
    <div className="w-full max-w-screen-md bg-white rounded-lg shadow-md p-4">
      <div className="mb-2">
        <h3 className="text-lg font-bold truncate">{title}</h3>
      </div>
      
      <audio ref={audioRef} preload="metadata" className="hidden" />
      
      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
          <p className="font-medium">{error}</p>
          <p className="text-sm mt-1">
            Tried {urlOptions.length} different URL formats including the audio proxy server. Make sure the proxy server is running on port 3006.
          </p>
          <div className="mt-2 space-y-1">
            <a 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-blue-600 hover:underline text-sm font-medium"
            >
              Open original Google Drive link
            </a>
            {urlOptions.length > 1 && (
              <a 
                href={urlOptions[0]} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block text-blue-600 hover:underline text-sm font-medium"
              >
                Try proxy server link
              </a>
            )}
            {urlOptions.length > 2 && (
              <a 
                href={urlOptions[1]} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block text-blue-600 hover:underline text-sm font-medium"
              >
                Try direct download link
              </a>
            )}
          </div>
        </div>
      )}
      
      {/* Loading state */}
      {loadingState === 'loading' && !error && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-gray-600">Loading audio...</span>
        </div>
      )}
      
      {/* Playback controls */}
      <div className="flex flex-col gap-2">
        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <span className="text-xs w-12 text-right">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="flex-grow h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            disabled={loadingState === 'error'}
          />
          <span className="text-xs w-12">{formatTime(duration)}</span>
        </div>
        
        {/* Control buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button 
              onClick={togglePlay}
              className={`${loadingState === 'error' ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'} text-white rounded-full w-12 h-12 flex items-center justify-center`}
              aria-label={isPlaying ? 'Pause' : loadingState === 'error' ? 'Try Again' : 'Play'}
              title={loadingState === 'error' ? 'Try Again' : (isPlaying ? 'Pause' : 'Play')}
            >
              {loadingState === 'error' ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                  <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06l1.72 1.72-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06l-1.72-1.72 1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" />
                </svg>
              ) : isPlaying ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                  <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25zm7.5 0A.75.75 0 0 1 15 4.5h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V5.25z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                  <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                </svg>
              )}
            </button>
            
            {/* Volume control */}
            <div className="flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-gray-600">
                <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06z" />
                <path d="M15.932 7.757a.75.75 0 0 1 1.061 0 6 6 0 0 1 .001 8.486.75.75 0 0 1-1.06-1.061 4.5 4.5 0 0 0-.001-6.364.75.75 0 0 1 0-1.06z" />
              </svg>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                disabled={loadingState === 'error'}
              />
            </div>
          </div>
          
          {/* Playback rate */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-600">Speed:</span>
            <div className="flex gap-1">
              {[0.5, 1, 1.5, 2].map(rate => (
                <button
                  key={rate}
                  onClick={() => handlePlaybackRateChange(rate)}
                  className={`px-2 py-1 text-xs rounded ${
                    loadingState === 'error' 
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                      : playbackRate === rate 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-200 text-gray-700'
                  }`}
                  disabled={loadingState === 'error'}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};