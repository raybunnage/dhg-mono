/**
 * Google Drive root folders management utility
 * Handles the management of root folders for Google Drive sync
 */

import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import type { Database } from '../../../../supabase/types';

/**
 * Interface for a root folder
 */
export interface RootFolder {
  id: string;
  name: string;
  drive_id: string;
  path?: string;
  description?: string;
  created_at: string;
  updated_at: string;
  last_synced: string | null;
  sync_status?: string;
  sync_error?: string | null;
}

/**
 * Get all registered root folders
 */
export async function getRootFolders(): Promise<RootFolder[]> {
  try {
    // Query the sources_google table for root folders
    const { data, error } = await supabase
      .from('google_sources')
      .select('*')
      .eq('is_root', true)
      .eq('deleted', false)
      .order('name');

    if (error) {
      console.error('Error getting root folders:', error);
      throw error;
    }
    
    // Convert to our RootFolder interface
    return data.map(folder => ({
      id: folder.id,
      name: folder.name,
      drive_id: folder.drive_id,
      path: folder.path || `/${folder.name}`,
      description: folder.metadata?.description || null,
      created_at: folder.created_at,
      updated_at: folder.updated_at,
      last_synced: folder.last_indexed,
      sync_status: folder.sync_status,
      sync_error: folder.sync_error
    }));
  } catch (error) {
    console.error('Failed to get root folders:', error);
    return [];
  }
}

/**
 * Add a new root folder
 * @param folderId Google Drive folder ID
 * @param name Optional custom name (if not provided, will fetch from Google Drive)
 * @param description Optional description
 */
export async function addRootFolder(
  folderId: string, 
  name?: string, 
  description?: string
): Promise<RootFolder | null> {
  try {
    const accessToken = localStorage.getItem('google_access_token') || '';
    
    if (!accessToken) {
      throw new Error('No Google access token found. Please authenticate first.');
    }
    
    // If name is not provided, fetch folder details from Google Drive
    if (!name) {
      // Fetch folder details from Google Drive
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to get folder details from Google Drive: ${response.status}`);
      }
      
      const folderData = await response.json();
      name = folderData.name;
      
      // Verify it's a folder
      if (folderData.mimeType !== 'application/vnd.google-apps.folder') {
        throw new Error('The provided ID is not a folder.');
      }
    }
    
    // Check if folder already exists
    const { data: existingFolders, error: queryError } = await supabase
      .from('google_sources')
      .select('id, drive_id')
      .eq('drive_id', folderId)
      .eq('deleted', false);
      
    if (queryError) {
      throw queryError;
    }
    
    // If folder exists, update it
    if (existingFolders && existingFolders.length > 0) {
      const { data, error } = await supabase
        .from('google_sources')
        .update({
          name,
          is_root: true,
          path: `/${name}`,
          parent_path: null,
          parent_folder_id: null,
          metadata: { 
            description,
            isRootFolder: true,
            lastUpdated: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('drive_id', folderId)
        .select()
        .single();
        
      if (error) {
        throw error;
      }
      
      return {
        id: data.id,
        name: data.name,
        drive_id: data.drive_id,
        path: data.path || `/${data.name}`,
        description: description || null,
        created_at: data.created_at,
        updated_at: data.updated_at,
        last_synced: data.last_indexed,
        sync_status: data.sync_status,
        sync_error: data.sync_error
      };
    }
    
    // Insert new root folder
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('google_sources')
      .insert({
        drive_id: folderId,
        name,
        is_root: true,
        mime_type: 'application/vnd.google-apps.folder',
        path: `/${name}`,
        parent_path: null,
        parent_folder_id: null,
        metadata: { 
          description,
          isRootFolder: true,
          createdAt: now
        },
        created_at: now,
        updated_at: now,
        deleted: false
      })
      .select()
      .single();
      
    if (error) {
      throw error;
    }
    
    return {
      id: data.id,
      name: data.name,
      drive_id: data.drive_id,
      path: data.path || `/${data.name}`,
      description: description || null,
      created_at: data.created_at,
      updated_at: data.updated_at,
      last_synced: data.last_indexed,
      sync_status: data.sync_status,
      sync_error: data.sync_error
    };
  } catch (error) {
    console.error('Failed to add root folder:', error);
    return null;
  }
}

/**
 * Remove a root folder
 * @param id Root folder ID from the database
 * @param hardDelete If true, delete from database. If false, just mark as not a root.
 */
export async function removeRootFolder(id: string, hardDelete = false): Promise<boolean> {
  try {
    if (hardDelete) {
      // Hard delete - remove from database
      const { error } = await supabase
        .from('google_sources')
        .update({ deleted: true, updated_at: new Date().toISOString() })
        .eq('id', id);
        
      if (error) {
        throw error;
      }
    } else {
      // Soft delete - just mark as not a root folder
      const { error } = await supabase
        .from('google_sources')
        .update({ 
          is_root: false, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', id);
        
      if (error) {
        throw error;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Failed to remove root folder:', error);
    return false;
  }
}

/**
 * Get a specific root folder by ID
 * @param id Root folder ID or Google Drive ID
 * @param isGoogleId If true, id is a Google Drive ID. If false, id is a database ID.
 */
export async function getRootFolder(id: string, isGoogleId = false): Promise<RootFolder | null> {
  try {
    let query = supabase
      .from('google_sources')
      .select('*')
      .eq('is_root', true)
      .eq('deleted', false);
      
    if (isGoogleId) {
      query = query.eq('drive_id', id);
    } else {
      query = query.eq('id', id);
    }
    
    const { data, error } = await query.single();
    
    if (error) {
      throw error;
    }
    
    if (!data) {
      return null;
    }
    
    return {
      id: data.id,
      name: data.name,
      drive_id: data.drive_id,
      path: data.path || `/${data.name}`,
      description: data.metadata?.description || null,
      created_at: data.created_at,
      updated_at: data.updated_at,
      last_synced: data.last_indexed,
      sync_status: data.sync_status,
      sync_error: data.sync_error
    };
  } catch (error) {
    console.error('Failed to get root folder:', error);
    return null;
  }
}

/**
 * Check if a folder exists in Google Drive
 * @param folderId Google Drive folder ID to check
 */
export async function checkGoogleDriveFolder(folderId: string): Promise<{
  exists: boolean;
  name?: string;
  mimeType?: string;
  error?: string;
}> {
  try {
    const accessToken = localStorage.getItem('google_access_token') || '';
    
    if (!accessToken) {
      return { 
        exists: false, 
        error: 'No Google access token found. Please authenticate first.' 
      };
    }
    
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    if (!response.ok) {
      return { 
        exists: false, 
        error: `Failed to get folder: ${response.status} ${response.statusText}` 
      };
    }
    
    const folderData = await response.json();
    const isFolder = folderData.mimeType === 'application/vnd.google-apps.folder';
    
    return {
      exists: true,
      name: folderData.name,
      mimeType: folderData.mimeType,
      error: isFolder ? undefined : 'The provided ID is not a folder.'
    };
  } catch (error) {
    return { 
      exists: false, 
      error: `Error checking folder: ${error.message}` 
    };
  }
}

/**
 * Update the sync status of a root folder
 * @param id Root folder ID
 * @param status New sync status
 * @param error Optional error message
 */
export async function updateRootFolderSyncStatus(
  id: string, 
  status: 'synced' | 'syncing' | 'error' | 'pending', 
  error?: string
): Promise<boolean> {
  try {
    const { data, error: updateError } = await supabase
      .from('google_sources')
      .update({
        sync_status: status,
        sync_error: error || null,
        last_indexed: status === 'synced' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select();
      
    if (updateError) {
      throw updateError;
    }
    
    return true;
  } catch (error) {
    console.error('Failed to update root folder sync status:', error);
    return false;
  }
}