import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../../../../supabase/types';

type MergeQueueDashboard = Database['public']['Views']['dev_merge_queue_dashboard']['Row'];

interface MergeQueueItemProps {
  item: MergeQueueDashboard;
  onRefresh: () => void;
}

const statusColors = {
  ready: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  merged: 'bg-gray-100 text-gray-600',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-500'
};

const MergeQueueItem: React.FC<MergeQueueItemProps> = ({ item, onRefresh }) => {
  const handleAction = async (action: string) => {
    // In a real implementation, these would trigger the CLI commands via an API
    console.log(`Action: ${action} for branch: ${item.branch_name}`);
    onRefresh();
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">{item.branch_name}</h3>
            <span className={`px-2 py-1 text-xs rounded-full ${statusColors[item.status as keyof typeof statusColors]}`}>
              {item.status}
            </span>
            <span className="text-sm text-gray-500">Priority: {item.priority}</span>
          </div>
          
          {item.task_title && (
            <p className="text-sm text-gray-600 mt-1">Task: {item.task_title}</p>
          )}
          
          <div className="flex items-center gap-4 mt-2 text-sm">
            <span className={`flex items-center gap-1 ${item.unresolved_conflicts > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {item.unresolved_conflicts > 0 ? '⚠' : '✓'} Conflicts: {item.unresolved_conflicts}
            </span>
            <span className="text-gray-600">
              Pre-checks: {item.pre_checks_passed}/{item.pre_checks_passed + item.pre_checks_pending}
            </span>
            {item.status === 'merged' && (
              <span className="text-gray-600">
                Post-checks: {item.post_checks_passed}/{item.post_checks_passed + item.post_checks_pending}
              </span>
            )}
          </div>
          
          {item.merge_started_at && (
            <p className="text-xs text-gray-500 mt-1">
              Merge started: {new Date(item.merge_started_at).toLocaleString()}
            </p>
          )}
        </div>
        
        <div className="flex gap-2">
          {item.status === 'pending' && (
            <>
              <button
                onClick={() => handleAction('run-checks')}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Run Checks
              </button>
              <button
                onClick={() => handleAction('check-conflicts')}
                className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600"
              >
                Check Conflicts
              </button>
            </>
          )}
          {item.status === 'ready' && (
            <button
              onClick={() => handleAction('start-merge')}
              className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
            >
              Start Merge
            </button>
          )}
          {item.status === 'in_progress' && (
            <button
              onClick={() => handleAction('complete-merge')}
              className="px-3 py-1 text-sm bg-purple-500 text-white rounded hover:bg-purple-600"
            >
              Complete
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const MergeQueueDashboard: React.FC = () => {
  const [items, setItems] = useState<MergeQueueDashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const fetchMergeQueue = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('dev_merge_queue_dashboard')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching merge queue:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMergeQueue();
    
    // Set up real-time subscription
    const subscription = supabase
      .channel('merge_queue_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'dev_merge_queue'
      }, () => {
        fetchMergeQueue();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [filter]);

  const statusCounts = items.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Merge Queue Dashboard</h2>
        <p className="text-gray-600">Manage feature branch merging workflow</p>
      </div>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded ${filter === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          All ({items.length})
        </button>
        <button
          onClick={() => setFilter('ready')}
          className={`px-4 py-2 rounded ${filter === 'ready' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          Ready ({statusCounts.ready || 0})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 rounded ${filter === 'pending' ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          Pending ({statusCounts.pending || 0})
        </button>
        <button
          onClick={() => setFilter('in_progress')}
          className={`px-4 py-2 rounded ${filter === 'in_progress' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          In Progress ({statusCounts.in_progress || 0})
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-500">Loading merge queue...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No branches in merge queue</p>
        </div>
      ) : (
        <div>
          {items.map(item => (
            <MergeQueueItem key={item.id} item={item} onRefresh={fetchMergeQueue} />
          ))}
        </div>
      )}

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-gray-700 mb-2">CLI Commands:</h3>
        <pre className="text-xs text-gray-600 overflow-x-auto">
{`# Add branch to queue
./scripts/cli-pipeline/merge/merge-cli.sh queue-add feature/my-feature --priority 5

# Run automated workflow
./scripts/cli-pipeline/merge/automated-merge.sh single feature/my-feature

# Process all ready branches
./scripts/cli-pipeline/merge/automated-merge.sh all-ready`}
        </pre>
      </div>
    </div>
  );
};