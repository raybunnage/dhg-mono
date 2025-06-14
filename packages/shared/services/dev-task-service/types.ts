/**
 * DevTask Service Types
 * Centralized type definitions for development task management
 */

export interface DevTask {
  id: string;
  title: string;
  description: string;
  task_type: 'bug' | 'feature' | 'refactor' | 'question' | 'documentation';
  status: 'pending' | 'in_progress' | 'testing' | 'revision' | 'completed' | 'merged' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  app?: string;
  claude_request?: string;
  claude_response?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  created_by?: string;
  // Git integration fields
  git_branch?: string;
  git_commit_start?: string;
  git_commit_current?: string;
  git_commits_count?: number;
  parent_task_id?: string;
  is_subtask?: boolean;
  testing_notes?: string;
  revision_count?: number;
  // Worktree fields
  worktree_path?: string;
  worktree_active?: boolean;
  work_mode?: 'single-file' | 'feature' | 'exploration' | 'cross-repo';
  requires_branch?: boolean;
  worktree?: string;
  // Progress tracking fields
  submitted_to_claude?: boolean;
  submitted_at?: string;
  submitted_on_worktree?: string;
  has_commits?: boolean;
  last_commit_at?: string;
  progress_status?: 'not_started' | 'claude_submitted' | 'in_development' | 'has_commits' | 'ready_for_review' | 'completed';
  // Success criteria fields
  success_criteria_defined?: boolean;
  validation_status?: string;
  quality_gates_status?: string;
  completion_confidence?: number;
  risk_assessment?: string;
  current_lifecycle_stage?: string;
  success_criteria_count?: number;
  success_criteria_met?: number;
  criteria_completion_percentage?: number;
  total_quality_gates?: number;
  passed_quality_gates?: number;
  // Source document fields
  source_doc_id?: string;
  source_doc_path?: string;
  source_doc_phase?: string;
  failed_quality_gates?: number;
  overall_completion_score?: number;
  // View-specific fields
  current_stage_name?: string;
  current_stage_status?: string;
  current_stage_confidence?: number;
  current_stage_risk?: string;
  // Element targeting
  element_target?: {
    type: string;
    id: string;
    name: string;
  };
}

export interface DevTaskTag {
  id: string;
  task_id: string;
  tag: string;
  created_at: string;
}

export interface DevTaskFile {
  id: string;
  task_id: string;
  file_path: string;
  action: 'created' | 'modified' | 'deleted';
  created_at: string;
}

export interface DevTaskCommit {
  id: string;
  task_id: string;
  commit_hash: string;
  commit_message?: string;
  files_changed?: number;
  insertions?: number;
  deletions?: number;
  created_at: string;
}

export interface DevTaskWorkSession {
  id: string;
  task_id: string;
  claude_session_id?: string;
  started_at: string;
  ended_at?: string;
  summary?: string;
  commands_used?: string[];
  files_modified?: string[];
}

export interface TaskFilters {
  status?: string;
  priority?: string;
  search?: string;
  app?: string;
  worktree?: string;
  has_commits?: boolean;
  progress_status?: string;
}

export interface CreateTaskInput {
  title: string;
  description: string;
  task_type: DevTask['task_type'];
  priority: DevTask['priority'];
  app?: string;
  worktree?: string;
  element_target?: DevTask['element_target'];
  tags?: string[];
}

export interface UpdateTaskInput extends Partial<Omit<DevTask, 'id' | 'created_at' | 'created_by'>> {}