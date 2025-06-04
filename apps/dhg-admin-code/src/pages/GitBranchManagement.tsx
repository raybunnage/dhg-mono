import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import type { GitBranch } from '../types/git';
import { GitApiClient } from '../services/git-api-client';
import { DashboardLayout } from '../components/DashboardLayout';
import { formatDistanceToNow } from 'date-fns';

export const GitBranchManagement: React.FC = () => {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<GitBranch | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'stale' | 'safe-to-delete'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyUnmerged, setShowOnlyUnmerged] = useState(false);
  const [showOnlyWithWorktree, setShowOnlyWithWorktree] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'status'>('date');
  const [refreshing, setRefreshing] = useState(false);

  const gitApiClient = new GitApiClient();

  useEffect(() => {
    loadBranches();
  }, []);

  const loadBranches = async () => {
    try {
      setLoading(true);
      const branchData = await gitApiClient.getAllBranches();
      setBranches(branchData);
    } catch (error) {
      console.error('Error loading branches:', error);
      alert('Failed to load branches. Make sure the Git API server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadBranches();
    setRefreshing(false);
  };

  const handleDeleteBranch = async (branch: GitBranch, force: boolean = false) => {
    if (!branch.safety.canDelete && !force) {
      const confirmForce = window.confirm(
        `This branch has the following issues:\n${branch.safety.reasons.join('\n')}\n\nDo you want to force delete it?`
      );
      if (!confirmForce) return;
      force = true;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to delete branch "${branch.name}"?${force ? ' (FORCE DELETE)' : ''}`
    );
    
    if (!confirmDelete) return;

    try {
      await gitApiClient.deleteBranch(branch.name, force);
      await loadBranches();
    } catch (error) {
      console.error('Error deleting branch:', error);
      alert(`Failed to delete branch: ${error}`);
    }
  };

  const handlePruneWorktrees = async () => {
    try {
      await gitApiClient.pruneWorktrees();
      await loadBranches();
      alert('Worktrees pruned successfully');
    } catch (error) {
      console.error('Error pruning worktrees:', error);
      alert(`Failed to prune worktrees: ${error}`);
    }
  };

  const getFilteredBranches = () => {
    let filtered = branches;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(branch => 
        branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        branch.lastCommit.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
        branch.lastCommit.message.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filters
    if (showOnlyUnmerged) {
      filtered = filtered.filter(branch => !branch.mergeStatus.merged);
    }

    if (showOnlyWithWorktree) {
      filtered = filtered.filter(branch => branch.worktree);
    }

    // Apply main filter
    switch (filter) {
      case 'active':
        filtered = filtered.filter(branch => {
          const lastCommitDate = new Date(branch.lastCommit.date);
          const daysSinceLastCommit = (Date.now() - lastCommitDate.getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceLastCommit < 30 || branch.worktree || branch.current;
        });
        break;
      case 'stale':
        filtered = filtered.filter(branch => {
          const lastCommitDate = new Date(branch.lastCommit.date);
          const daysSinceLastCommit = (Date.now() - lastCommitDate.getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceLastCommit >= 30 && !branch.worktree && !branch.current;
        });
        break;
      case 'safe-to-delete':
        filtered = filtered.filter(branch => branch.safety.canDelete);
        break;
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'date':
          return new Date(b.lastCommit.date).getTime() - new Date(a.lastCommit.date).getTime();
        case 'status':
          // Sort by: current > worktree > unmerged > merged > safe to delete
          const getStatusWeight = (branch: GitBranch) => {
            if (branch.current) return 5;
            if (branch.worktree) return 4;
            if (!branch.mergeStatus.merged) return 3;
            if (branch.mergeStatus.merged && !branch.safety.canDelete) return 2;
            return 1;
          };
          return getStatusWeight(b) - getStatusWeight(a);
        default:
          return 0;
      }
    });

    return filtered;
  };

  const getBranchStatusBadge = (branch: GitBranch) => {
    if (branch.current) {
      return <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">Current</span>;
    }
    if (branch.worktree) {
      return <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">Worktree</span>;
    }
    if (!branch.mergeStatus.merged) {
      return <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">Unmerged</span>;
    }
    if (branch.safety.canDelete) {
      return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Safe to Delete</span>;
    }
    return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">Merged</span>;
  };

  const getRelativeTime = (dateString: string) => {
    if (!dateString) return 'Unknown';
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  };

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
            <p className="text-gray-700">You need admin privileges to access this area.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const filteredBranches = getFilteredBranches();
  const stats = {
    total: branches.length,
    active: branches.filter(b => b.worktree || b.current).length,
    unmerged: branches.filter(b => !b.mergeStatus.merged).length,
    safeToDelete: branches.filter(b => b.safety.canDelete).length
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-green-900 mb-2">Git Branch Management</h1>
          <p className="text-green-700">Manage branches, worktrees, and clean up your repository</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-green-200">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-600">Total Branches</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-green-200">
            <div className="text-2xl font-bold text-purple-600">{stats.active}</div>
            <div className="text-sm text-gray-600">Active (Current/Worktree)</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-green-200">
            <div className="text-2xl font-bold text-yellow-600">{stats.unmerged}</div>
            <div className="text-sm text-gray-600">Unmerged Branches</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-green-200">
            <div className="text-2xl font-bold text-green-600">{stats.safeToDelete}</div>
            <div className="text-sm text-gray-600">Safe to Delete</div>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="mb-6 space-y-4">
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Search branches..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              onClick={handlePruneWorktrees}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              title="Remove references to worktrees that no longer exist"
            >
              Prune Worktrees
            </button>
          </div>

          <div className="flex items-center gap-4">
            {/* Main Filter */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded-md text-sm ${
                  filter === 'all' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({branches.length})
              </button>
              <button
                onClick={() => setFilter('active')}
                className={`px-3 py-1 rounded-md text-sm ${
                  filter === 'active' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setFilter('stale')}
                className={`px-3 py-1 rounded-md text-sm ${
                  filter === 'stale' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Stale (30+ days)
              </button>
              <button
                onClick={() => setFilter('safe-to-delete')}
                className={`px-3 py-1 rounded-md text-sm ${
                  filter === 'safe-to-delete' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Safe to Delete ({stats.safeToDelete})
              </button>
            </div>

            {/* Additional Filters */}
            <div className="flex items-center gap-4 ml-auto">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showOnlyUnmerged}
                  onChange={(e) => setShowOnlyUnmerged(e.target.checked)}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span className="text-sm text-gray-700">Only Unmerged</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showOnlyWithWorktree}
                  onChange={(e) => setShowOnlyWithWorktree(e.target.checked)}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span className="text-sm text-gray-700">Only With Worktree</span>
              </label>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1 border border-green-300 rounded-md text-sm focus:ring-2 focus:ring-green-500"
              >
                <option value="date">Sort by Date</option>
                <option value="name">Sort by Name</option>
                <option value="status">Sort by Status</option>
              </select>
            </div>
          </div>
        </div>

        {/* Branch List */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-500">Loading branches...</div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBranches.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No branches match your filters
              </div>
            ) : (
              filteredBranches.map((branch) => (
                <div
                  key={branch.name}
                  className={`bg-white p-4 rounded-lg shadow-sm border ${
                    branch.current ? 'border-blue-300' : 
                    branch.worktree ? 'border-purple-300' :
                    branch.safety.canDelete ? 'border-green-300' : 
                    'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 font-mono">
                          {branch.name}
                        </h3>
                        {getBranchStatusBadge(branch)}
                        {branch.remote && (
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                            Remote
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Last commit:</span> {getRelativeTime(branch.lastCommit.date)}
                        </div>
                        <div>
                          <span className="font-medium">Author:</span> {branch.lastCommit.author}
                        </div>
                        <div className="md:col-span-2">
                          <span className="font-medium">Message:</span> {branch.lastCommit.message}
                        </div>
                      </div>

                      {branch.worktree && (
                        <div className="mt-2 p-2 bg-purple-50 rounded text-sm">
                          <span className="font-medium text-purple-800">Worktree:</span>{' '}
                          <code className="text-purple-600">{branch.worktree.path}</code>
                          {branch.worktree.locked && (
                            <span className="ml-2 text-xs bg-purple-200 text-purple-800 px-2 py-1 rounded">
                              Locked
                            </span>
                          )}
                        </div>
                      )}

                      {branch.mergeStatus.mergedInto && (
                        <div className="mt-2 text-sm text-green-600">
                          ✓ Merged into: {branch.mergeStatus.mergedInto.join(', ')}
                        </div>
                      )}

                      {branch.mergeStatus.unmergedCommits > 0 && (
                        <div className="mt-2 text-sm text-yellow-600">
                          ⚠ {branch.mergeStatus.unmergedCommits} unmerged commits
                        </div>
                      )}

                      {!branch.safety.canDelete && branch.safety.reasons.length > 0 && (
                        <div className="mt-2 text-sm text-red-600">
                          <span className="font-medium">Cannot delete:</span>
                          <ul className="mt-1 ml-4 list-disc">
                            {branch.safety.reasons.map((reason, idx) => (
                              <li key={idx}>{reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => setSelectedBranch(branch)}
                        className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
                      >
                        Details
                      </button>
                      {!branch.current && (
                        <button
                          onClick={() => handleDeleteBranch(branch)}
                          className={`px-3 py-1 text-sm rounded-lg ${
                            branch.safety.canDelete
                              ? 'bg-red-100 hover:bg-red-200 text-red-700'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          }`}
                          title={branch.safety.canDelete ? 'Delete branch' : 'Force delete required'}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Branch Details Modal */}
        {selectedBranch && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">
                    Branch Details: {selectedBranch.name}
                  </h2>
                  <button
                    onClick={() => setSelectedBranch(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Branch Status */}
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Status</h3>
                    <div className="flex gap-2">
                      {getBranchStatusBadge(selectedBranch)}
                      {selectedBranch.remote && (
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                          Remote
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Last Commit */}
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Last Commit</h3>
                    <div className="bg-gray-50 p-3 rounded text-sm space-y-1">
                      <div><span className="font-medium">Hash:</span> {selectedBranch.lastCommit.hash}</div>
                      <div><span className="font-medium">Date:</span> {selectedBranch.lastCommit.date}</div>
                      <div><span className="font-medium">Author:</span> {selectedBranch.lastCommit.author}</div>
                      <div><span className="font-medium">Message:</span> {selectedBranch.lastCommit.message}</div>
                    </div>
                  </div>

                  {/* Worktree Info */}
                  {selectedBranch.worktree && (
                    <div>
                      <h3 className="font-medium text-gray-900 mb-2">Worktree</h3>
                      <div className="bg-purple-50 p-3 rounded text-sm">
                        <div><span className="font-medium">Path:</span> {selectedBranch.worktree.path}</div>
                        <div><span className="font-medium">Locked:</span> {selectedBranch.worktree.locked ? 'Yes' : 'No'}</div>
                      </div>
                    </div>
                  )}

                  {/* Merge Status */}
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Merge Status</h3>
                    <div className="bg-gray-50 p-3 rounded text-sm">
                      {selectedBranch.mergeStatus.merged ? (
                        <div className="text-green-600">
                          ✓ Merged into: {selectedBranch.mergeStatus.mergedInto?.join(', ')}
                        </div>
                      ) : (
                        <div className="text-yellow-600">
                          ⚠ Not merged ({selectedBranch.mergeStatus.unmergedCommits} unmerged commits)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Safety Analysis */}
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Safety Analysis</h3>
                    <div className={`p-3 rounded text-sm ${
                      selectedBranch.safety.canDelete ? 'bg-green-50' : 'bg-red-50'
                    }`}>
                      <div className="font-medium mb-1">
                        {selectedBranch.safety.canDelete ? '✓ Safe to delete' : '✗ Cannot delete safely'}
                      </div>
                      <ul className="ml-4 list-disc">
                        {selectedBranch.safety.reasons.map((reason, idx) => (
                          <li key={idx}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setSelectedBranch(null)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
                  >
                    Close
                  </button>
                  {!selectedBranch.current && (
                    <button
                      onClick={() => {
                        handleDeleteBranch(selectedBranch);
                        setSelectedBranch(null);
                      }}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                    >
                      Delete Branch
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};