import React, { useState } from 'react';
import type { DevTask } from '../services/task-service';
import { 
  FolderOpen, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  ArrowRight,
  RotateCcw,
  MessageSquare,
  FileEdit,
  TestTube,
  GitMerge,
  XCircle,
  Trash2,
  Terminal,
  HelpCircle
} from 'lucide-react';

interface TaskWorkflowPanelProps {
  task: DevTask;
  onStatusChange: (status: string) => void;
  onCreateWorktree: () => void;
  onRemoveWorktree: () => void;
  onAddRevisionNote?: (note: string) => void;
}

export const TaskWorkflowPanel: React.FC<TaskWorkflowPanelProps> = ({
  task,
  onStatusChange,
  onCreateWorktree,
  onRemoveWorktree,
  onAddRevisionNote
}) => {
  const [showRevisionNotes, setShowRevisionNotes] = useState(false);
  const [revisionNote, setRevisionNote] = useState('');
  const [showWorktreeHelp, setShowWorktreeHelp] = useState(false);

  const workflowStages = [
    { key: 'pending', label: 'Pending', icon: Clock, color: 'gray' },
    { key: 'in_progress', label: 'In Progress', icon: FileEdit, color: 'blue' },
    { key: 'testing', label: 'Testing', icon: TestTube, color: 'yellow' },
    { key: 'revision', label: 'Revision', icon: RotateCcw, color: 'orange' },
    { key: 'completed', label: 'Completed', icon: CheckCircle, color: 'green' },
    { key: 'merged', label: 'Merged', icon: GitMerge, color: 'purple' }
  ];

  const currentStageIndex = workflowStages.findIndex(s => s.key === task.status);

  const getStageClass = (stage: typeof workflowStages[0], index: number) => {
    const isActive = stage.key === task.status;
    const isPast = index < currentStageIndex;
    const colorClasses = {
      gray: isActive ? 'bg-gray-500 text-white' : isPast ? 'bg-gray-200 text-gray-600' : 'bg-gray-100 text-gray-400',
      blue: isActive ? 'bg-blue-500 text-white' : isPast ? 'bg-blue-200 text-blue-600' : 'bg-gray-100 text-gray-400',
      yellow: isActive ? 'bg-yellow-500 text-white' : isPast ? 'bg-yellow-200 text-yellow-600' : 'bg-gray-100 text-gray-400',
      orange: isActive ? 'bg-orange-500 text-white' : isPast ? 'bg-orange-200 text-orange-600' : 'bg-gray-100 text-gray-400',
      green: isActive ? 'bg-green-500 text-white' : isPast ? 'bg-green-200 text-green-600' : 'bg-gray-100 text-gray-400',
      purple: isActive ? 'bg-purple-500 text-white' : isPast ? 'bg-purple-200 text-purple-600' : 'bg-gray-100 text-gray-400',
    };
    return colorClasses[stage.color as keyof typeof colorClasses];
  };

  const handleRevisionSubmit = () => {
    if (revisionNote.trim() && onAddRevisionNote) {
      onAddRevisionNote(revisionNote);
      setRevisionNote('');
      setShowRevisionNotes(false);
    }
    onStatusChange('revision');
  };

  const copyWorktreeCommand = async () => {
    const command = `cd ~/Documents/github${task.worktree_path?.replace('..', '')} && cursor .`;
    await navigator.clipboard.writeText(command);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
      {/* Workflow Progress */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Workflow Progress</h3>
        <div className="flex items-center justify-between">
          {workflowStages.map((stage, index) => {
            const Icon = stage.icon;
            const isLast = index === workflowStages.length - 1;
            return (
              <React.Fragment key={stage.key}>
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getStageClass(stage, index)}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs mt-2 text-gray-600">{stage.label}</span>
                </div>
                {!isLast && (
                  <ArrowRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
        
        {/* Revision Counter */}
        {task.revision_count !== null && task.revision_count !== undefined && task.revision_count > 0 && (
          <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-orange-600" />
              <span className="text-sm font-medium text-orange-800">
                This task has been revised {task.revision_count} time{task.revision_count !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Worktree Management */}
      <div className="border-t pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            Worktree Management
            <span className="text-xs text-gray-500 font-normal ml-2">
              (Isolated workspace for this task)
            </span>
          </h3>
          <button
            onClick={() => setShowWorktreeHelp(!showWorktreeHelp)}
            className="text-gray-400 hover:text-gray-600"
            title="What is a worktree?"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>
        
        {showWorktreeHelp && (
          <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm">
            <h4 className="font-medium text-gray-900 mb-2">What is a Git Worktree?</h4>
            <p className="text-gray-700 mb-2">
              A worktree creates a separate working directory linked to your repository, allowing you to:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-1">
              <li>Work on this task without affecting other branches</li>
              <li>Keep changes isolated until ready to merge</li>
              <li>Switch between tasks without stashing changes</li>
              <li>Test changes in a clean environment</li>
            </ul>
          </div>
        )}
        
        {task.worktree_active && task.worktree_path ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <FolderOpen className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-800">Active Worktree</span>
                  </div>
                  <code className="text-sm bg-white px-3 py-1 rounded border border-green-300 block mb-3">
                    {task.worktree_path}
                  </code>
                  <div className="flex gap-2">
                    <button
                      onClick={copyWorktreeCommand}
                      className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                    >
                      <Terminal className="w-4 h-4" />
                      Open in Cursor
                    </button>
                    <button
                      onClick={onRemoveWorktree}
                      className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove Worktree
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">💡 Next Steps</h4>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>Click "Open in Cursor" to open the worktree in your editor</li>
                <li>Make your changes in Claude Code</li>
                <li>Test thoroughly before marking complete</li>
                <li>When done, ask Claude to: <code className="bg-blue-100 px-1 rounded">git add . && git commit -m "message"</code></li>
                <li>Remove worktree after merging to keep workspace clean</li>
              </ul>
            </div>
          </div>
        ) : task.git_branch ? (
          <div className="space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-700 mb-3">
                Create an isolated workspace for this task to keep changes separate from your main branch.
              </p>
              <button
                onClick={onCreateWorktree}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <FolderOpen className="w-5 h-5" />
                Create Worktree
              </button>
            </div>
            
            {/* Workflow Guide */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">📋 Worktree Workflow</h4>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Click "Create Worktree" to generate terminal commands</li>
                <li>Paste commands in terminal to create isolated workspace</li>
                <li>Work on changes in Claude Code using the worktree path</li>
                <li>Test your changes thoroughly</li>
                <li>When ready, ask Claude to commit and push changes</li>
                <li>Create a pull request for review</li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-gray-700 font-medium">No isolated workspace needed</p>
                <p className="text-sm text-gray-600 mt-1">
                  This task was created without a branch requirement. You can work directly on your current branch, 
                  or change the work mode in task settings if you need an isolated workspace.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Workflow Actions */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold mb-4">Workflow Actions</h3>
        
        <div className="space-y-3">
          {task.status === 'pending' && (
            <button
              onClick={() => onStatusChange('in_progress')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <FileEdit className="w-5 h-5" />
              Start Working
            </button>
          )}
          
          {task.status === 'in_progress' && (
            <button
              onClick={() => onStatusChange('testing')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
            >
              <TestTube className="w-5 h-5" />
              Move to Testing
            </button>
          )}
          
          {task.status === 'testing' && (
            <>
              <button
                onClick={() => onStatusChange('completed')}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                <CheckCircle className="w-5 h-5" />
                Mark as Completed
              </button>
              <button
                onClick={() => setShowRevisionNotes(!showRevisionNotes)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
              >
                <RotateCcw className="w-5 h-5" />
                Needs Revision
              </button>
              
              {showRevisionNotes && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Revision Notes (optional)
                  </label>
                  <textarea
                    value={revisionNote}
                    onChange={(e) => setRevisionNote(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                    placeholder="What needs to be revised?"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleRevisionSubmit}
                      className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
                    >
                      Submit Revision
                    </button>
                    <button
                      onClick={() => {
                        setShowRevisionNotes(false);
                        setRevisionNote('');
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          
          {task.status === 'revision' && (
            <button
              onClick={() => onStatusChange('in_progress')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <FileEdit className="w-5 h-5" />
              Resume Work
            </button>
          )}
          
          {task.status === 'completed' && task.git_branch && (
            <button
              onClick={() => onStatusChange('merged')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              <GitMerge className="w-5 h-5" />
              Mark as Merged
            </button>
          )}
          
          {(task.status !== 'cancelled' && task.status !== 'completed' && task.status !== 'merged') && (
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to cancel this task?')) {
                  onStatusChange('cancelled');
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              <XCircle className="w-5 h-5" />
              Cancel Task
            </button>
          )}
        </div>
      </div>

      {/* Testing Notes Display */}
      {task.testing_notes && (
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Testing Notes
          </h3>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <pre className="whitespace-pre-wrap text-sm text-gray-700">{task.testing_notes}</pre>
          </div>
        </div>
      )}
    </div>
  );
};