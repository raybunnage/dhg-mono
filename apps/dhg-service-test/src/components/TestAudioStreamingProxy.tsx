import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, Volume2, CheckCircle, XCircle, Info } from 'lucide-react';

const PROXY_URL = 'http://localhost:9883';

interface ServiceStatus {
  googleApiConfigured: boolean;
  localDriveFound: boolean;
  localDrivePath?: string;
  supabaseConfigured: boolean;
}

export function TestAudioStreamingProxy() {
  const [fileId, setFileId] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    fetchServiceStatus();
  }, []);

  const fetchServiceStatus = async () => {
    try {
      const response = await fetch(`${PROXY_URL}/api/audio-status`);
      if (!response.ok) throw new Error('Failed to fetch status');
      const status = await response.json();
      setServiceStatus(status);
    } catch (err) {
      console.error('Failed to fetch service status:', err);
    }
  };

  const testAudioFile = () => {
    if (!fileId) {
      setError('Please enter a Google Drive file ID');
      return;
    }

    setError(null);
    const audioUrl = `${PROXY_URL}/api/audio/${fileId}`;
    
    if (audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current.load();
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => {
        setError(`Playback error: ${err.message}`);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Audio Streaming Proxy Test</span>
          <Badge variant={serviceStatus?.googleApiConfigured ? 'success' : 'destructive'}>
            {serviceStatus?.googleApiConfigured ? 'Configured' : 'Not Configured'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Service Status */}
        {serviceStatus && (
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <h3 className="font-medium flex items-center gap-2">
              <Info className="h-4 w-4" />
              Service Status
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                {serviceStatus.googleApiConfigured ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span>Google API</span>
              </div>
              <div className="flex items-center gap-2">
                {serviceStatus.localDriveFound ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span>Local Drive</span>
              </div>
              <div className="flex items-center gap-2">
                {serviceStatus.supabaseConfigured ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span>Supabase</span>
              </div>
            </div>
            {serviceStatus.localDrivePath && (
              <div className="text-xs text-gray-600 mt-2">
                Local Drive Path: {serviceStatus.localDrivePath}
              </div>
            )}
          </div>
        )}

        {/* Audio Player */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Enter Google Drive file ID"
              value={fileId}
              onChange={(e) => setFileId(e.target.value)}
              className="flex-1"
            />
            <Button onClick={testAudioFile}>
              Load Audio
            </Button>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Hidden audio element */}
          <audio
            ref={audioRef}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onError={(e) => {
              const audio = e.currentTarget;
              let errorMsg = 'Unknown error';
              if (audio.error) {
                switch (audio.error.code) {
                  case 1:
                    errorMsg = 'Fetching audio was aborted';
                    break;
                  case 2:
                    errorMsg = 'Network error while loading audio';
                    break;
                  case 3:
                    errorMsg = 'Audio decoding error';
                    break;
                  case 4:
                    errorMsg = 'Audio format not supported';
                    break;
                }
              }
              setError(`Audio error: ${errorMsg}`);
            }}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={() => setError(null)}
          />

          {/* Custom Player Controls */}
          <div className="bg-gray-100 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Button
                size="icon"
                variant="outline"
                onClick={togglePlayPause}
                disabled={!fileId}
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              
              <Volume2 className="h-4 w-4 text-gray-600" />
              
              <div className="flex-1 space-y-1">
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  disabled={!duration}
                />
                <div className="flex justify-between text-xs text-gray-600">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Test File IDs */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-medium mb-2">Sample File IDs for Testing:</h3>
          <div className="space-y-1 text-xs text-gray-600">
            <div>• Use a Google Drive file ID from your sources_google table</div>
            <div>• File must be shared with the service account</div>
            <div>• Supports MP3, M4A, WAV, and other audio formats</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}