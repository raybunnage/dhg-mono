import { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { format, differenceInDays, differenceInHours } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { extractNextPhase, formatNextPhaseSummary } from '@shared/utils/markdown-phase-extractor';
import type { PhaseInfo } from '@shared/utils/markdown-phase-extractor';
import { CreateTaskFromPhase } from '../components/CreateTaskFromPhase';
import { useNavigate } from 'react-router-dom';
import { PlusCircleIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { serverRegistry } from '@shared/services/server-registry-service';
import { ServerStatusIndicator } from '../components/ServerStatusIndicator';
import { supabase } from '../lib/supabase';

interface LivingDocument {
  fileName: string;
  path: string;
  description: string;
  updateFrequency: 'daily' | 'weekly' | 'on-change';
  lastUpdated: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'active' | 'draft' | 'archived';
  category: string;
  nextPhase?: PhaseInfo;
}

export function LivingDocsPage() {
  const [documents, setDocuments] = useState<LivingDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<LivingDocument | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [loadingMarkdown, setLoadingMarkdown] = useState(false);
  const [creatingTaskFor, setCreatingTaskFor] = useState<{doc: LivingDocument, phase: PhaseInfo} | null>(null);
  const [showPriorityDashboard, setShowPriorityDashboard] = useState(false);
  const [priorityDashboard, setPriorityDashboard] = useState<string>('');
  const [generatingDashboard, setGeneratingDashboard] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'recent' | 'critical' | 'needs-update'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  // Load documents from the database
  const loadDocuments = async () => {
    try {
      setLoading(true);
      
      // Fetch documents from the database
      const { data, error: dbError } = await supabase
        .from('doc_living_docs_metadata')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (dbError) {
        console.error('Database error:', dbError);
        throw new Error('Failed to fetch documents from database');
      }
      
      // Transform the database records to match our interface
      const livingDocs: LivingDocument[] = (data || []).map(doc => ({
        fileName: doc.file_name,
        path: doc.file_path,
        description: doc.description || `Documentation for ${doc.file_name.replace('.md', '')}`,
        updateFrequency: doc.update_frequency || 'weekly',
        lastUpdated: doc.last_updated || doc.created_at,
        priority: doc.priority || 'medium',
        status: doc.status || 'active',
        category: doc.category || 'general'
      }));
      
      // Sort documents: template first, then by priority and name
      const sortedDocs = livingDocs.sort((a, b) => {
        if (a.category === 'template') return -1;
        if (b.category === 'template') return 1;
        
        // Define priority order including 'critical' 
        const priorityOrder: Record<string, number> = { 
          critical: 0, 
          high: 1, 
          medium: 2, 
          low: 3 
        };
        
        if (a.priority !== b.priority) {
          const aPriority = priorityOrder[a.priority] ?? 4;
          const bPriority = priorityOrder[b.priority] ?? 4;
          return aPriority - bPriority;
        }
        
        return a.fileName.localeCompare(b.fileName);
      });
      
      setDocuments(sortedDocs);
      
    } catch (err) {
      console.error('Error loading documents:', err);
      setError('Failed to load living documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  // Refresh documents from filesystem
  const refreshDocuments = async () => {
    try {
      setRefreshing(true);
      
      // Get the living docs server URL
      const livingDocsUrl = await serverRegistry.getServerUrl('living-docs-server');
      
      // Call the server to refresh documents
      const response = await fetch(`${livingDocsUrl}/api/living-docs/refresh`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to refresh documents');
      }
      
      // Reload documents after refresh
      await loadDocuments();
      
    } catch (err) {
      console.error('Error refreshing documents:', err);
      setError('Failed to refresh documents');
    } finally {
      setRefreshing(false);
    }
  };

  // Generate priority dashboard
  const generatePriorityDashboard = async () => {
    try {
      setGeneratingDashboard(true);
      
      const livingDocsUrl = await serverRegistry.getServerUrl('living-docs-server');
      const response = await fetch(`${livingDocsUrl}/api/living-docs/priority-dashboard`);
      
      if (!response.ok) {
        throw new Error('Failed to generate priority dashboard');
      }
      
      const data = await response.json();
      setPriorityDashboard(data.dashboard);
      setShowPriorityDashboard(true);
      setSelectedDocument(null);
    } catch (error) {
      console.error('Error generating priority dashboard:', error);
      setError('Failed to generate priority dashboard');
    } finally {
      setGeneratingDashboard(false);
    }
  };

  // Load markdown content for preview
  const loadMarkdownContent = async (document: LivingDocument) => {
    try {
      setLoadingMarkdown(true);
      setSelectedDocument(document);
      
      const mdServerUrl = await serverRegistry.getServerUrl('md-server');
      const response = await fetch(`${mdServerUrl}/api/markdown-file?path=${encodeURIComponent(document.path)}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch markdown content');
      }
      
      const data = await response.json();
      const content = data.content || 'Unable to load content';
      setMarkdownContent(content);
      
      // Extract phase information from the content
      const phaseInfo = extractNextPhase(content);
      if (phaseInfo && document) {
        document.nextPhase = phaseInfo;
      }
      
    } catch (error) {
      console.error('Error loading markdown:', error);
      setMarkdownContent('Failed to load document content');
    } finally {
      setLoadingMarkdown(false);
    }
  };

  // Get unique categories
  const categories = Array.from(new Set(documents.map(doc => doc.category))).sort();
  const priorities = ['critical', 'high', 'medium', 'low'];
  const statuses = ['active', 'draft', 'archived'];

  // Apply filters
  let filteredDocuments = documents;

  // Check if document needs update
  const needsUpdate = (doc: LivingDocument): boolean => {
    const lastUpdate = new Date(doc.lastUpdated);
    const now = new Date();
    
    switch (doc.updateFrequency) {
      case 'daily':
        return differenceInDays(now, lastUpdate) >= 1;
      case 'weekly':
        return differenceInDays(now, lastUpdate) >= 7;
      case 'on-change':
        // Would need to check if source file changed
        return false;
      default:
        return differenceInDays(now, lastUpdate) >= 7;
    }
  };

  // Category filter
  if (selectedCategory) {
    filteredDocuments = filteredDocuments.filter(doc => doc.category === selectedCategory);
  }

  // Priority filter
  if (selectedPriority) {
    filteredDocuments = filteredDocuments.filter(doc => doc.priority === selectedPriority);
  }

  // Status filter
  if (selectedStatus) {
    filteredDocuments = filteredDocuments.filter(doc => doc.status === selectedStatus);
  }

  // Search filter
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredDocuments = filteredDocuments.filter(doc => 
      doc.fileName.toLowerCase().includes(query) ||
      doc.description.toLowerCase().includes(query) ||
      doc.category.toLowerCase().includes(query)
    );
  }

  // Active filter pills
  switch (activeFilter) {
    case 'recent':
      // Sort by last updated, show top 10
      filteredDocuments = [...filteredDocuments]
        .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
        .slice(0, 10);
      break;
    case 'critical':
      filteredDocuments = filteredDocuments.filter(doc => 
        doc.priority === 'critical' || doc.priority === 'high'
      );
      break;
    case 'needs-update':
      filteredDocuments = filteredDocuments.filter(doc => needsUpdate(doc));
      break;
    // 'all' shows everything (default)
  }

  // Get time until next update
  const getNextUpdateTime = (doc: LivingDocument): string => {
    const lastUpdate = new Date(doc.lastUpdated);
    const now = new Date();
    
    let nextUpdate: Date;
    switch (doc.updateFrequency) {
      case 'daily':
        nextUpdate = new Date(lastUpdate);
        nextUpdate.setDate(nextUpdate.getDate() + 1);
        break;
      case 'weekly':
        nextUpdate = new Date(lastUpdate);
        nextUpdate.setDate(nextUpdate.getDate() + 7);
        break;
      case 'on-change':
        return 'On file change';
      default:
        nextUpdate = new Date(lastUpdate);
        nextUpdate.setDate(nextUpdate.getDate() + 7);
    }
    
    if (nextUpdate <= now) {
      return 'Update due';
    }
    
    const hours = differenceInHours(nextUpdate, now);
    if (hours < 24) {
      return `${hours}h`;
    }
    
    const days = differenceInDays(nextUpdate, now);
    return `${days}d`;
  };

  // Get badge colors based on category
  const getCategoryBadgeColor = (category: string): string => {
    const colors: Record<string, string> = {
      'documentation': 'bg-blue-100 text-blue-800',
      'development': 'bg-purple-100 text-purple-800',
      'infrastructure': 'bg-green-100 text-green-800',
      'testing': 'bg-yellow-100 text-yellow-800',
      'integration': 'bg-indigo-100 text-indigo-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  // Get badge colors based on priority
  const getPriorityBadgeColor = (priority: string): string => {
    const colors: Record<string, string> = {
      'critical': 'bg-red-200 text-red-900',
      'high': 'bg-red-100 text-red-800',
      'medium': 'bg-yellow-100 text-yellow-800',
      'low': 'bg-green-100 text-green-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  // Get badge colors based on update frequency
  const getFrequencyBadgeColor = (frequency: string): string => {
    const colors: Record<string, string> = {
      'daily': 'bg-purple-100 text-purple-800',
      'weekly': 'bg-blue-100 text-blue-800',
      'on-change': 'bg-gray-100 text-gray-800'
    };
    return colors[frequency] || 'bg-gray-100 text-gray-800';
  };

  // Get priority icon
  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical':
        return '🚨';
      case 'high':
        return '🔥';
      case 'medium':
        return '🟡';
      case 'low':
        return '🔵';
      default:
        return '⚪';
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading living documents...</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex h-screen">
        {/* Left Panel - Document Cards */}
        <div className="w-1/2 p-6 overflow-y-auto border-r border-gray-200">
          <div className="mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Living Docs</h1>
                <p className="mt-2 text-gray-600">
                  Living documentation that evolves with your project and stays current.
                </p>
              </div>
              <ServerStatusIndicator serviceName="md-server" />
            </div>
          </div>

          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
          </div>

          {/* Filter Pills and Actions */}
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            {/* Filter Pills */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  activeFilter === 'all' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                All ({documents.length})
              </button>
              <button
                onClick={() => setActiveFilter('recent')}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  activeFilter === 'recent' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Recent
              </button>
              <button
                onClick={() => setActiveFilter('critical')}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  activeFilter === 'critical' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                High Priority
              </button>
              <button
                onClick={() => setActiveFilter('needs-update')}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  activeFilter === 'needs-update' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Needs Update
              </button>
            </div>

            {/* Divider */}
            <div className="h-6 w-px bg-gray-300"></div>

            {/* Category Dropdown */}
            <select
              value={selectedCategory || ''}
              onChange={(e) => setSelectedCategory(e.target.value || null)}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Priority and Status Dropdowns */}
            <select
              value={selectedPriority || ''}
              onChange={(e) => setSelectedPriority(e.target.value || null)}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Priorities</option>
              {priorities.map(priority => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus || ''}
              onChange={(e) => setSelectedStatus(e.target.value || null)}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              {statuses.map(status => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            {/* Action Buttons */}
            <div className="ml-auto flex gap-2">
              <button
                onClick={refreshDocuments}
                disabled={refreshing}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                {refreshing ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    Refreshing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </>
                )}
              </button>
              
              <button
                onClick={generatePriorityDashboard}
                disabled={generatingDashboard}
                className="px-3 py-1 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                {generatingDashboard ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Dashboard
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results Count */}
          {(searchQuery || activeFilter !== 'all' || selectedCategory || selectedPriority || selectedStatus) && (
            <div className="mb-4 text-sm text-gray-600">
              Showing {filteredDocuments.length} of {documents.length} documents
              {searchQuery && ` matching "${searchQuery}"`}
            </div>
          )}

          {/* Document Cards */}
          <div className="space-y-4">
            {filteredDocuments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No documents found matching your criteria.
              </div>
            ) : (
              filteredDocuments.map((doc) => (
                <div
                  key={doc.fileName}
                  className={`bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow ${
                    selectedDocument?.fileName === doc.fileName ? 'ring-2 ring-blue-500' : ''
                  } ${needsUpdate(doc) ? 'border-l-4 border-orange-500' : ''}`}
                  onClick={() => loadMarkdownContent(doc)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      {getPriorityIcon(doc.priority)}
                      {doc.fileName.replace('.md', '')}
                    </h3>
                    {doc.nextPhase && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (doc.nextPhase) {
                            setCreatingTaskFor({ doc, phase: doc.nextPhase });
                          }
                        }}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="Create task from next phase"
                      >
                        <PlusCircleIcon className="w-5 h-5 text-gray-600" />
                      </button>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3">{doc.description}</p>
                  
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className={`px-2 py-1 rounded ${getCategoryBadgeColor(doc.category)}`}>
                      {doc.category}
                    </span>
                    <span className={`px-2 py-1 rounded ${getPriorityBadgeColor(doc.priority)}`}>
                      {doc.priority} priority
                    </span>
                    <span className={`px-2 py-1 rounded ${getFrequencyBadgeColor(doc.updateFrequency)}`}>
                      {doc.updateFrequency} updates
                    </span>
                    {doc.status !== 'active' && (
                      <span className="px-2 py-1 rounded bg-gray-100 text-gray-800">
                        {doc.status}
                      </span>
                    )}
                    <span className={`px-2 py-1 rounded ${needsUpdate(doc) ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'}`}>
                      {needsUpdate(doc) ? '⚠️ Update due' : `Next: ${getNextUpdateTime(doc)}`}
                    </span>
                  </div>

                  {doc.nextPhase && (
                    <div className="mt-3 p-2 bg-blue-50 rounded text-sm">
                      <strong className="text-blue-900">Next Phase:</strong>
                      <span className="text-blue-700 ml-1">{formatNextPhaseSummary(doc.nextPhase)}</span>
                    </div>
                  )}

                  <div className="mt-2 text-xs text-gray-500">
                    Last updated: {format(new Date(doc.lastUpdated), 'MMM d, yyyy')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel - Document Preview or Priority Dashboard */}
        <div className="w-1/2 p-6 bg-gray-50">
          {showPriorityDashboard ? (
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="mb-4 pb-4 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Living Documents Priority Dashboard
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Phase 1 priorities across all living documents
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowPriorityDashboard(false);
                    setPriorityDashboard('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Dashboard Content */}
              <div className="flex-1 overflow-y-auto">
                <div className="bg-white rounded-lg p-6 h-full border border-gray-200 overflow-y-auto">
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {priorityDashboard}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          ) : selectedDocument ? (
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="mb-4 pb-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  {selectedDocument.fileName.replace('.md', '')}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedDocument.description}
                </p>
                <div className="flex gap-2 mt-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded ${getCategoryBadgeColor(selectedDocument.category)}`}>
                    {selectedDocument.category}
                  </span>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${getFrequencyBadgeColor(selectedDocument.updateFrequency)}`}>
                    {selectedDocument.updateFrequency}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto">
                {loadingMarkdown ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-3 text-gray-600">Loading document...</span>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg p-6 h-full border border-gray-200 overflow-y-auto">
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {markdownContent}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <div className="text-6xl mb-4">📄</div>
                <p className="text-lg font-medium">Select a document to preview</p>
                <p className="text-sm mt-2">Click on any document card to view its content</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Task Modal */}
      {creatingTaskFor && (
        <CreateTaskFromPhase
          phaseInfo={creatingTaskFor.phase}
          docTitle={creatingTaskFor.doc.fileName}
          docPath={creatingTaskFor.doc.path}
          onCancel={() => setCreatingTaskFor(null)}
          onTaskCreated={(taskId) => {
            setCreatingTaskFor(null);
            navigate(`/tasks?id=${taskId}`);
          }}
        />
      )}
    </DashboardLayout>
  );
}