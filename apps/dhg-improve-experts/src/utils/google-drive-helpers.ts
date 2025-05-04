import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';

interface DriveItem {
  name: string;
  mime_type: string;
  drive_id: string;
  parent_folder_id?: string | null;
  children?: DriveItem[];
}

/**
 * Recursively inserts folder hierarchies and files in the correct order
 * to maintain parent-child relationships
 */
export async function insertHierarchy(
  item: DriveItem, 
  parentDriveId: string | null = null
): Promise<{ success: boolean; id?: string; error?: any }> {
  try {
    // Set parent relationship
    const itemToInsert = {
      ...item,
      parent_folder_id: parentDriveId,
    };
    
    // Insert the current item (folder or file)
    const { data, error } = await supabase
      .from('sources_google')
      .insert({
        name: itemToInsert.name,
        drive_id: itemToInsert.drive_id,
        mime_type: itemToInsert.mime_type,
        parent_folder_id: itemToInsert.parent_folder_id,
        is_root: parentDriveId === null, // Root if no parent
        sync_status: 'synced',
        content_extracted: false,
        deleted: false,
      })
      .select('id, drive_id')
      .single();
    
    if (error) throw error;
    
    // If it has children, process them recursively
    if (item.children && item.children.length > 0) {
      for (const child of item.children) {
        await insertHierarchy(child, item.drive_id);
      }
    }
    
    return { success: true, id: data.id };
  } catch (error) {
    console.error('Error inserting hierarchy item:', error);
    return { success: false, error };
  }
} 

/**
 * Converts a Google Drive folder tree to a format suitable for insertHierarchy
 * @param folderTree The folder tree from fetchFolderTree
 */
export function convertFolderTreeToHierarchy(folderTree) {
  // Process this folder
  const result = {
    name: folderTree.name,
    drive_id: folderTree.id,
    mime_type: folderTree.mimeType,
    children: []
  };
  
  // Add regular files as children
  if (folderTree.files && folderTree.files.length > 0) {
    result.children.push(...folderTree.files.map(file => ({
      name: file.name,
      drive_id: file.id,
      mime_type: file.mimeType
    })));
  }
  
  // Process subfolders recursively and add as children
  if (folderTree.subFolders && folderTree.subFolders.length > 0) {
    folderTree.subFolders.forEach(subFolder => {
      result.children.push(convertFolderTreeToHierarchy(subFolder));
    });
  }
  
  return result;
}

/**
 * Synchronizes an entire folder tree with Supabase
 */
export async function syncEntireFolderTree(folderId: string) {
  try {
    // Track metrics
    let totalItems = 0;
    let itemsAdded = 0;
    let itemsSkipped = 0;
    let itemsError = 0;
    const errors = [];
    
    // Fetch the complete folder structure
    const folderTree = await fetchFolderTree(folderId);
    
    // Count total items (recursive function)
    const countItems = (tree) => {
      let count = 1; // Count this folder
      if (tree.files) count += tree.files.length;
      if (tree.subFolders) {
        tree.subFolders.forEach(subfolder => {
          count += countItems(subfolder);
        });
      }
      return count;
    };
    
    totalItems = countItems(folderTree);
    
    // Convert to hierarchy format
    const hierarchy = convertFolderTreeToHierarchy(folderTree);
    
    // Insert the entire hierarchy
    const result = await insertHierarchy(hierarchy);
    
    if (result.success) {
      itemsAdded = totalItems; // Simplified - assume all were added
    } else {
      itemsError = totalItems;
      errors.push(result.error);
    }
    
    return {
      success: result.success,
      id: result.id,
      error: result.error,
      totalItems,
      itemsAdded,
      itemsSkipped,
      itemsError,
      errors
    };
  } catch (error) {
    console.error('Error syncing folder tree:', error);
    return { 
      success: false, 
      error,
      totalItems: 0,
      itemsAdded: 0,
      itemsSkipped: 0,
      itemsError: 1,
      errors: [error]
    };
  }
} 