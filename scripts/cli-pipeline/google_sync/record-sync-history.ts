#!/usr/bin/env ts-node
/**
 * Records sync history entries in the google_sync_history table
 * Used by sync commands to track their execution
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

// Define types directly since supabase/types.ts is empty
interface SyncHistoryInsert {
  id?: string;
  folder_id: string;
  folder_name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'completed_with_errors' | 'failed';
  items_processed?: number;
  timestamp?: string;
  completed_at?: string | null;
  error_message?: string | null;
  created_by?: string | null;
}

interface SyncHistoryRow extends SyncHistoryInsert {
  id: string;
  timestamp: string;
}

export interface SyncHistoryOptions {
  folderId: string;
  folderName?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'completed_with_errors' | 'failed';
  itemsProcessed?: number;
  errorMessage?: string;
  completedAt?: string;
}

/**
 * Creates a new sync history entry
 */
export async function createSyncHistory(options: {
  folderId: string;
  folderName?: string;
}): Promise<string | null> {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    const insertData: SyncHistoryInsert = {
      folder_id: options.folderId,
      folder_name: options.folderName || 'Google Drive',
      status: 'in_progress',
      items_processed: 0,
      timestamp: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('google_sync_history')
      .insert(insertData)
      .select('id')
      .single();
    
    if (error) {
      console.error('Error creating sync history:', error);
      return null;
    }
    
    return data?.id || null;
  } catch (error) {
    console.error('Failed to create sync history:', error);
    return null;
  }
}

/**
 * Updates an existing sync history entry
 */
export async function updateSyncHistory(
  historyId: string,
  updates: Partial<SyncHistoryOptions>
): Promise<boolean> {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    const updateData: Partial<SyncHistoryInsert> = {};
    
    if (updates.status) updateData.status = updates.status;
    if (updates.itemsProcessed !== undefined) updateData.items_processed = updates.itemsProcessed;
    if (updates.errorMessage) updateData.error_message = updates.errorMessage;
    if (updates.completedAt) updateData.completed_at = updates.completedAt;
    
    const { error } = await supabase
      .from('google_sync_history')
      .update(updateData)
      .eq('id', historyId);
    
    if (error) {
      console.error('Error updating sync history:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Failed to update sync history:', error);
    return false;
  }
}

/**
 * Completes a sync history entry with final status
 */
export async function completeSyncHistory(
  historyId: string,
  result: {
    itemsProcessed: number;
    hasErrors: boolean;
    errorMessage?: string;
  }
): Promise<boolean> {
  const status = result.hasErrors ? 
    (result.itemsProcessed > 0 ? 'completed_with_errors' : 'failed') : 
    'completed';
  
  return updateSyncHistory(historyId, {
    status,
    itemsProcessed: result.itemsProcessed,
    errorMessage: result.errorMessage,
    completedAt: new Date().toISOString()
  });
}

/**
 * Gets recent sync history entries
 */
export async function getRecentSyncHistory(
  limit: number = 10,
  folderId?: string
): Promise<SyncHistoryRow[]> {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    let query = supabase
      .from('google_sync_history')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);
    
    if (folderId) {
      query = query.eq('folder_id', folderId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching sync history:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Failed to fetch sync history:', error);
    return [];
  }
}

// Export as default for direct execution
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'list') {
    getRecentSyncHistory(20).then(history => {
      console.log('Recent sync history:');
      history.forEach(entry => {
        console.log(`- ${entry.timestamp}: ${entry.folder_name} (${entry.status}) - ${entry.items_processed} items`);
      });
    });
  } else {
    console.log('Usage: record-sync-history.ts list');
  }
}