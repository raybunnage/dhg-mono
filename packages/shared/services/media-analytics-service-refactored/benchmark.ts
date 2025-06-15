/**
 * Performance benchmark for MediaAnalyticsService
 */

import { MediaAnalyticsService } from './MediaAnalyticsService';
import { SupabaseClientService } from '../supabase-client';

async function benchmark() {
  console.log('Starting MediaAnalyticsService benchmark...\n');
  
  // Get dependencies
  const supabase = SupabaseClientService.getInstance().getClient();
  const service = new MediaAnalyticsService(supabase);
  
  try {
    // Benchmark 1: Health Check
    console.log('1. Health Check Performance:');
    const healthStart = Date.now();
    const health = await service.healthCheck();
    const healthDuration = Date.now() - healthStart;
    console.log(`   ✓ Health check: ${healthDuration}ms (healthy: ${health.healthy})`);
    
    // Benchmark 2: Media Statistics - All Media
    console.log('\n2. Media Statistics Operations:');
    const allStatsStart = Date.now();
    const allStats = await service.getMediaStatistics();
    const allStatsDuration = Date.now() - allStatsStart;
    console.log(`   ✓ Get all media statistics: ${allStatsDuration}ms (found: ${allStats.length} media items)`);
    
    // Benchmark 3: Media Statistics - Last 7 Days
    const weekStatsStart = Date.now();
    const weekStats = await service.getMediaStatistics({ days: 7 });
    const weekStatsDuration = Date.now() - weekStatsStart;
    console.log(`   ✓ Get last 7 days statistics: ${weekStatsDuration}ms (found: ${weekStats.length} media items)`);
    
    // Benchmark 4: Media Statistics - Last 30 Days
    const monthStatsStart = Date.now();
    const monthStats = await service.getMediaStatistics({ days: 30 });
    const monthStatsDuration = Date.now() - monthStatsStart;
    console.log(`   ✓ Get last 30 days statistics: ${monthStatsDuration}ms (found: ${monthStats.length} media items)`);
    
    // Benchmark 5: Single Media Statistics
    if (allStats.length > 0) {
      const singleMediaStart = Date.now();
      const singleStats = await service.getMediaStatistics({ mediaId: allStats[0].mediaId });
      const singleMediaDuration = Date.now() - singleMediaStart;
      console.log(`   ✓ Get single media statistics: ${singleMediaDuration}ms`);
    }
    
    // Benchmark 6: Top Media
    console.log('\n3. Top Media Operations:');
    const top10Start = Date.now();
    const top10 = await service.getTopMedia(10);
    const top10Duration = Date.now() - top10Start;
    console.log(`   ✓ Get top 10 media: ${top10Duration}ms`);
    
    const top5Start = Date.now();
    const top5Week = await service.getTopMedia(5, { days: 7 });
    const top5Duration = Date.now() - top5Start;
    console.log(`   ✓ Get top 5 media (last 7 days): ${top5Duration}ms`);
    
    // Benchmark 7: Session Analytics
    console.log('\n4. Session Analytics:');
    // First, get some sessions to analyze
    const { data: sessions } = await supabase
      .from('learn_media_sessions')
      .select('id')
      .limit(5);
    
    if (sessions && sessions.length > 0) {
      for (let i = 0; i < Math.min(3, sessions.length); i++) {
        const sessionStart = Date.now();
        const analytics = await service.getSessionAnalytics(sessions[i].id);
        const sessionDuration = Date.now() - sessionStart;
        console.log(`   ✓ Get session analytics ${i + 1}: ${sessionDuration}ms (${analytics?.events.length || 0} events)`);
      }
    } else {
      console.log('   ⚠ No sessions found for analytics benchmark');
    }
    
    // Benchmark 8: User Engagement
    console.log('\n5. User Engagement Metrics:');
    // Get some users with sessions
    const { data: users } = await supabase
      .from('learn_media_sessions')
      .select('user_id')
      .not('user_id', 'is', null)
      .limit(5);
    
    if (users && users.length > 0) {
      const uniqueUsers = [...new Set(users.map(u => u.user_id))].slice(0, 3);
      
      for (const userId of uniqueUsers) {
        const engagementStart = Date.now();
        const engagement = await service.getUserEngagement(userId);
        const engagementDuration = Date.now() - engagementStart;
        console.log(`   ✓ User engagement for ${userId.substring(0, 8)}...: ${engagementDuration}ms (${engagement.totalSessions} sessions, ${service.formatDuration(engagement.totalPlayTime)})`);
      }
    } else {
      console.log('   ⚠ No users found for engagement benchmark');
    }
    
    // Benchmark 9: Bulk Operations
    console.log('\n6. Bulk Operations:');
    const bulkStart = Date.now();
    
    // Run multiple queries in sequence
    const operations = [
      service.getMediaStatistics({ days: 1 }),
      service.getMediaStatistics({ days: 3 }),
      service.getMediaStatistics({ days: 7 }),
      service.getTopMedia(5),
      service.getTopMedia(10),
      service.getTopMedia(20)
    ];
    
    await Promise.all(operations);
    const bulkDuration = Date.now() - bulkStart;
    console.log(`   ✓ 6 parallel operations: ${bulkDuration}ms`);
    
    // Get final metrics
    console.log('\n7. Service Metrics:');
    const metrics = service.getMetrics();
    console.log('   ✓ Total Queries Executed:', metrics.totalQueriesExecuted);
    console.log('   ✓ Total Sessions Analyzed:', metrics.totalSessionsAnalyzed);
    console.log('   ✓ Total Events Processed:', metrics.totalEventsProcessed);
    console.log('   ✓ Total Media Stats Calculated:', metrics.totalMediaStatsCalculated);
    console.log('   ✓ Total User Engagement Queries:', metrics.totalUserEngagementQueries);
    console.log('   ✓ Average Query Time:', metrics.averageQueryTime.toFixed(2) + 'ms');
    console.log('   ✓ Total Errors:', metrics.totalErrors);
    
    // Display sample data for verification
    console.log('\n8. Sample Results:');
    if (top10.length > 0) {
      console.log('   Top 3 Media by Sessions:');
      top10.slice(0, 3).forEach((media, index) => {
        console.log(`   ${index + 1}. ${media.mediaName}: ${media.sessionCount} sessions, ${service.formatDuration(media.totalPlayTime)} total time`);
      });
    }
    
    console.log('\n✅ Benchmark completed successfully');
    
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
  } finally {
    await service.shutdown();
  }
}

// Run benchmark if called directly
if (require.main === module) {
  benchmark().catch(console.error);
}

export { benchmark };