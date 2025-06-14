#!/usr/bin/env ts-node
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { MediaAnalyticsService } from '../../../../packages/shared/services/media-analytics-service';
import { formatDuration, formatDate } from '../../../../packages/shared/utils';

interface SessionData {
  id: string;
  user_id: string;
  media_id: string;
  session_start: string;
  session_end: string | null;
  total_duration_seconds: number;
  completion_percentage: number;
  device_type: string;
  google_sources?: {
    name: string;
  };
  auth_allowed_emails?: {
    email: string;
  };
}

export async function viewSessions(options: {
  userId?: string;
  mediaId?: string;
  limit?: number;
  days?: number;
  detailed?: boolean;
}) {
  const supabase = SupabaseClientService.getInstance().getClient();
  const analyticsService = MediaAnalyticsService.getInstance(supabase);
  
  try {
    let query = supabase
      .from('learn_media_sessions')
      .select(`
        *,
        google_sources!media_id (
          name
        ),
        auth_allowed_emails!user_id (
          email
        )
      `)
      .order('session_start', { ascending: false });

    // Apply filters
    if (options.userId) {
      query = query.eq('user_id', options.userId);
    }
    
    if (options.mediaId) {
      query = query.eq('media_id', options.mediaId);
    }
    
    if (options.days) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - options.days);
      query = query.gte('session_start', startDate.toISOString());
    }
    
    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching sessions:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.log('No sessions found with the given criteria.');
      return;
    }

    console.log(`\nFound ${data.length} sessions:\n`);

    data.forEach(async (session: SessionData) => {
      const duration = formatDuration(session.total_duration_seconds);
      const email = session.auth_allowed_emails?.email || 'Unknown User';
      const mediaName = session.google_sources?.name || 'Unknown Media';
      const startTime = formatDate(session.session_start);
      const endTime = session.session_end ? formatDate(session.session_end) : 'In Progress';
      
      console.log(`Session: ${session.id}`);
      console.log(`  User: ${email}`);
      console.log(`  Media: ${mediaName}`);
      console.log(`  Started: ${startTime}`);
      console.log(`  Ended: ${endTime}`);
      console.log(`  Duration: ${duration}`);
      console.log(`  Completion: ${session.completion_percentage?.toFixed(1) || 0}%`);
      console.log(`  Device: ${session.device_type}`);
      
      // If detailed flag is set, fetch more analytics
      if (options.detailed) {
        const detailedSession = await analyticsService.getSessionAnalytics(session.id);
        if (detailedSession) {
          console.log(`  Events: ${detailedSession.events.length} total`);
          const eventCounts = detailedSession.events.reduce((acc: Record<string, number>, event) => {
            acc[event.type] = (acc[event.type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          
          Object.entries(eventCounts).forEach(([type, count]) => {
            console.log(`    - ${type}: ${count}`);
          });
        }
      }
      
      console.log('');
    });

  } catch (error) {
    console.error('Failed to view sessions:', error);
  }
}

