/**
 * Lifecycle tracking methods for DevTaskService
 * These methods support the comprehensive work summary tracking system
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface WorkSummaryTodo {
  id: string;
  work_summary_id: string;
  todo_text: string;
  completed: boolean;
  priority: string;
  sequence_order: number;
  created_at: string;
  completed_at?: string;
}

export interface WorkSummaryValidation {
  id: string;
  work_summary_id: string;
  dev_task_id?: string;
  validated_at: string;
  validation_status: 'pending' | 'passed' | 'failed' | 'issues_found';
  validation_summary?: string;
  issues: any[];
  validator_type: string;
}

export interface TestResult {
  id: string;
  dev_task_id?: string;
  work_summary_id?: string;
  test_suite_name?: string;
  passed_count: number;
  failed_count: number;
  skipped_count: number;
  total_count: number;
  coverage_percentage?: number;
  execution_time_ms?: number;
  report_url?: string;
  test_output?: any;
}

export interface WorkSummaryTracking {
  id: string;
  title: string;
  summary_content: string;
  created_at: string;
  dev_task_id?: string;
  dev_task_title?: string;
  dev_task_status?: string;
  submission_timestamp?: string;
  validation_status?: string;
  has_submission: boolean;
  has_tests: boolean;
  has_validation: boolean;
  needs_action: boolean;
  total_todos: number;
  completed_todos: number;
  follow_up_count: number;
  completed_follow_ups: number;
  passed_count?: number;
  failed_count?: number;
  coverage_percentage?: number;
}

export class LifecycleTrackingMixin {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Create a work summary linked to a dev task with automatic todo generation
   */
  async createWorkSummaryWithTaskLink(params: {
    title: string;
    content: string;
    taskId: string;
    worktree: string;
    gitCommit: string;
    category?: string;
  }): Promise<string> {
    const { data, error } = await this.supabase.rpc('create_work_summary_with_task_link', {
      p_title: params.title,
      p_content: params.content,
      p_task_id: params.taskId,
      p_worktree: params.worktree,
      p_git_commit: params.gitCommit,
      p_category: params.category || 'feature'
    });

    if (error) throw new Error(`Failed to create work summary: ${error.message}`);
    return data;
  }

  /**
   * Get work summary tracking information
   */
  async getWorkSummaryTracking(summaryId: string): Promise<WorkSummaryTracking | null> {
    const { data, error } = await this.supabase
      .from('work_summary_tracking_view')
      .select('*')
      .eq('id', summaryId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to get tracking info: ${error.message}`);
    }

    return data;
  }

  /**
   * Get todos for a work summary
   */
  async getWorkSummaryTodos(summaryId: string): Promise<WorkSummaryTodo[]> {
    const { data, error } = await this.supabase
      .from('work_summary_todos')
      .select('*')
      .eq('work_summary_id', summaryId)
      .order('sequence_order');

    if (error) throw new Error(`Failed to get todos: ${error.message}`);
    return data || [];
  }

  /**
   * Toggle a todo item completion status
   */
  async toggleTodo(todoId: string): Promise<WorkSummaryTodo> {
    // First get current status
    const { data: todo, error: getError } = await this.supabase
      .from('work_summary_todos')
      .select('completed')
      .eq('id', todoId)
      .single();

    if (getError) throw new Error(`Failed to get todo: ${getError.message}`);

    // Toggle and update
    const { data, error } = await this.supabase
      .from('work_summary_todos')
      .update({
        completed: !todo.completed,
        completed_at: !todo.completed ? new Date().toISOString() : null
      })
      .eq('id', todoId)
      .select()
      .single();

    if (error) throw new Error(`Failed to toggle todo: ${error.message}`);
    return data;
  }

  /**
   * Add a new todo to a work summary
   */
  async addTodo(summaryId: string, todoText: string, priority: 'low' | 'medium' | 'high' = 'medium'): Promise<WorkSummaryTodo> {
    // Get max sequence order
    const { data: todos } = await this.supabase
      .from('work_summary_todos')
      .select('sequence_order')
      .eq('work_summary_id', summaryId)
      .order('sequence_order', { ascending: false })
      .limit(1);

    const nextOrder = (todos && todos.length > 0) ? todos[0].sequence_order + 1 : 1;

    const { data, error } = await this.supabase
      .from('work_summary_todos')
      .insert({
        work_summary_id: summaryId,
        todo_text: todoText,
        priority,
        sequence_order: nextOrder
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add todo: ${error.message}`);
    return data;
  }

  /**
   * Create a validation record for a work summary
   */
  async createValidation(params: {
    workSummaryId: string;
    devTaskId?: string;
    status: 'pending' | 'passed' | 'failed' | 'issues_found';
    summary?: string;
    issues?: any[];
  }): Promise<WorkSummaryValidation> {
    const { data, error } = await this.supabase
      .from('work_summary_validations')
      .insert({
        work_summary_id: params.workSummaryId,
        dev_task_id: params.devTaskId,
        validation_status: params.status,
        validation_summary: params.summary,
        issues: params.issues || []
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create validation: ${error.message}`);
    return data;
  }

  /**
   * Record test results for a work summary
   */
  async recordTestResults(params: {
    workSummaryId?: string;
    devTaskId?: string;
    testSuiteName: string;
    passed: number;
    failed: number;
    skipped?: number;
    coverage?: number;
    reportUrl?: string;
    testOutput?: any;
  }): Promise<TestResult> {
    const total = params.passed + params.failed + (params.skipped || 0);
    
    const { data, error } = await this.supabase
      .from('test_results')
      .insert({
        work_summary_id: params.workSummaryId,
        dev_task_id: params.devTaskId,
        test_suite_name: params.testSuiteName,
        passed_count: params.passed,
        failed_count: params.failed,
        skipped_count: params.skipped || 0,
        total_count: total,
        coverage_percentage: params.coverage,
        report_url: params.reportUrl,
        test_output: params.testOutput
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to record test results: ${error.message}`);
    return data;
  }

  /**
   * Create a follow-up task
   */
  async createFollowUpTask(params: {
    parentTaskId: string;
    title: string;
    followUpType: string;
    priority?: string;
    description?: string;
  }): Promise<string> {
    const { data, error } = await this.supabase.rpc('create_follow_up_task', {
      p_parent_task_id: params.parentTaskId,
      p_title: params.title,
      p_follow_up_type: params.followUpType,
      p_priority: params.priority || 'medium',
      p_description: params.description
    });

    if (error) throw new Error(`Failed to create follow-up task: ${error.message}`);
    return data;
  }

  /**
   * Get all work summaries with tracking info for a specific dev task
   */
  async getTaskWorkSummaries(taskId: string): Promise<WorkSummaryTracking[]> {
    const { data, error } = await this.supabase
      .from('work_summary_tracking_view')
      .select('*')
      .eq('dev_task_id', taskId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get task work summaries: ${error.message}`);
    return data || [];
  }

  /**
   * Get work summaries that need action
   */
  async getWorkSummariesNeedingAction(): Promise<WorkSummaryTracking[]> {
    const { data, error } = await this.supabase
      .from('work_summary_tracking_view')
      .select('*')
      .eq('needs_action', true)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get summaries needing action: ${error.message}`);
    return data || [];
  }
}