import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';

export async function createTestSyncHistoryEntry() {
  try {
    const testEntry = {
      id: uuidv4(),
      folder_id: '1RNZ26i6iAhKwOUWcfRbS5vZQ0HhzQLN8', // Sample folder ID
      folder_name: 'Test Folder',
      timestamp: new Date().toISOString(),
      completed_at: new Date(Date.now() + 5000).toISOString(), // 5 seconds later
      status: 'completed',
      files_processed: 42, // Using the correct field name files_processed
      files_total: 50,
      files_added: 42,
      files_updated: 0,
      files_skipped: 8,
      files_error: 0,
      error_message: null
    };
    
    const { data, error } = await supabase
      .from('sync_history')
      .insert(testEntry)
      .select();
      
    if (error) throw error;
    
    return data;
  } catch (err) {
    console.error('Error creating test sync history entry:', err);
    throw err;
  }
}

/**
 * Store the latest sync result in localStorage and the database
 */
export async function storeLatestSyncResult(result: any) {
  try {
    console.log('Storing latest sync result:', result);
    
    // Add timestamp if not present
    const resultWithTimestamp = {
      ...result,
      timestamp: result.timestamp || new Date().toISOString()
    };
    
    // Store in localStorage for quick access
    localStorage.setItem('latest_sync_result', JSON.stringify(resultWithTimestamp));
    
    // Instead of trying to store in a non-existent sync_results table,
    // we'll update the corresponding sync_history record if there's a syncId
    if (result.syncId) {
      const { error } = await supabase
        .from('sync_history')
        .update({
          files_processed: result.synced?.added || 0, // Using the correct field name files_processed
          files_total: (result.synced?.added || 0) + (result.synced?.errors || 0),
          files_added: result.synced?.added || 0,
          files_updated: result.synced?.updated || 0,
          files_error: result.synced?.errors || 0,
          files_skipped: 0, // Default to 0 if not provided
          error_message: result.synced?.errors > 0 ? 'Some errors occurred during sync' : null,
          duration_ms: result.duration_ms || null,
        })
        .eq('id', result.syncId);
        
      if (error) {
        console.error('Error updating sync history record:', error);
      }
    }
    
    console.log('Successfully stored sync result');
    return true;
  } catch (err) {
    console.error('Error storing sync result:', err);
    return false;
  }
}

/**
 * Get the latest sync result
 */
export function getLatestSyncResult() {
  try {
    const storedResult = localStorage.getItem('latest_sync_result');
    if (!storedResult) return null;
    
    return JSON.parse(storedResult);
  } catch (err) {
    console.error('Error retrieving latest sync result:', err);
    return null;
  }
}

/**
 * Delete a sync history record by ID
 */
export async function deleteSyncHistoryRecord(id: string) {
  try {
    const { error } = await supabase
      .from('sync_history')
      .delete()
      .eq('id', id);
      
    if (error) throw error;
    
    return { success: true };
  } catch (err) {
    console.error('Error deleting sync history record:', err);
    return { success: false, error: err };
  }
} 