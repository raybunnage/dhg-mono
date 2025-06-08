#!/usr/bin/env ts-node
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

export async function mediaStats(options: {
  days?: number;
  mediaId?: string;
}) {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    let sessionsQuery = supabase
      .from('learn_media_sessions')
      .select(`
        *,
        google_sources!media_id (
          id,
          name
        )
      `);

    if (options.days) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - options.days);
      sessionsQuery = sessionsQuery.gte('session_start', startDate.toISOString());
    }

    if (options.mediaId) {
      sessionsQuery = sessionsQuery.eq('media_id', options.mediaId);
    }

    const { data: sessions, error: sessionsError } = await sessionsQuery;

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      return;
    }

    if (!sessions || sessions.length === 0) {
      console.log('No sessions found for the given criteria.');
      return;
    }

    // Calculate statistics
    const mediaStats: Record<string, {
      name: string;
      sessions: number;
      totalTime: number;
      avgTime: number;
      avgCompletion: number;
      uniqueUsers: Set<string>;
    }> = {};

    sessions.forEach(session => {
      const mediaId = session.media_id;
      const mediaName = session.google_sources?.name || 'Unknown Media';
      
      if (!mediaStats[mediaId]) {
        mediaStats[mediaId] = {
          name: mediaName,
          sessions: 0,
          totalTime: 0,
          avgTime: 0,
          avgCompletion: 0,
          uniqueUsers: new Set()
        };
      }
      
      const stats = mediaStats[mediaId];
      stats.sessions++;
      stats.totalTime += session.total_duration_seconds || 0;
      stats.avgCompletion += session.completion_percentage || 0;
      if (session.user_id) {
        stats.uniqueUsers.add(session.user_id);
      }
    });

    // Calculate averages
    Object.values(mediaStats).forEach(stats => {
      stats.avgTime = stats.sessions > 0 ? stats.totalTime / stats.sessions : 0;
      stats.avgCompletion = stats.sessions > 0 ? stats.avgCompletion / stats.sessions : 0;
    });

    // Sort by number of sessions
    const sortedStats = Object.entries(mediaStats)
      .sort(([, a], [, b]) => b.sessions - a.sessions);

    console.log(`\nMedia Statistics (${options.days ? `Last ${options.days} days` : 'All time'}):\n`);
    console.log('Media Name                                      Sessions  Users  Avg Time  Avg Completion');
    console.log('─'.repeat(88));

    sortedStats.forEach(([mediaId, stats]) => {
      const name = stats.name.length > 45 ? stats.name.substring(0, 42) + '...' : stats.name;
      const avgTime = formatDuration(stats.avgTime);
      const completion = stats.avgCompletion.toFixed(1);
      
      console.log(
        `${name.padEnd(45)} ${stats.sessions.toString().padStart(8)} ${stats.uniqueUsers.size.toString().padStart(6)} ${avgTime.padStart(9)} ${completion.padStart(13)}%`
      );
    });

    // Overall statistics
    const totalSessions = sessions.length;
    const totalUsers = new Set(sessions.map(s => s.user_id).filter(Boolean)).size;
    const totalTime = sessions.reduce((sum, s) => sum + (s.total_duration_seconds || 0), 0);
    const avgSessionTime = totalSessions > 0 ? totalTime / totalSessions : 0;

    console.log('─'.repeat(88));
    console.log(`\nOverall Statistics:`);
    console.log(`  Total Sessions: ${totalSessions}`);
    console.log(`  Unique Users: ${totalUsers}`);
    console.log(`  Total Listening Time: ${formatDuration(totalTime)}`);
    console.log(`  Average Session Time: ${formatDuration(avgSessionTime)}`);

  } catch (error) {
    console.error('Failed to get media statistics:', error);
  }
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0s';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
}