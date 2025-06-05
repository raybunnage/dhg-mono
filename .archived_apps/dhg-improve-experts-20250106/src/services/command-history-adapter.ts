/**
 * Adapter for command history service
 * 
 * This adapter will eventually use the shared command-history-service.
 * It's designed as an adapter to make the future transition smoother.
 * 
 * NOTES FOR MIGRATION:
 * 1. This is a temporary adapter that will be replaced with the shared service
 * 2. Keep the interface consistent with the shared service
 * 3. When migrating, update the implementation to use the shared service but
 *    maintain the same interface
 */
import { CommandHistoryService } from './commandHistoryService';
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

// Create a singleton instance of the service
const commandHistoryService = new CommandHistoryService();

export class CommandHistoryAdapter {
  /**
   * Record a command execution in the history
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
      return await commandHistoryService.recordCommand(
        command,
        categoryName,
        exitCode,
        durationMs,
        notes,
        tags
      );
    } catch (error) {
      console.error('Error in recordCommand adapter:', error);
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
      return await commandHistoryService.getCommandHistory(
        categoryFilter,
        successFilter,
        searchTerm,
        pageSize,
        pageNumber
      );
    } catch (error) {
      console.error('Error in getCommandHistory adapter:', error);
      return [];
    }
  }

  /**
   * Get all command categories
   */
  async getCategories(): Promise<CommandCategory[]> {
    try {
      return await commandHistoryService.getCategories();
    } catch (error) {
      console.error('Error in getCategories adapter:', error);
      return [];
    }
  }

  /**
   * Add a new command category
   */
  async addCategory(category: CommandCategoryInsert): Promise<CommandCategory | null> {
    try {
      return await commandHistoryService.addCategory(category);
    } catch (error) {
      console.error('Error in addCategory adapter:', error);
      return null;
    }
  }

  /**
   * Get favorite commands
   */
  async getFavoriteCommands(): Promise<FavoriteCommand[]> {
    try {
      return await commandHistoryService.getFavoriteCommands();
    } catch (error) {
      console.error('Error in getFavoriteCommands adapter:', error);
      return [];
    }
  }

  /**
   * Add a favorite command
   */
  async addFavoriteCommand(command: FavoriteCommandInsert): Promise<FavoriteCommand | null> {
    try {
      return await commandHistoryService.addFavoriteCommand(command);
    } catch (error) {
      console.error('Error in addFavoriteCommand adapter:', error);
      return null;
    }
  }

  /**
   * Update a favorite command
   */
  async updateFavoriteCommand(id: string, updates: Partial<FavoriteCommand>): Promise<FavoriteCommand | null> {
    try {
      return await commandHistoryService.updateFavoriteCommand(id, updates);
    } catch (error) {
      console.error('Error in updateFavoriteCommand adapter:', error);
      return null;
    }
  }

  /**
   * Delete a favorite command
   */
  async deleteFavoriteCommand(id: string): Promise<boolean> {
    try {
      return await commandHistoryService.deleteFavoriteCommand(id);
    } catch (error) {
      console.error('Error in deleteFavoriteCommand adapter:', error);
      return false;
    }
  }

  /**
   * Increment usage count for a favorite command
   */
  async incrementFavoriteCommandUsage(id: string): Promise<boolean> {
    try {
      return await commandHistoryService.incrementFavoriteCommandUsage(id);
    } catch (error) {
      console.error('Error in incrementFavoriteCommandUsage adapter:', error);
      return false;
    }
  }

  /**
   * Get command patterns for sanitization
   */
  async getCommandPatterns(): Promise<CommandPattern[]> {
    try {
      return await commandHistoryService.getCommandPatterns();
    } catch (error) {
      console.error('Error in getCommandPatterns adapter:', error);
      return [];
    }
  }

  /**
   * Get command suggestions
   */
  async getCommandSuggestions(): Promise<CommandSuggestion[]> {
    try {
      return await commandHistoryService.getCommandSuggestions();
    } catch (error) {
      console.error('Error in getCommandSuggestions adapter:', error);
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
      return await commandHistoryService.getMostUsedCommands(timePeriodDays, limit);
    } catch (error) {
      console.error('Error in getMostUsedCommands adapter:', error);
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
      return await commandHistoryService.getCommandUsageByCategory(timePeriodDays);
    } catch (error) {
      console.error('Error in getCommandUsageByCategory adapter:', error);
      return [];
    }
  }
}

// Export singleton instance
export const commandHistoryAdapter = new CommandHistoryAdapter();