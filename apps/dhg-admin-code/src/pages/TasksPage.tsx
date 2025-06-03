import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TaskService } from '../services/task-service';
import type { DevTask } from '../services/task-service';
import { Plus, ChevronRight, Clock, CheckCircle, AlertCircle, Eye, EyeOff, GitBranch, FolderOpen, GitMerge } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { useMergeQueue } from '../hooks/useMergeQueue';
import { MergeStatusBadge } from '../components/MergeStatusBadge';

export default function TasksPage() {
  const [tasks, setTasks] = useState<DevTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [appFilter, setAppFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCompleted, setShowCompleted] = useState(false); // Default to hiding completed tasks
  
  const { items: mergeQueueItems, getNextCandidate } = useMergeQueue();

  useEffect(() => {
    loadTasks();
  }, [statusFilter, priorityFilter, appFilter, searchQuery]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      if (statusFilter) filters.status = statusFilter;
      if (priorityFilter) filters.priority = priorityFilter;
      if (appFilter) filters.app = appFilter;
      if (searchQuery) filters.search = searchQuery;
      
      const data = await TaskService.getTasks(filters);
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-gray-500" />;
      case 'in_progress':
        return <AlertCircle className="w-4 h-4 text-blue-500" />;
      case 'testing':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'revision':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'merged':
        return <CheckCircle className="w-4 h-4 text-purple-500" />;
      case 'cancelled':
        return <Clock className="w-4 h-4 text-gray-400" />;
      default:
        return null;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'testing':
        return 'bg-yellow-100 text-yellow-800';
      case 'revision':
        return 'bg-orange-100 text-orange-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'merged':
        return 'bg-purple-100 text-purple-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-400';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case 'low':
        return 'bg-gray-100 text-gray-600';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'high':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'bug':
        return 'bg-red-50 text-red-700';
      case 'feature':
        return 'bg-purple-50 text-purple-700';
      case 'refactor':
        return 'bg-blue-50 text-blue-700';
      case 'question':
        return 'bg-orange-50 text-orange-700';
      default:
        return 'bg-gray-50 text-gray-700';
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error: {error}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Claude Code Tasks</h1>
        <Link
          to="/tasks/new"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Task
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                // If user selects "completed" status, automatically show completed tasks
                if (e.target.value === 'completed') {
                  setShowCompleted(true);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="testing">Testing</option>
              <option value="revision">Revision</option>
              <option value="completed">Completed</option>
              <option value="merged">Merged</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Priority
            </label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              App/Pipeline
            </label>
            <select
              value={appFilter}
              onChange={(e) => setAppFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Apps</option>
              {/* Get unique apps from tasks */}
              {Array.from(new Set(tasks.map(t => t.app).filter(Boolean))).sort().map(app => (
                <option key={app} value={app}>{app}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 lg:col-span-1 flex items-end gap-2 flex-wrap">
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-colors ${
                showCompleted 
                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title={showCompleted ? 'Hide completed tasks' : 'Show completed tasks'}
            >
              {showCompleted ? (
                <>
                  <Eye className="w-4 h-4" />
                  <span>Hide Completed</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4" />
                  <span>Show Completed</span>
                  {(() => {
                    const completedCount = tasks.filter(t => t.status === 'completed').length;
                    return completedCount > 0 ? (
                      <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-200 text-gray-600 rounded-full">
                        {completedCount}
                      </span>
                    ) : null;
                  })()}
                </>
              )}
            </button>
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('');
                setPriorityFilter('');
                setAppFilter('');
              }}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Merge Queue Summary */}
      {mergeQueueItems.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <GitMerge className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Merge Queue</h2>
              <span className="text-sm text-gray-600">({mergeQueueItems.length} branches)</span>
            </div>
            <Link
              to="/merge-queue"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View Full Queue →
            </Link>
          </div>
          
          <div className="mt-3 flex flex-wrap gap-2">
            {mergeQueueItems.slice(0, 5).map((item) => (
              <div key={item.id} className="flex items-center space-x-2 bg-white rounded-lg px-3 py-2 shadow-sm">
                <GitBranch className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-mono text-gray-700">{item.branch_name}</span>
                <MergeStatusBadge status={item.merge_status} size="sm" showIcon={false} />
              </div>
            ))}
            {mergeQueueItems.length > 5 && (
              <div className="flex items-center px-3 py-2">
                <span className="text-sm text-gray-500">+{mergeQueueItems.length - 5} more</span>
              </div>
            )}
          </div>
          
          {(() => {
            const nextCandidate = getNextCandidate();
            return nextCandidate ? (
              <div className="mt-3 p-3 bg-green-100 rounded-lg">
                <p className="text-sm text-green-800">
                  <span className="font-medium">Next to merge:</span> {nextCandidate.branch_name}
                </p>
              </div>
            ) : (
              <div className="mt-3 p-3 bg-yellow-100 rounded-lg">
                <p className="text-sm text-yellow-800">
                  No branches ready to merge. Run prepare-merge on pending branches.
                </p>
              </div>
            );
          })()}
        </div>
      )}

      {/* Task List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {(() => {
          // Apply client-side filtering for completed tasks
          let filteredTasks = tasks;
          
          // If status filter is explicitly set to "completed", show only completed tasks
          // Otherwise, respect the showCompleted toggle
          if (statusFilter !== 'completed' && !showCompleted) {
            filteredTasks = filteredTasks.filter(task => task.status !== 'completed');
          }
          
          const completedCount = tasks.filter(task => task.status === 'completed').length;
          const hiddenCompletedCount = !showCompleted && statusFilter !== 'completed' ? completedCount : 0;
          
          if (filteredTasks.length === 0) {
            return (
              <div className="p-8 text-center text-gray-500">
                <p>
                  {hiddenCompletedCount > 0 
                    ? `No active tasks found. ${hiddenCompletedCount} completed task${hiddenCompletedCount !== 1 ? 's' : ''} hidden.`
                    : 'No tasks found. Create your first task to get started!'}
                </p>
              </div>
            );
          }
          
          return (
            <div className="divide-y divide-gray-200">
              {filteredTasks.map((task) => (
              <Link
                key={task.id}
                to={`/tasks/${task.id}`}
                className="block hover:bg-gray-50 transition-colors"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusIcon(task.status)}
                        <h3 className="text-lg font-medium text-gray-900">
                          {task.title}
                        </h3>
                      </div>
                      <p className="text-gray-600 line-clamp-2 mb-2">
                        {task.description}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeBadgeClass(task.task_type)}`}>
                          {task.task_type}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(task.status)}`}>
                          {task.status.replace('_', ' ')}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityBadgeClass(task.priority)}`}>
                          {task.priority}
                        </span>
                        {task.app && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                            {task.app}
                          </span>
                        )}
                        {task.git_branch && (
                          <>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                              <GitBranch className="w-3 h-3" />
                              {task.git_branch}
                            </span>
                            {(() => {
                              const queueItem = mergeQueueItems.find(item => 
                                item.branch_name === task.git_branch || 
                                (item.task_ids && item.task_ids.includes(task.id))
                              );
                              return queueItem ? (
                                <MergeStatusBadge status={queueItem.merge_status} size="sm" />
                              ) : null;
                            })()}
                          </>
                        )}
                        {task.worktree_active && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700" title={`Worktree: ${task.worktree_path}`}>
                            <FolderOpen className="w-3 h-3" />
                            Worktree
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          Created {new Date(task.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 mt-1" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
          );
        })()}
      </div>
    </div>
    </DashboardLayout>
  );
}