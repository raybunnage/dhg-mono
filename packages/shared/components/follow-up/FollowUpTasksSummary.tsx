import { useState, useEffect } from 'react';
import { FollowUpTaskService, type FollowUpTask } from '../../services/follow-up-task-service';
import { SupabaseClient } from '@supabase/supabase-js';

interface FollowUpTasksSummaryProps {
  taskId?: string;
  workSummaryId?: string;
  className?: string;
  supabaseClient?: SupabaseClient;
}

export function FollowUpTasksSummary({ taskId, workSummaryId, className = '', supabaseClient }: FollowUpTasksSummaryProps) {
  const [followUps, setFollowUps] = useState<FollowUpTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFollowUps = async () => {
      try {
        if (!supabaseClient) {
          setError('No Supabase client provided');
          setLoading(false);
          return;
        }

        setLoading(true);
        setError(null);

        const followUpTaskService = FollowUpTaskService.getInstance(supabaseClient);
        let data: FollowUpTask[] = [];
        if (taskId) {
          data = await followUpTaskService.getFollowUpsForTask(taskId);
        } else if (workSummaryId) {
          data = await followUpTaskService.getFollowUpsForWorkSummary(workSummaryId);
        }

        setFollowUps(data);
      } catch (err) {
        console.error('Error loading follow-ups:', err);
        setError(err instanceof Error ? err.message : 'Failed to load follow-ups');
      } finally {
        setLoading(false);
      }
    };

    if ((taskId || workSummaryId) && supabaseClient) {
      loadFollowUps();
    }
  }, [taskId, workSummaryId, supabaseClient]);

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
        Error loading follow-ups: {error}
      </div>
    );
  }

  if (followUps.length === 0) {
    return null;
  }

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
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <h3 className="text-sm font-semibold text-blue-900">
          Follow-up Tasks ({followUps.length})
        </h3>
      </div>

      <div className="space-y-3">
        {followUps.map((followUp) => (
          <div key={followUp.id} className="bg-white rounded border border-blue-200 p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h4 className="font-medium text-gray-900 text-sm flex-1">
                {followUp.follow_up_title}
              </h4>
              <div className="flex gap-1 flex-shrink-0">
                <span className={`px-2 py-1 text-xs font-medium rounded ${getTypeBadgeColor(followUp.follow_up_type)}`}>
                  {followUp.follow_up_type}
                </span>
                <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusBadgeColor(followUp.follow_up_status)}`}>
                  {followUp.follow_up_status}
                </span>
              </div>
            </div>
            
            {followUp.follow_up_summary && (
              <p className="text-sm text-gray-600 mb-2">
                {followUp.follow_up_summary}
              </p>
            )}
            
            <div className="text-xs text-gray-500">
              Created: {new Date(followUp.created_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-blue-200">
        <p className="text-xs text-blue-700">
          💡 These tasks were created as follow-ups to address implementation, validation, or enhancement needs.
        </p>
      </div>
    </div>
  );
}