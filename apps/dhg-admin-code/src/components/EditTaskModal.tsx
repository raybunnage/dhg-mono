import { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { TaskService, type DevTask } from '../services/task-service';
import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';

interface EditTaskModalProps {
  task: DevTask;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedTask: DevTask) => void;
}

interface WorktreeDefinition {
  id: string;
  path: string;
  alias_name: string;
  alias_number: string;
  emoji: string;
  description: string | null;
}

const supabase = createSupabaseAdapter({ env: import.meta.env as any });

export function EditTaskModal({ task, isOpen, onClose, onSave }: EditTaskModalProps) {
  const [formData, setFormData] = useState({
    title: task.title,
    description: task.description,
    task_type: task.task_type,
    status: task.status,
    priority: task.priority,
    app: task.app || '',
    claude_request: task.claude_request || '',
    worktree_path: task.worktree_path || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [worktrees, setWorktrees] = useState<WorktreeDefinition[]>([]);

  // Reset form when task changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: task.title,
        description: task.description,
        task_type: task.task_type,
        status: task.status,
        priority: task.priority,
        app: task.app || '',
        claude_request: task.claude_request || '',
        worktree_path: task.worktree_path || ''
      });
      setError(null);
      loadWorktrees();
    }
  }, [task, isOpen]);

  const loadWorktrees = async () => {
    try {
      const { data, error } = await supabase
        .from('worktree_definitions')
        .select('*')
        .order('alias_number');
      
      if (error) throw error;
      if (data) {
        setWorktrees(data);
      }
    } catch (err) {
      console.error('Failed to load worktrees:', err);
    }
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    if (!formData.description.trim()) {
      setError('Description is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updates: Partial<DevTask> = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        task_type: formData.task_type,
        status: formData.status,
        priority: formData.priority,
        app: formData.app.trim() || undefined,
        claude_request: formData.claude_request.trim() || undefined,
        worktree_path: formData.worktree_path.trim() || undefined
      };

      const updatedTask = await TaskService.updateTask(task.id, updates);
      onSave(updatedTask);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Edit Task</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={saving}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Title */}
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
              placeholder="Enter task title"
              disabled={saving}
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description *
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Describe the task in detail"
              disabled={saving}
            />
          </div>

          {/* Row with Type, Status, Priority */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Task Type */}
            <div>
              <label htmlFor="task_type" className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                id="task_type"
                value={formData.task_type}
                onChange={(e) => setFormData({ ...formData, task_type: e.target.value as DevTask['task_type'] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                disabled={saving}
              >
                <option value="bug">Bug</option>
                <option value="feature">Feature</option>
                <option value="refactor">Refactor</option>
                <option value="question">Question</option>
                <option value="documentation">Documentation</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as DevTask['status'] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                disabled={saving}
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="testing">Testing</option>
                <option value="revision">Revision</option>
                <option value="completed">Completed</option>
                <option value="merged">Merged</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                id="priority"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as DevTask['priority'] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                disabled={saving}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          {/* App/Pipeline and Worktree */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* App/Pipeline */}
            <div>
              <label htmlFor="app" className="block text-sm font-medium text-gray-700 mb-1">
                App/Pipeline
              </label>
              <input
                id="app"
                type="text"
                value={formData.app}
                onChange={(e) => setFormData({ ...formData, app: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., dhg-admin-code, google-sync, etc."
                disabled={saving}
              />
            </div>

            {/* Worktree */}
            <div>
              <label htmlFor="worktree_path" className="block text-sm font-medium text-gray-700 mb-1">
                Worktree Assignment
              </label>
              <select
                id="worktree_path"
                value={formData.worktree_path}
                onChange={(e) => setFormData({ ...formData, worktree_path: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                disabled={saving}
              >
                <option value="">No worktree assignment</option>
                {worktrees.map((worktree) => (
                  <option key={worktree.id} value={worktree.path}>
                    {worktree.emoji} {worktree.alias_name} - {worktree.description || worktree.path}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Claude Request */}
          <div>
            <label htmlFor="claude_request" className="block text-sm font-medium text-gray-700 mb-1">
              Claude Request
            </label>
            <textarea
              id="claude_request"
              value={formData.claude_request}
              onChange={(e) => setFormData({ ...formData, claude_request: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Additional context or specific request for Claude"
              disabled={saving}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !formData.title.trim() || !formData.description.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}