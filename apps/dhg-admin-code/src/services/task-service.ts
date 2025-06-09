import { supabase } from '../lib/supabase';

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
  failed_quality_gates?: number;
  overall_completion_score?: number;
  // View-specific fields
  current_stage_name?: string;
  current_stage_status?: string;
  current_stage_confidence?: number;
  current_stage_risk?: string;
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

export class TaskService {
  // Task CRUD operations
  static async getTasks(filters?: {
    status?: string;
    priority?: string;
    search?: string;
    app?: string;
  }) {
    let query = supabase
      .from('dev_tasks_enhanced_view')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.priority) {
      query = query.eq('priority', filters.priority);
    }
    if (filters?.app) {
      query = query.eq('app', filters.app);
    }
    if (filters?.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as DevTask[];
  }

  static async getTask(id: string) {
    const { data, error } = await supabase
      .from('dev_tasks')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as DevTask;
  }

  static async createTask(task: Partial<DevTask>) {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('dev_tasks')
      .insert({
        ...task,
        created_by: user?.id
      })
      .select()
      .single();
    
    if (error) throw error;
    return data as DevTask;
  }

  static async updateTask(id: string, updates: Partial<DevTask>) {
    console.log('Updating task:', id, updates);
    
    // Check auth status
    const { data: { user } } = await supabase.auth.getUser();
    console.log('Auth status in updateTask:', user ? `Authenticated as ${user.email}` : 'Not authenticated');
    
    const { data, error } = await supabase
      .from('dev_tasks')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating task:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw new Error(`Failed to update task: ${error.message}`);
    }
    
    console.log('Task updated successfully:', data);
    return data as DevTask;
  }

  static async deleteTask(id: string) {
    const { error } = await supabase
      .from('dev_tasks')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  // Tag operations
  static async getTaskTags(taskId: string) {
    const { data, error } = await supabase
      .from('dev_task_tags')
      .select('*')
      .eq('task_id', taskId)
      .order('tag');
    
    if (error) throw error;
    return data as DevTaskTag[];
  }

  static async addTag(taskId: string, tag: string) {
    const { data, error } = await supabase
      .from('dev_task_tags')
      .insert({ task_id: taskId, tag })
      .select()
      .single();
    
    if (error) throw error;
    return data as DevTaskTag;
  }

  static async removeTag(tagId: string) {
    const { error } = await supabase
      .from('dev_task_tags')
      .delete()
      .eq('id', tagId);
    
    if (error) throw error;
  }

  // File operations
  static async getTaskFiles(taskId: string) {
    const { data, error } = await supabase
      .from('dev_task_files')
      .select('*')
      .eq('task_id', taskId)
      .order('file_path');
    
    if (error) throw error;
    return data as DevTaskFile[];
  }

  static async addFile(taskId: string, filePath: string, action: 'created' | 'modified' | 'deleted' = 'modified') {
    const { data, error } = await supabase
      .from('dev_task_files')
      .insert({ task_id: taskId, file_path: filePath, action })
      .select()
      .single();
    
    if (error) throw error;
    return data as DevTaskFile;
  }

  static async removeFile(fileId: string) {
    const { error } = await supabase
      .from('dev_task_files')
      .delete()
      .eq('id', fileId);
    
    if (error) throw error;
  }

  // Git integration methods
  static async getTaskCommits(taskId: string) {
    const { data, error } = await supabase
      .from('dev_task_commits')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching commits:', error);
      throw new Error(`Failed to fetch commits: ${error.message}`);
    }
    return data as DevTaskCommit[];
  }

  static async getTaskWorkSessions(taskId: string) {
    const { data, error } = await supabase
      .from('dev_task_work_sessions')
      .select('*')
      .eq('task_id', taskId)
      .order('started_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching work sessions:', error);
      throw new Error(`Failed to fetch work sessions: ${error.message}`);
    }
    return data as DevTaskWorkSession[];
  }

  // Helper to format task for Claude
  static formatForClaude(task: DevTask, tags: string[] = []): string {
    const tagString = tags.length > 0 ? `Tags: ${tags.join(', ')}\n` : '';
    
    return `# Task: ${task.title}
ID: ${task.id}
Type: ${task.task_type}
Priority: ${task.priority}

## Description
${task.description}

## Context
${tagString}
Created: ${new Date(task.created_at).toLocaleDateString()}`;
  }

  // Mark task as complete with Claude response
  static async completeTask(id: string, claudeResponse: string) {
    console.log('Completing task:', id, 'with response length:', claudeResponse?.length);
    
    try {
      const result = await this.updateTask(id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        claude_response: claudeResponse
      });
      
      console.log('Task completed successfully');
      return result;
    } catch (error) {
      console.error('Failed to complete task:', error);
      throw error;
    }
  }

  // Work session management
  static async startWorkSession(taskId: string) {
    const { data, error } = await supabase
      .from('dev_task_work_sessions')
      .insert({
        task_id: taskId,
        started_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    return data as DevTaskWorkSession;
  }

  static async endWorkSession(sessionId: string, summary: string, filesModified?: string[]) {
    const { data, error } = await supabase
      .from('dev_task_work_sessions')
      .update({
        ended_at: new Date().toISOString(),
        summary,
        files_modified: filesModified
      })
      .eq('id', sessionId)
      .select()
      .single();
    
    if (error) throw error;
    return data as DevTaskWorkSession;
  }

  static async updateWorkSessionClaude(sessionId: string, claudeSessionId: string) {
    const { data, error } = await supabase
      .from('dev_task_work_sessions')
      .update({
        claude_session_id: claudeSessionId
      })
      .eq('id', sessionId)
      .select()
      .single();
    
    if (error) throw error;
    return data as DevTaskWorkSession;
  }
}