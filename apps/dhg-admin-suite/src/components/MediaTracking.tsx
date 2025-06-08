import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format, formatDistanceToNow } from 'date-fns';

interface MediaSession {
  id: string;
  user_id: string | null;
  media_id: string;
  session_start: string;
  session_end: string | null;
  total_duration_seconds: number;
  completion_percentage: number;
  device_type: string | null;
  session_type: string | null;
  created_at: string;
  google_sources?: {
    title: string;
    mime_type: string;
  };
  auth_users?: {
    email: string;
  };
}

interface PlaybackEvent {
  id: string;
  session_id: string;
  user_id: string | null;
  event_type: string;
  timestamp_seconds: number;
  event_data: any;
  created_at: string;
}

interface MediaStats {
  total_sessions: number;
  total_duration_minutes: number;
  avg_completion_percentage: number;
  unique_users: number;
  unique_media: number;
}

export const MediaTracking: React.FC = () => {
  const [sessions, setSessions] = useState<MediaSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessionEvents, setSessionEvents] = useState<PlaybackEvent[]>([]);
  const [stats, setStats] = useState<MediaStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'sessions' | 'stats'>('sessions');

  useEffect(() => {
    fetchSessions();
    fetchStats();
  }, []);

  useEffect(() => {
    if (selectedSession) {
      fetchSessionEvents(selectedSession);
    }
  }, [selectedSession]);

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('learn_media_sessions')
        .select(`
          *,
          google_sources!inner(title, mime_type),
          auth_users(email)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessionEvents = async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from('learn_media_playback_events')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setSessionEvents(data || []);
    } catch (error) {
      console.error('Error fetching session events:', error);
    }
  };

  const fetchStats = async () => {
    try {
      // Get aggregate statistics
      const { data: sessionStats, error: statsError } = await supabase
        .from('learn_media_sessions')
        .select('*');

      if (statsError) throw statsError;

      if (sessionStats && sessionStats.length > 0) {
        const totalSessions = sessionStats.length;
        const totalDuration = sessionStats.reduce((sum, s) => sum + (s.total_duration_seconds || 0), 0);
        const avgCompletion = sessionStats.reduce((sum, s) => sum + (s.completion_percentage || 0), 0) / totalSessions;
        const uniqueUsers = new Set(sessionStats.map(s => s.user_id).filter(Boolean)).size;
        const uniqueMedia = new Set(sessionStats.map(s => s.media_id)).size;

        setStats({
          total_sessions: totalSessions,
          total_duration_minutes: Math.round(totalDuration / 60),
          avg_completion_percentage: Math.round(avgCompletion),
          unique_users: uniqueUsers,
          unique_media: uniqueMedia
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'play': return '▶️';
      case 'pause': return '⏸️';
      case 'seek': return '⏩';
      case 'speed_change': return '⚡';
      case 'volume_change': return '🔊';
      case 'session_start': return '🚀';
      case 'session_end': return '🏁';
      default: return '📍';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-blue-900 mb-4">Media Tracking</h2>
        
        {/* View Toggle */}
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setActiveView('sessions')}
            className={`px-4 py-2 rounded-md font-medium ${
              activeView === 'sessions'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            }`}
          >
            Recent Sessions
          </button>
          <button
            onClick={() => setActiveView('stats')}
            className={`px-4 py-2 rounded-md font-medium ${
              activeView === 'stats'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            }`}
          >
            Statistics
          </button>
        </div>

        {/* Statistics View */}
        {activeView === 'stats' && stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-900">{stats.total_sessions}</div>
              <div className="text-sm text-blue-600">Total Sessions</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-900">{stats.total_duration_minutes}</div>
              <div className="text-sm text-green-600">Total Minutes</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-900">{stats.avg_completion_percentage}%</div>
              <div className="text-sm text-purple-600">Avg Completion</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-900">{stats.unique_users}</div>
              <div className="text-sm text-orange-600">Unique Users</div>
            </div>
            <div className="bg-pink-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-pink-900">{stats.unique_media}</div>
              <div className="text-sm text-pink-600">Unique Media</div>
            </div>
          </div>
        )}

        {/* Sessions View */}
        {activeView === 'sessions' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sessions List */}
            <div className="space-y-4">
              <h3 className="font-medium text-blue-900">Recent Sessions</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => setSelectedSession(session.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedSession === session.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-sm truncate">
                          {session.google_sources?.title || 'Unknown Media'}
                        </div>
                        <div className="text-xs text-gray-600">
                          {session.auth_users?.email || 'Anonymous'}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {formatDuration(session.total_duration_seconds || 0)}
                        </div>
                        <div className="text-xs text-gray-600">
                          {session.completion_percentage || 0}%
                        </div>
                        <div className="text-xs text-gray-500">
                          {session.device_type || 'Unknown'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Session Events */}
            <div className="space-y-4">
              <h3 className="font-medium text-blue-900">Session Events</h3>
              {selectedSession ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {sessionEvents.map((event) => (
                    <div key={event.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <div className="text-2xl">{getEventIcon(event.event_type)}</div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {event.event_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </div>
                          <div className="text-xs text-gray-600">
                            at {formatDuration(event.timestamp_seconds)}
                          </div>
                          {event.event_data && (
                            <div className="text-xs text-gray-500 mt-1">
                              {event.event_type === 'seek' && event.event_data.seekFrom !== undefined && (
                                <>From {formatDuration(event.event_data.seekFrom)} to {formatDuration(event.event_data.seekTo)}</>
                              )}
                              {event.event_type === 'speed_change' && event.event_data.playbackSpeed && (
                                <>Speed: {event.event_data.playbackSpeed}x</>
                              )}
                              {event.event_type === 'volume_change' && event.event_data.volume !== undefined && (
                                <>Volume: {Math.round(event.event_data.volume * 100)}%</>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {format(new Date(event.created_at), 'HH:mm:ss')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  Select a session to view events
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};