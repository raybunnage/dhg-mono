import { useEffect, useRef, useCallback } from 'react';
import { MediaTrackingService } from '../services/media-tracking-service';
import { SupabaseClientService } from '../services/supabase-client';

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
  const serviceRef = useRef<MediaTrackingService | null>(null);
  const lastSeekTime = useRef<number>(0);

  // Initialize the tracking service
  useEffect(() => {
    if (!enabled || !mediaId) {
      return;
    }

    const initializeTracking = async () => {
      try {
        const supabase = SupabaseClientService.getInstance().getClient();
        const service = new MediaTrackingService(supabase);
        serviceRef.current = service;

        // Get the current user if userId not provided
        let trackingUserId = userId;
        if (!trackingUserId) {
          const { data: { user } } = await supabase.auth.getUser();
          trackingUserId = user?.id;
        }

        if (trackingUserId) {
          await service.startSession({
            userId: trackingUserId,
            mediaId,
            mediaType
          });
        }
      } catch (error) {
        console.error('Failed to initialize media tracking:', error);
      }
    };

    initializeTracking();

    // Cleanup function to end session when component unmounts
    return () => {
      if (serviceRef.current?.hasActiveSession()) {
        serviceRef.current.endSession();
      }
    };
  }, [mediaId, userId, mediaType, enabled]);

  // Track play event
  const trackPlay = useCallback(async (currentTime: number) => {
    if (serviceRef.current && enabled) {
      await serviceRef.current.trackPlay(currentTime);
    }
  }, [enabled]);

  // Track pause event
  const trackPause = useCallback(async (currentTime: number) => {
    if (serviceRef.current && enabled) {
      await serviceRef.current.trackPause(currentTime);
    }
  }, [enabled]);

  // Track seek event with debouncing
  const trackSeek = useCallback(async (fromTime: number, toTime: number) => {
    if (serviceRef.current && enabled) {
      // Debounce seeks to avoid tracking every small movement
      const timeDiff = Math.abs(toTime - fromTime);
      if (timeDiff > 1) { // Only track seeks greater than 1 second
        lastSeekTime.current = toTime;
        await serviceRef.current.trackSeek(fromTime, toTime);
      }
    }
  }, [enabled]);

  // Track speed change
  const trackSpeedChange = useCallback(async (currentTime: number, newSpeed: number) => {
    if (serviceRef.current && enabled) {
      await serviceRef.current.trackSpeedChange(currentTime, newSpeed);
    }
  }, [enabled]);

  // Track volume change
  const trackVolumeChange = useCallback(async (currentTime: number, newVolume: number) => {
    if (serviceRef.current && enabled) {
      await serviceRef.current.trackVolumeChange(currentTime, newVolume);
    }
  }, [enabled]);

  // Add bookmark
  const addBookmark = useCallback(async (
    currentTime: number, 
    note?: string, 
    type: string = 'general'
  ) => {
    if (serviceRef.current && enabled) {
      await serviceRef.current.addBookmark(mediaId, currentTime, note, type);
    }
  }, [mediaId, enabled]);

  // End session with completion percentage
  const endSession = useCallback(async (completionPercentage?: number) => {
    if (serviceRef.current && enabled) {
      await serviceRef.current.endSession(completionPercentage);
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