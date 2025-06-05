import React, { useState } from 'react';
import type { DevTaskWorkSession } from '../services/task-service';
import { MessageSquare, Clock, FileText, Check, AlertCircle, Plus } from 'lucide-react';

interface TaskIterationTrackerProps {
  workSessions: DevTaskWorkSession[];
  onStartNewSession: () => void;
  onEndSession: (sessionId: string, summary: string) => void;
  currentSessionId?: string;
}

export const TaskIterationTracker: React.FC<TaskIterationTrackerProps> = ({
  workSessions,
  onStartNewSession,
  onEndSession,
  currentSessionId
}) => {
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [sessionSummary, setSessionSummary] = useState('');

  const activeSession = workSessions.find(s => s.id === currentSessionId && !s.ended_at);

  const formatDuration = (start: string, end?: string | null) => {
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const duration = endTime - startTime;
    
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const handleEndSession = () => {
    if (activeSession && sessionSummary.trim()) {
      onEndSession(activeSession.id, sessionSummary);
      setSessionSummary('');
      setShowSessionForm(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Claude Iterations
        </h3>
        {!activeSession && (
          <button
            onClick={onStartNewSession}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            <Plus className="w-4 h-4" />
            Start Session
          </button>
        )}
      </div>

      {/* Active Session */}
      {activeSession && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="font-medium text-blue-800">Active Session</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-blue-700">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Started {new Date(activeSession.started_at || '').toLocaleTimeString()}
                </span>
                <span>Duration: {formatDuration(activeSession.started_at || '')}</span>
              </div>
            </div>
          </div>
          
          {!showSessionForm ? (
            <button
              onClick={() => setShowSessionForm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <Check className="w-4 h-4" />
              End Session
            </button>
          ) : (
            <div className="space-y-3">
              <textarea
                value={sessionSummary}
                onChange={(e) => setSessionSummary(e.target.value)}
                placeholder="Summarize what was accomplished in this session..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleEndSession}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Save & End
                </button>
                <button
                  onClick={() => {
                    setShowSessionForm(false);
                    setSessionSummary('');
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Session History */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700">Session History</h4>
        {workSessions.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            No sessions yet. Start a session to track your iterations with Claude.
          </p>
        ) : (
          <div className="space-y-2">
            {workSessions
              .filter(s => s.id !== activeSession?.id)
              .sort((a, b) => new Date(b.started_at || '').getTime() - new Date(a.started_at || '').getTime())
              .map((session, index) => (
                <div
                  key={session.id}
                  className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">
                          Session {workSessions.length - index}
                        </span>
                        {session.ended_at && (
                          <span className="text-xs text-gray-500">
                            {formatDuration(session.started_at || '', session.ended_at)}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(session.started_at || '').toLocaleString()}
                      </div>
                    </div>
                  </div>
                  
                  {session.summary && (
                    <p className="text-sm text-gray-700 mt-2">{session.summary}</p>
                  )}
                  
                  {session.files_modified && session.files_modified.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-gray-600 mb-1">Files Modified:</p>
                      <div className="flex flex-wrap gap-1">
                        {session.files_modified.map((file, idx) => (
                          <code key={idx} className="text-xs bg-gray-200 px-2 py-0.5 rounded">
                            {file.split('/').pop()}
                          </code>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {session.claude_session_id && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500">
                        Claude Session: <code className="bg-gray-200 px-1 py-0.5 rounded">{session.claude_session_id.slice(0, 8)}...</code>
                      </p>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
      
      {/* Tips */}
      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-600">
            <p className="font-medium mb-1">Iteration Tips:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Start a session when you begin working with Claude</li>
              <li>End the session with a summary after each iteration</li>
              <li>This helps track progress through multiple rounds of changes</li>
              <li>Sessions automatically capture the Claude conversation ID when available</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};