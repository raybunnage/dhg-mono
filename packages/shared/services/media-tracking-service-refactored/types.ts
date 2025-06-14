/**
 * Types for Media Tracking Service
 */

import { Database } from '../../../../supabase/types';

type Tables = Database['public']['Tables'];

// Re-export database types with cleaner names
export type MediaSession = Tables['learn_media_sessions']['Row'];
export type MediaSessionInsert = Tables['learn_media_sessions']['Insert'];
export type MediaSessionUpdate = Tables['learn_media_sessions']['Update'];

export type PlaybackEvent = Tables['learn_media_playback_events']['Row'];
export type PlaybackEventInsert = Tables['learn_media_playback_events']['Insert'];

export type MediaBookmark = Tables['learn_media_bookmarks']['Row'];
export type MediaBookmarkInsert = Tables['learn_media_bookmarks']['Insert'];

// Service-specific interfaces
export interface MediaTrackingOptions {
  userId?: string; // Optional - will use authenticated user if not provided
  mediaId: string;
  mediaType?: 'audio' | 'video';
  deviceType?: string;
}

export interface PlaybackEventData {
  playbackSpeed?: number;
  volume?: number;
  seekFrom?: number;
  seekTo?: number;
  quality?: string;
  duration?: number; // For loadedmetadata events
  [key: string]: any;
}

export interface SessionStatistics {
  sessionId: string;
  totalDuration: number; // Total session time in seconds
  activeDuration: number; // Active playback time in seconds
  completionPercentage: number;
  lastPosition: number;
}

// Event types enum for type safety
export enum PlaybackEventType {
  SESSION_START = 'session_start',
  SESSION_END = 'session_end',
  PLAY = 'play',
  PAUSE = 'pause',
  ENDED = 'ended',
  SEEKING = 'seeking',
  SEEKED = 'seeked',
  TIMEUPDATE = 'timeupdate',
  LOADEDMETADATA = 'loadedmetadata',
  ERROR = 'error',
  QUALITY_CHANGE = 'quality_change',
  SPEED_CHANGE = 'speed_change',
  VOLUME_CHANGE = 'volume_change',
  FULLSCREEN_ENTER = 'fullscreen_enter',
  FULLSCREEN_EXIT = 'fullscreen_exit'
}

// Bookmark categories
export enum BookmarkCategory {
  IMPORTANT = 'important',
  QUESTION = 'question',
  REFERENCE = 'reference',
  REVIEW = 'review',
  NOTE = 'note',
  OTHER = 'other'
}