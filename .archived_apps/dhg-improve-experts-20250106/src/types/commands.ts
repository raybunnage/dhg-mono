import { Database } from './supabase';

export type CommandCategory = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
};

export type CommandHistory = {
  id: string;
  command_text: string;
  sanitized_command: string;
  category_id: string;
  executed_at: string;
  duration_ms: number | null;
  exit_code: number | null;
  success: boolean | null;
  notes: string | null;
  tags: string[] | null;
};

export type FavoriteCommand = {
  id: string;
  name: string;
  command_text: string;
  category_id: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  usage_count: number;
  last_used_at: string | null;
  tags: string[] | null;
};

export type CommandPattern = {
  id: string;
  pattern: string;
  replacement: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CommandSuggestion = {
  sanitized_command: string;
  category_name: string;
  usage_count: number;
  last_used: string;
  success_rate: number;
  recommendation_strength: 'high' | 'medium' | 'low';
};

export type CommandUsageByCategory = {
  category_name: string;
  usage_count: number;
  success_rate: number;
};

export type MostUsedCommand = {
  command_text: string;
  category_name: string;
  usage_count: number;
  success_rate: number;
};

export type CommandHistoryWithCategory = CommandHistory & {
  category_name: string;
};

export type CommandHistoryFilters = {
  categoryFilter?: string | null;
  successFilter?: boolean | null;
  searchTerm?: string | null;
  pageSize?: number;
  pageNumber?: number;
};