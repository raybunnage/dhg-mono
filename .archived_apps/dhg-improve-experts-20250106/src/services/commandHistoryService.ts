import { supabase } from '../integrations/supabase/client';
import {
  CommandCategory,
  CommandCategoryInsert,
  CommandHistory,
  CommandHistoryInsert,
  CommandHistoryResult,
  CommandPattern,
  CommandSuggestion,
  FavoriteCommand,
  FavoriteCommandInsert,
  MostUsedCommand,
  CategoryUsage
} from '../types/commandHistory';

/**
 * Service for managing command history and related functionality
 */
export class CommandHistoryService {
  /**
   * Record a command execution in the history
   * @param command The command that was executed
   * @param categoryName The category name (e.g., 'git', 'pnpm')
   * @param exitCode The exit code from the command execution
   * @param durationMs The duration of the command execution in milliseconds
   * @param notes Optional notes about the command
   * @param tags Optional tags for the command
   */
  async recordCommand(
    command: string,
    categoryName: string,
    exitCode: number,
    durationMs: number,
    notes?: string,
    tags?: string[]
  ): Promise<CommandHistory | null> {
    try {
      // Get category ID
      const { data: category } = await supabase
        .from('command_categories')
        .select('id')
        .eq('name', categoryName)
        .single();

      if (!category) {
        console.error(`Category '${categoryName}' not found`);
        return null;
      }

      // Sanitize command (this will call the sanitize_command function in the database)
      const { data: sanitizedData } = await supabase
        .rpc('sanitize_command', { command_text: command });

      const sanitizedCommand = sanitizedData || command;

      // Insert command history
      const commandData: CommandHistoryInsert = {
        command_text: command,
        sanitized_command: sanitizedCommand,
        category_id: category.id,
        exit_code: exitCode,
        success: exitCode === 0,
        duration_ms: durationMs,
        notes,
        tags
      };

      const { data, error } = await supabase
        .from('command_history')
        .insert(commandData)
        .select()
        .single();

      if (error) {
        console.error('Error recording command:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in recordCommand:', error);
      return null;
    }
  }

  /**
   * Get command history with optional filtering and pagination
   */
  async getCommandHistory(
    categoryFilter?: string,
    successFilter?: boolean,
    searchTerm?: string,
    pageSize: number = 20,
    pageNumber: number = 1
  ): Promise<CommandHistoryResult[]> {
    try {
      const { data, error } = await supabase
        .rpc('get_command_history', {
          category_filter: categoryFilter,
          success_filter: successFilter,
          search_term: searchTerm,
          page_size: pageSize,
          page_number: pageNumber
        });

      if (error) {
        console.error('Error fetching command history:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getCommandHistory:', error);
      return [];
    }
  }

  /**
   * Get all command categories
   */
  async getCategories(): Promise<CommandCategory[]> {
    try {
      const { data, error } = await supabase
        .from('command_categories')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching categories:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getCategories:', error);
      return [];
    }
  }

  /**
   * Add a new command category
   */
  async addCategory(category: CommandCategoryInsert): Promise<CommandCategory | null> {
    try {
      const { data, error } = await supabase
        .from('command_categories')
        .insert(category)
        .select()
        .single();

      if (error) {
        console.error('Error adding category:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in addCategory:', error);
      return null;
    }
  }

  /**
   * Get favorite commands
   */
  async getFavoriteCommands(): Promise<FavoriteCommand[]> {
    try {
      const { data, error } = await supabase
        .from('favorite_commands')
        .select('*, command_categories(name)')
        .order('name');

      if (error) {
        console.error('Error fetching favorite commands:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getFavoriteCommands:', error);
      return [];
    }
  }

  /**
   * Add a favorite command
   */
  async addFavoriteCommand(command: FavoriteCommandInsert): Promise<FavoriteCommand | null> {
    try {
      const { data, error } = await supabase
        .from('favorite_commands')
        .insert(command)
        .select()
        .single();

      if (error) {
        console.error('Error adding favorite command:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in addFavoriteCommand:', error);
      return null;
    }
  }

  /**
   * Update a favorite command
   */
  async updateFavoriteCommand(id: string, updates: Partial<FavoriteCommand>): Promise<FavoriteCommand | null> {
    try {
      const { data, error } = await supabase
        .from('favorite_commands')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating favorite command:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in updateFavoriteCommand:', error);
      return null;
    }
  }

  /**
   * Delete a favorite command
   */
  async deleteFavoriteCommand(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('favorite_commands')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting favorite command:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteFavoriteCommand:', error);
      return false;
    }
  }

  /**
   * Increment usage count for a favorite command
   */
  async incrementFavoriteCommandUsage(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .rpc('increment_favorite_command_usage', { favorite_id: id });

      if (error) {
        console.error('Error incrementing favorite command usage:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in incrementFavoriteCommandUsage:', error);
      return false;
    }
  }

  /**
   * Get command patterns for sanitization
   */
  async getCommandPatterns(): Promise<CommandPattern[]> {
    try {
      const { data, error } = await supabase
        .from('command_patterns')
        .select('*')
        .order('created_at');

      if (error) {
        console.error('Error fetching command patterns:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getCommandPatterns:', error);
      return [];
    }
  }

  /**
   * Get command suggestions
   */
  async getCommandSuggestions(): Promise<CommandSuggestion[]> {
    try {
      const { data, error } = await supabase
        .from('command_suggestions')
        .select('*');

      if (error) {
        console.error('Error fetching command suggestions:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getCommandSuggestions:', error);
      return [];
    }
  }

  /**
   * Get most used commands
   */
  async getMostUsedCommands(
    timePeriodDays: number = 30,
    limit: number = 10
  ): Promise<MostUsedCommand[]> {
    try {
      const { data, error } = await supabase
        .rpc('get_most_used_commands', {
          time_period: `${timePeriodDays} days`,
          limit_count: limit
        });

      if (error) {
        console.error('Error fetching most used commands:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getMostUsedCommands:', error);
      return [];
    }
  }

  /**
   * Get command usage by category
   */
  async getCommandUsageByCategory(
    timePeriodDays: number = 30
  ): Promise<CategoryUsage[]> {
    try {
      const { data, error } = await supabase
        .rpc('get_command_usage_by_category', {
          time_period: `${timePeriodDays} days`
        });

      if (error) {
        console.error('Error fetching command usage by category:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getCommandUsageByCategory:', error);
      return [];
    }
  }
} 