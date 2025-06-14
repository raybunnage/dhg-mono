/**
 * DevTask Service
 * Centralized service for managing development tasks across the monorepo
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseClientService } from '../supabase-client';
import type {
  DevTask,
  DevTaskTag,
  DevTaskFile,
  DevTaskCommit,
  DevTaskWorkSession,
  TaskFilters,
  CreateTaskInput,
  UpdateTaskInput
} from './types';
import { LifecycleTrackingMixin } from './lifecycle-tracking';

export class DevTaskService {
  private static instances = new Map<SupabaseClient, DevTaskService>();
  private supabase: SupabaseClient;
  public lifecycle: LifecycleTrackingMixin;

  private constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
    this.lifecycle = new LifecycleTrackingMixin(supabaseClient);
  }

  /**
   * Get instance for browser environments (requires Supabase client)
   * For CLI/server environments, pass no parameter to use singleton
   */
  static getInstance(supabaseClient?: SupabaseClient): DevTaskService {
    // If no client provided, try to use the singleton (CLI/server only)
    if (!supabaseClient) {
      if (typeof window !== 'undefined') {
        throw new Error('Browser environment requires a Supabase client to be passed to getInstance()');
      }
      // CLI/server environment - use singleton
      supabaseClient = SupabaseClientService.getInstance().getClient();
    }

    // Check if we already have an instance for this client
    if (!DevTaskService.instances.has(supabaseClient)) {
      DevTaskService.instances.set(supabaseClient, new DevTaskService(supabaseClient));
    }
    
    return DevTaskService.instances.get(supabaseClient)!;
  }

  // Task CRUD operations
  async getTasks(filters?: TaskFilters): Promise<DevTask[]> {
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
    if (filters?.worktree) {
      query = query.eq('worktree', filters.worktree);
    }
    if (filters?.has_commits !== undefined) {
      query = query.eq('has_commits', filters.has_commits);
    }
    if (filters?.progress_status) {
      query = query.eq('progress_status', filters.progress_status);
    }
    if (filters?.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as DevTask[];
  }

  async getTask(id: string): Promise<DevTask> {
    const { data, error } = await this.supabase
      .from('dev_tasks_enhanced_view')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as DevTask;
  }

  async createTask(task: CreateTaskInput): Promise<DevTask> {
    let userId: string | null = null;
    
    try {
      const { data: { user }, error: authError } = await this.supabase.auth.getUser();
      if (authError && authError.message !== 'Auth session missing!') {
        console.warn('Auth error in createTask:', authError.message);
      }
      userId = user?.id || null;
    } catch (authError) {
      console.warn('Could not get authenticated user in createTask:', authError);
      // Continue without user ID - let the database handle RLS
    }
    
    // First create the task
    const { data: newTask, error: createError } = await this.supabase
      .from('dev_tasks')
      .insert({
        ...task,
        created_by: userId,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (createError) {
      console.error('Database error in createTask:', createError);
      throw new Error(`Failed to create task: ${createError.message}`);
    }

    // If tags were provided, add them
    if (task.tags && task.tags.length > 0) {
      const tagInserts = task.tags.map(tag => ({
        task_id: newTask.id,
        tag
      }));

      const { error: tagError } = await this.supabase
        .from('dev_task_tags')
        .insert(tagInserts);

      if (tagError) {
        console.error('Error adding tags:', tagError);
      }
    }

    // Fetch the complete task from the enhanced view
    return this.getTask(newTask.id);
  }

  async updateTask(id: string, updates: UpdateTaskInput): Promise<DevTask> {
    console.log('Updating task:', id, updates);
    
    // Check auth status
    const { data: { user } } = await this.supabase.auth.getUser();
    console.log('Auth status in updateTask:', user ? `Authenticated as ${user.email}` : 'Not authenticated');
    
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
      console.error('Error updating task:', updateError);
      console.error('Error details:', {
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        code: updateError.code
      });
      throw new Error(`Failed to update task: ${updateError.message}`);
    }
    
    console.log('Task updated in dev_tasks table:', updateData);
    
    // Now fetch the updated task from the enhanced view to get computed fields
    const { data: enhancedData, error: fetchError } = await this.supabase
      .from('dev_tasks_enhanced_view')
      .select('*')
      .eq('id', id)
      .single();
      
    if (fetchError) {
      console.error('Error fetching enhanced task data:', fetchError);
      // Fall back to the basic update data if enhanced view fails
      return updateData as DevTask;
    }
    
    console.log('Task fetched from enhanced view:', enhancedData);
    return enhancedData as DevTask;
  }

  async deleteTask(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('dev_tasks')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  // Tag operations
  async getTaskTags(taskId: string): Promise<DevTaskTag[]> {
    const { data, error } = await this.supabase
      .from('dev_task_tags')
      .select('*')
      .eq('task_id', taskId)
      .order('tag');
    
    if (error) throw error;
    return data as DevTaskTag[];
  }

  async addTag(taskId: string, tag: string): Promise<DevTaskTag> {
    const { data, error } = await this.supabase
      .from('dev_task_tags')
      .insert({ task_id: taskId, tag })
      .select()
      .single();
    
    if (error) throw error;
    return data as DevTaskTag;
  }

  async removeTag(tagId: string): Promise<void> {
    const { error } = await this.supabase
      .from('dev_task_tags')
      .delete()
      .eq('id', tagId);
    
    if (error) throw error;
  }

  // File operations
  async getTaskFiles(taskId: string): Promise<DevTaskFile[]> {
    const { data, error } = await this.supabase
      .from('dev_task_files')
      .select('*')
      .eq('task_id', taskId)
      .order('file_path');
    
    if (error) throw error;
    return data as DevTaskFile[];
  }

  async addFile(taskId: string, filePath: string, action: 'created' | 'modified' | 'deleted' = 'modified'): Promise<DevTaskFile> {
    const { data, error } = await this.supabase
      .from('dev_task_files')
      .insert({ task_id: taskId, file_path: filePath, action })
      .select()
      .single();
    
    if (error) throw error;
    return data as DevTaskFile;
  }

  async removeFile(fileId: string): Promise<void> {
    const { error } = await this.supabase
      .from('dev_task_files')
      .delete()
      .eq('id', fileId);
    
    if (error) throw error;
  }

  // Git integration methods
  async getTaskCommits(taskId: string): Promise<DevTaskCommit[]> {
    const { data, error } = await this.supabase
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

  async getTaskWorkSessions(taskId: string): Promise<DevTaskWorkSession[]> {
    const { data, error } = await this.supabase
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

  // Mark task as complete with Claude response
  async completeTask(id: string, claudeResponse: string): Promise<DevTask> {
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
  async startWorkSession(taskId: string): Promise<DevTaskWorkSession> {
    const { data, error } = await this.supabase
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

  async endWorkSession(sessionId: string, summary: string, filesModified?: string[]): Promise<DevTaskWorkSession> {
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
    
    if (error) throw error;
    return data as DevTaskWorkSession;
  }

  async updateWorkSessionClaude(sessionId: string, claudeSessionId: string): Promise<DevTaskWorkSession> {
    const { data, error } = await this.supabase
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

  // Task statistics and reporting
  async getTaskStatistics(filters?: TaskFilters): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    byType: Record<string, number>;
    completionRate: number;
  }> {
    const tasks = await this.getTasks(filters);
    
    const stats = {
      total: tasks.length,
      byStatus: {} as Record<string, number>,
      byPriority: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      completionRate: 0
    };

    let completedCount = 0;

    tasks.forEach(task => {
      // Status counts
      stats.byStatus[task.status] = (stats.byStatus[task.status] || 0) + 1;
      if (task.status === 'completed' || task.status === 'merged') {
        completedCount++;
      }

      // Priority counts
      stats.byPriority[task.priority] = (stats.byPriority[task.priority] || 0) + 1;

      // Type counts
      stats.byType[task.task_type] = (stats.byType[task.task_type] || 0) + 1;
    });

    stats.completionRate = stats.total > 0 ? (completedCount / stats.total) * 100 : 0;

    return stats;
  }
}