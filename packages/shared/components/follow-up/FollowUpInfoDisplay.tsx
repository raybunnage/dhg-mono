import { useState, useEffect } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';

interface FollowUpRelationship {
  id: string;
  original_task_id?: string;
  original_work_summary_id?: string;
  follow_up_type: string;
  follow_up_summary?: string;
  created_at: string;
}

interface FollowUpInfoDisplayProps {
  taskId: string;
  className?: string;
  supabaseClient: SupabaseClient;
}

export function FollowUpInfoDisplay({ taskId, className = '', supabaseClient }: FollowUpInfoDisplayProps) {
  const [followUpInfo, setFollowUpInfo] = useState<FollowUpRelationship | null>(null);
  const [originalItem, setOriginalItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFollowUpInfo = async () => {
      try {
        setLoading(true);
        setError(null);

        const supabase = supabaseClient;

        // Check if this task is a follow-up by querying the follow-up table
        const { data: followUps, error: followUpError } = await supabase
          .from('dev_follow_up_tasks')
          .select('*')
          .eq('follow_up_task_id', taskId)
          .single();

        if (followUpError && followUpError.code !== 'PGRST116') { // PGRST116 = no rows found
          throw followUpError;
        }

        if (followUps) {
          setFollowUpInfo(followUps);

          // Load the original item
          if (followUps.original_task_id) {
            const { data: originalTask, error: origError } = await supabase
              .from('dev_tasks')
              .select('id, title, status, created_at')
              .eq('id', followUps.original_task_id)
              .single();

            if (!origError && originalTask) {
              setOriginalItem({ ...originalTask, type: 'task' });
            }
          } else if (followUps.original_work_summary_id) {
            const { data: originalSummary, error: origError } = await supabase
              .from('ai_work_summaries')
              .select('id, title, status, created_at')
              .eq('id', followUps.original_work_summary_id)
              .single();

            if (!origError && originalSummary) {
              setOriginalItem({ ...originalSummary, type: 'work_summary' });
            }
          }
        }
      } catch (err) {
        console.error('Error loading follow-up info:', err);
        setError(err instanceof Error ? err.message : 'Failed to load follow-up info');
      } finally {
        setLoading(false);
      }
    };

    loadFollowUpInfo();
  }, [taskId]);

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-red-600 text-sm ${className}`}>
        Error loading follow-up info: {error}
      </div>
    );
  }

  if (!followUpInfo) {
    return null;
  }

  const getTypeBadgeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'implementation':
        return 'bg-purple-100 text-purple-800';
      case 'validation':
        return 'bg-green-100 text-green-800';
      case 'enhancement':
        return 'bg-blue-100 text-blue-800';
      case 'bugfix':
        return 'bg-red-100 text-red-800';
      case 'documentation':
        return 'bg-yellow-100 text-yellow-800';
      case 'testing':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
      case 'in-progress':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className={`bg-amber-50 border border-amber-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <h3 className="text-sm font-semibold text-amber-900">
          Follow-up Task
        </h3>
        <span className={`px-2 py-1 text-xs font-medium rounded ${getTypeBadgeColor(followUpInfo.follow_up_type)}`}>
          {followUpInfo.follow_up_type}
        </span>
      </div>

      {originalItem && (
        <div className="bg-white rounded border border-amber-200 p-3 mb-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1">
              <div className="text-xs text-gray-500 mb-1">
                Original {originalItem.type === 'task' ? 'Task' : 'Work Summary'}:
              </div>
              <h4 className="font-medium text-gray-900 text-sm">
                {originalItem.title}
              </h4>
            </div>
            <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusBadgeColor(originalItem.status)}`}>
              {originalItem.status}
            </span>
          </div>
          
          <div className="text-xs text-gray-500">
            Created: {new Date(originalItem.created_at).toLocaleDateString()}
          </div>
        </div>
      )}

      {followUpInfo.follow_up_summary && (
        <div className="mb-3">
          <div className="text-xs text-amber-700 font-medium mb-1">Summary:</div>
          <p className="text-sm text-amber-800">
            {followUpInfo.follow_up_summary}
          </p>
        </div>
      )}

      <div className="text-xs text-amber-700">
        💡 This task was created as a follow-up to address specific implementation needs.
      </div>
    </div>
  );
}