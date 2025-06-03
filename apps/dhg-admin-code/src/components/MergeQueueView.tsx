import React, { useState, useEffect } from 'react';
import { GitBranch, GitMerge, AlertCircle, CheckCircle, Clock, ChevronRight, RefreshCw, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { MergeStatusBadge } from './MergeStatusBadge';
import { BranchMergeCard } from './BranchMergeCard';

export interface MergeQueueItem {
  id: string;
  branch_name: string;
  worktree_path?: string;
  source_branch: string;
  merge_status: 'pending' | 'ready' | 'in_progress' | 'merged' | 'failed' | 'conflicts';
  priority: number;
  task_ids?: string[];
  conflicts_detected: boolean;
  conflict_details?: any;
  tests_passed?: boolean;
  last_updated_from_source?: string;
  merge_started_at?: string;
  merge_completed_at?: string;
  merge_commit_sha?: string;
  created_at: string;
  updated_at: string;
  notes?: string;
  checklist?: MergeChecklistItem[];
  dependencies?: MergeDependency[];
}

export interface MergeChecklistItem {
  id: string;
  check_type: string;
  status: 'pending' | 'passed' | 'failed' | 'skipped';
  executed_at?: string;
  result?: any;
}

export interface MergeDependency {
  id: string;
  depends_on_branch: string;
  dependency_type: 'must_merge_first' | 'should_merge_first' | 'test_together';
}

interface MergeQueueViewProps {
  taskId?: string;
  onMergeComplete?: () => void;
}

export function MergeQueueView({ taskId, onMergeComplete }: MergeQueueViewProps) {
  const [mergeQueue, setMergeQueue] = useState<MergeQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadMergeQueue();
  }, [taskId]);

  const loadMergeQueue = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('dev_merge_queue')
        .select(`
          *,
          dev_merge_checklist (
            id,
            check_type,
            status,
            executed_at,
            result
          ),
          dev_merge_dependencies (
            id,
            depends_on_branch,
            dependency_type
          )
        `)
        .not('merge_status', 'eq', 'merged')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true });

      if (taskId) {
        query = query.contains('task_ids', [taskId]);
      }

      const { data, error } = await query;
      if (error) throw error;

      const formattedData = data?.map(item => ({
        ...item,
        checklist: item.dev_merge_checklist || [],
        dependencies: item.dev_merge_dependencies || []
      })) || [];

      setMergeQueue(formattedData);
    } catch (error) {
      console.error('Error loading merge queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshStatus = async (branchName: string) => {
    setRefreshing(true);
    try {
      // This would call your CLI command via an API endpoint
      // For now, just reload the data
      await loadMergeQueue();
    } finally {
      setRefreshing(false);
    }
  };

  const getNextCandidate = () => {
    return mergeQueue.find(item => 
      item.merge_status === 'ready' && 
      !item.dependencies?.some(dep => 
        mergeQueue.some(other => 
          other.branch_name === dep.depends_on_branch && 
          other.merge_status !== 'merged'
        )
      )
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const nextCandidate = getNextCandidate();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <GitMerge className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold">Merge Queue</h3>
            <span className="text-sm text-gray-500">({mergeQueue.length} branches)</span>
          </div>
          <button
            onClick={() => loadMergeQueue()}
            disabled={refreshing}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {mergeQueue.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <GitBranch className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No branches in merge queue</p>
          </div>
        ) : (
          <div className="space-y-3">
            {nextCandidate && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-2 text-green-700">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Next merge candidate:</span>
                  <span className="font-mono text-sm">{nextCandidate.branch_name}</span>
                </div>
              </div>
            )}

            {mergeQueue.map((item) => (
              <BranchMergeCard
                key={item.id}
                item={item}
                isExpanded={selectedBranch === item.branch_name}
                onToggle={() => setSelectedBranch(
                  selectedBranch === item.branch_name ? null : item.branch_name
                )}
                onRefresh={() => refreshStatus(item.branch_name)}
                isNextCandidate={nextCandidate?.id === item.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Merge Workflow Commands</h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-center space-x-2">
            <code className="bg-gray-200 px-2 py-1 rounded">./worktree-cli.sh merge-status --all</code>
            <span className="text-gray-600">Check all branches</span>
          </div>
          <div className="flex items-center space-x-2">
            <code className="bg-gray-200 px-2 py-1 rounded">./worktree-cli.sh prepare-merge</code>
            <span className="text-gray-600">Prepare current branch</span>
          </div>
          <div className="flex items-center space-x-2">
            <code className="bg-gray-200 px-2 py-1 rounded">./worktree-cli.sh execute-merge</code>
            <span className="text-gray-600">Merge next ready branch</span>
          </div>
        </div>
      </div>
    </div>
  );
}