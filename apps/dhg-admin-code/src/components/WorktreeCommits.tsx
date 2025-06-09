import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';

const supabase = createSupabaseAdapter({ env: import.meta.env as any });

interface Commit {
  hash: string;
  subject: string;
  authorName: string;
  authorEmail: string;
  relativeTime: string;
  date: string;
  taskId: string | null;
}

interface WorktreeCommitsResponse {
  worktreePath: string;
  branch: string;
  commits: Commit[];
  totalCommits: number;
}

interface Task {
  id: string;
  title: string;
  status: string;
  type: string;
}

interface WorktreeCommitsProps {
  worktreePath: string;
  onClose: () => void;
}

export function WorktreeCommits({ worktreePath, onClose }: WorktreeCommitsProps) {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [branch, setBranch] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taskMap, setTaskMap] = useState<Map<string, Task>>(new Map());
  const [expandedCommits, setExpandedCommits] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadCommits();
  }, [worktreePath]);

  const loadCommits = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch commits from git server
      const response = await fetch(
        `http://localhost:3005/api/git/worktree-commits/${encodeURIComponent(worktreePath)}?limit=100`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch commits');
      }

      const data: WorktreeCommitsResponse = await response.json();
      setCommits(data.commits);
      setBranch(data.branch);

      // Collect all task IDs
      const taskIds = data.commits
        .filter(commit => commit.taskId)
        .map(commit => commit.taskId as string);

      if (taskIds.length > 0) {
        // Fetch task details from database
        const { data: tasks, error: taskError } = await supabase
          .from('dev_tasks')
          .select('id, title, status, type')
          .in('id', taskIds);

        if (taskError) {
          console.error('Error fetching tasks:', taskError);
        } else if (tasks) {
          const map = new Map<string, Task>();
          tasks.forEach(task => {
            map.set(task.id, task);
          });
          setTaskMap(map);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load commits');
    } finally {
      setLoading(false);
    }
  };

  const toggleCommitExpanded = (hash: string) => {
    const newExpanded = new Set(expandedCommits);
    if (newExpanded.has(hash)) {
      newExpanded.delete(hash);
    } else {
      newExpanded.add(hash);
    }
    setExpandedCommits(newExpanded);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'in_progress':
        return 'text-blue-600 bg-blue-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      case 'blocked':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'bug':
        return '🐛';
      case 'feature':
        return '✨';
      case 'refactor':
        return '♻️';
      case 'docs':
        return '📝';
      case 'test':
        return '🧪';
      case 'chore':
        return '🔧';
      default:
        return '📋';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading commits...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white rounded-lg p-6 max-w-5xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Worktree Commits</h2>
            <p className="text-sm text-gray-600 mt-1">
              {worktreePath.split('/').pop()} • {branch}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Showing {commits.length} most recent commits
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {/* Commits list */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {commits.map((commit) => {
            const task = commit.taskId ? taskMap.get(commit.taskId) : null;
            const isExpanded = expandedCommits.has(commit.hash);

            return (
              <div 
                key={commit.hash} 
                className={`bg-gray-50 rounded-lg p-4 transition-all ${
                  isExpanded ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                <div 
                  className="flex items-start justify-between cursor-pointer"
                  onClick={() => toggleCommitExpanded(commit.hash)}
                >
                  <div className="flex-1">
                    {/* Commit subject and hash */}
                    <div className="flex items-start space-x-3">
                      <code className="text-xs font-mono text-gray-500 mt-0.5">
                        {commit.hash.substring(0, 7)}
                      </code>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {commit.subject}
                        </p>
                        
                        {/* Author and time */}
                        <p className="text-xs text-gray-600 mt-1">
                          {commit.authorName} • {commit.relativeTime}
                        </p>
                        
                        {/* Task information */}
                        {task && (
                          <div className="mt-2 flex items-center space-x-2">
                            <span className="text-xs text-gray-500">Task:</span>
                            <span className="text-lg">{getTypeIcon(task.type)}</span>
                            <span className="text-sm font-medium text-gray-900">
                              {task.title}
                            </span>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                              getStatusColor(task.status)
                            }`}>
                              {task.status.replace('_', ' ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Expand/collapse indicator */}
                  <div className="ml-4 text-gray-400">
                    <svg 
                      className={`w-5 h-5 transform transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                
                {/* Expanded details */}
                {isExpanded && (
                  <div className="mt-4 pl-10 space-y-2 text-sm">
                    <div className="flex space-x-4">
                      <span className="text-gray-500">Full hash:</span>
                      <code className="font-mono text-xs">{commit.hash}</code>
                    </div>
                    <div className="flex space-x-4">
                      <span className="text-gray-500">Date:</span>
                      <span>{format(new Date(commit.date), 'PPpp')}</span>
                    </div>
                    <div className="flex space-x-4">
                      <span className="text-gray-500">Author:</span>
                      <span>{commit.authorName} &lt;{commit.authorEmail}&gt;</span>
                    </div>
                    {commit.taskId && (
                      <div className="flex space-x-4">
                        <span className="text-gray-500">Task ID:</span>
                        <code className="font-mono text-xs">{commit.taskId}</code>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-between items-center">
          <button
            onClick={loadCommits}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            🔄 Refresh
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}