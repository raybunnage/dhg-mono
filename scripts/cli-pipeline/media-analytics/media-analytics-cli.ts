#!/usr/bin/env ts-node
import { Command } from 'commander';
import { viewSessions } from './commands/view-sessions';
import { viewEvents } from './commands/view-events';
import { mediaStats } from './commands/media-stats';

const program = new Command();

program
  .name('media-analytics-cli')
  .description('CLI for analyzing media tracking data')
  .version('1.0.0');

// View sessions command
program
  .command('sessions')
  .description('View media tracking sessions')
  .option('-u, --user <userId>', 'Filter by user ID')
  .option('-m, --media <mediaId>', 'Filter by media ID')
  .option('-l, --limit <number>', 'Limit number of results', '20')
  .option('-d, --days <number>', 'Show sessions from last N days')
  .action(async (options) => {
    await viewSessions({
      userId: options.user,
      mediaId: options.media,
      limit: parseInt(options.limit),
      days: options.days ? parseInt(options.days) : undefined
    });
  });

// View events command
program
  .command('events <sessionId>')
  .description('View playback events for a specific session')
  .action(async (sessionId) => {
    await viewEvents(sessionId);
  });

// Media statistics command
program
  .command('stats')
  .description('View media statistics and usage patterns')
  .option('-d, --days <number>', 'Show stats from last N days')
  .option('-m, --media <mediaId>', 'Show stats for specific media')
  .action(async (options) => {
    await mediaStats({
      days: options.days ? parseInt(options.days) : undefined,
      mediaId: options.media
    });
  });

// Health check command
program
  .command('health-check')
  .description('Check media tracking system health')
  .action(async () => {
    const { SupabaseClientService } = await import('../../../../packages/shared/services/supabase-client');
    const supabase = SupabaseClientService.getInstance().getClient();
    
    try {
      console.log('Checking media tracking system health...\n');
      
      // Check tables exist and are accessible
      const tables = [
        'learn_media_sessions',
        'learn_media_playback_events',
        'learn_media_bookmarks'
      ];
      
      for (const table of tables) {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (error) {
          console.log(`❌ ${table}: Error - ${error.message}`);
        } else {
          console.log(`✅ ${table}: Accessible (${count || 0} records)`);
        }
      }
      
      // Check recent activity
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      const { data: recentSessions } = await supabase
        .from('learn_media_sessions')
        .select('id')
        .gte('session_start', oneDayAgo.toISOString())
        .limit(1);
      
      console.log(`\n📊 Recent Activity: ${recentSessions?.length ? 'Active' : 'No sessions in last 24 hours'}`);
      
    } catch (error) {
      console.error('Health check failed:', error);
    }
  });

program.parse(process.argv);