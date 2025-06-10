/**
 * Clipboard Service Types
 * Shared types for clipboard snippet management
 */

export interface ClipboardItem {
  id: string;
  title: string;
  content: string;
  category: string;
  last_used?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  usage_count?: number;
  is_favorite?: boolean;
  tags?: string[];
}

export interface ClipboardCategory {
  name: string;
  count: number;
}

export interface CreateClipboardItemInput {
  title: string;
  content: string;
  category: string;
  tags?: string[];
  is_favorite?: boolean;
}

export interface UpdateClipboardItemInput {
  title?: string;
  content?: string;
  category?: string;
  tags?: string[];
  is_favorite?: boolean;
}

export interface ClipboardFilters {
  category?: string;
  search?: string;
  is_favorite?: boolean;
  tags?: string[];
  user_id?: string;
}