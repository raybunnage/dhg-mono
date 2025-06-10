import { SupabaseClient } from '@supabase/supabase-js';
import { 
  WorkSummary, 
  CreateWorkSummaryInput, 
  UpdateWorkSummaryInput,
  WorkSummaryFilters,
  WorkSummaryStatistics,
  WorkItem,
  CATEGORY_MAPPINGS
} from './types';

export class WorkSummaryService {
  private static instance: WorkSummaryService | null = null;
  private supabase: SupabaseClient;

  private constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  static getInstance(supabaseClient?: SupabaseClient): WorkSummaryService {
    if (!WorkSummaryService.instance) {
      if (!supabaseClient) {
        throw new Error('Supabase client must be provided when creating WorkSummaryService instance');
      }
      WorkSummaryService.instance = new WorkSummaryService(supabaseClient);
    }
    return WorkSummaryService.instance;
  }

  /**
   * Get all work summaries with optional filters
   */
  async getSummaries(filters?: WorkSummaryFilters): Promise<WorkSummary[]> {
    try {
      let query = this.supabase
        .from('ai_work_summaries')
        .select('*')
        .order('work_date', { ascending: false })
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters) {
        if (filters.category && filters.category !== 'all') {
          query = query.eq('category', filters.category);
        }
        if (filters.status && filters.status !== 'all') {
          query = query.eq('status', filters.status);
        }
        if (filters.worktree) {
          query = query.eq('worktree', filters.worktree);
        }
        if (filters.startDate) {
          query = query.gte('work_date', filters.startDate);
        }
        if (filters.endDate) {
          query = query.lte('work_date', filters.endDate);
        }
        if (filters.tag) {
          query = query.contains('tags', [filters.tag]);
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      // Apply text search if provided
      let summaries = data || [];
      if (filters?.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        summaries = summaries.filter(summary => 
          summary.title.toLowerCase().includes(query) ||
          summary.summary_content.toLowerCase().includes(query) ||
          summary.commands?.some((cmd: string) => cmd.toLowerCase().includes(query)) ||
          summary.tags?.some((tag: string) => tag.toLowerCase().includes(query))
        );
      }

      return summaries;
    } catch (error) {
      console.error('Error fetching work summaries:', error);
      throw error;
    }
  }

  /**
   * Get a single work summary by ID
   */
  async getSummaryById(id: string): Promise<WorkSummary | null> {
    try {
      const { data, error } = await this.supabase
        .from('ai_work_summaries')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching work summary:', error);
      throw error;
    }
  }

  /**
   * Create a new work summary
   */
  async createSummary(input: CreateWorkSummaryInput): Promise<WorkSummary> {
    try {
      const { data, error } = await this.supabase
        .from('ai_work_summaries')
        .insert({
          ...input,
          commands: input.commands || [],
          ui_components: input.ui_components || [],
          tags: input.tags || [],
          status: input.status || 'completed'
        })
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Failed to create work summary');

      return data;
    } catch (error) {
      console.error('Error creating work summary:', error);
      throw error;
    }
  }

  /**
   * Update an existing work summary
   */
  async updateSummary(id: string, input: UpdateWorkSummaryInput): Promise<WorkSummary> {
    try {
      const { data, error } = await this.supabase
        .from('ai_work_summaries')
        .update({
          ...input,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Work summary not found');

      return data;
    } catch (error) {
      console.error('Error updating work summary:', error);
      throw error;
    }
  }

  /**
   * Delete a work summary
   */
  async deleteSummary(id: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('ai_work_summaries')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting work summary:', error);
      throw error;
    }
  }

  /**
   * Get work summary statistics
   */
  async getStatistics(): Promise<WorkSummaryStatistics> {
    try {
      const { data, error } = await this.supabase
        .from('ai_work_summaries')
        .select('*');

      if (error) throw error;

      const summaries = data || [];

      // Calculate statistics
      const byCategory: Record<string, number> = {};
      const byStatus: Record<string, number> = {};
      const byWorktree: Record<string, number> = {};
      const dateCount: Record<string, number> = {};

      summaries.forEach(summary => {
        // Count by category
        if (summary.category) {
          byCategory[summary.category] = (byCategory[summary.category] || 0) + 1;
        }

        // Count by status
        if (summary.status) {
          byStatus[summary.status] = (byStatus[summary.status] || 0) + 1;
        }

        // Count by worktree
        if (summary.worktree) {
          byWorktree[summary.worktree] = (byWorktree[summary.worktree] || 0) + 1;
        }

        // Count by date
        const date = summary.work_date.split('T')[0];
        dateCount[date] = (dateCount[date] || 0) + 1;
      });

      // Get recent activity (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentActivity = Object.entries(dateCount)
        .filter(([date]) => new Date(date) >= thirtyDaysAgo)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 30);

      return {
        totalSummaries: summaries.length,
        byCategory,
        byStatus,
        byWorktree,
        recentActivity
      };
    } catch (error) {
      console.error('Error getting work summary statistics:', error);
      throw error;
    }
  }

  /**
   * Get all unique tags from work summaries
   */
  async getAllTags(): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('ai_work_summaries')
        .select('tags');

      if (error) throw error;

      const allTags = new Set<string>();
      (data || []).forEach(summary => {
        (summary.tags || []).forEach((tag: string) => allTags.add(tag));
      });

      return Array.from(allTags).sort();
    } catch (error) {
      console.error('Error fetching tags:', error);
      throw error;
    }
  }

  /**
   * Get all unique categories
   */
  async getAllCategories(): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('ai_work_summaries')
        .select('category')
        .not('category', 'is', null);

      if (error) throw error;

      const categories = new Set<string>();
      (data || []).forEach(summary => {
        if (summary.category) categories.add(summary.category);
      });

      return Array.from(categories).sort();
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw error;
    }
  }

  /**
   * Get all unique worktrees
   */
  async getAllWorktrees(): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('ai_work_summaries')
        .select('worktree')
        .not('worktree', 'is', null);

      if (error) throw error;

      const worktrees = new Set<string>();
      (data || []).forEach(summary => {
        if (summary.worktree) worktrees.add(summary.worktree);
      });

      return Array.from(worktrees).sort();
    } catch (error) {
      console.error('Error fetching worktrees:', error);
      throw error;
    }
  }

  /**
   * Combine work summaries with tasks for unified view
   * Note: Tasks should be fetched separately from DevTaskService
   */
  combineWorkItems(summaries: WorkSummary[], tasks: any[]): WorkItem[] {
    const items: WorkItem[] = [];
    
    // Add summaries
    summaries.forEach(summary => {
      items.push({
        type: 'summary',
        date: summary.work_date,
        data: summary
      });
    });

    // Add tasks (using created_at as the date)
    tasks.forEach(task => {
      items.push({
        type: 'task',
        date: task.created_at,
        data: task
      });
    });

    // Sort by date (newest first)
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return items;
  }

  /**
   * Normalize category names using standard mappings
   */
  normalizeCategory(category: string): string {
    return CATEGORY_MAPPINGS[category] || category;
  }

  /**
   * Search work summaries by commands used
   */
  async searchByCommand(command: string): Promise<WorkSummary[]> {
    try {
      const { data, error } = await this.supabase
        .from('ai_work_summaries')
        .select('*')
        .contains('commands', [command])
        .order('work_date', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error searching by command:', error);
      throw error;
    }
  }

  /**
   * Search work summaries by UI components used
   */
  async searchByUIComponent(component: string): Promise<WorkSummary[]> {
    try {
      const { data, error } = await this.supabase
        .from('ai_work_summaries')
        .select('*')
        .contains('ui_components', [component])
        .order('work_date', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error searching by UI component:', error);
      throw error;
    }
  }

  /**
   * Get work summaries for a specific date range
   */
  async getSummariesByDateRange(startDate: string, endDate: string): Promise<WorkSummary[]> {
    try {
      const { data, error } = await this.supabase
        .from('ai_work_summaries')
        .select('*')
        .gte('work_date', startDate)
        .lte('work_date', endDate)
        .order('work_date', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching summaries by date range:', error);
      throw error;
    }
  }

  /**
   * Export work summaries as JSON
   */
  async exportSummaries(filters?: WorkSummaryFilters): Promise<string> {
    try {
      const summaries = await this.getSummaries(filters);
      return JSON.stringify(summaries, null, 2);
    } catch (error) {
      console.error('Error exporting summaries:', error);
      throw error;
    }
  }
}