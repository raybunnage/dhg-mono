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
    tags: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.description.trim()) {
      setError('Title and description are required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Create the task
      const task = await TaskService.createTask({
        title: formData.title,
        description: formData.description,
        task_type: formData.task_type,
        priority: formData.priority,
        app: formData.app || undefined,
        status: 'pending'
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