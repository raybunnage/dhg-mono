/**
 * Clipboard Service
 * Manages reusable code snippets and text templates
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseClientService } from '../supabase-client';
import type {
  ClipboardItem,
  ClipboardCategory,
  CreateClipboardItemInput,
  UpdateClipboardItemInput,
  ClipboardFilters
} from './types';

export class ClipboardService {
  private static instances = new Map<SupabaseClient, ClipboardService>();
  private supabase: SupabaseClient;

  private constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Get instance for browser environments (requires Supabase client)
   * For CLI/server environments, pass no parameter to use singleton
   */
  static getInstance(supabaseClient?: SupabaseClient): ClipboardService {
    // If no client provided, try to use the singleton (CLI/server only)
    if (!supabaseClient) {
      if (typeof window !== 'undefined') {
        throw new Error('Browser environment requires a Supabase client to be passed to getInstance()');
      }
      // CLI/server environment - use singleton
      supabaseClient = SupabaseClientService.getInstance().getClient();
    }

    // Check if we already have an instance for this client
    if (!ClipboardService.instances.has(supabaseClient)) {
      ClipboardService.instances.set(supabaseClient, new ClipboardService(supabaseClient));
    }
    
    return ClipboardService.instances.get(supabaseClient)!;
  }

  /**
   * Get all clipboard items for a user
   */
  async getItems(userId: string, filters?: ClipboardFilters): Promise<ClipboardItem[]> {
    let query = this.supabase
      .from('clipboard_snippets')
      .select('*')
      .eq('user_id', userId)
      .order('last_used', { ascending: false, nullsFirst: false });

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }

    if (filters?.is_favorite !== undefined) {
      query = query.eq('is_favorite', filters.is_favorite);
    }

    if (filters?.search) {
      query = query.or(
        `title.ilike.%${filters.search}%,content.ilike.%${filters.search}%,category.ilike.%${filters.search}%`
      );
    }

    if (filters?.tags && filters.tags.length > 0) {
      query = query.contains('tags', filters.tags);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data as ClipboardItem[];
  }

  /**
   * Get a single clipboard item
   */
  async getItem(id: string): Promise<ClipboardItem | null> {
    const { data, error } = await this.supabase
      .from('clipboard_snippets')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return data as ClipboardItem;
  }

  /**
   * Create a new clipboard item
   */
  async createItem(userId: string, input: CreateClipboardItemInput): Promise<ClipboardItem> {
    const { data, error } = await this.supabase
      .from('clipboard_snippets')
      .insert({
        ...input,
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data as ClipboardItem;
  }

  /**
   * Update a clipboard item
   */
  async updateItem(id: string, updates: UpdateClipboardItemInput): Promise<ClipboardItem> {
    const { data, error } = await this.supabase
      .from('clipboard_snippets')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as ClipboardItem;
  }

  /**
   * Delete a clipboard item
   */
  async deleteItem(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('clipboard_snippets')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Update last used timestamp
   */
  async recordUsage(id: string): Promise<void> {
    // Just update last used timestamp
    const { error } = await this.supabase
      .from('clipboard_snippets')
      .update({
        last_used: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Get categories with counts
   */
  async getCategories(userId: string): Promise<ClipboardCategory[]> {
    const { data, error } = await this.supabase
      .from('clipboard_snippets')
      .select('category')
      .eq('user_id', userId);

    if (error) throw error;

    // Count occurrences of each category
    const categoryCounts = data.reduce((acc, item) => {
      const category = item.category || 'Uncategorized';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Convert to array and sort by count
    return Object.entries(categoryCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get default clipboard items for new users
   */
  static getDefaultItems(userId: string): CreateClipboardItemInput[] {
    return [
      {
        title: 'Claude Context Reminder',
        content: `<system-reminder>
As you answer the user's questions, you can use the following context:
# claudeMd
Codebase and user instructions are shown below. Be sure to adhere to these instructions. IMPORTANT: These instructions OVERRIDE any default behavior and you MUST follow them exactly as written.

Contents of /Users/raybunnage/Documents/github/dhg-mono-improve-cli-pipelines/CLAUDE.md (project instructions, checked into the codebase):`,
        category: 'Claude Prompts',
        tags: ['claude', 'context', 'system']
      },
      {
        title: 'Important Instruction Reminders',
        content: `# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
Please clean up any files that you've created for testing or debugging purposes after they're no longer needed.
      
      IMPORTANT: this context may or may not be relevant to your tasks. You should not respond to this context or otherwise consider it in your response unless it is highly relevant to your task. Most of the time, it is not relevant.`,
        category: 'Claude Prompts',
        tags: ['claude', 'instructions', 'guidelines']
      }
    ];
  }

  /**
   * Initialize default items for a new user
   */
  async initializeDefaultItems(userId: string): Promise<ClipboardItem[]> {
    const defaultItems = ClipboardService.getDefaultItems(userId);
    const createdItems: ClipboardItem[] = [];

    for (const item of defaultItems) {
      try {
        const created = await this.createItem(userId, item);
        createdItems.push(created);
      } catch (error) {
        console.error('Error creating default clipboard item:', error);
      }
    }

    return createdItems;
  }

  /**
   * Export clipboard items
   */
  async exportItems(userId: string, format: 'json' | 'markdown' = 'json'): Promise<string> {
    const items = await this.getItems(userId);

    if (format === 'json') {
      return JSON.stringify(items, null, 2);
    }

    // Markdown format
    let markdown = '# Clipboard Snippets\n\n';
    const categories = await this.getCategories(userId);

    for (const category of categories) {
      markdown += `## ${category.name}\n\n`;
      const categoryItems = items.filter(item => item.category === category.name);
      
      for (const item of categoryItems) {
        markdown += `### ${item.title}\n\n`;
        markdown += '```\n' + item.content + '\n```\n\n';
        if (item.tags && item.tags.length > 0) {
          markdown += `**Tags**: ${item.tags.join(', ')}\n\n`;
        }
        markdown += '---\n\n';
      }
    }

    return markdown;
  }

  /**
   * Import clipboard items from JSON
   */
  async importItems(userId: string, jsonData: string): Promise<{ imported: number; failed: number }> {
    let items: any[];
    try {
      items = JSON.parse(jsonData);
    } catch (error) {
      throw new Error('Invalid JSON data');
    }

    if (!Array.isArray(items)) {
      throw new Error('JSON data must be an array of clipboard items');
    }

    let imported = 0;
    let failed = 0;

    for (const item of items) {
      try {
        await this.createItem(userId, {
          title: item.title || 'Untitled',
          content: item.content || '',
          category: item.category || 'Imported',
          tags: item.tags || [],
          is_favorite: item.is_favorite || false
        });
        imported++;
      } catch (error) {
        console.error('Failed to import item:', error);
        failed++;
      }
    }

    return { imported, failed };
  }
}