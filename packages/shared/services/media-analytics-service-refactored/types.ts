/**
 * Type definitions for MediaAnalyticsService
 */

export interface MediaStatsOptions {
  days?: number;
  mediaId?: string;
  userId?: string;
}

export interface MediaStatistics {
  mediaId: string;
  mediaName: string;
  sessionCount: number;
  totalPlayTime: number;
  averagePlayTime: number;
  averageCompletion: number;
  uniqueUsers: number;
  events: {
    plays: number;
    pauses: number;
    seeks: number;
    completions: number;
  };
}

export interface SessionAnalytics {
  sessionId: string;
  mediaId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  completionPercentage: number;
  events: Array<{
    type: string;
    timestamp: Date;
    data?: any;
  }>;
}

export interface UserEngagementMetrics {
  totalSessions: number;
  totalPlayTime: number;
  averageSessionLength: number;
  mediaCount: number;
  favoriteMedia?: MediaStatistics;
}