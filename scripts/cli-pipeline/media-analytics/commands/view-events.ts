#!/usr/bin/env ts-node
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

export async function viewEvents(sessionId: string) {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    const { data, error } = await supabase
      .from('learn_media_playback_events')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching events:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.log('No events found for this session.');
      return;
    }

    console.log(`\nFound ${data.length} events for session ${sessionId}:\n`);

    // Group events by type
    const eventCounts: Record<string, number> = {};
    
    data.forEach(event => {
      eventCounts[event.event_type] = (eventCounts[event.event_type] || 0) + 1;
      
      const timestamp = formatTime(event.timestamp_seconds);
      const eventTime = new Date(event.created_at).toLocaleTimeString();
      
      console.log(`[${eventTime}] ${event.event_type.toUpperCase()} at ${timestamp}`);
      
      if (event.event_data) {
        const data = event.event_data as any;
        if (data.seekFrom !== undefined && data.seekTo !== undefined) {
          console.log(`  Seeked from ${formatTime(data.seekFrom)} to ${formatTime(data.seekTo)}`);
        }
        if (data.playbackSpeed !== undefined) {
          console.log(`  Speed changed to ${data.playbackSpeed}x`);
        }
        if (data.volume !== undefined) {
          console.log(`  Volume changed to ${Math.round(data.volume * 100)}%`);
        }
      }
    });

    console.log('\nEvent Summary:');
    Object.entries(eventCounts).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

  } catch (error) {
    console.error('Failed to view events:', error);
  }
}

function formatTime(seconds: number): string {
  if (!seconds && seconds !== 0) return '0:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}