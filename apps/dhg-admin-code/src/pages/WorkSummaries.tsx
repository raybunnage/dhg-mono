import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Search, Calendar, Tag, Command, ChevronDown, ChevronUp, ArrowLeft, CheckCircle, Clock, AlertCircle, FileText, Hash } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { TaskService } from '../services/task-service';
import type { DevTask, DevTaskTag } from '../services/task-service';
import { supabase } from '../lib/supabase';
import { WorkSummaryService, type WorkSummary, type WorkItem } from '@shared/services/work-summary-service';

// Create work summary service instance
const workSummaryService = WorkSummaryService.getInstance(supabase);

interface TaskWithTags extends DevTask {
  tags: string[];
}

export function WorkSummaries() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [summaries, setSummaries] = useState<WorkSummary[]>([]);
  const [tasks, setTasks] = useState<TaskWithTags[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<WorkItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    combineWorkItems();
  }, [summaries, tasks]);

  useEffect(() => {
    filterWorkItems();
  }, [searchQuery, selectedCategory, selectedType, workItems]);

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
          return (item.data as WorkSummary).category === selectedCategory;
        } else {
          const task = item.data as TaskWithTags;
          return task.task_type === selectedCategory || task.status === selectedCategory;
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
            summary.tags?.some(tag => tag.toLowerCase().includes(query));
        } else {
          const task = item.data as TaskWithTags;
          return task.title.toLowerCase().includes(query) ||
            task.description.toLowerCase().includes(query) ||
            task.tags?.some(tag => tag.toLowerCase().includes(query));
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

  const categories = ['all', ...Array.from(new Set([
    ...summaries.map(s => s.category).filter(Boolean),
    ...tasks.map(t => t.task_type).filter(Boolean),
    ...tasks.map(t => t.status).filter(Boolean)
  ]))];

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
      default:
        return 'bg-orange-100 text-orange-800 border-orange-200';
    }
  };

  const getCategoryEmoji = (category: string) => {
    const emojis: Record<string, string> = {
      'bug_fix': '🐛',
      'feature': '✨',
      'refactoring': '🔧',
      'documentation': '📚',
      'completed': '✅',
      'in_progress': '🔄'
    };
    return emojis[category] || '📋';
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Work Summaries</h1>
          <p className="text-gray-600">Track and manage AI assistant work history and development tasks</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search work items, tasks, commands..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 bg-gray-50 focus:bg-white transition-colors"
              />
            </div>

            {/* Type Filter */}
            <div>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 bg-gray-50 focus:bg-white transition-colors"
              >
                <option value="all">All Types</option>
                <option value="summary">Work Summaries</option>
                <option value="task">Dev Tasks</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 bg-gray-50 focus:bg-white transition-colors"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
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
        </div>

        {/* Work Items List */}
        <div className="space-y-4">
          {filteredItems.map(item => {
            if (item.type === 'summary') {
              const summary = item.data as WorkSummary;
              return (
                <div key={summary.id} className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-100">
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{getCategoryEmoji(summary.category)}</span>
                          <h3 className="text-lg font-semibold text-gray-900">{summary.title}</h3>
                          <span className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs border border-blue-200">
                            Summary
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-700 mb-3">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {new Date(summary.work_date).toLocaleDateString()}
                          </span>
                          {summary.category && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">
                              {summary.category.replace('_', ' ')}
                            </span>
                          )}
                        </div>

                        {/* Summary Content with better expansion */}
                        <div className="mb-3">
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
                        </div>

                        {/* Commands and Tags */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          {summary.commands?.map(cmd => (
                            <span key={cmd} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs border border-gray-200">
                              <Command className="h-3 w-3" />
                              {cmd}
                            </span>
                          ))}
                          {summary.tags?.map(tag => (
                            <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md text-xs border border-emerald-200">
                              <Tag className="h-3 w-3" />
                              {tag}
                            </span>
                          ))}
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
                      </div>
                    </div>
                  </div>
                </div>
              );
            } else {
              const task = item.data as TaskWithTags;
              return (
                <div key={task.id} className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-100">
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getTaskStatusIcon(task.status)}
                          <h3 className="text-lg font-semibold text-gray-900">
                            <Link to={`/tasks/${task.id}`} className="hover:text-gray-700 transition-colors">
                              {task.title}
                            </Link>
                          </h3>
                          <span className="inline-flex items-center px-2 py-1 bg-purple-50 text-purple-700 rounded-full text-xs border border-purple-200">
                            Task
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-sm text-gray-600 flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {new Date(task.created_at).toLocaleDateString()}
                          </span>
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
                        </div>

                        {/* Task Description */}
                        <div className="mb-3">
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
                      </div>
                      
                      {/* Action Button */}
                      <div>
                        <Link
                          to={`/tasks/${task.id}`}
                          className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium transition-colors"
                        >
                          View Task
                        </Link>
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
    </DashboardLayout>
  );
}