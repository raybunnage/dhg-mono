import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Search, Calendar, Tag, Command, ChevronDown, ChevronUp, ArrowLeft, CheckCircle, Clock, AlertCircle, FileText, Hash } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { TaskService } from '../services/task-service';
import type { DevTask, DevTaskTag } from '../services/task-service';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface WorkSummary {
  id: string;
  title: string;
  summary_content: string;
  work_date: string;
  commands: string[];
  ui_components: string[];
  tags: string[];
  category: string;
  status: string;
  created_at: string;
  metadata?: any;
}

interface TaskWithTags extends DevTask {
  tags: string[];
}

interface WorkItem {
  type: 'summary' | 'task';
  date: string;
  data: WorkSummary | TaskWithTags;
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
    fetchSummaries();
  }, []);

  useEffect(() => {
    filterSummaries();
  }, [searchQuery, selectedCategory, summaries]);

  const fetchSummaries = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_work_summaries')
        .select('*')
        .order('work_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSummaries(data || []);
    } catch (error) {
      console.error('Error fetching summaries:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterSummaries = () => {
    let filtered = [...summaries];

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(s => s.category === selectedCategory);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.title.toLowerCase().includes(query) ||
        s.summary_content.toLowerCase().includes(query) ||
        s.commands?.some(cmd => cmd.toLowerCase().includes(query)) ||
        s.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    setFilteredSummaries(filtered);
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedSummaries);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedSummaries(newExpanded);
  };

  const categories = ['all', ...Array.from(new Set(summaries.map(s => s.category).filter(Boolean)))];

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
        {/* Description */}
        <div className="mb-6">
          <p className="text-gray-700">Track and search through AI assistant work history</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search summaries, commands, tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 bg-gray-50 focus:bg-white transition-colors"
              />
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

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
            <div className="text-2xl font-bold text-gray-900">{summaries.length}</div>
            <div className="text-sm text-gray-700">Total Summaries</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
            <div className="text-2xl font-bold text-gray-900">
              {summaries.filter(s => s.category === 'feature').length}
            </div>
            <div className="text-sm text-gray-700">Features Added</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
            <div className="text-2xl font-bold text-gray-900">
              {summaries.filter(s => s.category === 'bug_fix').length}
            </div>
            <div className="text-sm text-gray-700">Bugs Fixed</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
            <div className="text-2xl font-bold text-gray-900">
              {Array.from(new Set(summaries.flatMap(s => s.commands || []))).length}
            </div>
            <div className="text-sm text-gray-700">Commands Worked On</div>
          </div>
        </div>

        {/* Summaries List */}
        <div className="space-y-4">
          {filteredSummaries.map(summary => (
            <div key={summary.id} className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-100">
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{getCategoryEmoji(summary.category)}</span>
                      <h3 className="text-lg font-semibold text-gray-900">{summary.title}</h3>
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
                      <p className={`text-gray-800 ${expandedSummaries.has(summary.id) ? 'whitespace-pre-wrap' : 'overflow-hidden'}`}
                         style={expandedSummaries.has(summary.id) ? {} : { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                        {summary.summary_content}
                      </p>
                      {summary.summary_content.length > 200 && (
                        <button
                          onClick={() => toggleExpanded(summary.id)}
                          className="mt-2 text-sm text-gray-600 hover:text-gray-800 font-medium flex items-center gap-1 transition-colors"
                        >
                          {expandedSummaries.has(summary.id) ? (
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
                    {expandedSummaries.has(summary.id) && summary.metadata && (
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
          ))}
        </div>

        {filteredSummaries.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-600 border border-gray-100">
            No summaries found matching your criteria
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}