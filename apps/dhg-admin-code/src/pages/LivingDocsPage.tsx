import { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { format, differenceInDays, differenceInHours } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { extractNextPhase, formatNextPhaseSummary } from '@shared/utils/markdown-phase-extractor';
import type { PhaseInfo } from '@shared/utils/markdown-phase-extractor';
import { CreateTaskFromPhase } from '../components/CreateTaskFromPhase';
import { useNavigate } from 'react-router-dom';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
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
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [loadingMarkdown, setLoadingMarkdown] = useState(false);
  const [creatingTaskFor, setCreatingTaskFor] = useState<{doc: LivingDocument, phase: PhaseInfo} | null>(null);
  const [showPriorityDashboard, setShowPriorityDashboard] = useState(false);
  const [priorityDashboard, setPriorityDashboard] = useState<string>('');
  const [generatingDashboard, setGeneratingDashboard] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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
      setError(null);
    } catch (err) {
      setError('Failed to load living documents.');
      console.error('Error loading documents:', err);
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
        // Update the document in the state
        setDocuments(docs => docs.map(doc => 
          doc.path === document.path ? { ...doc, nextPhase: phaseInfo } : doc
        ));
      }
    } catch (err) {
      console.error('Error loading markdown:', err);
      setMarkdownContent('Error loading document content. Make sure the markdown server is running on port 3001.');
    } finally {
      setLoadingMarkdown(false);
    }
  };

  // Get unique categories
  const categories = Array.from(new Set(documents.map(doc => doc.category))).sort();

  // Apply filters
  let filteredDocuments = documents;

  // Category filter
  if (selectedCategory) {
    filteredDocuments = filteredDocuments.filter(doc => doc.category === selectedCategory);
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
    
    const hoursUntil = differenceInHours(nextUpdate, now);
    if (hoursUntil < 24) {
      return `${hoursUntil} hours`;
    }
    
    const daysUntil = Math.floor(hoursUntil / 24);
    return `${daysUntil} days`;
  };

  // Get priority badge color
  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-purple-100 text-purple-800';
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'archived':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryBadgeColor = (category: string) => {
    const colors: Record<string, string> = {
      'template': 'bg-purple-100 text-purple-800',
      'architecture': 'bg-blue-100 text-blue-800',
      'implementation': 'bg-green-100 text-green-800',
      'monitoring': 'bg-orange-100 text-orange-800',
      'database': 'bg-indigo-100 text-indigo-800',
      'tools': 'bg-cyan-100 text-cyan-800',
      'media': 'bg-pink-100 text-pink-800',
      'ai': 'bg-red-100 text-red-800',
      'management': 'bg-yellow-100 text-yellow-800',
      'testing': 'bg-teal-100 text-teal-800',
      'git': 'bg-gray-100 text-gray-800',
      'integration': 'bg-emerald-100 text-emerald-800',
      'documentation': 'bg-amber-100 text-amber-800',
      'processing': 'bg-lime-100 text-lime-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const getFrequencyBadgeColor = (frequency: string) => {
    switch (frequency) {
      case 'daily':
        return 'bg-red-100 text-red-800';
      case 'weekly':
        return 'bg-yellow-100 text-yellow-800';
      case 'on-change':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
                className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Filter Pills and Actions - All on one line */}
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
                <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
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
          {(searchQuery || activeFilter !== 'all' || selectedCategory) && (
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
                key={doc.path}
                onClick={() => loadMarkdownContent(doc)}
                className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                  selectedDocument?.path === doc.path ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                } ${
                  needsUpdate(doc) ? 'border-l-4 border-l-orange-500' : ''
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 text-sm">
                    {doc.fileName.replace('.md', '')}
                  </h3>
                  {doc.category === 'template' && (
                    <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded font-medium">
                      TEMPLATE
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-sm text-gray-600 mb-3 leading-relaxed">
                  {doc.description}
                </p>

                {/* Badges */}
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded ${getCategoryBadgeColor(doc.category)}`}>
                    {doc.category}
                  </span>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${getPriorityBadgeColor(doc.priority)}`}>
                    {doc.priority} priority
                  </span>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${getFrequencyBadgeColor(doc.updateFrequency)}`}>
                    {doc.updateFrequency}
                  </span>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusBadgeColor(doc.status)}`}>
                    {doc.status}
                  </span>
                </div>

                {/* Next Phase Section */}
                {doc.nextPhase && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-md border border-blue-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-xs font-medium text-blue-900 mb-1">
                          Next Phase: {doc.nextPhase.phaseName}
                        </div>
                        <div className="text-xs text-blue-700">
                          {formatNextPhaseSummary(doc.nextPhase)}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCreatingTaskFor({ doc, phase: doc.nextPhase });
                        }}
                        className="ml-2 p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded transition-colors"
                        title="Create implementation task"
                      >
                        <PlusCircleIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Update Info */}
                <div className="flex justify-between items-center text-xs text-gray-500 mt-3">
                  <span>Updated: {format(new Date(doc.lastUpdated), 'MMM d, yyyy')}</span>
                  <span className={needsUpdate(doc) ? 'text-orange-600 font-medium' : ''}>
                    Next: {getNextUpdateTime(doc)}
                  </span>
                </div>

                {needsUpdate(doc) && (
                  <div className="mt-2 text-xs text-orange-600 font-medium">
                    ⚠️ Update overdue
                  </div>
                )}
              </div>
            ))}
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
          docTitle={creatingTaskFor.doc.fileName.replace('.md', '')}
          docPath={creatingTaskFor.doc.path}
          onTaskCreated={(taskId) => {
            setCreatingTaskFor(null);
            // Navigate to the task detail page
            navigate(`/tasks/${taskId}`);
          }}
          onCancel={() => setCreatingTaskFor(null)}
        />
      )}
    </DashboardLayout>
  );
}