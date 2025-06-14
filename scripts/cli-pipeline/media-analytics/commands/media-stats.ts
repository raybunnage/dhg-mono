#!/usr/bin/env ts-node
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { MediaAnalyticsService } from '../../../../packages/shared/services/media-analytics-service';

export async function mediaStats(options: {
  days?: number;
  mediaId?: string;
}) {
  const supabase = SupabaseClientService.getInstance().getClient();
  const analyticsService = MediaAnalyticsService.getInstance(supabase);
  
  try {
    // Get statistics using the MediaAnalyticsService
    const stats = await analyticsService.getMediaStatistics(options);

    if (!stats || stats.length === 0) {
      console.log('No sessions found for the given criteria.');
      return;
    }

    // Display header
    console.log('\nMedia Analytics Report');
    console.log('─'.repeat(88));
    console.log('Media Name                              Sessions  Total Time    Avg Time    Completion  Users');
    console.log('─'.repeat(88));

    // Display each media's statistics
    stats.forEach((mediaStat) => {
      const name = mediaStat.mediaName.substring(0, 38).padEnd(38, ' ');
      const sessions = mediaStat.sessionCount.toString().padStart(8, ' ');
      const totalTime = analyticsService.formatDuration(mediaStat.totalPlayTime).padEnd(12, ' ');
      const avgTime = analyticsService.formatDuration(mediaStat.averagePlayTime).padEnd(11, ' ');
      const completion = `${Math.round(mediaStat.averageCompletion)}%`.padEnd(10, ' ');
      const users = mediaStat.uniqueUsers.toString().padStart(5, ' ');
      
      console.log(`${name} ${sessions} ${totalTime} ${avgTime} ${completion} ${users}`);
    });

    console.log('─'.repeat(88));

    // Overall statistics
    const totalSessions = stats.reduce((sum: number, s) => sum + s.sessionCount, 0);
    const totalUsers = stats.reduce((sum: number, s) => sum + s.uniqueUsers, 0);
    const totalTime = stats.reduce((sum: number, s) => sum + s.totalPlayTime, 0);
    const avgSessionTime = totalSessions > 0 ? totalTime / totalSessions : 0;

    console.log(`\nOverall Statistics:`);
    console.log(`  Total Sessions: ${totalSessions}`);
    console.log(`  Unique Users: ${totalUsers}`);
    console.log(`  Total Listening Time: ${analyticsService.formatDuration(totalTime)}`);
    console.log(`  Average Session Time: ${analyticsService.formatDuration(avgSessionTime)}`);

    // Show event statistics if available
    const totalEvents = stats.reduce((sum: number, s) => 
      sum + s.events.plays + s.events.pauses + s.events.seeks + s.events.completions, 0);
    
    if (totalEvents > 0) {
      console.log(`\nEvent Statistics:`);
      const totalPlays = stats.reduce((sum: number, s) => sum + s.events.plays, 0);
      const totalPauses = stats.reduce((sum: number, s) => sum + s.events.pauses, 0);
      const totalSeeks = stats.reduce((sum: number, s) => sum + s.events.seeks, 0);
      const totalCompletions = stats.reduce((sum: number, s) => sum + s.events.completions, 0);
      
      console.log(`  Total Plays: ${totalPlays}`);
      console.log(`  Total Pauses: ${totalPauses}`);
      console.log(`  Total Seeks: ${totalSeeks}`);
      console.log(`  Total Completions: ${totalCompletions}`);
    }

  } catch (error) {
    console.error('Failed to get media statistics:', error);
  }
}