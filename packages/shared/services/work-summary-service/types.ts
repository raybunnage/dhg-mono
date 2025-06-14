// Work Summary Types

export interface WorkSummary {
  id: string;
  title: string;
  summary_content: string;
  work_date: string;
  commands: string[];
  ui_components: string[];
  tags: string[];
  category: string;
  status: string;
  created_at: string;
  updated_at?: string;
  metadata?: Record<string, any>;
  worktree?: string;
  worktree_path?: string;
}

export interface CreateWorkSummaryInput {
  title: string;
  summary_content: string;
  work_date: string;
  commands?: string[];
  ui_components?: string[];
  tags?: string[];
  category: string;
  status?: string;
  metadata?: Record<string, any>;
  worktree?: string;
  worktree_path?: string;
}

export interface UpdateWorkSummaryInput {
  title?: string;
  summary_content?: string;
  work_date?: string;
  commands?: string[];
  ui_components?: string[];
  tags?: string[];
  category?: string;
  status?: string;
  metadata?: Record<string, any>;
  worktree?: string;
  worktree_path?: string;
}

export interface WorkSummaryFilters {
  category?: string;
  status?: string;
  worktree?: string;
  tag?: string;
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
}

export interface WorkSummaryStatistics {
  totalSummaries: number;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  byWorktree: Record<string, number>;
  recentActivity: {
    date: string;
    count: number;
  }[];
}

// Combined work item types for unified views
export interface WorkItem {
  type: 'summary' | 'task';
  date: string;
  data: WorkSummary | any; // 'any' for task data since it comes from DevTaskService
}

// Standard category mappings
export const CATEGORY_MAPPINGS: Record<string, string> = {
  // Summary categories
  'feature': 'feature',
  'bug_fix': 'bug',
  'refactoring': 'refactor',
  'documentation': 'documentation',
  'infrastructure': 'infrastructure',
  'testing': 'testing',
  'performance': 'performance',
  'security': 'security',
  // Task types (already standardized)
  'bug': 'bug',
  'refactor': 'refactor',
};

export const WORK_SUMMARY_STATUSES = [
  'completed',
  'in_progress',
  'pending',
  'archived'
] as const;

export type WorkSummaryStatus = typeof WORK_SUMMARY_STATUSES[number];