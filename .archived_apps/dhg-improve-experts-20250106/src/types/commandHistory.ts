import { Database } from '../../../../supabase/types';

// Command Categories
export type CommandCategory = Database['public']['Tables']['command_categories']['Row'];
export type CommandCategoryInsert = Database['public']['Tables']['command_categories']['Insert'];
export type CommandCategoryUpdate = Database['public']['Tables']['command_categories']['Update'];

// Command History
export type CommandHistory = Database['public']['Tables']['command_history']['Row'];
export type CommandHistoryInsert = Database['public']['Tables']['command_history']['Insert'];
export type CommandHistoryUpdate = Database['public']['Tables']['command_history']['Update'];

// Favorite Commands
export type FavoriteCommand = Database['public']['Tables']['favorite_commands']['Row'];
export type FavoriteCommandInsert = Database['public']['Tables']['favorite_commands']['Insert'];
export type FavoriteCommandUpdate = Database['public']['Tables']['favorite_commands']['Update'];

// Command Patterns
export type CommandPattern = Database['public']['Tables']['command_patterns']['Row'];
export type CommandPatternInsert = Database['public']['Tables']['command_patterns']['Insert'];
export type CommandPatternUpdate = Database['public']['Tables']['command_patterns']['Update'];

// Command Suggestions (from view)
export type CommandSuggestion = {
  sanitized_command: string;
  category_name: string;
  usage_count: number;
  last_used: string;
  success_rate: number;
  recommendation_strength: 'high' | 'medium' | 'low';
};

// Analytics Function Return Types
export type MostUsedCommand = {
  command_text: string;
  category_name: string;
  usage_count: number;
  success_rate: number;
};

export type CategoryUsage = {
  category_name: string;
  usage_count: number;
  success_rate: number;
};

export type CommandHistoryResult = {
  id: string;
  command_text: string;
  sanitized_command: string;
  category_name: string;
  executed_at: string;
  duration_ms: number | null;
  exit_code: number | null;
  success: boolean | null;
  notes: string | null;
  tags: string[] | null;
}; 