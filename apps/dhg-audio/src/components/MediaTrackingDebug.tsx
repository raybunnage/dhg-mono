import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export function MediaTrackingDebug() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const loadTrackingData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Get recent media sessions for current user
        const { data: sessionsData, error: sessionsError } = await supabase
          .from('learn_media_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (sessionsError) {
          console.error('Error loading sessions:', sessionsError);
          setError('Failed to load sessions');
          return;
        }

        setSessions(sessionsData || []);

        // Get recent playback events for current user
        const { data: eventsData, error: eventsError } = await supabase
          .from('learn_media_playback_events')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (eventsError) {
          console.error('Error loading events:', eventsError);
        } else {
          setEvents(eventsData || []);
        }

        // Get bookmarks for current user
        const { data: bookmarksData, error: bookmarksError } = await supabase
          .from('learn_media_bookmarks')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (bookmarksError) {
          console.error('Error loading bookmarks:', bookmarksError);
        } else {
          setBookmarks(bookmarksData || []);
        }

      } catch (error: any) {
        console.error('Error loading tracking data:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    loadTrackingData();
  }, [user]);

  if (!user) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-600">Please log in to view media tracking data.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-600">Loading tracking data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 rounded-lg border border-red-200">
        <p className="text-red-700">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">📊 Media Tracking Status</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="font-medium">Sessions:</span> {sessions.length}
          </div>
          <div>
            <span className="font-medium">Events:</span> {events.length}
          </div>
          <div>
            <span className="font-medium">Bookmarks:</span> {bookmarks.length}
          </div>
        </div>
      </div>

      {/* Recent Sessions */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h4 className="font-semibold mb-3">🎵 Recent Sessions</h4>
        {sessions.length === 0 ? (
          <p className="text-gray-500 text-sm">No sessions found. Play an audio file to start tracking!</p>
        ) : (
          <div className="space-y-2">
            {sessions.slice(0, 5).map((session) => (
              <div key={session.id} className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm">
                <div>
                  <span className="font-medium">Media:</span> {session.media_id?.substring(0, 8)}...
                  <span className="ml-2 text-gray-600">
                    {session.completion_percentage}% complete
                  </span>
                </div>
                <div className="text-gray-500">
                  {new Date(session.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Events */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h4 className="font-semibold mb-3">⚡ Recent Events</h4>
        {events.length === 0 ? (
          <p className="text-gray-500 text-sm">No events tracked yet.</p>
        ) : (
          <div className="space-y-1">
            {events.slice(0, 10).map((event) => (
              <div key={event.id} className="flex justify-between items-center p-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono bg-gray-100 px-1 rounded">{event.event_type}</span>
                  <span className="text-gray-600">@{event.timestamp_seconds}s</span>
                </div>
                <div className="text-gray-500">
                  {new Date(event.created_at).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
        <h4 className="font-semibold text-green-900 mb-2">✅ Tracking System Status</h4>
        <ul className="text-sm text-green-800 space-y-1">
          <li>• <strong>Database tables:</strong> learn_media_sessions, learn_media_playback_events, learn_media_bookmarks</li>
          <li>• <strong>Service layer:</strong> MediaTrackingService ✅</li>
          <li>• <strong>Hook integration:</strong> useMediaTracking ✅</li>
          <li>• <strong>Component:</strong> TrackedAudioPlayer ✅</li>
          <li>• <strong>Usage:</strong> Audio detail pages automatically track playback</li>
        </ul>
        <p className="mt-2 text-sm text-green-700">
          Click on any audio file to go to its detail page and start a tracked session!
        </p>
      </div>
    </div>
  );
}