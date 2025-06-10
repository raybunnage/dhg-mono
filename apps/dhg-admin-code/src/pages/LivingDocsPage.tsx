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

interface LivingDocument {
  fileName: string;
  path: string;
  description: string;
  updateFrequency: 'daily' | 'weekly' | 'on-change';
  lastUpdated: string;
  priority: 'high' | 'medium' | 'low';
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
  const navigate = useNavigate();

  // Load documents from the living-docs folder
  const loadDocuments = async () => {
    try {
      setLoading(true);
      
      // Define the documents with their descriptions and metadata
      const livingDocs: LivingDocument[] = [
        {
          fileName: 'CONTINUOUSLY-UPDATED-TEMPLATE-GUIDE.md',
          path: '/docs/living-docs/CONTINUOUSLY-UPDATED-TEMPLATE-GUIDE.md',
          description: 'Template and guidelines for maintaining living documentation with proper structure and review schedules.',
          updateFrequency: 'daily',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'template'
        },
        {
          fileName: 'apps-documentation.md',
          path: '/docs/living-docs/apps-documentation.md',
          description: 'Comprehensive documentation for all DHG monorepo applications including configuration, deployment, and usage patterns.',
          updateFrequency: 'daily',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'architecture'
        },
        {
          fileName: 'cli-pipelines-documentation.md',
          path: '/docs/living-docs/cli-pipelines-documentation.md',
          description: 'Architecture and usage documentation for CLI pipeline system including command structure and integration patterns.',
          updateFrequency: 'daily',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'architecture'
        },
        {
          fileName: 'claude-tasks-editing-implementation.md',
          path: '/docs/living-docs/claude-tasks-editing-implementation.md',
          description: 'Implementation guide for Claude task editing system including modal components, form validation, and database integration.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'medium',
          status: 'active',
          category: 'implementation'
        },
        {
          fileName: 'code-continuous-monitoring.md',
          path: '/docs/living-docs/code-continuous-monitoring.md',
          description: 'System for monitoring code changes and automatically updating documentation to maintain synchronization.',
          updateFrequency: 'daily',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'monitoring'
        },
        {
          fileName: 'database-maintenance-guide.md',
          path: '/docs/living-docs/database-maintenance-guide.md',
          description: 'Guidelines for database maintenance including migrations, cleanup procedures, and performance optimization.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'database'
        },
        {
          fileName: 'git-history-analysis-server.md',
          path: '/docs/living-docs/git-history-analysis-server.md',
          description: 'Server implementation for analyzing git history and extracting insights about code changes and development patterns.',
          updateFrequency: 'on-change',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'medium',
          status: 'active',
          category: 'tools'
        },
        {
          fileName: 'mp4-pipeline-auto-update-system.md',
          path: '/docs/living-docs/mp4-pipeline-auto-update-system.md',
          description: 'Automated system for processing MP4 files including conversion, metadata extraction, and storage management.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'medium',
          status: 'active',
          category: 'media'
        },
        {
          fileName: 'mp4-to-m4a-pipeline-implementation.md',
          path: '/docs/living-docs/mp4-to-m4a-pipeline-implementation.md',
          description: 'Implementation details for converting MP4 files to M4A audio format with quality preservation and batch processing.',
          updateFrequency: 'on-change',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'medium',
          status: 'active',
          category: 'media'
        },
        {
          fileName: 'prompt-service-implementation-progress.md',
          path: '/docs/living-docs/prompt-service-implementation-progress.md',
          description: 'Progress tracking for AI prompt service implementation including features, testing, and deployment status.',
          updateFrequency: 'daily',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'ai'
        },
        {
          fileName: 'script-and-prompt-management-guide.md',
          path: '/docs/living-docs/script-and-prompt-management-guide.md',
          description: 'Comprehensive guide for managing scripts and AI prompts including organization, versioning, and best practices.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'management'
        },
        {
          fileName: 'testing-quick-start-dhg-apps.md',
          path: '/docs/living-docs/testing-quick-start-dhg-apps.md',
          description: 'Quick start guide for setting up and running tests across all DHG applications with common patterns and utilities.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'medium',
          status: 'active',
          category: 'testing'
        },
        {
          fileName: 'testing-vision-and-implementation-guide.md',
          path: '/docs/living-docs/testing-vision-and-implementation-guide.md',
          description: 'Strategic vision and implementation roadmap for testing infrastructure including tools, processes, and quality standards.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'medium',
          status: 'active',
          category: 'testing'
        },
        {
          fileName: 'worktree-assignment-system.md',
          path: '/docs/living-docs/worktree-assignment-system.md',
          description: 'System for managing git worktree assignments and task allocation including automation and tracking capabilities.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'medium',
          status: 'active',
          category: 'git'
        },
        {
          fileName: 'dev-tasks-system.md',
          path: '/docs/living-docs/dev-tasks-system.md',
          description: 'Comprehensive dev task management system that bridges structured planning with AI-assisted development.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'management'
        },
        {
          fileName: 'database-architecture-guide.md',
          path: '/docs/living-docs/database-architecture-guide.md',
          description: 'Database architecture, naming conventions, and migration procedures with comprehensive table organization.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'database'
        },
        {
          fileName: 'service-dependency-system.md',
          path: '/docs/living-docs/service-dependency-system.md',
          description: 'Service dependency mapping system for understanding relationships between apps, pipelines, and shared services.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'architecture'
        },
        {
          fileName: 'google-drive-integration.md',
          path: '/docs/living-docs/google-drive-integration.md',
          description: 'Google Drive integration with audio streaming, local optimization, and AI-powered content analysis.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'integration'
        },
        {
          fileName: 'documentation-management-system.md',
          path: '/docs/living-docs/documentation-management-system.md',
          description: 'Living documentation system for managing 700+ docs with continuous monitoring and intelligent archiving.',
          updateFrequency: 'daily',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'documentation'
        },
        {
          fileName: 'batch-processing-system.md',
          path: '/docs/living-docs/batch-processing-system.md',
          description: 'Scalable batch processing system for handling large document sets with monitoring and error recovery.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'medium',
          status: 'active',
          category: 'processing'
        },
        {
          fileName: 'claude-md-management-guide.md',
          path: '/docs/living-docs/claude-md-management-guide.md',
          description: 'Comprehensive guide for managing CLAUDE.md size under 40k limit with tracking and optimization strategies.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'critical',
          status: 'active',
          category: 'management'
        },
        {
          fileName: 'claude-md-candidates.md',
          path: '/docs/living-docs/claude-md-candidates.md',
          description: 'Tracking document for potential CLAUDE.md additions with review process and size impact analysis.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'management'
        }
      ];
      
      // Sort documents: template first, then by priority and name
      const sortedDocs = livingDocs.sort((a, b) => {
        if (a.category === 'template') return -1;
        if (b.category === 'template') return 1;
        if (a.priority !== b.priority) {
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
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

  // Load markdown content for preview
  const loadMarkdownContent = async (document: LivingDocument) => {
    try {
      setLoadingMarkdown(true);
      setSelectedDocument(document);
      
      const response = await fetch(`http://localhost:3001/api/markdown-file?path=${encodeURIComponent(document.path)}`);
      
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

  // Filter documents by category
  const filteredDocuments = selectedCategory 
    ? documents.filter(doc => doc.category === selectedCategory)
    : documents;

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
            <h1 className="text-2xl font-bold text-gray-900">Living Docs</h1>
            <p className="mt-2 text-gray-600">
              Living documentation that evolves with your project and stays current.
            </p>
          </div>

          {/* Category Filter */}
          <div className="mb-4">
            <select
              value={selectedCategory || ''}
              onChange={(e) => setSelectedCategory(e.target.value || null)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Document Cards */}
          <div className="space-y-4">
            {filteredDocuments.map((doc) => (
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

        {/* Right Panel - Document Preview */}
        <div className="w-1/2 p-6 bg-gray-50">
          {selectedDocument ? (
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