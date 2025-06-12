import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Search, AlertCircle, Plus } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { TaskService, type DevTask } from '../services/task-service';
import { supabase } from '../lib/supabase';
import { type WorkSummary } from '../../../../packages/shared/services/work-summary-service/types';
import { WorkSummaryService } from '../../../../packages/shared/services/work-summary-service/work-summary-service';
import { WorkSummaryCard } from '../components/WorkSummaryCard';
import { useWorkSummaryTracking } from '../hooks/useWorkSummaryTracking';

// Create work summary service instance
const workSummaryService = WorkSummaryService.getInstance(supabase);

interface TaskWithTags extends DevTask {
  tags: string[];
}

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
  const { user, signOut } = useAuth();
  const [summaries, setSummaries] = useState<WorkSummary[]>([]);
  const [filteredSummaries, setFilteredSummaries] = useState<WorkSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedValidationStatus, setSelectedValidationStatus] = useState<string>('all');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummaries();
  }, []);

  useEffect(() => {
    filterSummaries();
  }, [searchQuery, selectedCategory, selectedValidationStatus, summaries]);

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

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat.replace('_', ' ').charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ')}
                </option>
              ))}
            </select>

            {/* Validation Status Filter */}
            <select
              value={selectedValidationStatus}
              onChange={(e) => setSelectedValidationStatus(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Validation Status</option>
              <option value="validated">Validated</option>
              <option value="not_validated">Not Validated</option>
              <option value="failed">Validation Failed</option>
              <option value="issues">Has Issues</option>
            </select>
          </div>
        </div>

        {/* Active Filters Indicator */}
        {(selectedCategory !== 'all' || selectedValidationStatus !== 'all' || searchQuery) && (
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