import { BusinessService } from '../base-classes/BusinessService';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../base-classes/BaseService';

// Task-related interfaces
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

// Task filter options
export interface TaskFilters {
  status?: string;
  priority?: string;
  search?: string;
  app?: string;
}

// Service metrics
interface TaskServiceMetrics {
  tasksCreated: number;
  tasksUpdated: number;
  tasksDeleted: number;
  tasksCompleted: number;
  tagsAdded: number;
  tagsRemoved: number;
  filesTracked: number;
  commitsTracked: number;
  workSessionsStarted: number;
  workSessionsEnded: number;
  errors: number;
}

/**
 * Service for managing development tasks and related entities
 * Extends BusinessService for proper dependency injection and lifecycle management
 */
export class TaskService extends BusinessService {
  private metrics: TaskServiceMetrics = {
    tasksCreated: 0,
    tasksUpdated: 0,
    tasksDeleted: 0,
    tasksCompleted: 0,
    tagsAdded: 0,
    tagsRemoved: 0,
    filesTracked: 0,
    commitsTracked: 0,
    workSessionsStarted: 0,
    workSessionsEnded: 0,
    errors: 0
  };

  /**
   * Constructor that accepts a configured Supabase client and optional logger
   * @param supabase - The Supabase client to use for database operations
   * @param logger - Optional logger for structured logging
   */
  constructor(
    private supabase: SupabaseClient<any>,
    logger?: Logger
  ) {
    super('TaskService', logger);
  }

  /**
   * BaseService requirement: Initialize the service
   */
  protected async initialize(): Promise<void> {
    this.logger?.info('TaskService: Initializing service');
    // No specific initialization needed for TaskService
  }

  /**
   * BaseService requirement: Cleanup resources
   */
  protected async cleanup(): Promise<void> {
    this.logger?.info('TaskService: Cleaning up resources');
    // No specific cleanup needed for TaskService
  }

  /**
   * BaseService requirement: Health check implementation
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any; timestamp: Date }> {
    try {
      // Test database connectivity by counting tasks
      const { count, error } = await this.supabase
        .from('dev_tasks')
        .select('*', { count: 'exact', head: true });

      if (error) {
        throw error;
      }

      // Check if enhanced view is accessible
      let viewHealthy = true;
      try {
        const { error: viewError } = await this.supabase
          .from('dev_tasks_enhanced_view')
          .select('id', { head: true })
          .limit(1);
        viewHealthy = !viewError;
      } catch (e) {
        viewHealthy = false;
      }

      return {
        healthy: true,
        details: {
          taskCount: count || 0,
          enhancedViewAccessible: viewHealthy,
          metrics: this.getMetrics()
        },
        timestamp: new Date()
      };
    } catch (error) {
      this.logger?.error('TaskService: Health check failed', error);
      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          metrics: this.getMetrics()
        },
        timestamp: new Date()
      };
    }
  }

  /**
   * Get service metrics
   */
  public getMetrics(): TaskServiceMetrics {
    return { ...this.metrics };
  }

  // Task CRUD operations

  /**
   * Get tasks with optional filters
   */
  async getTasks(filters?: TaskFilters): Promise<DevTask[]> {
    try {
      this.logger?.debug('TaskService: Getting tasks', { filters });
      
      let query = this.supabase
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
      if (error) {
        this.logger?.error('TaskService: Error getting tasks', error);
        this.metrics.errors++;
        throw error;
      }
      
      this.logger?.debug('TaskService: Retrieved tasks', { count: data?.length || 0 });
      return data as DevTask[];
    } catch (error) {
      this.logger?.error('TaskService: Failed to get tasks', error);
      this.metrics.errors++;
      throw error;
    }
  }

  /**
   * Get a single task by ID
   */
  async getTask(id: string): Promise<DevTask> {
    try {
      this.logger?.debug('TaskService: Getting task', { id });
      
      const { data, error } = await this.supabase
        .from('dev_tasks_enhanced_view')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        this.logger?.error('TaskService: Error getting task', error);
        this.metrics.errors++;
        throw error;
      }
      
      this.logger?.debug('TaskService: Retrieved task', { id, title: data.title });
      return data as DevTask;
    } catch (error) {
      this.logger?.error('TaskService: Failed to get task', error);
      this.metrics.errors++;
      throw error;
    }
  }

  /**
   * Create a new task
   */
  async createTask(task: Partial<DevTask>): Promise<DevTask> {
    try {
      this.logger?.info('TaskService: Creating task', { title: task.title });
      
      const { data: { user } } = await this.supabase.auth.getUser();
      
      const { data, error } = await this.supabase
        .from('dev_tasks')
        .insert({
          ...task,
          created_by: user?.id
        })
        .select()
        .single();
      
      if (error) {
        this.logger?.error('TaskService: Error creating task', error);
        this.metrics.errors++;
        throw error;
      }
      
      this.metrics.tasksCreated++;
      this.logger?.info('TaskService: Task created', { id: data.id, title: data.title });
      return data as DevTask;
    } catch (error) {
      this.logger?.error('TaskService: Failed to create task', error);
      this.metrics.errors++;
      throw error;
    }
  }

  /**
   * Update an existing task
   */
  async updateTask(id: string, updates: Partial<DevTask>): Promise<DevTask> {
    try {
      this.logger?.info('TaskService: Updating task', { id, updates });
      
      // Check auth status
      const { data: { user } } = await this.supabase.auth.getUser();
      this.logger?.debug('TaskService: Auth status', { 
        authenticated: !!user, 
        email: user?.email 
      });
      
      // Update the task in dev_tasks table
      const { data: updateData, error: updateError } = await this.supabase
        .from('dev_tasks')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      
      if (updateError) {
        this.logger?.error('TaskService: Error updating task', {
          error: updateError,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code
        });
        this.metrics.errors++;
        throw new Error(`Failed to update task: ${updateError.message}`);
      }
      
      this.logger?.debug('TaskService: Task updated in dev_tasks table', { id });
      
      // Now fetch the updated task from the enhanced view to get computed fields
      const { data: enhancedData, error: fetchError } = await this.supabase
        .from('dev_tasks_enhanced_view')
        .select('*')
        .eq('id', id)
        .single();
        
      if (fetchError) {
        this.logger?.warn('TaskService: Error fetching enhanced task data', fetchError);
        // Fall back to the basic update data if enhanced view fails
        this.metrics.tasksUpdated++;
        return updateData as DevTask;
      }
      
      this.metrics.tasksUpdated++;
      this.logger?.info('TaskService: Task updated successfully', { id, title: enhancedData.title });
      return enhancedData as DevTask;
    } catch (error) {
      this.logger?.error('TaskService: Failed to update task', error);
      this.metrics.errors++;
      throw error;
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(id: string): Promise<void> {
    try {
      this.logger?.info('TaskService: Deleting task', { id });
      
      const { error } = await this.supabase
        .from('dev_tasks')
        .delete()
        .eq('id', id);
      
      if (error) {
        this.logger?.error('TaskService: Error deleting task', error);
        this.metrics.errors++;
        throw error;
      }
      
      this.metrics.tasksDeleted++;
      this.logger?.info('TaskService: Task deleted', { id });
    } catch (error) {
      this.logger?.error('TaskService: Failed to delete task', error);
      this.metrics.errors++;
      throw error;
    }
  }

  // Tag operations

  /**
   * Get tags for a task
   */
  async getTaskTags(taskId: string): Promise<DevTaskTag[]> {
    try {
      this.logger?.debug('TaskService: Getting task tags', { taskId });
      
      const { data, error } = await this.supabase
        .from('dev_task_tags')
        .select('*')
        .eq('task_id', taskId)
        .order('tag');
      
      if (error) {
        this.logger?.error('TaskService: Error getting task tags', error);
        this.metrics.errors++;
        throw error;
      }
      
      this.logger?.debug('TaskService: Retrieved task tags', { taskId, count: data?.length || 0 });
      return data as DevTaskTag[];
    } catch (error) {
      this.logger?.error('TaskService: Failed to get task tags', error);
      this.metrics.errors++;
      throw error;
    }
  }

  /**
   * Add a tag to a task
   */
  async addTag(taskId: string, tag: string): Promise<DevTaskTag> {
    try {
      this.logger?.info('TaskService: Adding tag to task', { taskId, tag });
      
      const { data, error } = await this.supabase
        .from('dev_task_tags')
        .insert({ task_id: taskId, tag })
        .select()
        .single();
      
      if (error) {
        this.logger?.error('TaskService: Error adding tag', error);
        this.metrics.errors++;
        throw error;
      }
      
      this.metrics.tagsAdded++;
      this.logger?.info('TaskService: Tag added', { taskId, tag });
      return data as DevTaskTag;
    } catch (error) {
      this.logger?.error('TaskService: Failed to add tag', error);
      this.metrics.errors++;
      throw error;
    }
  }

  /**
   * Remove a tag
   */
  async removeTag(tagId: string): Promise<void> {
    try {
      this.logger?.info('TaskService: Removing tag', { tagId });
      
      const { error } = await this.supabase
        .from('dev_task_tags')
        .delete()
        .eq('id', tagId);
      
      if (error) {
        this.logger?.error('TaskService: Error removing tag', error);
        this.metrics.errors++;
        throw error;
      }
      
      this.metrics.tagsRemoved++;
      this.logger?.info('TaskService: Tag removed', { tagId });
    } catch (error) {
      this.logger?.error('TaskService: Failed to remove tag', error);
      this.metrics.errors++;
      throw error;
    }
  }

  // File operations

  /**
   * Get files for a task
   */
  async getTaskFiles(taskId: string): Promise<DevTaskFile[]> {
    try {
      this.logger?.debug('TaskService: Getting task files', { taskId });
      
      const { data, error } = await this.supabase
        .from('dev_task_files')
        .select('*')
        .eq('task_id', taskId)
        .order('file_path');
      
      if (error) {
        this.logger?.error('TaskService: Error getting task files', error);
        this.metrics.errors++;
        throw error;
      }
      
      this.logger?.debug('TaskService: Retrieved task files', { taskId, count: data?.length || 0 });
      return data as DevTaskFile[];
    } catch (error) {
      this.logger?.error('TaskService: Failed to get task files', error);
      this.metrics.errors++;
      throw error;
    }
  }

  /**
   * Add a file to a task
   */
  async addFile(taskId: string, filePath: string, action: 'created' | 'modified' | 'deleted' = 'modified'): Promise<DevTaskFile> {
    try {
      this.logger?.info('TaskService: Adding file to task', { taskId, filePath, action });
      
      const { data, error } = await this.supabase
        .from('dev_task_files')
        .insert({ task_id: taskId, file_path: filePath, action })
        .select()
        .single();
      
      if (error) {
        this.logger?.error('TaskService: Error adding file', error);
        this.metrics.errors++;
        throw error;
      }
      
      this.metrics.filesTracked++;
      this.logger?.info('TaskService: File added', { taskId, filePath });
      return data as DevTaskFile;
    } catch (error) {
      this.logger?.error('TaskService: Failed to add file', error);
      this.metrics.errors++;
      throw error;
    }
  }

  /**
   * Remove a file
   */
  async removeFile(fileId: string): Promise<void> {
    try {
      this.logger?.info('TaskService: Removing file', { fileId });
      
      const { error } = await this.supabase
        .from('dev_task_files')
        .delete()
        .eq('id', fileId);
      
      if (error) {
        this.logger?.error('TaskService: Error removing file', error);
        this.metrics.errors++;
        throw error;
      }
      
      this.logger?.info('TaskService: File removed', { fileId });
    } catch (error) {
      this.logger?.error('TaskService: Failed to remove file', error);
      this.metrics.errors++;
      throw error;
    }
  }

  // Git integration methods

  /**
   * Get commits for a task
   */
  async getTaskCommits(taskId: string): Promise<DevTaskCommit[]> {
    try {
      this.logger?.debug('TaskService: Getting task commits', { taskId });
      
      const { data, error } = await this.supabase
        .from('dev_task_commits')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });
      
      if (error) {
        this.logger?.error('TaskService: Error fetching commits', error);
        this.metrics.errors++;
        throw new Error(`Failed to fetch commits: ${error.message}`);
      }
      
      this.logger?.debug('TaskService: Retrieved task commits', { taskId, count: data?.length || 0 });
      return data as DevTaskCommit[];
    } catch (error) {
      this.logger?.error('TaskService: Failed to get task commits', error);
      this.metrics.errors++;
      throw error;
    }
  }

  /**
   * Get work sessions for a task
   */
  async getTaskWorkSessions(taskId: string): Promise<DevTaskWorkSession[]> {
    try {
      this.logger?.debug('TaskService: Getting task work sessions', { taskId });
      
      const { data, error } = await this.supabase
        .from('dev_task_work_sessions')
        .select('*')
        .eq('task_id', taskId)
        .order('started_at', { ascending: false });
      
      if (error) {
        this.logger?.error('TaskService: Error fetching work sessions', error);
        this.metrics.errors++;
        throw new Error(`Failed to fetch work sessions: ${error.message}`);
      }
      
      this.logger?.debug('TaskService: Retrieved work sessions', { taskId, count: data?.length || 0 });
      return data as DevTaskWorkSession[];
    } catch (error) {
      this.logger?.error('TaskService: Failed to get work sessions', error);
      this.metrics.errors++;
      throw error;
    }
  }

  // Helper methods

  /**
   * Format task for Claude
   */
  formatForClaude(task: DevTask, tags: string[] = []): string {
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

  /**
   * Mark task as complete with Claude response
   */
  async completeTask(id: string, claudeResponse: string): Promise<DevTask> {
    try {
      this.logger?.info('TaskService: Completing task', { id, responseLength: claudeResponse?.length });
      
      const result = await this.updateTask(id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        claude_response: claudeResponse
      });
      
      this.metrics.tasksCompleted++;
      this.logger?.info('TaskService: Task completed successfully', { id });
      return result;
    } catch (error) {
      this.logger?.error('TaskService: Failed to complete task', error);
      throw error;
    }
  }

  // Work session management

  /**
   * Start a work session for a task
   */
  async startWorkSession(taskId: string): Promise<DevTaskWorkSession> {
    try {
      this.logger?.info('TaskService: Starting work session', { taskId });
      
      const { data, error } = await this.supabase
        .from('dev_task_work_sessions')
        .insert({
          task_id: taskId,
          started_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        this.logger?.error('TaskService: Error starting work session', error);
        this.metrics.errors++;
        throw error;
      }
      
      this.metrics.workSessionsStarted++;
      this.logger?.info('TaskService: Work session started', { taskId, sessionId: data.id });
      return data as DevTaskWorkSession;
    } catch (error) {
      this.logger?.error('TaskService: Failed to start work session', error);
      this.metrics.errors++;
      throw error;
    }
  }

  /**
   * End a work session
   */
  async endWorkSession(sessionId: string, summary: string, filesModified?: string[]): Promise<DevTaskWorkSession> {
    try {
      this.logger?.info('TaskService: Ending work session', { sessionId });
      
      const { data, error } = await this.supabase
        .from('dev_task_work_sessions')
        .update({
          ended_at: new Date().toISOString(),
          summary,
          files_modified: filesModified
        })
        .eq('id', sessionId)
        .select()
        .single();
      
      if (error) {
        this.logger?.error('TaskService: Error ending work session', error);
        this.metrics.errors++;
        throw error;
      }
      
      this.metrics.workSessionsEnded++;
      this.logger?.info('TaskService: Work session ended', { sessionId });
      return data as DevTaskWorkSession;
    } catch (error) {
      this.logger?.error('TaskService: Failed to end work session', error);
      this.metrics.errors++;
      throw error;
    }
  }

  /**
   * Update work session with Claude session ID
   */
  async updateWorkSessionClaude(sessionId: string, claudeSessionId: string): Promise<DevTaskWorkSession> {
    try {
      this.logger?.info('TaskService: Updating work session with Claude ID', { sessionId, claudeSessionId });
      
      const { data, error } = await this.supabase
        .from('dev_task_work_sessions')
        .update({
          claude_session_id: claudeSessionId
        })
        .eq('id', sessionId)
        .select()
        .single();
      
      if (error) {
        this.logger?.error('TaskService: Error updating work session', error);
        this.metrics.errors++;
        throw error;
      }
      
      this.logger?.info('TaskService: Work session updated with Claude ID', { sessionId });
      return data as DevTaskWorkSession;
    } catch (error) {
      this.logger?.error('TaskService: Failed to update work session', error);
      this.metrics.errors++;
      throw error;
    }
  }
}

// Export the service class and types
export { TaskService };