/**
 * Supabase Helper Functions
 * 
 * Provides utility functions for working with Supabase, including
 * adding user references to database records.
 */

import { SupabaseClientService } from '../supabase-client';

// Export a system user ID for use when no authenticated user is available
export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Helper function to add user references to database records
 * If authenticated, uses the current user's ID; otherwise uses SYSTEM_USER_ID
 * 
 * @param record - The record to add user references to
 * @returns The record with created_by and updated_by fields added
 */
export async function addUserReferences<T extends Record<string, any>>(record: T): Promise<T> {
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Try to get the current user session
    const { data } = await supabase.auth.getSession();
    const userId = data?.session?.user?.id || SYSTEM_USER_ID;
    
    // Add user reference fields if they don't exist
    const recordWithRefs = { ...record };
    
    if (!('created_by' in recordWithRefs)) {
      (recordWithRefs as any).created_by = userId;
    }
    
    if (!('updated_by' in recordWithRefs)) {
      (recordWithRefs as any).updated_by = userId;
    }
    
    return recordWithRefs;
  } catch (error) {
    // If there's any error, fall back to the system user ID
    const recordWithRefs = { ...record };
    
    if (!('created_by' in recordWithRefs)) {
      (recordWithRefs as any).created_by = SYSTEM_USER_ID;
    }
    
    if (!('updated_by' in recordWithRefs)) {
      (recordWithRefs as any).updated_by = SYSTEM_USER_ID;
    }
    
    return recordWithRefs;
  }
}

/**
 * Test the Supabase connection
 * 
 * @returns Object with success status and optional error message
 */
export async function testSupabaseConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Try a simple query to test the connection
    const { data, error } = await supabase
      .from('document_types')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('Supabase connection test failed:', error);
      return { success: false, error: error.message };
    }
    
    console.log('Supabase connection test successful');
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Supabase connection test error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}