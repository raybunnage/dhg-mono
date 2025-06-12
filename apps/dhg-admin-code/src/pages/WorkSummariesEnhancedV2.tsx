import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Search, AlertCircle, Plus } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { supabase } from '../lib/supabase';
import { type WorkSummary } from '../../../../packages/shared/services/work-summary-service/types';
import { WorkSummaryService } from '../../../../packages/shared/services/work-summary-service/work-summary-service';
import { WorkSummaryCard } from '../components/WorkSummaryCard';
import { useWorkSummaryTracking } from '../hooks/useWorkSummaryTracking';
import { StatusPill } from '@shared/components/ui/StatusPill';

// Create work summary service instance
const workSummaryService = WorkSummaryService.getInstance(supabase);

// Component for individual work summary with tracking data
function WorkSummaryWithTracking({ 
  summary, 
  expanded, 
  onToggleExpanded 
}: { 
  summary: WorkSummary; 
  expanded: boolean; 
  onToggleExpanded: () => void;
}) {
  const taskId = summary.metadata?.task_id || summary.metadata?.dev_task_id;
  const tracking = useWorkSummaryTracking(summary.id, taskId);
  
  const handleCreateFollowUpTask = () => {
    // Navigate to create task page with pre-filled data
    window.location.href = `/dev-tasks/create?parent=${taskId}&type=bug_fix&title=Fix failing tests for ${summary.title}`;
  };

  return (
    <WorkSummaryCard
      summary={summary}
      devTask={tracking.devTask}
      submissionInfo={tracking.submissionInfo}
      validationInfo={tracking.validationInfo}
      testResults={tracking.testResults}
      documentationInfo={tracking.documentationInfo}
      todoItems={tracking.todoItems}
      onToggleTodo={tracking.toggleTodo}
      onCreateFollowUpTask={handleCreateFollowUpTask}
      expanded={expanded}
      onToggleExpanded={onToggleExpanded}
    />
  );
}

export function WorkSummariesEnhancedV2() {
  const navigate = useNavigate();
  const [summaries, setSummaries] = useState<WorkSummary[]>([]);
  const [filteredSummaries, setFilteredSummaries] = useState<WorkSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedValidationStatus, setSelectedValidationStatus] = useState<string>('all');
  const [selectedWorktree, setSelectedWorktree] = useState<string>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummaries();
  }, []);

  useEffect(() => {
    filterSummaries();
  }, [searchQuery, selectedCategory, selectedValidationStatus, selectedWorktree, selectedDateRange, selectedTag, summaries]);

  const fetchSummaries = async () => {
    try {
      const summariesResult = await workSummaryService.getSummaries();
      setSummaries(summariesResult);
    } catch (error) {
      console.error('Error fetching summaries:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterSummaries = () => {
    let filtered = [...summaries];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(summary =>
        summary.title.toLowerCase().includes(query) ||
        summary.summary_content.toLowerCase().includes(query) ||
        summary.tags?.some(tag => tag.toLowerCase().includes(query)) ||
        summary.commands?.some(cmd => cmd.toLowerCase().includes(query))
      );
    }

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(summary => summary.category === selectedCategory);
    }

    // Worktree filter
    if (selectedWorktree !== 'all') {
      filtered = filtered.filter(summary => summary.worktree === selectedWorktree);
    }

    // Date range filter
    if (selectedDateRange !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filtered = filtered.filter(summary => {
        const workDate = new Date(summary.work_date);
        
        switch (selectedDateRange) {
          case 'today':
            return workDate >= today;
          case 'week':
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return workDate >= weekAgo;
          case 'month':
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return workDate >= monthAgo;
          default:
            return true;
        }
      });
    }

    // Tag filter
    if (selectedTag !== 'all') {
      filtered = filtered.filter(summary => 
        summary.tags?.includes(selectedTag)
      );
    }

    // Validation status filter (would need to fetch this data)
    // For now, this is a placeholder
    if (selectedValidationStatus !== 'all') {
      // Filter based on validation status
    }

    setFilteredSummaries(filtered);
  };

  const toggleExpanded = (id: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const categories = [...new Set(summaries.map(s => s.category))].filter(Boolean);
  const worktrees = [...new Set(summaries.map(s => s.worktree))].filter(Boolean);
  const allTags = summaries.flatMap(s => s.tags || []);
  const tagCounts = allTags.reduce((acc, tag) => {
    acc[tag] = (acc[tag] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topTags = Object.entries(tagCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([tag]) => tag);
  
  // Calculate counts for filters
  const categoryCounts = categories.reduce((acc, cat) => {
    acc[cat] = summaries.filter(s => s.category === cat).length;
    return acc;
  }, {} as Record<string, number>);
  
  const worktreeCounts = worktrees.reduce((acc, wt) => {
    acc[wt || ''] = summaries.filter(s => s.worktree === wt).length;
    return acc;
  }, {} as Record<string, number>);
  
  // Date range counts
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  
  const dateRangeCounts = {
    today: summaries.filter(s => new Date(s.work_date) >= today).length,
    week: summaries.filter(s => new Date(s.work_date) >= weekAgo).length,
    month: summaries.filter(s => new Date(s.work_date) >= monthAgo).length
  };
  
  // TODO: Calculate validation status counts once we have the data
  const validationCounts = {
    validated: 0,
    not_validated: summaries.length,
    failed: 0,
    issues: 0
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-700">Loading summaries...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div>
        {/* Page Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Work Summaries (Enhanced v2)</h1>
            <p className="text-gray-600">Track work summaries with full task lifecycle visibility</p>
          </div>
          <button
            onClick={() => navigate('/work-summaries/create')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            New Summary
          </button>
        </div>

        {/* Quick Filter Pills */}
        <div className="mb-4 space-y-3">
          {/* Date Range Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Date:</span>
            <button
              onClick={() => setSelectedDateRange('all')}
              className={`px-3 py-1 rounded-full transition-colors ${
                selectedDateRange === 'all'
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setSelectedDateRange('today')}
              className={`px-3 py-1 rounded-full transition-colors ${
                selectedDateRange === 'today'
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Today ({dateRangeCounts.today})
            </button>
            <button
              onClick={() => setSelectedDateRange('week')}
              className={`px-3 py-1 rounded-full transition-colors ${
                selectedDateRange === 'week'
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              This Week ({dateRangeCounts.week})
            </button>
            <button
              onClick={() => setSelectedDateRange('month')}
              className={`px-3 py-1 rounded-full transition-colors ${
                selectedDateRange === 'month'
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              This Month ({dateRangeCounts.month})
            </button>
          </div>

          {/* Worktree Pills */}
          {worktrees.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Branch:</span>
              <button
                onClick={() => setSelectedWorktree('all')}
                className={`px-3 py-1 rounded-full transition-colors ${
                  selectedWorktree === 'all'
                    ? 'bg-purple-100 text-purple-700 border border-purple-300'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Branches
              </button>
              {worktrees.slice(0, 5).map(wt => (
                <button
                  key={wt}
                  onClick={() => setSelectedWorktree(wt || '')}
                  className={`px-3 py-1 rounded-full transition-colors ${
                    selectedWorktree === wt
                      ? 'bg-purple-100 text-purple-700 border border-purple-300'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {wt} ({worktreeCounts[wt || '']})
                </button>
              ))}
            </div>
          )}


          {/* Popular Tags Pills */}
          {topTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Tags:</span>
              <button
                onClick={() => setSelectedTag('all')}
                className={`px-3 py-1 rounded-full transition-colors ${
                  selectedTag === 'all'
                    ? 'bg-orange-100 text-orange-700 border border-orange-300'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Tags
              </button>
              {topTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`px-3 py-1 rounded-full transition-colors ${
                    selectedTag === tag
                      ? 'bg-orange-100 text-orange-700 border border-orange-300'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  #{tag} ({tagCounts[tag]})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-gray-100">
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search summaries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Category Filter */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Category</h3>
              <div className="flex flex-wrap gap-2">
                <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-lg border transition-colors ${
                  selectedCategory === 'all' 
                    ? 'bg-blue-50 border-blue-300 text-blue-700' 
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                All Categories
                <StatusPill variant="default" size="sm" className="ml-2 inline-flex">
                  {summaries.length}
                </StatusPill>
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg border transition-colors ${
                    selectedCategory === cat 
                      ? 'bg-blue-50 border-blue-300 text-blue-700' 
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {cat.replace('_', ' ').charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ')}
                  <StatusPill variant="default" size="sm" className="ml-2 inline-flex">
                    {categoryCounts[cat]}
                  </StatusPill>
                </button>
              ))}
              </div>
            </div>

            {/* Validation Status Filter */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Validation Status</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedValidationStatus('all')}
                  className={`px-3 py-1.5 rounded-lg border transition-colors ${
                    selectedValidationStatus === 'all' 
                      ? 'bg-blue-50 border-blue-300 text-blue-700' 
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  All Status
                  <StatusPill variant="default" size="sm" className="ml-2 inline-flex">
                    {summaries.length}
                  </StatusPill>
                </button>
                <button
                  onClick={() => setSelectedValidationStatus('validated')}
                  className={`px-3 py-1.5 rounded-lg border transition-colors ${
                    selectedValidationStatus === 'validated' 
                      ? 'bg-blue-50 border-blue-300 text-blue-700' 
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <StatusPill variant="validated" size="sm" dot dotStatus="completed" className="inline-flex">
                    Validated ({validationCounts.validated})
                  </StatusPill>
                </button>
                <button
                  onClick={() => setSelectedValidationStatus('not_validated')}
                  className={`px-3 py-1.5 rounded-lg border transition-colors ${
                    selectedValidationStatus === 'not_validated' 
                      ? 'bg-blue-50 border-blue-300 text-blue-700' 
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <StatusPill variant="not_validated" size="sm" dot dotStatus="not_started" className="inline-flex">
                    Not Validated ({validationCounts.not_validated})
                  </StatusPill>
                </button>
                <button
                  onClick={() => setSelectedValidationStatus('failed')}
                  className={`px-3 py-1.5 rounded-lg border transition-colors ${
                    selectedValidationStatus === 'failed' 
                      ? 'bg-blue-50 border-blue-300 text-blue-700' 
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <StatusPill variant="validation_failed" size="sm" dot dotStatus="failed" className="inline-flex">
                    Failed ({validationCounts.failed})
                  </StatusPill>
                </button>
                <button
                  onClick={() => setSelectedValidationStatus('issues')}
                  className={`px-3 py-1.5 rounded-lg border transition-colors ${
                    selectedValidationStatus === 'issues' 
                      ? 'bg-blue-50 border-blue-300 text-blue-700' 
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <StatusPill variant="issues_found" size="sm" dot dotStatus="warning" className="inline-flex">
                    Has Issues ({validationCounts.issues})
                  </StatusPill>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Active Filters Indicator */}
        {(selectedCategory !== 'all' || selectedValidationStatus !== 'all' || selectedWorktree !== 'all' || 
          selectedDateRange !== 'all' || selectedTag !== 'all' || searchQuery) && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <span className="text-sm text-amber-800 font-medium">
                Filters active - showing {filteredSummaries.length} of {summaries.length} total summaries
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSelectedValidationStatus('all');
                setSelectedWorktree('all');
                setSelectedDateRange('all');
                setSelectedTag('all');
                setSearchQuery('');
              }}
              className="text-sm text-amber-700 hover:text-amber-900 font-medium underline"
            >
              Clear all filters
            </button>
          </div>
        )}

        {/* Work Summary Cards */}
        <div className="space-y-4">
          {filteredSummaries.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <p className="text-gray-500">No work summaries found matching your filters.</p>
            </div>
          ) : (
            filteredSummaries.map(summary => (
              <WorkSummaryWithTracking
                key={summary.id}
                summary={summary}
                expanded={expandedItems.has(summary.id)}
                onToggleExpanded={() => toggleExpanded(summary.id)}
              />
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}