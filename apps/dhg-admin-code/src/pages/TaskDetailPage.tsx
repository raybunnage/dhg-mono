import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { TaskService } from '../services/task-service';
import type { DevTask, DevTaskTag, DevTaskFile, DevTaskCommit, DevTaskWorkSession } from '../services/task-service';
import { ArrowLeft, Copy, Check, Plus, X, FileText, Clock, CheckCircle, AlertCircle, GitBranch, GitCommit, Terminal, Calendar, FolderOpen, Trash2 } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { TaskWorkflowPanel } from '../components/TaskWorkflowPanel';
import { TaskIterationTracker } from '../components/TaskIterationTracker';
import { FollowUpInfoDisplay } from '@shared/components/follow-up/FollowUpInfoDisplay';
import { supabase } from '../lib/supabase';

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<DevTask | null>(null);
  const [tags, setTags] = useState<DevTaskTag[]>([]);
  const [files, setFiles] = useState<DevTaskFile[]>([]);
  const [commits, setCommits] = useState<DevTaskCommit[]>([]);
  const [workSessions, setWorkSessions] = useState<DevTaskWorkSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showResponseForm, setShowResponseForm] = useState(false);
  const [claudeResponse, setClaudeResponse] = useState('');
  const [newTag, setNewTag] = useState('');
  const [newFile, setNewFile] = useState({ path: '', action: 'modified' as const });
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>();
  const [showWorktreeDialog, setShowWorktreeDialog] = useState(false);
  const [worktreeName, setWorktreeName] = useState('');

  useEffect(() => {
    if (id) {
      loadTask();
    }
  }, [id]);

  const loadTask = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      // Load task data first
      const taskData = await TaskService.getTask(id);
      setTask(taskData);
      if (taskData.claude_response) {
        setClaudeResponse(taskData.claude_response);
      }
      
      // Then load related data with individual error handling
      try {
        const tagsData = await TaskService.getTaskTags(id);
        setTags(tagsData);
      } catch (err) {
        console.error('Failed to load tags:', err);
      }
      
      try {
        const filesData = await TaskService.getTaskFiles(id);
        setFiles(filesData);
      } catch (err) {
        console.error('Failed to load files:', err);
      }
      
      try {
        const commitsData = await TaskService.getTaskCommits(id);
        setCommits(commitsData);
      } catch (err) {
        console.error('Failed to fetch commits:', err);
        // Don't show error for commits - just log it
      }
      
      try {
        const sessionsData = await TaskService.getTaskWorkSessions(id);
        setWorkSessions(sessionsData);
      } catch (err) {
        console.error('Failed to load work sessions:', err);
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

  const handleStatusChange = async (newStatus: string) => {
    if (!task || !id) return;
    
    try {
      const updates: any = { status: newStatus };
      
      // If moving to testing, prompt for testing notes
      if (newStatus === 'testing') {
        const testingNotes = prompt('Enter testing notes (optional):');
        if (testingNotes !== null) {
          updates.testing_notes = testingNotes;
        }
      }
      
      // If moving to revision, increment revision count
      if (newStatus === 'revision' && task.revision_count !== null && task.revision_count !== undefined) {
        updates.revision_count = task.revision_count + 1;
      }
      
      await TaskService.updateTask(id, updates);
      await loadTask();
    } catch (err) {
      console.error('Failed to update status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleCreateWorktree = async () => {
    if (!task || !id || !task.git_branch) return;
    
    // Set default worktree name and show dialog
    const defaultName = task.git_branch.replace(/\//g, '-');
    setWorktreeName(defaultName);
    setShowWorktreeDialog(true);
  };

  const handleConfirmWorktree = async () => {
    if (!task || !id || !task.git_branch || !worktreeName.trim()) return;
    
    try {
      // Use the edited worktree name
      const worktreePath = `../dhg-mono-${worktreeName}`;
      
      // Copy git commands to clipboard
      const commands = `# Create worktree for task: ${task.title}
cd ~/Documents/github/dhg-mono
git worktree add -b ${task.git_branch} ${worktreePath}
cd ${worktreePath}
pnpm install
cursor .`;
      
      await navigator.clipboard.writeText(commands);
      
      // Update task with worktree info
      await TaskService.updateTask(id, {
        worktree_path: worktreePath,
        worktree_active: true
      });
      
      await loadTask();
      setShowWorktreeDialog(false);
      alert('Worktree commands copied to clipboard! Paste in terminal to create worktree.');
    } catch (err) {
      console.error('Failed to create worktree:', err);
      setError(err instanceof Error ? err.message : 'Failed to create worktree');
    }
  };

  const handleRemoveWorktree = async () => {
    if (!task || !id || !task.worktree_path) return;
    
    const confirmRemove = confirm(`Remove worktree at ${task.worktree_path}?`);
    if (!confirmRemove) return;
    
    try {
      // Copy removal command to clipboard
      const command = `git worktree remove ${task.worktree_path}`;
      await navigator.clipboard.writeText(command);
      
      // Update task to clear worktree info
      await TaskService.updateTask(id, {
        worktree_path: undefined,
        worktree_active: false
      });
      
      await loadTask();
      alert('Worktree removal command copied to clipboard!');
    } catch (err) {
      console.error('Failed to remove worktree:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove worktree');
    }
  };

  const handleStartWorkSession = async () => {
    if (!id) return;
    
    try {
      const session = await TaskService.startWorkSession(id);
      setCurrentSessionId(session.id);
      await loadTask();
    } catch (err) {
      console.error('Failed to start work session:', err);
      setError(err instanceof Error ? err.message : 'Failed to start work session');
    }
  };

  const handleEndWorkSession = async (sessionId: string, summary: string) => {
    try {
      await TaskService.endWorkSession(sessionId, summary);
      setCurrentSessionId(undefined);
      await loadTask();
    } catch (err) {
      console.error('Failed to end work session:', err);
      setError(err instanceof Error ? err.message : 'Failed to end work session');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-gray-500" />;
      case 'in_progress':
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
      case 'testing':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'revision':
        return <AlertCircle className="w-5 h-5 text-orange-500" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'merged':
        return <CheckCircle className="w-5 h-5 text-purple-500" />;
      case 'cancelled':
        return <Clock className="w-5 h-5 text-gray-400" />;
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
      <div className="mb-6">
        <Link
          to="/tasks"
          className="inline-flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Tasks
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Left Side */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    {getStatusIcon(task.status)}
                    <h1 className="text-2xl font-bold text-gray-900">{task.title}</h1>
                  </div>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
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
                    {task.app && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
                        {task.app}
                      </span>
                    )}
                    {task.work_mode && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
                        {task.work_mode === 'single-file' && '📄 Single File'}
                        {task.work_mode === 'feature' && '🚀 Feature'}
                        {task.work_mode === 'exploration' && '🔍 Exploration'}
                        {task.work_mode === 'cross-repo' && '🔗 Cross-Repo'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {task.status !== 'completed' && task.status !== 'merged' && (
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
            </div>

        <div className="p-6 space-y-6">
          {/* Follow-up Information */}
          <FollowUpInfoDisplay taskId={task.id} supabaseClient={supabase} />
          
          {/* Description */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Description</h2>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="whitespace-pre-wrap text-gray-700 leading-relaxed" style={{ color: '#374151' }}>{task.description}</p>
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
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
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

          {/* Source Document Link */}
          {(task.source_doc_path || task.source_doc_phase) && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Source Document</h2>
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-900">
                      Generated from continuous documentation
                    </p>
                    {task.source_doc_phase && (
                      <p className="text-sm font-medium text-blue-700 mt-1">
                        Phase: {task.source_doc_phase}
                      </p>
                    )}
                  </div>
                  {task.source_doc_path && (
                    <Link
                      to="/continuous-docs"
                      className="text-sm text-blue-600 hover:text-blue-800 underline font-medium"
                    >
                      View Document →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Git Information */}
          {(task.git_branch || task.git_commits_count || task.is_subtask) && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Git Information</h2>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                {task.git_branch && (
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-600">Branch:</span>
                    <code className="text-sm bg-white px-2 py-1 rounded border border-gray-200">
                      {task.git_branch}
                    </code>
                  </div>
                )}
                
                {task.git_commits_count !== null && task.git_commits_count !== undefined && (
                  <div className="flex items-center gap-2">
                    <GitCommit className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-600">Commits:</span>
                    <span className="text-sm">{task.git_commits_count}</span>
                  </div>
                )}
                
                {task.is_subtask && task.parent_task_id && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-600">Parent Task:</span>
                    <Link 
                      to={`/tasks/${task.parent_task_id}`}
                      className="text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                      View Parent
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}


          {/* Claude Response */}
          {task.status === 'completed' && task.claude_response ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-gray-900">Claude's Response</h2>
                <button
                  onClick={() => {
                    setShowResponseForm(true);
                    setClaudeResponse(task.claude_response || '');
                  }}
                  className="text-sm px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Edit Response
                </button>
              </div>
              {!showResponseForm ? (
                <div className="bg-gray-50 rounded-lg p-4">
                  <pre className="whitespace-pre-wrap text-gray-700">{task.claude_response}</pre>
                </div>
              ) : (
                <div className="space-y-4">
                  <textarea
                    value={claudeResponse}
                    onChange={(e) => setClaudeResponse(e.target.value)}
                    className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Update Claude's response..."
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleComplete}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      Update Response
                    </button>
                    <button
                      onClick={() => {
                        setShowResponseForm(false);
                        setClaudeResponse(task.claude_response || '');
                      }}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-red-800 text-sm">{error}</p>
                    </div>
                  )}
                </div>
              )}
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

          {/* Commits */}
          {commits.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Commits</h2>
              <div className="space-y-2">
                {commits.map((commit) => (
                  <div key={commit.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <GitCommit className="w-4 h-4 text-gray-500 mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <code className="text-xs bg-gray-200 px-2 py-0.5 rounded">
                            {commit.commit_hash.slice(0, 7)}
                          </code>
                          <span className="text-xs text-gray-500">
                            {new Date(commit.created_at).toLocaleString()}
                          </span>
                        </div>
                        {commit.commit_message && (
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{commit.commit_message}</p>
                        )}
                        {(commit.files_changed || commit.insertions || commit.deletions) && (
                          <div className="flex gap-4 mt-1 text-xs text-gray-500">
                            {commit.files_changed && <span>{commit.files_changed} files</span>}
                            {commit.insertions && <span className="text-green-600">+{commit.insertions}</span>}
                            {commit.deletions && <span className="text-red-600">-{commit.deletions}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Work Sessions */}
          {workSessions.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Work Sessions</h2>
              <div className="space-y-2">
                {workSessions.map((session) => (
                  <div key={session.id} className="bg-blue-50 rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <Terminal className="w-4 h-4 text-blue-500 mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">
                            Session {new Date(session.started_at).toLocaleDateString()}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(session.started_at).toLocaleTimeString()} - {
                              session.ended_at 
                                ? new Date(session.ended_at).toLocaleTimeString()
                                : 'In Progress'
                            }
                          </span>
                        </div>
                        {session.summary && (
                          <p className="text-sm text-gray-700 mt-1">{session.summary}</p>
                        )}
                        {session.files_modified && session.files_modified.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-gray-600 mb-1">Files Modified:</p>
                            <div className="flex flex-wrap gap-1">
                              {session.files_modified.map((file, idx) => (
                                <code key={idx} className="text-xs bg-gray-200 px-2 py-0.5 rounded">
                                  {file}
                                </code>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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

    {/* Workflow Panel - Right Side */}
    <div className="lg:col-span-1 space-y-6">
      <TaskWorkflowPanel
        task={task}
        onStatusChange={handleStatusChange}
        onCreateWorktree={handleCreateWorktree}
        onRemoveWorktree={handleRemoveWorktree}
      />
      
      <TaskIterationTracker
        workSessions={workSessions}
        onStartNewSession={handleStartWorkSession}
        onEndSession={handleEndWorkSession}
        currentSessionId={currentSessionId}
      />
    </div>
  </div>

  {/* Worktree Name Dialog */}
  {showWorktreeDialog && (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Create Worktree</h3>
        <p className="text-sm text-gray-600 mb-4">
          Customize the worktree directory name or use the default based on the branch name.
        </p>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Worktree Directory Name
          </label>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">../dhg-mono-</span>
            <input
              type="text"
              value={worktreeName}
              onChange={(e) => setWorktreeName(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="worktree-name"
              autoFocus
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Full path: ../dhg-mono-{worktreeName || '[name]'}
          </p>
        </div>

        <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-sm font-medium text-gray-700 mb-1">Commands to be copied:</p>
          <pre className="text-xs bg-white p-2 rounded border border-gray-300 overflow-x-auto">
{`cd ~/Documents/github/dhg-mono
git worktree add -b ${task?.git_branch} ../dhg-mono-${worktreeName || '[name]'}
# If branch already exists, use: git worktree add ../dhg-mono-${worktreeName || '[name]'} ${task?.git_branch}
cd ../dhg-mono-${worktreeName || '[name]'}
pnpm install
cursor .`}
          </pre>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleConfirmWorktree}
            disabled={!worktreeName.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Copy Commands & Create
          </button>
          <button
            onClick={() => {
              setShowWorktreeDialog(false);
              setWorktreeName('');
            }}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )}

    </DashboardLayout>
  );
}