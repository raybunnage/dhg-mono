import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { TaskService } from '../services/task-service';
import { ArrowLeft, Save } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';

// Apps list
const APPS = [
  'dhg-hub',
  'dhg-hub-lovable',
  'dhg-audio',
  'dhg-admin-suite',
  'dhg-admin-code',
  'dhg-admin-google'
];

// CLI Pipelines list
const CLI_PIPELINES = [
  'ai',
  'all_pipelines',
  'analysis',
  'auth',
  'classify',
  'core',
  'database',
  'dev_tasks',
  'document',
  'document_types',
  'drive_filter',
  'examples',
  'experts',
  'google_sync',
  'media-processing',
  'mime_types',
  'monitoring',
  'presentations',
  'prompt_service',
  'refactor_tracking',
  'scripts',
  'shared',
  'tracking',
  'utilities',
  'viewers',
  'work_summaries'
];

export default function CreateTaskPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    task_type: 'feature' as 'bug' | 'feature' | 'refactor' | 'question',
    priority: 'medium' as 'low' | 'medium' | 'high',
    app: '',
    tags: '',
    work_mode: 'single-file' as 'single-file' | 'feature' | 'exploration' | 'cross-repo',
    requires_branch: false
  });

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
      
      // Generate git branch name if requires_branch is enabled
      const gitBranch = formData.requires_branch 
        ? generateBranchName(formData.title, formData.task_type)
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
        requires_branch: formData.requires_branch
      });

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
          <ArrowLeft className="w-4 h-4 mr-2" />
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
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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
                  work_mode: mode,
                  // Auto-enable branch for feature mode
                  requires_branch: mode === 'feature' ? true : formData.requires_branch
                });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              disabled={loading}
            >
              <option value="single-file">Single File - Quick fix or small change</option>
              <option value="feature">Feature - Substantial new functionality</option>
              <option value="exploration">Exploration - Research or experimentation</option>
              <option value="cross-repo">Cross-Repo - Spans multiple repositories</option>
            </select>
            <p className="mt-1 text-sm text-gray-500">
              {formData.work_mode === 'single-file' && 'Quick fixes that don\'t need a branch'}
              {formData.work_mode === 'feature' && 'New features that need isolated development'}
              {formData.work_mode === 'exploration' && 'Research tasks that may need temporary branches'}
              {formData.work_mode === 'cross-repo' && 'Tasks that span multiple repositories'}
            </p>
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
              Application / Pipeline
            </label>
            <select
              id="app"
              value={formData.app}
              onChange={(e) => setFormData({ ...formData, app: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              disabled={loading}
            >
              <option value="">Select an app or pipeline...</option>
              <optgroup label="Applications">
                {APPS.map(app => (
                  <option key={app} value={app}>{app}</option>
                ))}
              </optgroup>
              <optgroup label="CLI Pipelines">
                {CLI_PIPELINES.map(pipeline => (
                  <option key={`cli-${pipeline}`} value={`cli-${pipeline}`}>cli-{pipeline}</option>
                ))}
              </optgroup>
            </select>
            <p className="mt-1 text-sm text-gray-500">
              Select the app or CLI pipeline this task relates to
            </p>
          </div>

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

          <div className="bg-gray-50 rounded-lg p-4">
            <label className="flex items-start">
              <input
                type="checkbox"
                checked={formData.requires_branch}
                onChange={(e) => setFormData({ ...formData, requires_branch: e.target.checked })}
                className="mt-1 mr-3"
                disabled={loading || formData.work_mode === 'feature'} // Always on for features
              />
              <div>
                <span className="text-sm font-medium text-gray-700">
                  Create Git branch
                  {formData.work_mode === 'feature' && (
                    <span className="text-xs text-gray-500 ml-2">(required for features)</span>
                  )}
                </span>
                <p className="text-sm text-gray-500 mt-1">
                  Create a dedicated git branch for this task. Recommended for features and larger changes.
                  {formData.title && formData.requires_branch && (
                    <span className="block mt-1">
                      Branch name: <code className="bg-gray-200 px-1 rounded">
                        {generateBranchName(formData.title, formData.task_type)}
                      </code>
                    </span>
                  )}
                </p>
              </div>
            </label>
          </div>

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
                  <Save className="w-4 h-4 mr-2" />
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