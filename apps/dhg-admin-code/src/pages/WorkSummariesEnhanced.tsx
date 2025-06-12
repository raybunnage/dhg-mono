import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Search, Calendar, Tag, Command, ChevronDown, ChevronUp, ArrowLeft, CheckCircle, Clock, AlertCircle, FileText, Hash, Edit2, Save, X, GitBranch, CheckSquare } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { TaskService, type DevTask, type DevTaskTag } from '../services/task-service';
import { supabase } from '../lib/supabase';
import { type WorkSummary, type WorkItem } from '../../../../packages/shared/services/work-summary-service/types';
import { WorkSummaryService } from '../../../../packages/shared/services/work-summary-service/work-summary-service';
import { WorkSummaryValidationModal } from '../components/WorkSummaryValidationModal';

// Create work summary service instance
const workSummaryService = WorkSummaryService.getInstance(supabase);

interface TaskWithTags extends DevTask {
  tags: string[];
}

interface EditingState {
  id: string;
  type: 'summary' | 'task';
  data: any;
}

// Define standardized categories for work types
const categoryMapping: Record<string, string> = {
  // Feature variations -> feature
  'feature': 'feature',
  'feature-development': 'feature',
  
  // Bug fix variations -> bug
  'bug': 'bug',
  'bug_fix': 'bug',
  'bug-fix': 'bug', 
  'bugfix': 'bug',
  
  // Refactoring variations -> refactor
  'refactor': 'refactor',
  'refactoring': 'refactor',
  
  // Documentation variations -> documentation
  'documentation': 'documentation',
  'docs': 'documentation',
  
  // Infrastructure and maintenance -> maintenance
  'infrastructure': 'maintenance',
  'maintenance': 'maintenance',
  'merge': 'maintenance',
  
  // Keep question as is
  'question': 'question',
};

export function WorkSummariesEnhanced() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [summaries, setSummaries] = useState<WorkSummary[]>([]);
  const [tasks, setTasks] = useState<TaskWithTags[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<WorkItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCompletionStatus, setSelectedCompletionStatus] = useState<string>('all');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<EditingState | null>(null);
  const [saving, setSaving] = useState(false);
  const [validationModalOpen, setValidationModalOpen] = useState(false);
  const [selectedSummaryForValidation, setSelectedSummaryForValidation] = useState<WorkSummary | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    combineWorkItems();
  }, [summaries, tasks]);

  useEffect(() => {
    filterWorkItems();
  }, [searchQuery, selectedCategory, selectedType, selectedCompletionStatus, workItems]);

  const fetchData = async () => {
    try {
      // Fetch summaries using the service
      const summariesPromise = workSummaryService.getSummaries();

      // Fetch tasks with their tags
      const tasksPromise = TaskService.getTasks();
      const tagsPromise = supabase
        .from('dev_task_tags')
        .select('*');

      const [summariesResult, tasksResult, tagsResult] = await Promise.all([
        summariesPromise,
        tasksPromise,
        tagsPromise
      ]);

      if (tagsResult.error) throw tagsResult.error;

      // Map tags to tasks
      const tasksWithTags = (tasksResult || []).map(task => {
        const taskTags = (tagsResult.data || []).filter(tag => tag.task_id === task.id);
        return {
          ...task,
          tags: taskTags.map(t => t.tag)
        };
      });

      setSummaries(summariesResult);
      setTasks(tasksWithTags);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const combineWorkItems = () => {
    const items = workSummaryService.combineWorkItems(summaries, tasks);
    setWorkItems(items);
  };

  const filterWorkItems = () => {
    let filtered = [...workItems];

    // Type filter
    if (selectedType !== 'all') {
      filtered = filtered.filter(item => item.type === selectedType);
    }

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => {
        if (item.type === 'summary') {
          const summary = item.data as WorkSummary;
          const normalizedCategory = categoryMapping[summary.category] || summary.category;
          return normalizedCategory === selectedCategory;
        } else {
          const task = item.data as TaskWithTags;
          const normalizedTaskType = categoryMapping[task.task_type] || task.task_type;
          return normalizedTaskType === selectedCategory;
        }
      });
    }

    // Completion status filter
    if (selectedCompletionStatus !== 'all') {
      filtered = filtered.filter(item => {
        if (item.type === 'summary') {
          const summary = item.data as WorkSummary;
          // Check if summary has an associated task
          const taskId = summary.metadata?.task_id || summary.metadata?.dev_task_id;
          if (taskId) {
            // Find the associated task
            const associatedTask = tasks.find(t => t.id === taskId);
            if (associatedTask) {
              return selectedCompletionStatus === 'completed' ? 
                associatedTask.status === 'completed' : 
                associatedTask.status !== 'completed';
            }
          }
          // If no associated task, consider it as "not completed"
          return selectedCompletionStatus === 'not-completed';
        } else {
          // For task items, use their status directly
          const task = item.data as TaskWithTags;
          return selectedCompletionStatus === 'completed' ? 
            task.status === 'completed' : 
            task.status !== 'completed';
        }
      });
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => {
        if (item.type === 'summary') {
          const summary = item.data as WorkSummary;
          return summary.title.toLowerCase().includes(query) ||
            summary.summary_content.toLowerCase().includes(query) ||
            summary.commands?.some(cmd => cmd.toLowerCase().includes(query)) ||
            summary.tags?.some(tag => tag.toLowerCase().includes(query)) ||
            summary.worktree?.toLowerCase().includes(query);
        } else {
          const task = item.data as TaskWithTags;
          return task.title.toLowerCase().includes(query) ||
            task.description.toLowerCase().includes(query) ||
            task.tags?.some(tag => tag.toLowerCase().includes(query)) ||
            task.worktree_path?.toLowerCase().includes(query);
        }
      });
    }

    setFilteredItems(filtered);
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  // Get unique categories from both summaries and tasks, normalized
  const categories = ['all', ...Array.from(new Set([
    ...summaries.map(s => categoryMapping[s.category] || s.category).filter(Boolean),
    ...tasks.map(t => categoryMapping[t.task_type] || t.task_type).filter(Boolean)
  ])).sort()];

  const getTaskStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-gray-500" />;
      case 'in_progress':
        return <AlertCircle className="w-4 h-4 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      default:
        return null;
    }
  };

  const getTaskTypeColor = (type: string) => {
    switch (type) {
      case 'bug':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'feature':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'refactor':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'documentation':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'maintenance':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'question':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-orange-100 text-orange-800 border-orange-200';
    }
  };

  const getCategoryEmoji = (category: string) => {
    // Normalize the category first
    const normalized = categoryMapping[category] || category;
    
    const emojis: Record<string, string> = {
      'bug': '🐛',
      'feature': '✨',
      'refactor': '🔧',
      'documentation': '📚',
      'maintenance': '🛠️',
      'question': '❓',
      // Legacy mappings for backward compatibility (now handled by categoryMapping)
      'bug_fix': '🐛',
      'refactoring': '🔧',
      'docs': '📚',
      'infrastructure': '🛠️',
    };
    return emojis[normalized] || emojis[category] || '📋';
  };

  const startEditing = (item: WorkItem) => {
    setEditingItem({
      id: item.data.id,
      type: item.type,
      data: { ...item.data }
    });
  };

  const cancelEditing = () => {
    setEditingItem(null);
  };

  const saveChanges = async () => {
    if (!editingItem) return;
    
    setSaving(true);
    try {
      if (editingItem.type === 'summary') {
        await workSummaryService.updateSummary(editingItem.id, {
          title: editingItem.data.title,
          summary_content: editingItem.data.summary_content,
          category: editingItem.data.category,
          tags: editingItem.data.tags,
          worktree: editingItem.data.worktree
        });
      } else {
        const { error } = await supabase
          .from('dev_tasks')
          .update({
            title: editingItem.data.title,
            description: editingItem.data.description,
            task_type: editingItem.data.task_type,
            priority: editingItem.data.priority,
            status: editingItem.data.status,
            worktree_path: editingItem.data.worktree_path,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingItem.id);

        if (error) throw error;
      }

      // Refresh data
      await fetchData();
      setEditingItem(null);
    } catch (error) {
      console.error('Error saving changes:', error);
      alert('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const updateEditingData = (field: string, value: any) => {
    if (!editingItem) return;
    setEditingItem({
      ...editingItem,
      data: {
        ...editingItem.data,
        [field]: value
      }
    });
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
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Work Summaries (Enhanced)</h1>
          <p className="text-gray-600">Track, manage, and edit AI assistant work history and development tasks</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-gray-100">
          {/* Filter Pills - All on one line */}
          <div className="mb-4">
            <div className="flex flex-wrap gap-2 items-center">
              {/* Type Filter Pills */}
              <button
                onClick={() => setSelectedType('all')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
                  selectedType === 'all' 
                    ? 'bg-gray-800 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Types
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full bg-white/20">
                  {workItems.length}
                </span>
              </button>
              <button
                onClick={() => setSelectedType('summary')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
                  selectedType === 'summary' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                Work Summaries
                <span className={`inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full ${
                  selectedType === 'summary' ? 'bg-white/20' : 'bg-blue-200'
                }`}>
                  {summaries.length}
                </span>
              </button>
              <button
                onClick={() => setSelectedType('task')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
                  selectedType === 'task' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                }`}
              >
                Dev Tasks
                <span className={`inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full ${
                  selectedType === 'task' ? 'bg-white/20' : 'bg-purple-200'
                }`}>
                  {tasks.length}
                </span>
              </button>

              {/* Divider */}
              <div className="w-px h-8 bg-gray-300"></div>

              {/* Completion Status Filter Pills */}
              <button
                onClick={() => setSelectedCompletionStatus('all')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
                  selectedCompletionStatus === 'all' 
                    ? 'bg-gray-800 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Items
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full bg-white/20">
                  {filteredItems.length}
                </span>
              </button>
              <button
                onClick={() => setSelectedCompletionStatus('completed')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
                  selectedCompletionStatus === 'completed' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-green-50 text-green-700 hover:bg-green-100'
                }`}
              >
                Completed
                <span className={`inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full ${
                  selectedCompletionStatus === 'completed' ? 'bg-white/20' : 'bg-green-200'
                }`}>
                  {workItems.filter(item => {
                    if (item.type === 'summary') {
                      const summary = item.data as WorkSummary;
                      const taskId = summary.metadata?.task_id || summary.metadata?.dev_task_id;
                      if (taskId) {
                        const associatedTask = tasks.find(t => t.id === taskId);
                        return associatedTask?.status === 'completed';
                      }
                      return false;
                    } else {
                      const task = item.data as TaskWithTags;
                      return task.status === 'completed';
                    }
                  }).length}
                </span>
              </button>
              <button
                onClick={() => setSelectedCompletionStatus('not-completed')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
                  selectedCompletionStatus === 'not-completed' 
                    ? 'bg-orange-600 text-white' 
                    : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
                }`}
              >
                Not Completed
                <span className={`inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full ${
                  selectedCompletionStatus === 'not-completed' ? 'bg-white/20' : 'bg-orange-200'
                }`}>
                  {workItems.filter(item => {
                    if (item.type === 'summary') {
                      const summary = item.data as WorkSummary;
                      const taskId = summary.metadata?.task_id || summary.metadata?.dev_task_id;
                      if (taskId) {
                        const associatedTask = tasks.find(t => t.id === taskId);
                        return associatedTask?.status !== 'completed';
                      }
                      return true;
                    } else {
                      const task = item.data as TaskWithTags;
                      return task.status !== 'completed';
                    }
                  }).length}
                </span>
              </button>

              {/* Category Filter (kept as dropdown for many options) */}
              <div className="ml-auto">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 bg-gray-50 focus:bg-white transition-colors text-sm"
                >
                  <option value="all">All Categories</option>
                  {categories.filter(cat => cat !== 'all').map(cat => {
                    const displayName = {
                      'feature': '✨ Feature',
                      'bug': '🐛 Bug Fix',
                      'refactor': '🔧 Refactoring',
                      'documentation': '📚 Documentation',
                      'maintenance': '🛠️ Maintenance',
                      'question': '❓ Question',
                    }[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
                    
                    return (
                      <option key={cat} value={cat}>
                        {displayName}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search work items, tasks, commands, worktrees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 bg-gray-50 focus:bg-white transition-colors"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
            <div className="text-2xl font-bold text-gray-900">{summaries.length}</div>
            <div className="text-sm text-gray-700">Work Summaries</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
            <div className="text-2xl font-bold text-gray-900">{tasks.length}</div>
            <div className="text-sm text-gray-700">Dev Tasks</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
            <div className="text-2xl font-bold text-emerald-900">
              {tasks.filter(t => t.status === 'completed').length}
            </div>
            <div className="text-sm text-gray-700">Tasks Completed</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
            <div className="text-2xl font-bold text-blue-900">
              {tasks.filter(t => t.status === 'in_progress').length}
            </div>
            <div className="text-sm text-gray-700">In Progress</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
            <div className="text-2xl font-bold text-gray-900">
              {tasks.filter(t => t.status === 'pending').length}
            </div>
            <div className="text-sm text-gray-700">Pending Tasks</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
            <div className="text-2xl font-bold text-purple-900">
              {summaries.filter(s => {
                const taskId = s.metadata?.task_id || s.metadata?.dev_task_id;
                if (taskId) {
                  const task = tasks.find(t => t.id === taskId);
                  return task?.status === 'completed';
                }
                return false;
              }).length}
            </div>
            <div className="text-sm text-gray-700">Summaries for Completed Tasks</div>
          </div>
        </div>

        {/* Active Filters Indicator */}
        {(selectedType !== 'all' || selectedCompletionStatus !== 'all' || selectedCategory !== 'all' || searchQuery) && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <span className="text-sm text-amber-800 font-medium">
                Filters active - showing {filteredItems.length} of {workItems.length} total items
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedType('all');
                setSelectedCompletionStatus('all');
                setSelectedCategory('all');
                setSearchQuery('');
              }}
              className="text-sm text-amber-700 hover:text-amber-900 font-medium underline"
            >
              Clear all filters
            </button>
          </div>
        )}

        {/* Work Items List */}
        <div className="space-y-4">
          {filteredItems.map(item => {
            const isEditing = editingItem?.id === item.data.id;
            
            if (item.type === 'summary') {
              const summary = item.data as WorkSummary;
              const editData = isEditing && editingItem ? editingItem.data : summary;
              
              return (
                <div key={summary.id} className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-100">
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{getCategoryEmoji(editData.category)}</span>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editData.title}
                              onChange={(e) => updateEditingData('title', e.target.value)}
                              className="flex-1 px-2 py-1 border border-gray-300 rounded-md"
                            />
                          ) : (
                            <h3 className="text-lg font-semibold text-gray-900">{summary.title}</h3>
                          )}
                          <span className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs border border-blue-200">
                            Summary
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-700 mb-3">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {new Date(summary.work_date).toLocaleDateString()}
                          </span>
                          {isEditing ? (
                            <select
                              value={editData.category}
                              onChange={(e) => updateEditingData('category', e.target.value)}
                              className="px-2 py-1 border border-gray-300 rounded-md text-xs"
                            >
                              <option value="feature">✨ Feature</option>
                              <option value="bug_fix">🐛 Bug Fix</option>
                              <option value="refactoring">🔧 Refactoring</option>
                              <option value="documentation">📚 Documentation</option>
                            </select>
                          ) : (
                            summary.category && (
                              <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">
                                {summary.category.replace('_', ' ')}
                              </span>
                            )
                          )}
                          {(editData.worktree || isEditing) && (
                            <span className="flex items-center gap-1">
                              <GitBranch className="h-4 w-4" />
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editData.worktree || ''}
                                  onChange={(e) => updateEditingData('worktree', e.target.value)}
                                  placeholder="worktree name"
                                  className="px-2 py-1 border border-gray-300 rounded-md text-xs"
                                />
                              ) : (
                                <span className="text-xs">{summary.worktree}</span>
                              )}
                            </span>
                          )}
                        </div>

                        {/* Summary Content */}
                        <div className="mb-3">
                          {isEditing ? (
                            <textarea
                              value={editData.summary_content}
                              onChange={(e) => updateEditingData('summary_content', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                              rows={5}
                            />
                          ) : (
                            <>
                              <p className={`text-gray-600 leading-relaxed ${expandedItems.has(summary.id) ? 'whitespace-pre-wrap' : 'overflow-hidden'}`}
                                 style={expandedItems.has(summary.id) ? {} : { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                                {summary.summary_content}
                              </p>
                              {summary.summary_content.length > 200 && (
                                <button
                                  onClick={() => toggleExpanded(summary.id)}
                                  className="mt-2 text-sm text-gray-600 hover:text-gray-800 font-medium flex items-center gap-1 transition-colors"
                                >
                                  {expandedItems.has(summary.id) ? (
                                    <>
                                      <ChevronUp className="h-4 w-4" />
                                      Show less
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="h-4 w-4" />
                                      Show more
                                    </>
                                  )}
                                </button>
                              )}
                            </>
                          )}
                        </div>

                        {/* Commands and Tags */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          {summary.commands?.map(cmd => (
                            <span key={cmd} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs border border-gray-200">
                              <Command className="h-3 w-3" />
                              {cmd}
                            </span>
                          ))}
                          {isEditing ? (
                            <input
                              type="text"
                              value={editData.tags?.join(', ') || ''}
                              onChange={(e) => updateEditingData('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                              placeholder="Tags (comma separated)"
                              className="px-2 py-1 border border-gray-300 rounded-md text-xs"
                            />
                          ) : (
                            summary.tags?.map(tag => (
                              <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md text-xs border border-emerald-200">
                                <Tag className="h-3 w-3" />
                                {tag}
                              </span>
                            ))
                          )}
                        </div>

                        {/* Metadata */}
                        {expandedItems.has(summary.id) && summary.metadata && (
                          <div className="mt-4 p-3 bg-gray-50 rounded-md border border-gray-100">
                            <h4 className="text-sm font-medium text-gray-800 mb-2">Additional Details</h4>
                            <pre className="text-xs text-gray-700 overflow-x-auto">
                              {JSON.stringify(summary.metadata, null, 2)}
                            </pre>
                          </div>
                        )}

                        {/* Created At */}
                        {expandedItems.has(summary.id) && (
                          <div className="mt-2 text-xs text-gray-500">
                            Created: {new Date(summary.created_at).toLocaleString()}
                          </div>
                        )}
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex gap-2 ml-4">
                        {isEditing ? (
                          <>
                            <button
                              onClick={saveChanges}
                              disabled={saving}
                              className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium transition-colors disabled:opacity-50"
                            >
                              <Save className="h-4 w-4 mr-1" />
                              {saving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="inline-flex items-center px-3 py-1.5 bg-gray-400 text-white rounded-md hover:bg-gray-500 text-sm font-medium transition-colors"
                            >
                              <X className="h-4 w-4 mr-1" />
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEditing(item)}
                              className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium transition-colors"
                            >
                              <Edit2 className="h-4 w-4 mr-1" />
                              Edit
                            </button>
                            {!summary.metadata?.validation_task_id && (
                              <button
                                onClick={() => {
                                  setSelectedSummaryForValidation(summary);
                                  setValidationModalOpen(true);
                                }}
                                className="inline-flex items-center px-3 py-1.5 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 text-sm font-medium transition-colors"
                                title="Create validation task"
                              >
                                <CheckSquare className="h-4 w-4 mr-1" />
                                Validate
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            } else {
              const task = item.data as TaskWithTags;
              const editData = isEditing && editingItem ? editingItem.data : task;
              
              return (
                <div key={task.id} className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-100">
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getTaskStatusIcon(editData.status)}
                          {isEditing ? (
                            <input
                              type="text"
                              value={editData.title}
                              onChange={(e) => updateEditingData('title', e.target.value)}
                              className="flex-1 px-2 py-1 border border-gray-300 rounded-md"
                            />
                          ) : (
                            <h3 className="text-lg font-semibold text-gray-900">
                              <Link to={`/tasks/${task.id}`} className="hover:text-gray-700 transition-colors">
                                {task.title}
                              </Link>
                            </h3>
                          )}
                          <span className="inline-flex items-center px-2 py-1 bg-purple-50 text-purple-700 rounded-full text-xs border border-purple-200">
                            Task
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-sm text-gray-600 flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {new Date(task.created_at).toLocaleDateString()}
                          </span>
                          {isEditing ? (
                            <>
                              <select
                                value={editData.task_type}
                                onChange={(e) => updateEditingData('task_type', e.target.value)}
                                className={`px-2 py-1 rounded-full text-xs border ${getTaskTypeColor(editData.task_type)}`}
                              >
                                <option value="feature">✨ Feature</option>
                                <option value="bug">🐛 Bug</option>
                                <option value="refactor">🔧 Refactor</option>
                                <option value="documentation">📚 Documentation</option>
                                <option value="question">❓ Question</option>
                              </select>
                              <select
                                value={editData.priority}
                                onChange={(e) => updateEditingData('priority', e.target.value)}
                                className="px-2 py-1 rounded-full text-xs border"
                              >
                                <option value="high">High priority</option>
                                <option value="medium">Medium priority</option>
                                <option value="low">Low priority</option>
                              </select>
                              <select
                                value={editData.status}
                                onChange={(e) => updateEditingData('status', e.target.value)}
                                className="px-2 py-1 rounded-full text-xs border"
                              >
                                <option value="pending">Pending</option>
                                <option value="in_progress">In Progress</option>
                                <option value="completed">Completed</option>
                              </select>
                            </>
                          ) : (
                            <>
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${getTaskTypeColor(task.task_type)}`}>
                                {task.task_type}
                              </span>
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                                task.priority === 'high' ? 'bg-red-100 text-red-800 border border-red-200' :
                                task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                                'bg-gray-100 text-gray-800 border border-gray-200'
                              }`}>
                                {task.priority} priority
                              </span>
                            </>
                          )}
                          {(editData.worktree_path || isEditing) && (
                            <span className="flex items-center gap-1">
                              <GitBranch className="h-4 w-4" />
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editData.worktree_path || ''}
                                  onChange={(e) => updateEditingData('worktree_path', e.target.value)}
                                  placeholder="worktree path"
                                  className="px-2 py-1 border border-gray-300 rounded-md text-xs"
                                />
                              ) : (
                                <span className="text-xs">{task.worktree_path}</span>
                              )}
                            </span>
                          )}
                        </div>

                        {/* Task Description */}
                        <div className="mb-3">
                          {isEditing ? (
                            <textarea
                              value={editData.description}
                              onChange={(e) => updateEditingData('description', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                              rows={5}
                            />
                          ) : (
                            <>
                              <p className={`text-gray-600 leading-relaxed ${expandedItems.has(task.id) ? 'whitespace-pre-wrap' : 'overflow-hidden'}`}
                                 style={expandedItems.has(task.id) ? {} : { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                                {task.description}
                              </p>
                              {task.description.length > 200 && (
                                <button
                                  onClick={() => toggleExpanded(task.id)}
                                  className="mt-2 text-sm text-gray-600 hover:text-gray-800 font-medium flex items-center gap-1 transition-colors"
                                >
                                  {expandedItems.has(task.id) ? (
                                    <>
                                      <ChevronUp className="h-4 w-4" />
                                      Show less
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="h-4 w-4" />
                                      Show more
                                    </>
                                  )}
                                </button>
                              )}
                            </>
                          )}
                        </div>

                        {/* Task Tags */}
                        {task.tags && task.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {task.tags.map(tag => (
                              <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs border border-gray-200">
                                <Hash className="h-3 w-3" />
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Task Response (if completed) */}
                        {task.status === 'completed' && task.claude_response && expandedItems.has(task.id) && (
                          <div className="mt-4 p-3 bg-emerald-50 rounded-md border border-emerald-100">
                            <h4 className="text-sm font-medium text-emerald-800 mb-2">Claude's Response</h4>
                            <pre className="text-xs text-emerald-700 overflow-x-auto whitespace-pre-wrap">
                              {task.claude_response}
                            </pre>
                          </div>
                        )}

                        {/* Created At */}
                        {expandedItems.has(task.id) && (
                          <div className="mt-2 text-xs text-gray-500">
                            Created: {new Date(task.created_at).toLocaleString()}
                            {task.completed_at && (
                              <span className="ml-4">Completed: {new Date(task.completed_at).toLocaleString()}</span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex gap-2 ml-4">
                        {isEditing ? (
                          <>
                            <button
                              onClick={saveChanges}
                              disabled={saving}
                              className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium transition-colors disabled:opacity-50"
                            >
                              <Save className="h-4 w-4 mr-1" />
                              {saving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="inline-flex items-center px-3 py-1.5 bg-gray-400 text-white rounded-md hover:bg-gray-500 text-sm font-medium transition-colors"
                            >
                              <X className="h-4 w-4 mr-1" />
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEditing(item)}
                              className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium transition-colors"
                            >
                              <Edit2 className="h-4 w-4 mr-1" />
                              Edit
                            </button>
                            <Link
                              to={`/tasks/${task.id}`}
                              className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium transition-colors"
                            >
                              View Task
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
          })}
        </div>

        {filteredItems.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-600 border border-gray-100">
            No work items found matching your criteria
          </div>
        )}
      </div>

      {/* Validation Modal */}
      {selectedSummaryForValidation && (
        <WorkSummaryValidationModal
          isOpen={validationModalOpen}
          onClose={() => {
            setValidationModalOpen(false);
            setSelectedSummaryForValidation(null);
          }}
          workSummary={selectedSummaryForValidation}
        />
      )}
    </DashboardLayout>
  );
}