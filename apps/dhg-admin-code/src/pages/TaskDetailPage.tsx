import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { TaskService } from '../services/task-service';
import type { DevTask, DevTaskTag, DevTaskFile } from '../services/task-service';
import { ArrowLeft, Copy, Check, Plus, X, FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<DevTask | null>(null);
  const [tags, setTags] = useState<DevTaskTag[]>([]);
  const [files, setFiles] = useState<DevTaskFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showResponseForm, setShowResponseForm] = useState(false);
  const [claudeResponse, setClaudeResponse] = useState('');
  const [newTag, setNewTag] = useState('');
  const [newFile, setNewFile] = useState({ path: '', action: 'modified' as const });

  useEffect(() => {
    if (id) {
      loadTask();
    }
  }, [id]);

  const loadTask = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const [taskData, tagsData, filesData] = await Promise.all([
        TaskService.getTask(id),
        TaskService.getTaskTags(id),
        TaskService.getTaskFiles(id)
      ]);
      setTask(taskData);
      setTags(tagsData);
      setFiles(filesData);
      if (taskData.claude_response) {
        setClaudeResponse(taskData.claude_response);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!task) return;
    
    const tagNames = tags.map(t => t.tag);
    const formattedRequest = TaskService.formatForClaude(task, tagNames);
    
    try {
      await navigator.clipboard.writeText(formattedRequest);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleComplete = async () => {
    if (!task || !id) return;
    
    if (!claudeResponse.trim()) {
      setError('Please enter Claude\'s response before completing the task');
      return;
    }
    
    try {
      console.log('Attempting to complete task:', id);
      await TaskService.completeTask(id, claudeResponse);
      await loadTask();
      setShowResponseForm(false);
      setError(''); // Clear any previous errors
    } catch (err) {
      console.error('Error in handleComplete:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to complete task';
      setError(errorMessage);
      // Don't close the form on error so user can retry
    }
  };

  const handleAddTag = async () => {
    if (!id || !newTag.trim()) return;
    
    try {
      await TaskService.addTag(id, newTag.trim());
      setNewTag('');
      await loadTask();
    } catch (err) {
      console.error('Failed to add tag:', err);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      await TaskService.removeTag(tagId);
      await loadTask();
    } catch (err) {
      console.error('Failed to remove tag:', err);
    }
  };

  const handleAddFile = async () => {
    if (!id || !newFile.path.trim()) return;
    
    try {
      await TaskService.addFile(id, newFile.path.trim(), newFile.action);
      setNewFile({ path: '', action: 'modified' });
      await loadTask();
    } catch (err) {
      console.error('Failed to add file:', err);
    }
  };

  const handleRemoveFile = async (fileId: string) => {
    try {
      await TaskService.removeFile(fileId);
      await loadTask();
    } catch (err) {
      console.error('Failed to remove file:', err);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-gray-500" />;
      case 'in_progress':
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !task) {
    return (
      <DashboardLayout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error || 'Task not found'}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          to="/tasks"
          className="inline-flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Tasks
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                {getStatusIcon(task.status)}
                <h1 className="text-2xl font-bold text-gray-900">{task.title}</h1>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  task.task_type === 'bug' ? 'bg-red-100 text-red-800' :
                  task.task_type === 'feature' ? 'bg-purple-100 text-purple-800' :
                  task.task_type === 'refactor' ? 'bg-blue-100 text-blue-800' :
                  'bg-orange-100 text-orange-800'
                }`}>
                  {task.task_type}
                </span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  task.priority === 'high' ? 'bg-red-100 text-red-800' :
                  task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {task.priority} priority
                </span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  task.status === 'completed' ? 'bg-green-100 text-green-800' :
                  task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {task.status.replace('_', ' ')}
                </span>
                {task.app && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
                    {task.app}
                  </span>
                )}
              </div>
            </div>
            {task.status !== 'completed' && (
              <button
                onClick={copyToClipboard}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy for Claude
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Description */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Description</h2>
            <div className="prose max-w-none">
              <pre className="whitespace-pre-wrap text-gray-700">{task.description}</pre>
            </div>
          </div>

          {/* Tags */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Tags</h2>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                >
                  {tag.tag}
                  <button
                    onClick={() => handleRemoveTag(tag.id)}
                    className="ml-2 text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                placeholder="Add a tag..."
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={handleAddTag}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
              >
                Add
              </button>
            </div>
          </div>

          {/* Files */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Affected Files</h2>
            <div className="space-y-2 mb-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-500" />
                    <code className="text-sm">{file.file_path}</code>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      file.action === 'created' ? 'bg-green-100 text-green-700' :
                      file.action === 'deleted' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {file.action}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveFile(file.id)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newFile.path}
                onChange={(e) => setNewFile({ ...newFile, path: e.target.value })}
                placeholder="File path..."
                className="flex-1 px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <select
                value={newFile.action}
                onChange={(e) => setNewFile({ ...newFile, action: e.target.value as any })}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="created">Created</option>
                <option value="modified">Modified</option>
                <option value="deleted">Deleted</option>
              </select>
              <button
                onClick={handleAddFile}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
              >
                Add
              </button>
            </div>
          </div>

          {/* Claude Response */}
          {task.status === 'completed' && task.claude_response ? (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Claude's Response</h2>
              <div className="bg-gray-50 rounded-lg p-4">
                <pre className="whitespace-pre-wrap text-gray-700">{task.claude_response}</pre>
              </div>
            </div>
          ) : (
            task.status !== 'completed' && (
              <div>
                <button
                  onClick={() => setShowResponseForm(!showResponseForm)}
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Mark Complete
                </button>

                {showResponseForm && (
                  <div className="mt-4">
                    {error && (
                      <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-red-800 text-sm">{error}</p>
                      </div>
                    )}
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Paste Claude's Response
                    </label>
                    <textarea
                      value={claudeResponse}
                      onChange={(e) => setClaudeResponse(e.target.value)}
                      rows={10}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Paste Claude's work summary here..."
                    />
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={handleComplete}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                      >
                        Save & Complete
                      </button>
                      <button
                        onClick={() => {
                          setShowResponseForm(false);
                          setError(''); // Clear error when canceling
                        }}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          )}

          {/* Metadata */}
          <div className="pt-4 border-t text-sm text-gray-500">
            <p>Created: {new Date(task.created_at).toLocaleString()}</p>
            <p>Updated: {new Date(task.updated_at).toLocaleString()}</p>
            {task.completed_at && (
              <p>Completed: {new Date(task.completed_at).toLocaleString()}</p>
            )}
          </div>
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
}