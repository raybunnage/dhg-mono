import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export function TrackingStatusIndicator() {
  const [sessionCount, setSessionCount] = useState<number>(0);
  const [recentSession, setRecentSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const checkTrackingStatus = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Get count of user's sessions
        const { data, error } = await supabase
          .from('learn_media_sessions')
          .select('id, created_at, completion_percentage, media_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (!error && data) {
          setSessionCount(data.length);
          if (data.length > 0) {
            setRecentSession(data[0]);
          }
        }
      } catch (error) {
        console.error('Error checking tracking status:', error);
      } finally {
        setLoading(false);
      }
    };

    checkTrackingStatus();
  }, [user]);

  if (!user || loading) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-xs text-gray-600">
      <span className={`w-2 h-2 rounded-full ${sessionCount > 0 ? 'bg-green-500' : 'bg-gray-400'}`}></span>
      <span>
        {sessionCount > 0 ? (
          <>
            Tracking active
            {recentSession && (
              <span className="ml-1 text-gray-500">
                (last: {new Date(recentSession.created_at).toLocaleDateString()})
              </span>
            )}
          </>
        ) : (
          'Click any audio file to start tracking'
        )}
      </span>
    </div>
  );
}