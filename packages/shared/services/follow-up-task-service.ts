import { SupabaseClient } from '@supabase/supabase-js';

export interface FollowUpTask {
  id: string;
  follow_up_task_id: string;
  follow_up_type: string;
  follow_up_summary: string | null;
  follow_up_title: string;
  follow_up_status: string;
  created_at: string;
}

export interface CreateFollowUpRequest {
  originalTaskId?: string;
  originalWorkSummaryId?: string;
  followUpTaskId: string;
  followUpType?: string;
  followUpSummary?: string;
}

export class FollowUpTaskService {
  private static instances = new Map<SupabaseClient, FollowUpTaskService>();
  private supabase: SupabaseClient;

  private constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  public static getInstance(supabaseClient: SupabaseClient): FollowUpTaskService {
    if (!FollowUpTaskService.instances.has(supabaseClient)) {
      FollowUpTaskService.instances.set(supabaseClient, new FollowUpTaskService(supabaseClient));
    }
    return FollowUpTaskService.instances.get(supabaseClient)!;
  }

  /**
   * Create a follow-up task relationship
   */
  async createFollowUpRelationship(request: CreateFollowUpRequest): Promise<string> {
    const { data, error } = await this.supabase.rpc('create_follow_up_task_relationship', {
      p_original_task_id: request.originalTaskId || null,
      p_original_work_summary_id: request.originalWorkSummaryId || null,
      p_follow_up_task_id: request.followUpTaskId,
      p_follow_up_type: request.followUpType || 'implementation',
      p_follow_up_summary: request.followUpSummary || null
    });

    if (error) {
      console.error('Error creating follow-up relationship:', error);
      throw new Error(`Failed to create follow-up relationship: ${error.message}`);
    }

    return data;
  }

  /**
   * Get follow-up tasks for a dev task
   */
  async getFollowUpsForTask(taskId: string): Promise<FollowUpTask[]> {
    const { data, error } = await this.supabase.rpc('get_follow_ups', {
      p_task_id: taskId
    });

    if (error) {
      console.error('Error fetching follow-ups for task:', error);
      throw new Error(`Failed to fetch follow-ups: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get follow-up tasks for a work summary
   */
  async getFollowUpsForWorkSummary(workSummaryId: string): Promise<FollowUpTask[]> {
    const { data, error } = await this.supabase.rpc('get_follow_ups', {
      p_work_summary_id: workSummaryId
    });

    if (error) {
      console.error('Error fetching follow-ups for work summary:', error);
      throw new Error(`Failed to fetch follow-ups: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get dev task with follow-ups
   */
  async getTaskWithFollowUps(taskId: string) {
    const { data, error } = await this.supabase
      .from('dev_tasks_with_follow_ups_view')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error) {
      console.error('Error fetching task with follow-ups:', error);
      throw new Error(`Failed to fetch task with follow-ups: ${error.message}`);
    }

    return data;
  }

  /**
   * Get work summary with follow-ups
   */
  async getWorkSummaryWithFollowUps(workSummaryId: string) {
    const { data, error } = await this.supabase
      .from('ai_work_summaries_with_follow_ups_view')
      .select('*')
      .eq('id', workSummaryId)
      .single();

    if (error) {
      console.error('Error fetching work summary with follow-ups:', error);
      throw new Error(`Failed to fetch work summary with follow-ups: ${error.message}`);
    }

    return data;
  }

  /**
   * Update follow-up task summary
   */
  async updateFollowUpSummary(followUpId: string, summary: string): Promise<void> {
    const { error } = await this.supabase
      .from('dev_follow_up_tasks')
      .update({ follow_up_summary: summary })
      .eq('id', followUpId);

    if (error) {
      console.error('Error updating follow-up summary:', error);
      throw new Error(`Failed to update follow-up summary: ${error.message}`);
    }
  }

  /**
   * Delete a follow-up relationship
   */
  async deleteFollowUpRelationship(followUpId: string): Promise<void> {
    const { error } = await this.supabase
      .from('dev_follow_up_tasks')
      .delete()
      .eq('id', followUpId);

    if (error) {
      console.error('Error deleting follow-up relationship:', error);
      throw new Error(`Failed to delete follow-up relationship: ${error.message}`);
    }
  }

  /**
   * Get all follow-up tasks created in the last N days
   */
  async getRecentFollowUps(days: number = 7): Promise<FollowUpTask[]> {
    const { data, error } = await this.supabase
      .from('dev_follow_up_tasks')
      .select(`
        id,
        follow_up_task_id,
        follow_up_type,
        follow_up_summary,
        created_at,
        follow_up_task:dev_tasks!follow_up_task_id(title, status)
      `)
      .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching recent follow-ups:', error);
      throw new Error(`Failed to fetch recent follow-ups: ${error.message}`);
    }

    return (data || []).map(item => ({
      id: item.id,
      follow_up_task_id: item.follow_up_task_id,
      follow_up_type: item.follow_up_type,
      follow_up_summary: item.follow_up_summary,
      follow_up_title: (item.follow_up_task as any)?.title || 'Unknown',
      follow_up_status: (item.follow_up_task as any)?.status || 'unknown',
      created_at: item.created_at
    }));
  }
}