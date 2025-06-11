import { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { format, differenceInDays, differenceInHours } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { extractNextPhase, formatNextPhaseSummary } from '@shared/utils/markdown-phase-extractor';
import type { PhaseInfo } from '@shared/utils/markdown-phase-extractor';
import { CreateTaskFromPhase } from '../components/CreateTaskFromPhase';
import { useNavigate } from 'react-router-dom';
import { PlusCircleIcon, Search } from '@heroicons/react/24/outline';
import { serverRegistry } from '@shared/services/server-registry-service';
import { ServerStatusIndicator } from '../components/ServerStatusIndicator';

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
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [loadingMarkdown, setLoadingMarkdown] = useState(false);
  const [creatingTaskFor, setCreatingTaskFor] = useState<{doc: LivingDocument, phase: PhaseInfo} | null>(null);
  const [showPriorityDashboard, setShowPriorityDashboard] = useState(false);
  const [priorityDashboard, setPriorityDashboard] = useState<string>('');
  const [generatingDashboard, setGeneratingDashboard] = useState(false);
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
          category: 'documentation'
        },
        {
          fileName: 'admin-dashboard-implementation-system.md',
          path: '/docs/living-docs/admin-dashboard-implementation-system.md',
          description: 'Implementation guide for the administrative dashboard system with component architecture and best practices.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'development'
        },
        {
          fileName: 'apps-documentation.md',
          path: '/docs/living-docs/apps-documentation.md',
          description: 'Comprehensive documentation of all applications in the monorepo including features, setup, and maintenance.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'medium',
          status: 'active',
          category: 'documentation'
        },
        {
          fileName: 'batch-processing-system.md',
          path: '/docs/living-docs/batch-processing-system.md',
          description: 'Design and implementation of the batch processing system for handling large-scale operations efficiently.',
          updateFrequency: 'daily',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'infrastructure'
        },
        {
          fileName: 'claude-md-candidates.md',
          path: '/docs/living-docs/claude-md-candidates.md',
          description: 'Candidate updates and improvements for CLAUDE.md based on discovered patterns and solutions.',
          updateFrequency: 'daily',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'documentation'
        },
        {
          fileName: 'claude-md-management-guide.md',
          path: '/docs/living-docs/claude-md-management-guide.md',
          description: 'Guide for managing and updating CLAUDE.md with versioning, review processes, and integration strategies.',
          updateFrequency: 'daily',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'documentation'
        },
        {
          fileName: 'claude-tasks-editing-implementation.md',
          path: '/docs/living-docs/claude-tasks-editing-implementation.md',
          description: 'Implementation details for Claude task editing functionality including UI components and data flow.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'medium',
          status: 'active',
          category: 'development'
        },
        {
          fileName: 'cli-pipelines-documentation.md',
          path: '/docs/living-docs/cli-pipelines-documentation.md',
          description: 'Documentation of CLI pipeline architecture, commands, and best practices for extending functionality.',
          updateFrequency: 'daily',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'development'
        },
        {
          fileName: 'cli-pipelines-documentation-updated-2025-06-08.md',
          path: '/docs/living-docs/cli-pipelines-documentation-updated-2025-06-08.md',
          description: 'Updated CLI pipelines documentation with latest patterns and consolidated commands.',
          updateFrequency: 'daily',
          lastUpdated: '2025-06-08T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'development'
        },
        {
          fileName: 'code-continuous-monitoring.md',
          path: '/docs/living-docs/code-continuous-monitoring.md',
          description: 'System for continuous code monitoring including health checks, metrics, and automated alerts.',
          updateFrequency: 'daily',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'infrastructure'
        },
        {
          fileName: 'continuous-documentation-monitoring-vision.md',
          path: '/docs/living-docs/continuous-documentation-monitoring-vision.md',
          description: 'Vision and architecture for automated documentation monitoring and update systems.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'medium',
          status: 'active',
          category: 'documentation'
        },
        {
          fileName: 'continuous-monitoring-implementation-guide.md',
          path: '/docs/living-docs/continuous-monitoring-implementation-guide.md',
          description: 'Step-by-step guide for implementing continuous monitoring across different system components.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'infrastructure'
        },
        {
          fileName: 'database-architecture-guide.md',
          path: '/docs/living-docs/database-architecture-guide.md',
          description: 'Comprehensive guide to database architecture including schema design, optimization, and best practices.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'infrastructure'
        },
        {
          fileName: 'database-maintenance-guide.md',
          path: '/docs/living-docs/database-maintenance-guide.md',
          description: 'Guide for routine database maintenance tasks including backups, optimizations, and health checks.',
          updateFrequency: 'daily',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'infrastructure'
        },
        {
          fileName: 'deployment-management-system.md',
          path: '/docs/living-docs/deployment-management-system.md',
          description: 'System for managing deployments with safety checks, rollback capabilities, and audit trails.',
          updateFrequency: 'daily',
          lastUpdated: '2025-06-11T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'infrastructure'
        },
        {
          fileName: 'dev-tasks-lifecycle-management-guide.md',
          path: '/docs/living-docs/dev-tasks-lifecycle-management-guide.md',
          description: 'Guide for managing development task lifecycles from creation through completion and archival.',
          updateFrequency: 'daily',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'development'
        },
        {
          fileName: 'dev-tasks-success-criteria-enhancement.md',
          path: '/docs/living-docs/dev-tasks-success-criteria-enhancement.md',
          description: 'Enhancement guide for defining and tracking success criteria in development tasks.',
          updateFrequency: 'daily',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'development'
        },
        {
          fileName: 'dev-tasks-system.md',
          path: '/docs/living-docs/dev-tasks-system.md',
          description: 'Core system documentation for development task tracking and management infrastructure.',
          updateFrequency: 'daily',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'development'
        },
        {
          fileName: 'document-archiving-strategy.md',
          path: '/docs/living-docs/document-archiving-strategy.md',
          description: 'Strategy for archiving documents including retention policies, storage optimization, and retrieval.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'medium',
          status: 'active',
          category: 'documentation'
        },
        {
          fileName: 'documentation-management-system.md',
          path: '/docs/living-docs/documentation-management-system.md',
          description: 'System for managing all project documentation including versioning, review cycles, and publishing.',
          updateFrequency: 'daily',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'documentation'
        },
        {
          fileName: 'element-catalog-system-guide.md',
          path: '/docs/living-docs/element-catalog-system-guide.md',
          description: 'Guide for cataloging and managing UI elements and components across applications.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'medium',
          status: 'active',
          category: 'development'
        },
        {
          fileName: 'element-success-criteria-gates-system.md',
          path: '/docs/living-docs/element-success-criteria-gates-system.md',
          description: 'System for defining and enforcing success criteria gates for UI elements and features.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'medium',
          status: 'active',
          category: 'development'
        },
        {
          fileName: 'git-history-analysis-server.md',
          path: '/docs/living-docs/git-history-analysis-server.md',
          description: 'Server implementation for analyzing git history and providing insights on code evolution.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'medium',
          status: 'active',
          category: 'infrastructure'
        },
        {
          fileName: 'google-drive-integration.md',
          path: '/docs/living-docs/google-drive-integration.md',
          description: 'Integration guide for Google Drive including authentication, file operations, and sync strategies.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'integration'
        },
        {
          fileName: 'granular-success-criteria-system.md',
          path: '/docs/living-docs/granular-success-criteria-system.md',
          description: 'System for defining granular success criteria with measurable outcomes and validation.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'medium',
          status: 'active',
          category: 'development'
        },
        {
          fileName: 'hardcoded-values-parameterization-guide.md',
          path: '/docs/living-docs/hardcoded-values-parameterization-guide.md',
          description: 'Guide for identifying and parameterizing hardcoded values to improve configurability.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'medium',
          status: 'active',
          category: 'development'
        },
        {
          fileName: 'living-docs-prioritization-system.md',
          path: '/docs/living-docs/living-docs-prioritization-system.md',
          description: 'System for prioritizing living documents based on value, effort, and impact analysis.',
          updateFrequency: 'daily',
          lastUpdated: '2025-06-11T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'documentation'
        },
        {
          fileName: 'mp4-pipeline-auto-update-system.md',
          path: '/docs/living-docs/mp4-pipeline-auto-update-system.md',
          description: 'Automated update system for MP4 processing pipeline with monitoring and error handling.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'medium',
          status: 'active',
          category: 'infrastructure'
        },
        {
          fileName: 'mp4-to-m4a-pipeline-implementation.md',
          path: '/docs/living-docs/mp4-to-m4a-pipeline-implementation.md',
          description: 'Implementation guide for audio extraction pipeline converting MP4 to M4A format.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'medium',
          status: 'active',
          category: 'infrastructure'
        },
        {
          fileName: 'prompt-service-implementation-progress.md',
          path: '/docs/living-docs/prompt-service-implementation-progress.md',
          description: 'Progress tracking for prompt service implementation including milestones and blockers.',
          updateFrequency: 'daily',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'development'
        },
        {
          fileName: 'script-and-prompt-management-guide.md',
          path: '/docs/living-docs/script-and-prompt-management-guide.md',
          description: 'Guide for managing scripts and prompts including versioning, testing, and deployment.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'medium',
          status: 'active',
          category: 'development'
        },
        {
          fileName: 'server-registry-implementation-guide.md',
          path: '/docs/living-docs/server-registry-implementation-guide.md',
          description: 'Implementation guide for server registry system with dynamic port management.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'infrastructure'
        },
        {
          fileName: 'service-dependency-system.md',
          path: '/docs/living-docs/service-dependency-system.md',
          description: 'System for tracking and managing service dependencies with impact analysis.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'infrastructure'
        },
        {
          fileName: 'success-criteria-implementation-guide.md',
          path: '/docs/living-docs/success-criteria-implementation-guide.md',
          description: 'Guide for implementing success criteria across different system components.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'medium',
          status: 'active',
          category: 'development'
        },
        {
          fileName: 'supabase-free-plan-optimization-guide.md',
          path: '/docs/living-docs/supabase-free-plan-optimization-guide.md',
          description: 'Guide for optimizing Supabase usage within free plan limits including caching strategies.',
          updateFrequency: 'daily',
          lastUpdated: '2025-06-11T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'infrastructure'
        },
        {
          fileName: 'testing-quick-start-dhg-apps.md',
          path: '/docs/living-docs/testing-quick-start-dhg-apps.md',
          description: 'Quick start guide for testing DHG applications with examples and best practices.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'medium',
          status: 'active',
          category: 'testing'
        },
        {
          fileName: 'testing-vision-and-implementation-guide.md',
          path: '/docs/living-docs/testing-vision-and-implementation-guide.md',
          description: 'Vision and implementation guide for comprehensive testing strategy across all applications.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'testing'
        },
        {
          fileName: 'testing-vision-and-implementation.md',
          path: '/docs/living-docs/testing-vision-and-implementation.md',
          description: 'Core testing vision document outlining principles, strategies, and implementation roadmap.',
          updateFrequency: 'weekly',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'testing'
        },
        {
          fileName: 'unassigned-tasks-analysis-and-recommendations.md',
          path: '/docs/living-docs/unassigned-tasks-analysis-and-recommendations.md',
          description: 'Analysis of unassigned tasks with recommendations for prioritization and assignment.',
          updateFrequency: 'daily',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'medium',
          status: 'active',
          category: 'development'
        },
        {
          fileName: 'work-summary-validation-system.md',
          path: '/docs/living-docs/work-summary-validation-system.md',
          description: 'System for validating work summaries with follow-up tasks and quality assurance.',
          updateFrequency: 'daily',
          lastUpdated: '2025-06-11T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'development'
        },
        {
          fileName: 'worktree-assignment-system.md',
          path: '/docs/living-docs/worktree-assignment-system.md',
          description: 'System for managing worktree assignments and tracking work across multiple branches.',
          updateFrequency: 'daily',
          lastUpdated: '2025-06-09T08:00:00Z',
          priority: 'high',
          status: 'active',
          category: 'development'
        }
      ];
      
      setDocuments(livingDocs);
      
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
  const priorities = ['high', 'medium', 'low'];
  const statuses = ['active', 'draft', 'archived'];

  // Filter documents by category, priority, status, and search
  const filteredDocuments = documents.filter(doc => {
    const matchesCategory = !selectedCategory || doc.category === selectedCategory;
    const matchesPriority = !selectedPriority || doc.priority === selectedPriority;
    const matchesStatus = !selectedStatus || doc.status === selectedStatus;
    const matchesSearch = !searchQuery || 
      doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.category.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesCategory && matchesPriority && matchesStatus && matchesSearch;
  });

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

  // Remove applied filters
  const removeFilter = (type: 'category' | 'priority' | 'status') => {
    switch (type) {
      case 'category':
        setSelectedCategory(null);
        break;
      case 'priority':
        setSelectedPriority(null);
        break;
      case 'status':
        setSelectedStatus(null);
        break;
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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents..."
                className="w-full px-4 py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
          </div>

          {/* Filter Pills */}
          <div className="mb-4 space-y-2">
            {/* Category Pills */}
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-600 font-medium mr-2">Category:</span>
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  !selectedCategory
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Priority Pills */}
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-600 font-medium mr-2">Priority:</span>
              <button
                onClick={() => setSelectedPriority(null)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  !selectedPriority
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {priorities.map(priority => (
                <button
                  key={priority}
                  onClick={() => setSelectedPriority(priority)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                    selectedPriority === priority
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {getPriorityIcon(priority)} {priority}
                </button>
              ))}
            </div>

            {/* Status Pills */}
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-600 font-medium mr-2">Status:</span>
              <button
                onClick={() => setSelectedStatus(null)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  !selectedStatus
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {statuses.map(status => (
                <button
                  key={status}
                  onClick={() => setSelectedStatus(status)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedStatus === status
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            {/* Active Filters */}
            {(selectedCategory || selectedPriority || selectedStatus) && (
              <div className="flex flex-wrap gap-2 pt-2">
                <span className="text-sm text-gray-600">Active filters:</span>
                {selectedCategory && (
                  <button
                    onClick={() => removeFilter('category')}
                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium flex items-center gap-1 hover:bg-blue-200"
                  >
                    {selectedCategory}
                    <span className="text-blue-600">×</span>
                  </button>
                )}
                {selectedPriority && (
                  <button
                    onClick={() => removeFilter('priority')}
                    className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium flex items-center gap-1 hover:bg-purple-200"
                  >
                    {selectedPriority}
                    <span className="text-purple-600">×</span>
                  </button>
                )}
                {selectedStatus && (
                  <button
                    onClick={() => removeFilter('status')}
                    className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium flex items-center gap-1 hover:bg-green-200"
                  >
                    {selectedStatus}
                    <span className="text-green-600">×</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mb-4 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Showing {filteredDocuments.length} of {documents.length} documents
            </div>
            
            <button
              onClick={generatePriorityDashboard}
              disabled={generatingDashboard}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {generatingDashboard ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Priority Dashboard
                </>
              )}
            </button>
          </div>

          {/* Document Cards */}
          <div className="space-y-4">
            {filteredDocuments.map((doc) => (
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
                        setCreatingTaskFor({ doc, phase: doc.nextPhase });
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
            ))}
            
            {filteredDocuments.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No documents match your filters
              </div>
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
          phase={creatingTaskFor.phase}
          documentTitle={creatingTaskFor.doc.fileName}
          documentPath={creatingTaskFor.doc.path}
          onClose={() => setCreatingTaskFor(null)}
          onTaskCreated={(taskId) => {
            setCreatingTaskFor(null);
            navigate(`/tasks?id=${taskId}`);
          }}
        />
      )}
    </DashboardLayout>
  );
}