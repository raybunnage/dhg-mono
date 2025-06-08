import { useEffect, useRef, useCallback } from 'react';
import { MediaTrackingService } from '@shared/services/media-tracking-service';
import { supabase } from '../lib/supabase';

interface UseMediaTrackingProps {
  mediaId: string;
  userId?: string;
  mediaType?: 'audio' | 'video';
  enabled?: boolean;
}

interface MediaTrackingControls {
  trackPlay: (currentTime: number) => Promise<void>;
  trackPause: (currentTime: number) => Promise<void>;
  trackSeek: (fromTime: number, toTime: number) => Promise<void>;
  trackSpeedChange: (currentTime: number, newSpeed: number) => Promise<void>;
  trackVolumeChange: (currentTime: number, newVolume: number) => Promise<void>;
  addBookmark: (currentTime: number, note?: string, type?: string) => Promise<void>;
  endSession: (completionPercentage?: number) => Promise<void>;
}

export function useMediaTracking({
  mediaId,
  userId,
  mediaType = 'audio',
  enabled = true
}: UseMediaTrackingProps): MediaTrackingControls {
  const trackingServiceRef = useRef<MediaTrackingService | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !mediaId) {
      return;
    }

    // Initialize the tracking service with browser-compatible supabase client
    trackingServiceRef.current = new MediaTrackingService(supabase);

    // Start a new session
    const initSession = async () => {
      try {
        const sessionId = await trackingServiceRef.current?.startSession(
          mediaId,
          userId,
          mediaType
        );
        sessionIdRef.current = sessionId || null;
      } catch (error) {
        console.error('Failed to start media tracking session:', error);
      }
    };

    initSession();

    // Cleanup: end session when component unmounts
    return () => {
      if (sessionIdRef.current && trackingServiceRef.current) {
        trackingServiceRef.current.endSession(sessionIdRef.current).catch(console.error);
      }
    };
  }, [mediaId, userId, mediaType, enabled]);

  const trackPlay = useCallback(async (currentTime: number) => {
    if (!sessionIdRef.current || !trackingServiceRef.current || !enabled) return;
    
    try {
      await trackingServiceRef.current.trackEvent(sessionIdRef.current, {
        event_type: 'play',
        event_timestamp: new Date().toISOString(),
        playback_position: currentTime
      });
    } catch (error) {
      console.error('Failed to track play event:', error);
    }
  }, [enabled]);

  const trackPause = useCallback(async (currentTime: number) => {
    if (!sessionIdRef.current || !trackingServiceRef.current || !enabled) return;
    
    try {
      await trackingServiceRef.current.trackEvent(sessionIdRef.current, {
        event_type: 'pause',
        event_timestamp: new Date().toISOString(),
        playback_position: currentTime
      });
    } catch (error) {
      console.error('Failed to track pause event:', error);
    }
  }, [enabled]);

  const trackSeek = useCallback(async (fromTime: number, toTime: number) => {
    if (!sessionIdRef.current || !trackingServiceRef.current || !enabled) return;
    
    try {
      await trackingServiceRef.current.trackEvent(sessionIdRef.current, {
        event_type: 'seek',
        event_timestamp: new Date().toISOString(),
        playback_position: toTime,
        event_data: { from: fromTime, to: toTime }
      });
    } catch (error) {
      console.error('Failed to track seek event:', error);
    }
  }, [enabled]);

  const trackSpeedChange = useCallback(async (currentTime: number, newSpeed: number) => {
    if (!sessionIdRef.current || !trackingServiceRef.current || !enabled) return;
    
    try {
      await trackingServiceRef.current.trackEvent(sessionIdRef.current, {
        event_type: 'speed_change',
        event_timestamp: new Date().toISOString(),
        playback_position: currentTime,
        event_data: { speed: newSpeed }
      });
    } catch (error) {
      console.error('Failed to track speed change:', error);
    }
  }, [enabled]);

  const trackVolumeChange = useCallback(async (currentTime: number, newVolume: number) => {
    if (!sessionIdRef.current || !trackingServiceRef.current || !enabled) return;
    
    try {
      await trackingServiceRef.current.trackEvent(sessionIdRef.current, {
        event_type: 'volume_change',
        event_timestamp: new Date().toISOString(),
        playback_position: currentTime,
        event_data: { volume: newVolume }
      });
    } catch (error) {
      console.error('Failed to track volume change:', error);
    }
  }, [enabled]);

  const addBookmark = useCallback(async (currentTime: number, note?: string, type?: string) => {
    if (!sessionIdRef.current || !trackingServiceRef.current || !enabled) return;
    
    try {
      await trackingServiceRef.current.addBookmark(sessionIdRef.current, {
        playback_position: currentTime,
        note,
        bookmark_type: type
      });
    } catch (error) {
      console.error('Failed to add bookmark:', error);
    }
  }, [enabled]);

  const endSession = useCallback(async (completionPercentage?: number) => {
    if (!sessionIdRef.current || !trackingServiceRef.current || !enabled) return;
    
    try {
      await trackingServiceRef.current.endSession(sessionIdRef.current, completionPercentage);
      sessionIdRef.current = null;
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  }, [enabled]);

  return {
    trackPlay,
    trackPause,
    trackSeek,
    trackSpeedChange,
    trackVolumeChange,
    addBookmark,
    endSession
  };
}