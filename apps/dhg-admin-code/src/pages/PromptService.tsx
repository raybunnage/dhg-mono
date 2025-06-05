import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Search, 
  FileText, 
  Clock, 
  Zap, 
  Hash, 
  ChevronDown, 
  ChevronUp,
  Play,
  Settings,
  BarChart3,
  Plus,
  Edit,
  Loader2,
  X,
  Save,
  Info,
  Code2,
  LinkIcon
} from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Prompt {
  id: string;
  name: string;
  description: string | null;
  content: any;
  metadata: any;
  document_type_id: string | null;
  category_id: string | null;
  created_at: string;
  updated_at: string;
  version: string | null;
  status: 'active' | 'draft' | 'deprecated' | 'archived';
  author: string | null;
  tags: string[] | null;
  file_path: string | null;
  // Fields that will be added by migration
  execution_count?: number;
  avg_tokens?: number;
  avg_execution_time_ms?: number;
  last_executed_at?: string;
  supported_document_types?: string[];
  supported_mime_types?: string[];
  priority?: number;
}

interface DocumentType {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  is_general_type: boolean | null;
  is_ai_generated: boolean | null;
  mnemonic: string | null;
  prompt_id: string | null;
  expected_json_schema: any | null;
  created_at: string | null;
  updated_at: string | null;
}

interface PromptCategory {
  id: string;
  name: string;
  description: string | null;
}

interface OutputTemplate {
  id: string;
  name: string;
  description: string | null;
  template: any;
}

export function PromptService() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [categories, setCategories] = useState<PromptCategory[]>([]);
  const [templates, setTemplates] = useState<OutputTemplate[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set());
  const [executingPrompt, setExecutingPrompt] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configPrompt, setConfigPrompt] = useState<Prompt | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [promptsResult, categoriesResult, templatesResult, documentTypesResult] = await Promise.all([
        supabase
          .from('ai_prompts')
          .select('*')
          .order('name'),
        supabase
          .from('ai_prompt_categories')
          .select('*')
          .order('name'),
        supabase
          .from('ai_prompt_output_templates')
          .select('*')
          .order('name'),
        supabase
          .from('document_types')
          .select('*')
          .order('name')
      ]);

      if (promptsResult.error) throw promptsResult.error;
      if (categoriesResult.error) throw categoriesResult.error;
      if (templatesResult.error) throw templatesResult.error;
      if (documentTypesResult.error) throw documentTypesResult.error;

      setPrompts(promptsResult.data || []);
      setCategories(categoriesResult.data || []);
      setTemplates(templatesResult.data || []);
      setDocumentTypes(documentTypesResult.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedPrompts);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedPrompts(newExpanded);
  };

  const executePrompt = async (promptId: string) => {
    setExecutingPrompt(promptId);
    // Simulate execution - in real implementation, this would call the API
    setTimeout(() => {
      setExecutingPrompt(null);
      alert('Prompt execution would be implemented here');
    }, 2000);
  };

  const handleEdit = (prompt: Prompt) => {
    setEditingPrompt(prompt);
    setShowEditModal(true);
  };

  const handleConfig = (prompt: Prompt) => {
    setConfigPrompt(prompt);
    setShowConfigModal(true);
  };

  const getDocumentTypesForPrompt = (promptId: string): DocumentType[] => {
    return documentTypes.filter(dt => dt.prompt_id === promptId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'deprecated':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'archived':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPromptContent = (content: any): string => {
    if (typeof content === 'string') return content;
    if (content?.content) return content.content;
    if (content?.text) return content.text;
    return JSON.stringify(content, null, 2);
  };

  const filteredPrompts = prompts.filter(prompt => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        prompt.name.toLowerCase().includes(query) ||
        (prompt.description?.toLowerCase().includes(query) ?? false) ||
        (prompt.tags?.some(tag => tag.toLowerCase().includes(query)) ?? false);
      if (!matchesSearch) return false;
    }

    // Category filter
    if (selectedCategory !== 'all' && prompt.category_id !== selectedCategory) {
      return false;
    }

    // Status filter
    if (selectedStatus !== 'all' && prompt.status !== selectedStatus) {
      return false;
    }

    return true;
  });

  // Calculate stats
  const activePrompts = prompts.filter(p => p.status === 'active').length;
  const totalExecutions = prompts.reduce((sum, p) => sum + (p.execution_count || 0), 0);
  const avgExecutionTime = prompts
    .filter(p => p.avg_execution_time_ms)
    .reduce((sum, p, _, arr) => sum + (p.avg_execution_time_ms || 0) / arr.length, 0);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-700">Loading prompts...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div>
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Prompt Service</h1>
          <p className="text-gray-600">Manage AI prompts, templates, and execution tracking</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900">{prompts.length}</div>
                <div className="text-sm text-gray-700">Total Prompts</div>
              </div>
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-green-900">{activePrompts}</div>
                <div className="text-sm text-gray-700">Active Prompts</div>
              </div>
              <Zap className="h-8 w-8 text-green-400" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-blue-900">{totalExecutions}</div>
                <div className="text-sm text-gray-700">Total Executions</div>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-400" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-purple-900">
                  {avgExecutionTime ? `${Math.round(avgExecutionTime)}ms` : 'N/A'}
                </div>
                <div className="text-sm text-gray-700">Avg Execution Time</div>
              </div>
              <Clock className="h-8 w-8 text-purple-400" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search prompts..."
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
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 bg-gray-50 focus:bg-white transition-colors"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="deprecated">Deprecated</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {filteredPrompts.length} of {prompts.length} prompts
            </div>
            <button className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors">
              <Plus className="h-4 w-4 mr-2" />
              New Prompt
            </button>
          </div>
        </div>

        {/* Prompts List */}
        <div className="space-y-4">
          {filteredPrompts.map(prompt => {
            const category = categories.find(c => c.id === prompt.category_id);
            const isExpanded = expandedPrompts.has(prompt.id);
            
            return (
              <div key={prompt.id} className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-100">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Header */}
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{prompt.name}</h3>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${getStatusColor(prompt.status)}`}>
                          {prompt.status}
                        </span>
                        {category && (
                          <span className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs border border-blue-200">
                            {category.name}
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      {prompt.description && (
                        <p className="text-gray-600 mb-3">{prompt.description}</p>
                      )}

                      {/* Metadata */}
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-3">
                        {prompt.execution_count !== undefined && prompt.execution_count > 0 && (
                          <span className="flex items-center gap-1">
                            <Play className="h-4 w-4" />
                            {prompt.execution_count} executions
                          </span>
                        )}
                        {prompt.avg_execution_time_ms && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {prompt.avg_execution_time_ms}ms avg
                          </span>
                        )}
                        {prompt.avg_tokens && (
                          <span className="flex items-center gap-1">
                            <Hash className="h-4 w-4" />
                            {prompt.avg_tokens} tokens avg
                          </span>
                        )}
                        {prompt.version && (
                          <span className="text-gray-500">v{prompt.version}</span>
                        )}
                      </div>

                      {/* Tags */}
                      {prompt.tags && prompt.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {prompt.tags.map(tag => (
                            <span key={tag} className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs border border-gray-200">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Document Type Mappings */}
                      {(prompt.supported_document_types?.length || prompt.supported_mime_types?.length) && (
                        <div className="mb-3">
                          {prompt.supported_document_types && prompt.supported_document_types.length > 0 && (
                            <div className="mb-2">
                              <span className="text-xs font-medium text-gray-700">Document Types: </span>
                              {prompt.supported_document_types.map(dt => (
                                <span key={dt} className="inline-flex items-center px-2 py-1 bg-purple-50 text-purple-700 rounded-md text-xs border border-purple-200 ml-2">
                                  {dt}
                                </span>
                              ))}
                            </div>
                          )}
                          {prompt.supported_mime_types && prompt.supported_mime_types.length > 0 && (
                            <div>
                              <span className="text-xs font-medium text-gray-700">MIME Types: </span>
                              {prompt.supported_mime_types.map(mt => (
                                <span key={mt} className="inline-flex items-center px-2 py-1 bg-orange-50 text-orange-700 rounded-md text-xs border border-orange-200 ml-2">
                                  {mt}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Prompt Content (Expandable) */}
                      {isExpanded && (
                        <div className="mt-4 space-y-4">
                          {/* Document Types Using This Prompt */}
                          {(() => {
                            const linkedDocTypes = getDocumentTypesForPrompt(prompt.id);
                            if (linkedDocTypes.length > 0) {
                              return (
                                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                  <h4 className="text-sm font-medium text-blue-900 mb-2 flex items-center gap-2">
                                    <LinkIcon className="h-4 w-4" />
                                    Document Types Using This Prompt ({linkedDocTypes.length})
                                  </h4>
                                  <div className="space-y-2">
                                    {linkedDocTypes.map(dt => (
                                      <div key={dt.id} className="bg-white p-3 rounded border border-blue-100">
                                        <div className="flex items-start justify-between">
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                              <span className="font-medium text-gray-900">{dt.name}</span>
                                              {dt.mnemonic && (
                                                <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">
                                                  {dt.mnemonic}
                                                </span>
                                              )}
                                              {dt.category && (
                                                <span className="text-xs text-gray-600">
                                                  ({dt.category})
                                                </span>
                                              )}
                                            </div>
                                            {dt.description && (
                                              <p className="text-sm text-gray-600 mt-1">{dt.description}</p>
                                            )}
                                            {dt.expected_json_schema && (
                                              <details className="mt-2">
                                                <summary className="cursor-pointer text-xs text-blue-700 hover:text-blue-800 font-medium">
                                                  View Expected JSON Output Schema
                                                </summary>
                                                <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                                                  {JSON.stringify(dt.expected_json_schema, null, 2)}
                                                </pre>
                                              </details>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })()}

                          {/* Prompt Content */}
                          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <h4 className="text-sm font-medium text-gray-800 mb-2">Prompt Content</h4>
                            <pre className="text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap">
                              {getPromptContent(prompt.content)}
                            </pre>
                          </div>
                          
                          {/* Metadata */}
                          {prompt.metadata && Object.keys(prompt.metadata).length > 0 && (
                            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                              <h4 className="text-sm font-medium text-gray-800 mb-2">Metadata</h4>
                              <pre className="text-xs text-gray-700 overflow-x-auto">
                                {JSON.stringify(prompt.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => executePrompt(prompt.id)}
                        disabled={prompt.status !== 'active' || executingPrompt === prompt.id}
                        className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                          prompt.status !== 'active' 
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        {executingPrompt === prompt.id ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4 mr-1" />
                        )}
                        Execute
                      </button>
                      <button 
                        onClick={() => handleEdit(prompt)}
                        className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium transition-colors"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </button>
                      <button 
                        onClick={() => handleConfig(prompt)}
                        className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium transition-colors"
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        Config
                      </button>
                    </div>
                  </div>

                  {/* Expand/Collapse Button */}
                  <button
                    onClick={() => toggleExpanded(prompt.id)}
                    className="mt-4 text-sm text-gray-600 hover:text-gray-800 font-medium flex items-center gap-1 transition-colors"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        Hide details
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" />
                        Show details
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredPrompts.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-600 border border-gray-100">
            No prompts found matching your criteria
          </div>
        )}

        {/* Config Modal - Document Type Associations */}
        {showConfigModal && configPrompt && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Configure Prompt: {configPrompt.name}
                  </h2>
                  <button
                    onClick={() => {
                      setShowConfigModal(false);
                      setConfigPrompt(null);
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Document Type Associations */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <LinkIcon className="h-5 w-5" />
                    Document Type Associations
                  </h3>
                  
                  {(() => {
                    const linkedDocTypes = getDocumentTypesForPrompt(configPrompt.id);
                    const unlinkedDocTypes = documentTypes.filter(dt => dt.prompt_id !== configPrompt.id);
                    
                    return (
                      <div className="space-y-4">
                        {/* Currently Linked */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">
                            Currently Linked ({linkedDocTypes.length})
                          </h4>
                          {linkedDocTypes.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {linkedDocTypes.map(dt => (
                                <div key={dt.id} className="bg-green-50 p-3 rounded-lg border border-green-200">
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <div className="font-medium text-gray-900">{dt.name}</div>
                                      {dt.category && (
                                        <div className="text-xs text-gray-600 mt-1">{dt.category}</div>
                                      )}
                                    </div>
                                    {dt.expected_json_schema && (
                                      <Code2 className="h-4 w-4 text-green-700" title="Has JSON Schema" />
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500 italic">
                              No document types are currently using this prompt
                            </div>
                          )}
                        </div>

                        {/* Available to Link */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">
                            Available Document Types ({unlinkedDocTypes.length})
                          </h4>
                          {unlinkedDocTypes.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                              {unlinkedDocTypes.map(dt => (
                                <div key={dt.id} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <div className="font-medium text-gray-900">{dt.name}</div>
                                      {dt.category && (
                                        <div className="text-xs text-gray-600 mt-1">{dt.category}</div>
                                      )}
                                    </div>
                                    <button 
                                      className="text-xs text-blue-600 hover:text-blue-700"
                                      title="This would link the document type to this prompt"
                                    >
                                      Link →
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500 italic">
                              All document types are already linked to prompts
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Prompt Info */}
                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Info className="h-5 w-5" />
                    Prompt Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Status:</span>
                      <span className={`ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs border ${getStatusColor(configPrompt.status)}`}>
                        {configPrompt.status}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Version:</span>
                      <span className="ml-2 text-gray-900">{configPrompt.version || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Author:</span>
                      <span className="ml-2 text-gray-900">{configPrompt.author || 'Unknown'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Created:</span>
                      <span className="ml-2 text-gray-900">
                        {new Date(configPrompt.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 mt-4 border-t">
                  <button
                    onClick={() => {
                      setShowConfigModal(false);
                      setConfigPrompt(null);
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}