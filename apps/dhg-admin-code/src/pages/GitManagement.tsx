import React, { useState, useEffect } from 'react';
import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';
import { format } from 'date-fns';
import { DashboardLayout } from '../components/DashboardLayout';
import { getWorktreeAliasInfo } from '../utils/worktree-alias-mapping';
import { WorktreeCommits } from '../components/WorktreeCommits';

// Create supabase client with environment variables
const supabase = createSupabaseAdapter({ env: import.meta.env as any });

interface Worktree {
  path: string;
  branch: string;
  commit?: string;
  lastCommit?: {
    hash: string;
    message: string;
    relativeTime: string;
    author: string;
  };
  uncommittedChanges?: number;
  ahead?: number;
  behind?: number;
  needsAttention?: boolean;
  activeTasks?: number;
}

interface MergeQueueItem {
  id: string;
  branch_name: string;
  worktree_path?: string;
  source_branch: string;
  merge_status: 'pending' | 'ready' | 'in_progress' | 'merged' | 'failed' | 'conflicts';
  priority: number;
  task_ids?: string[];
  conflicts_detected: boolean;
  tests_passed?: boolean;
  last_updated_from_source?: string;
  merge_started_at?: string;
  merge_completed_at?: string;
  merge_commit_sha?: string;
  created_at: string;
  notes?: string;
}

interface MergeChecklistItem {
  id: string;
  merge_queue_id: string;
  check_type: string;
  status: 'pending' | 'passed' | 'failed' | 'skipped';
  executed_at?: string;
  result?: any;
}

interface DevTask {
  id: string;
  title: string;
  branch_name?: string;
  worktree_path?: string;
  worktree_active?: boolean;
  work_mode?: string;
  status: string;
}

interface Branch {
  name: string;
  fullName: string;
  isRemote: boolean;
  isCurrent: boolean;
  isMerged: boolean;
  lastCommit: {
    date: string;
    author: string;
    message: string;
  };
  hasUpstream?: boolean;
  ahead?: number;
  behind?: number;
  ageInDays?: number;
  canDelete?: boolean;
  suggestCleanup?: boolean;
}

type TabType = 'worktrees' | 'branches' | 'merge-queue' | 'merge-history';

export function GitManagement() {
  const [activeTab, setActiveTab] = useState<TabType>('worktrees');
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [mergeQueue, setMergeQueue] = useState<MergeQueueItem[]>([]);
  const [mergeHistory, setMergeHistory] = useState<MergeQueueItem[]>([]);
  const [activeTasks, setActiveTasks] = useState<DevTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMerge, setSelectedMerge] = useState<MergeQueueItem | null>(null);
  const [mergeChecklist, setMergeChecklist] = useState<MergeChecklistItem[]>([]);
  const [showAddToQueue, setShowAddToQueue] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<Set<string>>(new Set());
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [branchFilter, setBranchFilter] = useState<'all' | 'cleanup' | 'merged' | 'unmerged'>('all');
  const [selectedWorktreeForCommits, setSelectedWorktreeForCommits] = useState<string | null>(null);

  // Function to execute CLI commands
  const executeCliCommand = async (command: string): Promise<string> => {
    try {
      const response = await fetch('/api/execute-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });
      
      if (!response.ok) {
        throw new Error('Command execution failed');
      }
      
      const result = await response.json();
      return result.output;
    } catch (error) {
      console.error('Failed to execute command:', error);
      throw error;
    }
  };

  // Refresh worktrees using git server
  const handleRefreshWorktrees = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('http://localhost:3005/api/git/worktrees');
      if (!response.ok) {
        throw new Error('Failed to fetch worktrees');
      }
      
      const data = await response.json();
      if (data.worktrees) {
        // Update worktrees with the fetched data
        const enhancedWorktrees = data.worktrees.map((wt: any) => ({
          ...wt,
          activeTasks: activeTasks?.filter(task => 
            task.worktree_path?.includes(wt.path.split('/').pop() || '')
          ).length || 0
        }));
        setWorktrees(enhancedWorktrees);
      }
    } catch (error) {
      console.error('Failed to refresh worktrees:', error);
      // Fall back to hardcoded data if server is not running
      await loadData();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Hardcoded worktrees for now (would come from git CLI in real implementation)
  const defaultWorktrees: Worktree[] = [
    { path: '/Users/raybunnage/Documents/github/dhg-mono', branch: 'development' },
    { path: '/Users/raybunnage/Documents/github/dhg-mono-admin-code', branch: 'feature/improve-prompt-service-add-page' },
    { path: '/Users/raybunnage/Documents/github/dhg-mono-dhg-hub', branch: 'feature/improve-dhg-hub' },
    { path: '/Users/raybunnage/Documents/github/dhg-mono-dhg-mono-admin-google', branch: 'feature/dhg-admin-google-next-task' },
    { path: '/Users/raybunnage/Documents/github/dhg-mono-dhg-mono-audio', branch: 'feature/audio-improvement' },
    { path: '/Users/raybunnage/Documents/github/dhg-mono-feature/dhg-mono-docs', branch: 'feature/continuous-documentation-archiving' },
    { path: '/Users/raybunnage/Documents/github/dhg-mono-gmail-cli-pipeline-research-app', branch: 'gmail-cli-pipeline-research-app' },
    { path: '/Users/raybunnage/Documents/github/dhg-mono-improve-cli-pipelines', branch: 'improve-cli-pipelines' },
    { path: '/Users/raybunnage/Documents/github/dhg-mono-integration-bug-fixes-tweaks', branch: 'integration/bug-fixes-tweaks' },
  ];

  // Load data function
  const loadData = async () => {
      try {
        setLoading(true);

        // Load merge queue
        const { data: queueData, error: queueError } = await supabase
          .from('dev_merge_queue')
          .select('*')
          .order('priority', { ascending: false })
          .order('created_at', { ascending: true });

        if (queueError) throw queueError;

        // Separate active queue from history
        const active = queueData?.filter(item => 
          ['pending', 'ready', 'in_progress', 'conflicts'].includes(item.merge_status)
        ) || [];
        const history = queueData?.filter(item => 
          ['merged', 'failed'].includes(item.merge_status)
        ) || [];

        setMergeQueue(active);
        setMergeHistory(history);

        // Load active tasks with worktrees
        const { data: tasksData, error: tasksError } = await supabase
          .from('dev_tasks')
          .select('*')
          .not('worktree_path', 'is', null)
          .eq('status', 'in_progress');

        if (tasksError) throw tasksError;
        setActiveTasks(tasksData || []);

        // Try to fetch worktrees from git server first
        let worktreesToUse = defaultWorktrees;
        try {
          const response = await fetch('http://localhost:3005/api/git/worktrees');
          if (response.ok) {
            const data = await response.json();
            if (data.worktrees && data.worktrees.length > 0) {
              worktreesToUse = data.worktrees;
            }
          }
        } catch (fetchError) {
          console.log('Git server not available, using default worktrees');
        }

        // Enhance worktrees with task counts
        const enhancedWorktrees = worktreesToUse.map(wt => ({
          ...wt,
          activeTasks: tasksData?.filter(task => 
            task.worktree_path?.includes(wt.path.split('/').pop() || '')
          ).length || 0
        }));

        setWorktrees(enhancedWorktrees);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
  };

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Load branches function
  const loadBranches = async () => {
    setIsLoadingBranches(true);
    try {
      const response = await fetch('http://localhost:3005/api/git/branches');
      if (!response.ok) {
        throw new Error('Failed to fetch branches');
      }
      
      const data = await response.json();
      setBranches(data.branches || []);
    } catch (error) {
      console.error('Failed to load branches:', error);
      setError('Failed to load branches. Make sure the git server is running.');
    } finally {
      setIsLoadingBranches(false);
    }
  };

  // Load branches when branches tab is active
  useEffect(() => {
    if (activeTab === 'branches' && branches.length === 0) {
      loadBranches();
    }
  }, [activeTab]);

  // Delete branch function
  const handleDeleteBranch = async (branchName: string, force: boolean = false) => {
    if (!confirm(`Are you sure you want to delete branch: ${branchName}?`)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3005/api/git/branches/${encodeURIComponent(branchName)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete branch');
      }

      // Refresh branches
      await loadBranches();
      alert(`Branch ${branchName} deleted successfully`);
    } catch (error: any) {
      if (error.message.includes('not fully merged')) {
        if (confirm('Branch is not fully merged. Force delete?')) {
          await handleDeleteBranch(branchName, true);
        }
      } else {
        alert(`Failed to delete branch: ${error.message}`);
      }
    }
  };

  // Cleanup multiple branches
  const handleCleanupBranches = async (dryRun: boolean = true) => {
    const branchesToCleanup = Array.from(selectedBranches);
    
    if (branchesToCleanup.length === 0) {
      alert('No branches selected for cleanup');
      return;
    }

    const message = dryRun 
      ? `Preview cleanup of ${branchesToCleanup.length} branches?`
      : `Delete ${branchesToCleanup.length} branches?`;
    
    if (!confirm(message)) {
      return;
    }

    try {
      const response = await fetch('http://localhost:3005/api/git/cleanup-branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branches: branchesToCleanup, dryRun })
      });

      if (!response.ok) {
        throw new Error('Failed to cleanup branches');
      }

      const result = await response.json();
      
      if (dryRun) {
        const wouldDelete = result.results.filter((r: any) => r.status === 'would-delete').length;
        alert(`Dry run complete:\n${wouldDelete} branches would be deleted\n${result.summary.skipped} branches would be skipped`);
      } else {
        alert(`Cleanup complete:\n${result.summary.deleted} branches deleted\n${result.summary.skipped} branches skipped\n${result.summary.errors} errors`);
        setSelectedBranches(new Set());
        await loadBranches();
      }
    } catch (error: any) {
      alert(`Failed to cleanup branches: ${error.message}`);
    }
  };

  // Filter branches based on current filter
  const getFilteredBranches = () => {
    switch (branchFilter) {
      case 'cleanup':
        return branches.filter(b => b.suggestCleanup);
      case 'merged':
        return branches.filter(b => b.isMerged);
      case 'unmerged':
        return branches.filter(b => !b.isMerged);
      default:
        return branches;
    }
  };

  // Load merge checklist when a merge is selected
  useEffect(() => {
    if (!selectedMerge) {
      setMergeChecklist([]);
      return;
    }

    async function loadChecklist() {
      const { data, error } = await supabase
        .from('dev_merge_checklist')
        .select('*')
        .eq('merge_queue_id', selectedMerge.id)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMergeChecklist(data);
      }
    }

    loadChecklist();
  }, [selectedMerge]);

  // Handler functions
  const handleRunChecks = async (item: MergeQueueItem) => {
    try {
      console.log(`Running checks for branch: ${item.branch_name}`);
      // In a full implementation, this would execute the CLI command
      // await executeCliCommand(`./scripts/cli-pipeline/git/git-cli.sh run-merge-checks --branch ${item.branch_name}`);
      
      // For now, just refresh the data
      await loadData();
    } catch (error) {
      console.error('Failed to run checks:', error);
    }
  };

  const handleStartMerge = async (item: MergeQueueItem) => {
    if (confirm(`Are you sure you want to start merging ${item.branch_name} into ${item.source_branch}?`)) {
      try {
        console.log(`Starting merge for branch: ${item.branch_name}`);
        // In a full implementation, this would execute the CLI command
        // await executeCliCommand(`./scripts/cli-pipeline/git/git-cli.sh start-merge --id ${item.id}`);
        
        // For now, just show a message
        alert('Merge started! In a full implementation, this would execute the git merge command.');
      } catch (error) {
        console.error('Failed to start merge:', error);
      }
    }
  };

  const handleWorktreeAction = async (worktree: Worktree, action: 'status' | 'update') => {
    try {
      console.log(`${action} for worktree: ${worktree.path}`);
      // In a full implementation, this would execute the appropriate CLI command
      
      if (action === 'status') {
        alert(`Status check for ${worktree.branch}\nIn a full implementation, this would show detailed git status.`);
      } else if (action === 'update') {
        alert(`Updating ${worktree.branch} from remote...\nIn a full implementation, this would run git pull.`);
      }
    } catch (error) {
      console.error(`Failed to ${action} worktree:`, error);
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
      case 'merged':
      case 'passed':
        return 'text-green-600 bg-green-100';
      case 'in_progress':
        return 'text-blue-600 bg-blue-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      case 'conflicts':
      case 'failed':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  // Format check type
  const formatCheckType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Git Management</h1>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading git data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Git Management</h1>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading data</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Git Management</h1>
        
        <div className="flex space-x-4">
          <button 
            onClick={handleRefreshWorktrees}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            🔄 Refresh Worktrees
          </button>
          <button 
            onClick={() => setShowAddToQueue(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
          >
            ➕ Add to Merge Queue
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('worktrees')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'worktrees'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Worktrees ({worktrees.length})
          </button>
          <button
            onClick={() => setActiveTab('branches')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'branches'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Branches ({branches.length})
          </button>
          <button
            onClick={() => setActiveTab('merge-queue')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'merge-queue'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Merge Queue ({mergeQueue.length})
          </button>
          <button
            onClick={() => setActiveTab('merge-history')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'merge-history'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Merge History ({mergeHistory.length})
          </button>
        </nav>
      </div>

      {/* Worktrees Tab */}
      {activeTab === 'worktrees' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 mb-2">
            💡 Click on any worktree card to view its commit history
          </p>
          {worktrees.map((worktree, index) => (
            <div 
              key={index} 
              className="bg-white p-6 rounded-lg border border-gray-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all"
              onClick={() => setSelectedWorktreeForCommits(worktree.path)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    {(() => {
                      const aliasInfo = getWorktreeAliasInfo(worktree.path);
                      return aliasInfo ? (
                        <>
                          <span className="text-2xl">{aliasInfo.emoji}</span>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-1 rounded">
                              {aliasInfo.number}/{aliasInfo.name}
                            </span>
                            <h3 className="text-lg font-semibold text-gray-900">
                              {worktree.path.split('/').pop()}
                            </h3>
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="text-2xl">📁</span>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {worktree.path.split('/').pop()}
                          </h3>
                        </>
                      );
                    })()}
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      worktree.branch === 'development' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {worktree.branch}
                    </span>
                    {worktree.activeTasks && worktree.activeTasks > 0 && (
                      <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                        {worktree.activeTasks} active task{worktree.activeTasks > 1 ? 's' : ''}
                      </span>
                    )}
                    {worktree.needsAttention && (
                      <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                        ⚠️ Needs attention
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">
                    {worktree.path}
                  </div>
                  
                  {/* Git status information */}
                  <div className="mt-3 space-y-1 text-sm">
                    {worktree.lastCommit && (
                      <div className="text-gray-700">
                        <span className="font-medium">Last commit:</span> {worktree.lastCommit.message}
                        <span className="text-gray-500 ml-2">({worktree.lastCommit.relativeTime} by {worktree.lastCommit.author})</span>
                      </div>
                    )}
                    
                    <div className="flex space-x-4 text-sm">
                      {worktree.uncommittedChanges && worktree.uncommittedChanges > 0 && (
                        <span className="text-orange-600">
                          📝 {worktree.uncommittedChanges} uncommitted change{worktree.uncommittedChanges > 1 ? 's' : ''}
                        </span>
                      )}
                      {worktree.ahead && worktree.ahead > 0 && (
                        <span className="text-blue-600">
                          ⬆️ {worktree.ahead} commit{worktree.ahead > 1 ? 's' : ''} ahead
                        </span>
                      )}
                      {worktree.behind && worktree.behind > 0 && (
                        <span className="text-red-600">
                          ⬇️ {worktree.behind} commit{worktree.behind > 1 ? 's' : ''} behind
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Active tasks in this worktree */}
                  {activeTasks.filter(task => 
                    task.worktree_path?.includes(worktree.path.split('/').pop() || '')
                  ).length > 0 && (
                    <div className="mt-3 space-y-1">
                      <div className="text-sm font-medium text-gray-700">Active Tasks:</div>
                      {activeTasks
                        .filter(task => task.worktree_path?.includes(worktree.path.split('/').pop() || ''))
                        .map(task => (
                          <div key={task.id} className="text-sm text-gray-600 pl-4">
                            • {task.title} 
                            {task.branch_name && (
                              <span className="text-xs text-gray-500 ml-2">
                                ({task.branch_name})
                              </span>
                            )}
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
                
                <div className="flex space-x-2 ml-4">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleWorktreeAction(worktree, 'status');
                    }}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                    title="Check status"
                  >
                    📊
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleWorktreeAction(worktree, 'update');
                    }}
                    className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
                    title="Update from remote"
                  >
                    🔄
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Branches Tab */}
      {activeTab === 'branches' && (
        <div>
          {/* Branch Filters and Actions */}
          <div className="mb-6 flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Branches ({branches.length})</option>
                <option value="cleanup">Suggested Cleanup ({branches.filter(b => b.suggestCleanup).length})</option>
                <option value="merged">Merged ({branches.filter(b => b.isMerged).length})</option>
                <option value="unmerged">Unmerged ({branches.filter(b => !b.isMerged).length})</option>
              </select>
              
              {selectedBranches.size > 0 && (
                <span className="text-sm text-gray-600">
                  {selectedBranches.size} selected
                </span>
              )}
            </div>
            
            <div className="flex space-x-3">
              {selectedBranches.size > 0 && (
                <>
                  <button
                    onClick={() => handleCleanupBranches(true)}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
                  >
                    Preview Cleanup
                  </button>
                  <button
                    onClick={() => handleCleanupBranches(false)}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Delete Selected
                  </button>
                </>
              )}
              <button
                onClick={loadBranches}
                disabled={isLoadingBranches}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoadingBranches ? '🔄 Loading...' : '🔄 Refresh'}
              </button>
            </div>
          </div>

          {/* Branch Cleanup Suggestions */}
          {branchFilter === 'all' && branches.some(b => b.suggestCleanup) && (
            <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <span className="text-yellow-600 mr-2">💡</span>
                <div>
                  <h3 className="text-sm font-medium text-yellow-800">Branch Cleanup Suggestions</h3>
                  <p className="mt-1 text-sm text-yellow-700">
                    {branches.filter(b => b.suggestCleanup).length} branches are suggested for cleanup:
                    merged branches older than 30 days or unmerged branches older than 90 days.
                  </p>
                  <button
                    onClick={() => setBranchFilter('cleanup')}
                    className="mt-2 text-sm text-yellow-800 underline hover:text-yellow-900"
                  >
                    View cleanup suggestions
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Branches List */}
          <div className="space-y-2">
            {getFilteredBranches().map((branch) => (
              <div 
                key={branch.name} 
                className={`bg-white p-4 rounded-lg border ${
                  branch.suggestCleanup ? 'border-yellow-200' : 'border-gray-200'
                } ${branch.isCurrent ? 'ring-2 ring-blue-500' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    {branch.canDelete && (
                      <input
                        type="checkbox"
                        checked={selectedBranches.has(branch.name)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedBranches);
                          if (e.target.checked) {
                            newSelected.add(branch.name);
                          } else {
                            newSelected.delete(branch.name);
                          }
                          setSelectedBranches(newSelected);
                        }}
                        className="mt-1"
                      />
                    )}
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-medium text-gray-900">
                          {branch.name}
                        </h3>
                        {branch.isCurrent && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                            Current
                          </span>
                        )}
                        {branch.isMerged && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded">
                            Merged
                          </span>
                        )}
                        {branch.suggestCleanup && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                            Cleanup suggested
                          </span>
                        )}
                      </div>
                      
                      <div className="mt-1 text-sm text-gray-600">
                        Last commit: {branch.lastCommit.message}
                        <span className="text-gray-500 ml-2">
                          ({branch.ageInDays} days ago by {branch.lastCommit.author})
                        </span>
                      </div>
                      
                      {branch.hasUpstream && ((branch.ahead && branch.ahead > 0) || (branch.behind && branch.behind > 0)) && (
                        <div className="mt-1 flex space-x-3 text-xs">
                          {branch.ahead && branch.ahead > 0 && (
                            <span className="text-blue-600">
                              ⬆️ {branch.ahead} ahead
                            </span>
                          )}
                          {branch.behind && branch.behind > 0 && (
                            <span className="text-red-600">
                              ⬇️ {branch.behind} behind
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {branch.canDelete && (
                    <button
                      onClick={() => handleDeleteBranch(branch.name)}
                      className="ml-4 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Delete branch"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* No branches message */}
          {getFilteredBranches().length === 0 && (
            <div className="bg-white p-8 rounded-lg border border-gray-200 text-center">
              <div className="text-gray-500">
                {isLoadingBranches ? 'Loading branches...' : 'No branches found'}
              </div>
            </div>
          )}

          {/* Branch Management Help */}
          <div className="mt-6 text-sm text-gray-600">
            <p className="font-medium mb-2">Branch Management Tips:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Cleanup suggestions</strong> are based on branch age and merge status</li>
              <li><strong>Protected branches</strong> (main, master, development) cannot be deleted</li>
              <li><strong>Current branch</strong> is highlighted and cannot be deleted</li>
              <li>Use <strong>Preview Cleanup</strong> to see what would be deleted before committing</li>
            </ul>
          </div>
        </div>
      )}

      {/* Merge Queue Tab */}
      {activeTab === 'merge-queue' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Queue List */}
          <div className="lg:col-span-2 space-y-4">
            {mergeQueue.length === 0 ? (
              <div className="bg-white p-8 rounded-lg border border-gray-200 text-center">
                <div className="text-gray-500">No branches in merge queue</div>
                <p className="text-sm text-gray-400 mt-2">
                  Add branches to the queue to manage merge order
                </p>
              </div>
            ) : (
              mergeQueue.map(item => (
                <div 
                  key={item.id} 
                  className={`bg-white p-6 rounded-lg border ${
                    selectedMerge?.id === item.id ? 'border-blue-500' : 'border-gray-200'
                  } cursor-pointer hover:border-blue-300`}
                  onClick={() => setSelectedMerge(item)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-medium text-gray-900">
                          {item.branch_name}
                        </h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          getStatusColor(item.merge_status)
                        }`}>
                          {item.merge_status.replace('_', ' ')}
                        </span>
                        {item.priority > 0 && (
                          <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                            Priority: {item.priority}
                          </span>
                        )}
                      </div>
                      
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>Source: {item.source_branch}</div>
                        {item.worktree_path && (
                          <div>Worktree: {item.worktree_path}</div>
                        )}
                        <div>Added: {format(new Date(item.created_at), 'MMM d, yyyy HH:mm')}</div>
                      </div>
                      
                      {item.conflicts_detected && (
                        <div className="mt-2 text-sm text-red-600">
                          ⚠️ Conflicts detected
                        </div>
                      )}
                      
                      {item.notes && (
                        <div className="mt-2 text-sm text-gray-700">
                          Note: {item.notes}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col space-y-2 ml-4">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRunChecks(item);
                        }}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Check Status
                      </button>
                      {item.merge_status === 'ready' && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartMerge(item);
                          }}
                          className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Start Merge
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Checklist Panel */}
          <div className="lg:col-span-1">
            {selectedMerge ? (
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Merge Checklist
                </h3>
                <div className="space-y-3">
                  {mergeChecklist.length === 0 ? (
                    <div className="text-sm text-gray-500">No checks performed yet</div>
                  ) : (
                    mergeChecklist.map(check => (
                      <div key={check.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className={`text-lg ${
                            check.status === 'passed' ? '✅' : 
                            check.status === 'failed' ? '❌' :
                            check.status === 'skipped' ? '⏭️' : '⏳'
                          }`}>
                          </span>
                          <span className="text-sm text-gray-700">
                            {formatCheckType(check.check_type)}
                          </span>
                        </div>
                        {check.executed_at && (
                          <span className="text-xs text-gray-500">
                            {format(new Date(check.executed_at), 'HH:mm')}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
                
                <div className="mt-6 space-y-2">
                  <button className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    Run All Checks
                  </button>
                  <button className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
                    Update from Source
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <div className="text-center text-gray-500">
                  Select a branch to view checklist
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Merge History Tab */}
      {activeTab === 'merge-history' && (
        <div className="space-y-4">
          {mergeHistory.length === 0 ? (
            <div className="bg-white p-8 rounded-lg border border-gray-200 text-center">
              <div className="text-gray-500">No merge history yet</div>
            </div>
          ) : (
            mergeHistory.map(item => (
              <div key={item.id} className="bg-white p-6 rounded-lg border border-gray-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className={item.merge_status === 'merged' ? '✅' : '❌'}></span>
                      <h3 className="text-lg font-medium text-gray-900">
                        {item.branch_name}
                      </h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        getStatusColor(item.merge_status)
                      }`}>
                        {item.merge_status}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>Merged into: {item.source_branch}</div>
                      {item.merge_completed_at && (
                        <div>
                          Completed: {format(new Date(item.merge_completed_at), 'MMM d, yyyy HH:mm')}
                        </div>
                      )}
                      {item.merge_commit_sha && (
                        <div className="font-mono text-xs">
                          Commit: {item.merge_commit_sha}
                        </div>
                      )}
                      {item.notes && (
                        <div className="mt-2">Note: {item.notes}</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-500 ml-4">
                    {item.merge_completed_at && item.merge_started_at && (
                      <div>
                        Duration: {Math.round(
                          (new Date(item.merge_completed_at).getTime() - 
                           new Date(item.merge_started_at).getTime()) / 1000 / 60
                        )} min
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add to Queue Modal */}
      {showAddToQueue && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Add Branch to Merge Queue</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Branch Name
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="feature/my-branch"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Branch
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="development">development</option>
                  <option value="main">main</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority (0-10)
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  defaultValue="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Any notes about this merge..."
                />
              </div>
            </div>
            
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowAddToQueue(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  alert('In a full implementation, this would add the branch to the merge queue.');
                  setShowAddToQueue(false);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Add to Queue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Worktree Commits Modal */}
      {selectedWorktreeForCommits && (
        <WorktreeCommits
          worktreePath={selectedWorktreeForCommits}
          onClose={() => setSelectedWorktreeForCommits(null)}
        />
      )}
    </div>
    </DashboardLayout>
  );
}