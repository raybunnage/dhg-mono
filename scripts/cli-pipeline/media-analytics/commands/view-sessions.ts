#!/usr/bin/env ts-node
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

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
}) {
  const supabase = SupabaseClientService.getInstance().getClient();
  
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

    data.forEach((session: SessionData) => {
      const duration = formatDuration(session.total_duration_seconds);
      const email = session.auth_allowed_emails?.email || 'Unknown User';
      const mediaName = session.google_sources?.name || 'Unknown Media';
      const startTime = new Date(session.session_start).toLocaleString();
      const endTime = session.session_end ? new Date(session.session_end).toLocaleString() : 'In Progress';
      
      console.log(`Session: ${session.id}`);
      console.log(`  User: ${email}`);
      console.log(`  Media: ${mediaName}`);
      console.log(`  Started: ${startTime}`);
      console.log(`  Ended: ${endTime}`);
      console.log(`  Duration: ${duration}`);
      console.log(`  Completion: ${session.completion_percentage?.toFixed(1) || 0}%`);
      console.log(`  Device: ${session.device_type}`);
      console.log('');
    });

  } catch (error) {
    console.error('Failed to view sessions:', error);
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