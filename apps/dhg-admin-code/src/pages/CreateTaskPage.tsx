import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { TaskService } from '../services/task-service';
import { ArrowLeft, Save, ChevronRight } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { supabase } from '../lib/supabase';
import { ElementCatalogService } from '@shared/services/element-catalog-service';
import { ElementCriteriaService } from '@shared/services/element-criteria-service';
import type { TaskElement } from '@shared/services/element-catalog-service';

interface WorktreeDefinition {
  id: string;
  path: string;
  alias_name: string;
  alias_number: string;
  emoji: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export default function CreateTaskPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customBranchName, setCustomBranchName] = useState<string>('');
  const [selectedWorktree, setSelectedWorktree] = useState<WorktreeDefinition | null>(null);
  const [availableApps, setAvailableApps] = useState<string[]>([]);
  const [availablePipelines, setAvailablePipelines] = useState<string[]>([]);
  
  // Direct state for worktree data (like WorktreeMappings page)
  const [worktrees, setWorktrees] = useState<WorktreeDefinition[]>([]);
  const [appMappings, setAppMappings] = useState<any[]>([]);
  const [pipelineMappings, setPipelineMappings] = useState<any[]>([]);
  const [worktreesLoading, setWorktreesLoading] = useState(true);
  
  // Element selection state
  const [showElementSelector, setShowElementSelector] = useState(false);
  const [availableElements, setAvailableElements] = useState<TaskElement[]>([]);
  const [selectedElement, setSelectedElement] = useState<TaskElement | null>(null);
  const [elementsLoading, setElementsLoading] = useState(false);
  const [elementCriteria, setElementCriteria] = useState<{ criteriaCount: number; gatesCount: number }>({ criteriaCount: 0, gatesCount: 0 });
  const elementCatalog = ElementCatalogService.getInstance(supabase);
  const criteriaService = ElementCriteriaService.getInstance(supabase);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    task_type: 'feature' as 'bug' | 'feature' | 'refactor' | 'question',
    priority: 'medium' as 'low' | 'medium' | 'high',
    app: '',
    tags: '',
    work_mode: 'single-file' as 'single-file' | 'feature' | 'exploration' | 'cross-repo',
    worktree_path: ''
  });

  // Load worktree data on mount (exactly like WorktreeMappings page)
  useEffect(() => {
    loadWorktreeData();
  }, []);

  const loadWorktreeData = async () => {
    try {
      setWorktreesLoading(true);
      
      // Load worktree definitions
      const { data: worktreeData, error: worktreeError } = await supabase
        .from('worktree_definitions')
        .select('*')
        .order('alias_number');
      
      if (worktreeError) {
        console.error('Error loading worktrees:', worktreeError);
        setError('Failed to load worktrees');
        return;
      }
      
      setWorktrees(worktreeData || []);
      console.log('✅ Loaded', worktreeData?.length, 'worktrees for CreateTaskPage');
      
      // Load app mappings
      const { data: appData, error: appError } = await supabase
        .from('worktree_app_mappings')
        .select('*');
      
      if (appError) console.error('Error loading app mappings:', appError);
      setAppMappings(appData || []);
      
      // Load pipeline mappings
      const { data: pipelineData, error: pipelineError } = await supabase
        .from('worktree_pipeline_mappings')
        .select('*');
      
      if (pipelineError) console.error('Error loading pipeline mappings:', pipelineError);
      setPipelineMappings(pipelineData || []);
      
    } catch (err) {
      console.error('Error in loadWorktreeData:', err);
      setError('Failed to load worktree data');
    } finally {
      setWorktreesLoading(false);
    }
  };

  // Helper functions
  const getAppsForWorktree = (worktreeId: string): string[] => {
    return appMappings
      .filter(m => m.worktree_id === worktreeId)
      .map(m => m.app_name)
      .sort();
  };

  const getPipelinesForWorktree = (worktreeId: string): string[] => {
    return pipelineMappings
      .filter(m => m.worktree_id === worktreeId)
      .map(m => m.pipeline_name)
      .sort();
  };

  const getWorktreeByPath = (path: string): WorktreeDefinition | undefined => {
    return worktrees.find(w => w.path === path);
  };

  const getWorktreeLabel = (worktree: WorktreeDefinition): string => {
    return `${worktree.emoji} ${worktree.alias_number}/${worktree.alias_name} - ${worktree.path}`;
  };

  // Update available apps and pipelines when worktree changes
  useEffect(() => {
    if (selectedWorktree) {
      const apps = getAppsForWorktree(selectedWorktree.id);
      const pipelines = getPipelinesForWorktree(selectedWorktree.id);
      
      setAvailableApps(apps);
      setAvailablePipelines(pipelines);
      
      // Reset app selection if it's not available in the new worktree
      if (formData.app && 
          !apps.includes(formData.app) && 
          !pipelines.some(p => `cli-${p}` === formData.app)) {
        setFormData(prev => ({ ...prev, app: '' }));
      }
    } else {
      setAvailableApps([]);
      setAvailablePipelines([]);
    }
  }, [selectedWorktree?.id]); // Remove function dependencies

  // Load elements when app/pipeline is selected
  useEffect(() => {
    if (formData.app) {
      loadAvailableElements();
    } else {
      setAvailableElements([]);
      setSelectedElement(null);
      setShowElementSelector(false);
      setElementCriteria({ criteriaCount: 0, gatesCount: 0 });
    }
  }, [formData.app]);

  // Load criteria counts when element is selected
  useEffect(() => {
    if (selectedElement) {
      loadElementCriteria();
    } else {
      setElementCriteria({ criteriaCount: 0, gatesCount: 0 });
    }
  }, [selectedElement]);

  const loadAvailableElements = async () => {
    if (!formData.app) return;
    
    setElementsLoading(true);
    try {
      let type: 'app' | 'cli_pipeline' | 'service';
      
      if (formData.app.startsWith('cli-')) {
        type = 'cli_pipeline';
      } else if (formData.app.includes('service')) {
        type = 'service';
      } else {
        type = 'app';
      }
      
      const elements = await elementCatalog.getAvailableElements(type, formData.app);
      setAvailableElements(elements);
      
      // Show element selector if there are elements available
      if (elements.length > 0) {
        setShowElementSelector(true);
      }
    } catch (error) {
      console.error('Error loading elements:', error);
    } finally {
      setElementsLoading(false);
    }
  };

  const loadElementCriteria = async () => {
    if (!selectedElement) return;
    
    try {
      const [criteria, gates] = await Promise.all([
        criteriaService.getElementCriteria(selectedElement.element_type, selectedElement.element_id),
        criteriaService.getElementGates(selectedElement.element_type, selectedElement.element_id)
      ]);
      
      setElementCriteria({
        criteriaCount: criteria.length,
        gatesCount: gates.length
      });
    } catch (error) {
      console.error('Error loading element criteria:', error);
    }
  };

  // Generate branch name from title and type
  const generateBranchName = (title: string, type: string): string => {
    const kebabCase = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .trim()
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
    
    // Generate a short unique suffix (first 6 chars of timestamp)
    const suffix = Date.now().toString(36).slice(-6);
    
    return `${type}/${kebabCase}-${suffix}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.description.trim()) {
      setError('Title and description are required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Use custom branch name if provided, otherwise use generated name
      const needsBranch = formData.work_mode === 'feature' || formData.work_mode === 'exploration';
      const gitBranch = needsBranch 
        ? (customBranchName || generateBranchName(formData.title, formData.task_type))
        : undefined;

      // Create the task
      const task = await TaskService.createTask({
        title: formData.title,
        description: formData.description,
        task_type: formData.task_type,
        priority: formData.priority,
        app: formData.app || undefined,
        status: 'pending',
        git_branch: gitBranch,
        work_mode: formData.work_mode,
        requires_branch: needsBranch,
        worktree_path: formData.worktree_path || undefined
      });

      // Link selected element to the task if one was chosen
      if (selectedElement && task.id) {
        await elementCatalog.linkElementToTask(
          task.id,
          selectedElement.element_type,
          selectedElement.element_id,
          selectedElement.name
        );
        
        // Inherit criteria and gates from the element
        const inheritedCount = await criteriaService.inheritToTask(
          task.id,
          selectedElement.element_type,
          selectedElement.element_id
        );
        
        console.log(`Inherited ${inheritedCount} criteria/gates from element`);
      }

      // Add tags if provided
      if (formData.tags.trim()) {
        const tags = formData.tags.split(',').map(t => t.trim()).filter(t => t);
        for (const tag of tags) {
          await TaskService.addTag(task.id, tag);
        }
      }

      // Navigate to the task detail page
      navigate(`/tasks/${task.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Link
          to="/tasks"
          className="inline-flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
          Back to Tasks
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Task</h1>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Worktree Selection */}
          <div>
            <label htmlFor="worktree" className="block text-sm font-medium text-gray-700 mb-1">
              Worktree *
            </label>
            <select
              id="worktree"
              value={formData.worktree_path}
              onChange={(e) => {
                const path = e.target.value;
                const worktree = getWorktreeByPath(path);
                setSelectedWorktree(worktree || null);
                setFormData({ ...formData, worktree_path: path });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              disabled={loading || worktreesLoading}
              required
            >
              <option value="">
                {worktreesLoading ? 'Loading worktrees...' : 'Select a worktree...'}
              </option>
              {worktrees.map(worktree => (
                <option key={worktree.path} value={worktree.path}>
                  {getWorktreeLabel(worktree)}
                </option>
              ))}
            </select>
            {selectedWorktree && (
              <p className="mt-1 text-sm text-gray-500">
                {selectedWorktree.description}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => {
                const newTitle = e.target.value;
                setFormData({ ...formData, title: newTitle });
                // Auto-update branch name if user hasn't customized it
                if ((formData.work_mode === 'feature' || formData.work_mode === 'exploration') && 
                    (!customBranchName || customBranchName === generateBranchName(formData.title, formData.task_type))) {
                  setCustomBranchName(generateBranchName(newTitle, formData.task_type));
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Brief description of the task"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description *
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Detailed description of what needs to be done. Include acceptance criteria if applicable."
              disabled={loading}
            />
            <p className="mt-1 text-sm text-gray-500">
              Tip: Use markdown formatting for better readability
            </p>
          </div>

          <div>
            <label htmlFor="work_mode" className="block text-sm font-medium text-gray-700 mb-1">
              Work Mode
            </label>
            <select
              id="work_mode"
              value={formData.work_mode}
              onChange={(e) => {
                const mode = e.target.value as typeof formData.work_mode;
                setFormData({ 
                  ...formData, 
                  work_mode: mode
                });
                // Reset custom branch name when changing work mode
                if (mode === 'feature' || mode === 'exploration') {
                  setCustomBranchName(generateBranchName(formData.title, formData.task_type));
                } else {
                  setCustomBranchName('');
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              disabled={loading}
            >
              <option value="single-file">Single File - Quick fix or small change</option>
              <option value="feature">Feature - Substantial new functionality</option>
              <option value="exploration">Exploration - Research or experimentation</option>
              <option value="cross-repo">Cross-Repo - Spans multiple repositories</option>
            </select>
            <div className="mt-2 space-y-1">
              <p className="text-sm text-gray-500">
                {formData.work_mode === 'single-file' && 'Quick fixes that don\'t need a branch'}
                {formData.work_mode === 'feature' && 'New features that need isolated development (branch will be created)'}
                {formData.work_mode === 'exploration' && 'Research tasks (branch will be created for isolation)'}
                {formData.work_mode === 'cross-repo' && 'Tasks that span multiple repositories'}
              </p>
              {/* Removed inline branch display - will show in dedicated section */}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="task_type" className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                id="task_type"
                value={formData.task_type}
                onChange={(e) => setFormData({ ...formData, task_type: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                disabled={loading}
              >
                <option value="feature">Feature</option>
                <option value="bug">Bug</option>
                <option value="refactor">Refactor</option>
                <option value="question">Question</option>
              </select>
            </div>

            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                id="priority"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                disabled={loading}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="app" className="block text-sm font-medium text-gray-700 mb-1">
              Application / Pipeline {selectedWorktree && '(filtered by worktree)'}
            </label>
            <select
              id="app"
              value={formData.app}
              onChange={(e) => setFormData({ ...formData, app: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              disabled={loading || !selectedWorktree}
            >
              <option value="">
                {selectedWorktree ? 'Select an app or pipeline...' : 'Select a worktree first...'}
              </option>
              {availableApps.length > 0 && (
                <optgroup label="Applications">
                  {availableApps.map(app => (
                    <option key={app} value={app}>{app}</option>
                  ))}
                </optgroup>
              )}
              {availablePipelines.length > 0 && (
                <optgroup label="CLI Pipelines">
                  {availablePipelines.map(pipeline => (
                    <option key={`cli-${pipeline}`} value={`cli-${pipeline}`}>cli-{pipeline}</option>
                  ))}
                </optgroup>
              )}
            </select>
            <p className="mt-1 text-sm text-gray-500">
              {selectedWorktree 
                ? `${availableApps.length} apps and ${availablePipelines.length} pipelines available in this worktree`
                : 'Select a worktree to see available apps and pipelines'
              }
            </p>
          </div>

          {/* Element Selection - Show when app/pipeline is selected */}
          {showElementSelector && formData.app && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Specific Element (Optional)
              </label>
              
              {elementsLoading ? (
                <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    Loading available elements...
                  </div>
                </div>
              ) : availableElements.length > 0 ? (
                <div className="space-y-2">
                  <select
                    value={selectedElement?.element_id || ''}
                    onChange={(e) => {
                      const element = availableElements.find(el => el.element_id === e.target.value);
                      setSelectedElement(element || null);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    disabled={loading}
                  >
                    <option value="">Select a specific {formData.app.startsWith('cli-') ? 'command' : 'feature'}...</option>
                    
                    {/* Group elements by subcategory */}
                    {Object.entries(
                      availableElements.reduce((groups, element) => {
                        const key = element.subcategory;
                        if (!groups[key]) groups[key] = [];
                        groups[key].push(element);
                        return groups;
                      }, {} as Record<string, TaskElement[]>)
                    ).map(([subcategory, elements]) => (
                      <optgroup key={subcategory} label={subcategory.charAt(0).toUpperCase() + subcategory.slice(1) + 's'}>
                        {elements.map(element => (
                          <option key={element.element_id} value={element.element_id}>
                            {element.name}
                            {element.description && ` - ${element.description.substring(0, 50)}${element.description.length > 50 ? '...' : ''}`}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  
                  {selectedElement && (
                    <div className="mt-2 p-3 bg-blue-50 rounded-md border border-blue-200">
                      <div className="flex items-start">
                        <ChevronRight className="w-4 h-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                        <div className="text-sm flex-1">
                          <p className="font-medium text-blue-900">{selectedElement.name}</p>
                          {selectedElement.path && (
                            <p className="text-xs text-blue-700 font-mono mt-1">{selectedElement.path}</p>
                          )}
                          {selectedElement.description && (
                            <p className="text-xs text-blue-600 mt-1">{selectedElement.description}</p>
                          )}
                          
                          {/* Show criteria and gates counts */}
                          <div className="mt-2 flex items-center gap-3 text-xs">
                            {elementCriteria.criteriaCount > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                                ✓ {elementCriteria.criteriaCount} success criteria defined
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                No criteria defined
                              </span>
                            )}
                            
                            {elementCriteria.gatesCount > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                                🚪 {elementCriteria.gatesCount} quality gates defined
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                No gates defined
                              </span>
                            )}
                          </div>
                          
                          {(elementCriteria.criteriaCount > 0 || elementCriteria.gatesCount > 0) && (
                            <p className="text-xs text-blue-600 mt-2 italic">
                              These criteria and gates will be inherited by your task
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-500 italic">
                  No elements cataloged for this {formData.app.startsWith('cli-') ? 'pipeline' : 'app'} yet.
                  {formData.app.startsWith('cli-') ? (
                    <span className="block mt-1">
                      Run <code className="bg-gray-100 px-1 py-0.5 rounded">./scripts/cli-pipeline/registry/registry-cli.sh scan-pipelines</code> to catalog commands.
                    </span>
                  ) : (
                    <span className="block mt-1">
                      Run <code className="bg-gray-100 px-1 py-0.5 rounded">./scripts/cli-pipeline/registry/registry-cli.sh scan-app-features --app {formData.app}</code> to catalog features.
                    </span>
                  )}
                </div>
              )}
              
              <p className="mt-1 text-sm text-gray-500">
                Choose a specific {formData.app.startsWith('cli-') ? 'command' : 'component, page, or feature'} you plan to work on
              </p>
            </div>
          )}

          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1">
              Tags
            </label>
            <input
              id="tags"
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="frontend, api, database (comma separated)"
              disabled={loading}
            />
          </div>

          {/* Branch Configuration - Only show when branch will be created */}
          {(formData.work_mode === 'feature' || formData.work_mode === 'exploration') && (
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h4 className="text-sm font-medium text-blue-900 mb-2">🌿 Git Branch Configuration</h4>
              <p className="text-sm text-blue-800 mb-3">
                A git branch will be created for this task. You can customize the branch name below.
              </p>
              
              <div className="space-y-3">
                <div>
                  <label htmlFor="branchName" className="block text-xs font-medium text-gray-700 mb-1">
                    Branch Name
                  </label>
                  <input
                    id="branchName"
                    type="text"
                    value={customBranchName || generateBranchName(formData.title || 'untitled', formData.task_type)}
                    onChange={(e) => setCustomBranchName(e.target.value)}
                    onFocus={() => {
                      // Set custom branch name if not already set when focusing
                      if (!customBranchName && formData.title) {
                        setCustomBranchName(generateBranchName(formData.title, formData.task_type));
                      }
                    }}
                    className="w-full px-3 py-2 bg-white border border-blue-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="feature/branch-name"
                    disabled={loading}
                  />
                  <p className="mt-1 text-xs text-gray-600">
                    Tip: Use format like feature/description-abc123 or bugfix/issue-name
                  </p>
                </div>
                
                {customBranchName && customBranchName !== generateBranchName(formData.title || '', formData.task_type) && (
                  <button
                    type="button"
                    onClick={() => setCustomBranchName(generateBranchName(formData.title || 'untitled', formData.task_type))}
                    className="text-xs text-blue-700 hover:text-blue-900 underline"
                  >
                    Reset to auto-generated name
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-4">
            <Link
              to="/tasks"
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" aria-hidden="true" />
                  Create Task
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
    </DashboardLayout>
  );
}