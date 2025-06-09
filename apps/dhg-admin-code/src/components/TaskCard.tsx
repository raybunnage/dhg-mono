import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { GitBranch, FolderOpen, ChevronRight, CheckCircle, Clock, AlertCircle, GitCommit, Send, Code, Edit3, Target, Shield, TrendingUp, TestTube, Trash2 } from 'lucide-react';
import { TaskService, type DevTask } from '../services/task-service';
import { getWorktreeByPath } from '../utils/worktree-mapping';
import { EditTaskModal } from './EditTaskModal';

interface TaskCardProps {
  task: DevTask;
  onTaskUpdate?: (updatedTask: DevTask) => void;
  onTaskDelete?: (taskId: string) => void;
}

export function TaskCard({ task, onTaskUpdate, onTaskDelete }: TaskCardProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent Link navigation
    e.stopPropagation();
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent Link navigation
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsDeleting(true);
    try {
      await TaskService.deleteTask(task.id);
      if (onTaskDelete) {
        onTaskDelete(task.id);
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteConfirm(false);
  };

  const handleTaskUpdate = (updatedTask: DevTask) => {
    if (onTaskUpdate) {
      onTaskUpdate(updatedTask);
    }
  };
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-gray-500" />;
      case 'in_progress':
        return <AlertCircle className="w-4 h-4 text-blue-500" />;
      case 'testing':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'revision':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'merged':
        return <CheckCircle className="w-4 h-4 text-purple-500" />;
      case 'cancelled':
        return <Clock className="w-4 h-4 text-gray-400" />;
      default:
        return null;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'testing':
        return 'bg-yellow-100 text-yellow-800';
      case 'revision':
        return 'bg-orange-100 text-orange-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'merged':
        return 'bg-purple-100 text-purple-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-600';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'bug':
        return 'bg-red-100 text-red-800';
      case 'feature':
        return 'bg-purple-100 text-purple-800';
      case 'refactor':
        return 'bg-blue-100 text-blue-800';
      case 'documentation':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
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

  const getProgressStatusDisplay = () => {
    if (!task.progress_status) return null;
    
    switch (task.progress_status) {
      case 'not_started':
        return (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Clock className="w-3 h-3" />
            <span>Not started</span>
          </div>
        );
      case 'claude_submitted':
        return (
          <div className="flex items-center gap-1 text-xs text-blue-600">
            <Send className="w-3 h-3" />
            <span>Submitted to Claude</span>
            {task.submitted_on_worktree && (
              <span className="text-gray-500">on {task.submitted_on_worktree}</span>
            )}
          </div>
        );
      case 'in_development':
        return (
          <div className="flex items-center gap-1 text-xs text-indigo-600">
            <Code className="w-3 h-3" />
            <span>In development</span>
          </div>
        );
      case 'has_commits':
        return (
          <div className="flex items-center gap-1 text-xs text-green-600">
            <GitCommit className="w-3 h-3" />
            <span>Has commits</span>
          </div>
        );
      case 'ready_for_review':
        return (
          <div className="flex items-center gap-1 text-xs text-purple-600">
            <CheckCircle className="w-3 h-3" />
            <span>Ready for review</span>
          </div>
        );
      case 'completed':
        return (
          <div className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle className="w-3 h-3" />
            <span>Completed</span>
          </div>
        );
      default:
        return null;
    }
  };

  const getLifecycleStageDisplay = () => {
    if (!task.current_lifecycle_stage) return null;
    
    const stageConfig = {
      planning: { color: 'text-gray-600', bg: 'bg-gray-100', icon: Clock },
      development: { color: 'text-blue-600', bg: 'bg-blue-100', icon: Code },
      testing: { color: 'text-yellow-600', bg: 'bg-yellow-100', icon: TestTube },
      review: { color: 'text-purple-600', bg: 'bg-purple-100', icon: Shield },
      integration: { color: 'text-indigo-600', bg: 'bg-indigo-100', icon: GitBranch },
      completed: { color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle }
    };
    
    const config = stageConfig[task.current_lifecycle_stage as keyof typeof stageConfig] || stageConfig.planning;
    const IconComponent = config.icon;
    
    return (
      <div className={`flex items-center gap-1 text-xs ${config.color}`}>
        <IconComponent className="w-3 h-3" />
        <span className="capitalize">{task.current_lifecycle_stage.replace('_', ' ')}</span>
      </div>
    );
  };

  const getSuccessCriteriaDisplay = () => {
    if (!task.success_criteria_count || task.success_criteria_count === 0) {
      return (
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Target className="w-3 h-3" />
          <span>No criteria defined</span>
        </div>
      );
    }

    const percentage = task.criteria_completion_percentage || 0;
    const color = percentage >= 80 ? 'text-green-600' : percentage >= 50 ? 'text-yellow-600' : 'text-red-600';
    
    return (
      <div className={`flex items-center gap-1 text-xs ${color}`}>
        <Target className="w-3 h-3" />
        <span>{task.success_criteria_met || 0}/{task.success_criteria_count} criteria</span>
        <span className="text-gray-500">({percentage.toFixed(0)}%)</span>
      </div>
    );
  };

  const getQualityGatesDisplay = () => {
    if (!task.total_quality_gates || task.total_quality_gates === 0) {
      return (
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Shield className="w-3 h-3" />
          <span>No gates defined</span>
        </div>
      );
    }

    const passedGates = task.passed_quality_gates || 0;
    const failedGates = task.failed_quality_gates || 0;
    const color = failedGates > 0 ? 'text-red-600' : passedGates === task.total_quality_gates ? 'text-green-600' : 'text-yellow-600';
    
    return (
      <div className={`flex items-center gap-1 text-xs ${color}`}>
        <Shield className="w-3 h-3" />
        <span>{passedGates}/{task.total_quality_gates} gates</span>
        {failedGates > 0 && <span className="text-red-600">({failedGates} failed)</span>}
      </div>
    );
  };

  const getCompletionScoreDisplay = () => {
    const score = task.overall_completion_score || 0;
    const color = score >= 80 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-gray-600';
    
    return (
      <div className={`flex items-center gap-1 text-xs ${color}`}>
        <TrendingUp className="w-3 h-3" />
        <span>{score.toFixed(0)}% complete</span>
        {task.completion_confidence && (
          <span className="text-gray-500">(confidence: {task.completion_confidence}/10)</span>
        )}
      </div>
    );
  };

  const getRiskAssessmentBadge = () => {
    if (!task.risk_assessment || task.risk_assessment === 'low') return null;
    
    const riskConfig = {
      medium: { color: 'bg-yellow-100 text-yellow-800', label: 'Medium Risk' },
      high: { color: 'bg-orange-100 text-orange-800', label: 'High Risk' },
      critical: { color: 'bg-red-100 text-red-800', label: 'Critical Risk' }
    };
    
    const config = riskConfig[task.risk_assessment as keyof typeof riskConfig];
    if (!config) return null;
    
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        ⚠️ {config.label}
      </span>
    );
  };

  return (
    <>
      <Link
        to={`/tasks/${task.id}`}
        className="block hover:bg-gray-50 transition-colors"
      >
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-start gap-3">
                {getStatusIcon(task.status)}
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900">
                    {task.title}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                    {task.description}
                  </p>
                
                {/* Enhanced Status Section */}
                <div className="mt-2 mb-2 space-y-2">
                  {/* Primary Status Row */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {getLifecycleStageDisplay()}
                    {getProgressStatusDisplay()}
                    {getCompletionScoreDisplay()}
                  </div>
                  
                  {/* Success Criteria and Quality Gates Row */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {getSuccessCriteriaDisplay()}
                    {getQualityGatesDisplay()}
                  </div>
                  
                  {/* Additional status info */}
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {task.submitted_to_claude && (
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Send className="w-3 h-3" />
                        <span>Claude: {new Date(task.submitted_at!).toLocaleDateString()}</span>
                      </div>
                    )}
                    {task.has_commits && (
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <GitCommit className="w-3 h-3" />
                        <span>{task.git_commits_count || 0} commits</span>
                        {task.last_commit_at && (
                          <span>• Last: {new Date(task.last_commit_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeBadgeClass(task.task_type)}`}>
                    {task.task_type}
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(task.status)}`}>
                    {task.status.replace('_', ' ')}
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityBadgeClass(task.priority)}`}>
                    {task.priority}
                  </span>
                  {getRiskAssessmentBadge()}
                  {task.app && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                      {task.app}
                    </span>
                  )}
                  {task.git_branch && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      <GitBranch className="w-3 h-3" />
                      {task.git_branch}
                    </span>
                  )}
                  {task.worktree_path && (() => {
                    const worktree = getWorktreeByPath(task.worktree_path);
                    return worktree ? (
                      <span 
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700" 
                        title={worktree.description}
                      >
                        <span>{worktree.alias.emoji}</span>
                        <span>{worktree.alias.name}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        <FolderOpen className="w-3 h-3" />
                        {task.worktree_path.split('/').pop()}
                      </span>
                    );
                  })()}
                  <span className="text-xs text-gray-500">
                    Created {new Date(task.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1">
                {showDeleteConfirm ? (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <span className="text-xs text-red-600">Delete?</span>
                    <button
                      onClick={handleConfirmDelete}
                      disabled={isDeleting}
                      className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Confirm delete"
                    >
                      {isDeleting ? '...' : 'Yes'}
                    </button>
                    <button
                      onClick={handleCancelDelete}
                      disabled={isDeleting}
                      className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:opacity-50 transition-colors"
                      title="Cancel delete"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={handleEditClick}
                      className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                      title="Edit task"
                    >
                      <Edit3 className="w-4 h-4 text-gray-500 hover:text-gray-700" />
                    </button>
                    <button
                      onClick={handleDeleteClick}
                      className="p-1.5 hover:bg-red-100 rounded transition-colors"
                      title="Delete task"
                    >
                      <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-600" />
                    </button>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
    
    {/* Edit Modal - Outside of Link to prevent navigation issues */}
    <EditTaskModal
      task={task}
      isOpen={isEditModalOpen}
      onClose={() => setIsEditModalOpen(false)}
      onSave={handleTaskUpdate as (task: DevTask) => void}
    />
  </>
  );
}