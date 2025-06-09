import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { TaskService } from '../services/task-service';
import type { DevTask } from '../services/task-service';
import { Plus, Eye, EyeOff, Search } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { TaskCard } from '../components/TaskCard';
import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';

const supabase = createSupabaseAdapter({ env: import.meta.env as any });

interface WorktreeDefinition {
  id: string;
  path: string;
  alias_name: string;
  alias_number: string;
  emoji: string;
  description: string | null;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<DevTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [appFilter, setAppFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState(''); // Separate state for input
  const [completionFilter, setCompletionFilter] = useState<'all' | 'completed' | 'unfinished'>('unfinished'); // 3-state filter
  const [worktreeFilter, setWorktreeFilter] = useState<string>('');
  const [worktrees, setWorktrees] = useState<WorktreeDefinition[]>([]);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadTasks();
    loadWorktrees();
  }, [statusFilter, priorityFilter, appFilter, searchQuery, worktreeFilter]);

  // Handle search input with debounce
  const handleSearchInputChange = useCallback((value: string) => {
    setSearchInput(value);
    
    // Clear existing timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    // Set new timer for debounced search
    const newTimer = setTimeout(() => {
      setSearchQuery(value);
    }, 500); // 500ms delay
    
    setDebounceTimer(newTimer);
  }, [debounceTimer]);

  // Handle immediate search on Enter key or button click
  const handleSearchSubmit = useCallback(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      setDebounceTimer(null);
    }
    setSearchQuery(searchInput);
  }, [searchInput, debounceTimer]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

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

  const loadWorktrees = async () => {
    try {
      const { data, error } = await supabase
        .from('worktree_definitions')
        .select('*')
        .order('alias_number');
      
      if (error) throw error;
      if (data) {
        setWorktrees(data);
      }
    } catch (err) {
      console.error('Failed to load worktrees:', err);
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

      {/* Worktree Pills */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">Worktrees:</span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setWorktreeFilter('')}
              className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                worktreeFilter === ''
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Tasks
              {worktreeFilter === '' && (
                <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-gray-800 bg-gray-200 rounded-full">
                  {tasks.filter(t => {
                    if (completionFilter === 'completed') return t.status === 'completed' || t.status === 'merged';
                    if (completionFilter === 'unfinished') return t.status !== 'completed' && t.status !== 'merged';
                    return true;
                  }).length}
                </span>
              )}
            </button>
            
            {worktrees.map((worktree) => {
              const worktreeTasks = tasks.filter(t => t.worktree_path === worktree.path);
              const taskCount = worktreeTasks.filter(t => {
                if (completionFilter === 'completed') return t.status === 'completed' || t.status === 'merged';
                if (completionFilter === 'unfinished') return t.status !== 'completed' && t.status !== 'merged';
                return true; // 'all'
              }).length;
              const isActive = worktreeFilter === worktree.path;
              
              return (
                <button
                  key={worktree.id}
                  onClick={() => setWorktreeFilter(worktree.path)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-purple-600 text-white'
                      : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                  }`}
                  title={worktree.description || `Worktree: ${worktree.path}`}
                >
                  <span>{worktree.emoji}</span>
                  <span>{worktree.alias_name}</span>
                  {taskCount > 0 && (
                    <span className={`ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none rounded-full ${
                      isActive ? 'text-purple-600 bg-purple-200' : 'text-purple-200 bg-purple-600'
                    }`}>
                      {taskCount}
                    </span>
                  )}
                </button>
              );
            })}
            
            {/* Show unassigned tasks pill */}
            {(() => {
              const unassignedTasks = tasks.filter(t => !t.worktree_path);
              const unassignedCount = unassignedTasks.filter(t => {
                if (completionFilter === 'completed') return t.status === 'completed' || t.status === 'merged';
                if (completionFilter === 'unfinished') return t.status !== 'completed' && t.status !== 'merged';
                return true;
              }).length;
              if (unassignedCount > 0) {
                return (
                  <button
                    onClick={() => setWorktreeFilter('unassigned')}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      worktreeFilter === 'unassigned'
                        ? 'bg-orange-600 text-white'
                        : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                    }`}
                    title="Tasks without worktree assignment"
                  >
                    <span>❓</span>
                    <span>Unassigned</span>
                    <span className={`ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none rounded-full ${
                      worktreeFilter === 'unassigned' ? 'text-orange-600 bg-orange-200' : 'text-orange-200 bg-orange-600'
                    }`}>
                      {unassignedCount}
                    </span>
                  </button>
                );
              }
              return null;
            })()}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => handleSearchInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearchSubmit();
                  }
                }}
                placeholder="Search tasks..."
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={handleSearchSubmit}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="Search now"
              >
                <Search className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Press Enter or click search icon to search immediately</p>
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
                  setCompletionFilter('completed');
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
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setCompletionFilter('unfinished')}
                className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                  completionFilter === 'unfinished'
                    ? 'bg-white text-blue-700 shadow'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                title="Show unfinished tasks only"
              >
                Unfinished
              </button>
              <button
                onClick={() => setCompletionFilter('completed')}
                className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                  completionFilter === 'completed'
                    ? 'bg-white text-green-700 shadow'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                title="Show completed tasks only"
              >
                Completed
              </button>
              <button
                onClick={() => setCompletionFilter('all')}
                className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                  completionFilter === 'all'
                    ? 'bg-white text-gray-700 shadow'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                title="Show all tasks"
              >
                All
              </button>
            </div>
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchInput('');
                setStatusFilter('');
                setPriorityFilter('');
                setAppFilter('');
                setWorktreeFilter('');
              }}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {(() => {
          // Apply client-side filtering for completed tasks
          let filteredTasks = tasks;
          
          // Apply worktree filter
          if (worktreeFilter === 'unassigned') {
            filteredTasks = filteredTasks.filter(task => !task.worktree_path);
          } else if (worktreeFilter) {
            filteredTasks = filteredTasks.filter(task => task.worktree_path === worktreeFilter);
          }
          
          // Apply completion filter
          if (completionFilter === 'completed') {
            filteredTasks = filteredTasks.filter(task => task.status === 'completed' || task.status === 'merged');
          } else if (completionFilter === 'unfinished') {
            filteredTasks = filteredTasks.filter(task => task.status !== 'completed' && task.status !== 'merged');
          }
          // 'all' shows everything - no additional filtering needed
          
          if (filteredTasks.length === 0) {
            return (
              <div className="p-8 text-center text-gray-500">
                <p>
                  {completionFilter === 'completed' 
                    ? 'No completed tasks found.'
                    : completionFilter === 'unfinished'
                    ? 'No unfinished tasks found. Great job!'
                    : 'No tasks found. Create your first task to get started!'}
                </p>
              </div>
            );
          }
          
          return (
            <div className="divide-y divide-gray-200">
              {filteredTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          );
        })()}
      </div>
    </div>
    </DashboardLayout>
  );
}