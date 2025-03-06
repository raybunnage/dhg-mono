import React, { useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';
import { FileTree2, type FileNode } from '@/components/FileTree2';

// Define the root folder names we're specifically looking for
const TARGET_ROOT_FOLDERS = [
  'RUTs Book',
  'References.RUTs',
  'Polyvagal Steering Group'
];

function Viewer2() {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rootFolders, setRootFolders] = useState<any[]>([]);
  const [testingRoots, setTestingRoots] = useState(false);
  
  // Function to query root folders by exact name match
  const findTargetRootFolders = async () => {
    try {
      setTestingRoots(true);
      setError(null);
      
      // First, create an array of promises for each target folder name
      const folderPromises = TARGET_ROOT_FOLDERS.map(folderName => 
        supabase
          .from('sources_google')
          .select('id, drive_id, name, mime_type, path, parent_path, is_root, parent_folder_id')
          .eq('name', folderName)
          .eq('mime_type', 'application/vnd.google-apps.folder')
      );
      
      // Execute all queries in parallel
      const results = await Promise.all(folderPromises);
      
      // Collect all found folders
      let targetFolders = [];
      
      results.forEach((result, index) => {
        if (result.error) {
          console.error(`Error fetching folder "${TARGET_ROOT_FOLDERS[index]}":`, result.error);
        } else if (result.data && result.data.length > 0) {
          console.log(`Found folder "${TARGET_ROOT_FOLDERS[index]}":`, result.data);
          targetFolders.push(...result.data);
        } else {
          console.warn(`Folder "${TARGET_ROOT_FOLDERS[index]}" not found`);
        }
      });
      
      console.log(`Found ${targetFolders.length} of ${TARGET_ROOT_FOLDERS.length} target folders`);
      
      // If we didn't find all folders, try a more flexible search
      if (targetFolders.length < TARGET_ROOT_FOLDERS.length) {
        console.warn("Some folders not found with exact match, trying partial match...");
        
        // Get all folders
        const { data: allFolders, error: allFoldersError } = await supabase
          .from('sources_google')
          .select('id, drive_id, name, mime_type, path, parent_path, is_root, parent_folder_id')
          .eq('mime_type', 'application/vnd.google-apps.folder');
          
        if (allFoldersError) {
          console.error("Error fetching all folders:", allFoldersError);
        } else if (allFolders) {
          // For each missing target, try to find a partial match
          const foundNames = new Set(targetFolders.map(f => f.name));
          
          TARGET_ROOT_FOLDERS.forEach(targetName => {
            if (!foundNames.has(targetName)) {
              // Look for partial matches
              const matches = allFolders.filter(folder => 
                folder.name.includes(targetName) || targetName.includes(folder.name)
              );
              
              if (matches.length > 0) {
                console.log(`Found partial matches for "${targetName}":`, matches);
                targetFolders.push(...matches);
              }
            }
          });
        }
      }
      
      // If we STILL don't have all folders, try a different approach
      if (targetFolders.length < TARGET_ROOT_FOLDERS.length) {
        console.warn("Still missing folders, trying another approach...");
        
        // Try to find folders marked as is_root
        const { data: rootFolders, error: rootFoldersError } = await supabase
          .from('sources_google')
          .select('id, drive_id, name, mime_type, path, parent_path, is_root, parent_folder_id')
          .eq('is_root', true)
          .eq('mime_type', 'application/vnd.google-apps.folder');
          
        if (rootFoldersError) {
          console.error("Error fetching root folders:", rootFoldersError);
        } else if (rootFolders) {
          // Add any root folders that match our target names or contain them
          const newMatches = rootFolders.filter(folder => 
            TARGET_ROOT_FOLDERS.some(targetName => 
              folder.name.includes(targetName) || targetName.includes(folder.name)
            ) && 
            !targetFolders.some(existing => existing.id === folder.id)
          );
          
          if (newMatches.length > 0) {
            console.log("Found additional matches from root folders:", newMatches);
            targetFolders.push(...newMatches);
          }
        }
      }
      
      // Deduplicate folders by ID
      const uniqueFolders = [];
      const seenIds = new Set();
      
      targetFolders.forEach(folder => {
        if (!seenIds.has(folder.id)) {
          seenIds.add(folder.id);
          uniqueFolders.push(folder);
        }
      });
      
      // Log each found target for debugging
      console.log("Final target folders:");
      uniqueFolders.forEach(folder => {
        console.log(`- ${folder.name} (ID: ${folder.id}, drive_id: ${folder.drive_id})`);
      });
      
      // Show warning for any missing folders
      const foundNames = new Set(uniqueFolders.map(f => f.name));
      const missingNames = TARGET_ROOT_FOLDERS.filter(name => !foundNames.has(name));
      
      if (missingNames.length > 0) {
        console.warn("Still missing folders:", missingNames);
      }
      
      // Set the result to show found target folders
      setRootFolders(uniqueFolders);
    } catch (err: any) {
      console.error('Error finding target root folders:', err);
      setError(err.message);
    } finally {
      setTestingRoots(false);
    }
  };
  
  // Function to fetch all nested files and folders for the target folders
  const fetchNestedFilesForTargetFolders = async () => {
    if (rootFolders.length === 0) {
      console.error("No target folders found to fetch nested files");
      return;
    }
    
    try {
      setLoading(true);
      
      // Extract IDs from the found target folders - use drive_id if available
      const targetFolderDriveIds = rootFolders
        .map(folder => folder.drive_id)
        .filter(Boolean);
        
      const targetFolderIds = rootFolders.map(folder => folder.id);
      
      console.log("Target folder IDs:", targetFolderIds);
      console.log("Target folder Drive IDs:", targetFolderDriveIds);
      
      // 1. First, retrieve ALL records from sources_google
      // This gives us full access to analyze the data structure client-side
      const { data: allItems, error: dataError } = await supabase
        .from('sources_google')
        .select(`
          id, name, mime_type, path, parent_path, 
          parent_folder_id, drive_id, is_root, parent_id
        `);
        
      if (dataError) {
        console.error("Error fetching data:", dataError);
        throw dataError;
      }
      
      console.log(`Retrieved ${allItems.length} items from sources_google`);
      
      // 2. Create a mapping of IDs to items for quick lookup
      const itemsById = new Map();
      const itemsByDriveId = new Map();
      
      allItems.forEach(item => {
        itemsById.set(item.id, item);
        if (item.drive_id) {
          itemsByDriveId.set(item.drive_id, item);
        }
      });
      
      // 3. Create a child map for each possible parent relationship type
      const childrenByParentFolderId = new Map();
      const childrenByParentId = new Map();
      const childrenByParentPath = new Map();
      
      allItems.forEach(item => {
        // Map by parent_folder_id
        if (item.parent_folder_id) {
          if (!childrenByParentFolderId.has(item.parent_folder_id)) {
            childrenByParentFolderId.set(item.parent_folder_id, []);
          }
          childrenByParentFolderId.get(item.parent_folder_id).push(item);
        }
        
        // Map by parent_id
        if (item.parent_id) {
          if (!childrenByParentId.has(item.parent_id)) {
            childrenByParentId.set(item.parent_id, []);
          }
          childrenByParentId.get(item.parent_id).push(item);
        }
        
        // Map by parent_path
        if (item.parent_path) {
          if (!childrenByParentPath.has(item.parent_path)) {
            childrenByParentPath.set(item.parent_path, []);
          }
          childrenByParentPath.get(item.parent_path).push(item);
        }
      });
      
      console.log(`Built relationship maps:
        - By parent_folder_id: ${childrenByParentFolderId.size} mappings
        - By parent_id: ${childrenByParentId.size} mappings
        - By parent_path: ${childrenByParentPath.size} mappings
      `);
      
      // 4. Function to collect all descendants using ALL relationship types
      const collectAllDescendants = (item: any, collected = new Set<string>()) => {
        if (!item || collected.has(item.id)) {
          return collected; // Prevent circular references
        }
        
        collected.add(item.id);
        
        // Try all child relationship maps
        const childrenByFolderId = childrenByParentFolderId.get(item.id) || [];
        const childrenByDriveId = item.drive_id ? (childrenByParentFolderId.get(item.drive_id) || []) : [];
        const childrenById = childrenByParentId.get(item.id) || [];
        const childrenByPath = item.path ? (childrenByParentPath.get(item.path) || []) : [];
        
        // Combine all children from different sources, avoiding duplicates
        const allChildren = new Map();
        [...childrenByFolderId, ...childrenByDriveId, ...childrenById, ...childrenByPath].forEach(child => {
          if (!allChildren.has(child.id)) {
            allChildren.set(child.id, child);
          }
        });
        
        // Process all unique children
        Array.from(allChildren.values()).forEach(child => {
          // Skip if we've already seen this child
          if (collected.has(child.id)) return;
          
          // Add this child
          collected.add(child.id);
          
          // Only recursively process folders
          if (child.mime_type === 'application/vnd.google-apps.folder') {
            collectAllDescendants(child, collected);
          }
        });
        
        return collected;
      };
      
      // 5. Collect all items related to our target folders
      const relevantItemIds = new Set<string>();
      
      // Add target folders themselves
      targetFolderIds.forEach(id => relevantItemIds.add(id));
      
      // Add all descendants
      rootFolders.forEach(folder => {
        collectAllDescendants(folder, relevantItemIds);
      });
      
      console.log(`Found ${relevantItemIds.size} relevant items in the hierarchies`);
      
      // 6. Second approach: Get children by name path
      // This helps catch items that might not have the correct parent_folder_id
      rootFolders.forEach(folder => {
        if (folder.name) {
          allItems.forEach(item => {
            if (item.path && item.path.includes(folder.name)) {
              relevantItemIds.add(item.id);
            }
          });
        }
      });
      
      console.log(`After path matching, found ${relevantItemIds.size} relevant items`);
      
      // 7. Get all relevant items
      const relevantItems = allItems.filter(item => relevantItemIds.has(item.id));
      
      if (relevantItems.length === 0) {
        console.warn("No relevant items found! Trying another approach...");
        
        // If nothing else works, just get items by direct name search
        const folderNameMatches = allItems.filter(item => 
          targetFolderDriveIds.includes(item.drive_id) || 
          TARGET_ROOT_FOLDERS.some(name => item.path && item.path.includes(name))
        );
        
        console.log(`Found ${folderNameMatches.length} items by name/path matching`);
        
        if (folderNameMatches.length > 0) {
          // Create FileNodes from these items
          const fileNodes = folderNameMatches.map(item => ({
            id: item.id,
            name: item.name,
            mime_type: item.mime_type,
            path: item.path,
            parent_path: item.parent_path,
            parent_folder_id: item.parent_folder_id,
            drive_id: item.drive_id,
            is_root: targetFolderIds.includes(item.id) || targetFolderDriveIds.includes(item.drive_id)
          }));
          
          setFiles(fileNodes);
        } else {
          // Last resort: just use the root folders themselves
          const fileNodes = rootFolders.map(item => ({
            id: item.id,
            name: item.name,
            mime_type: item.mime_type,
            path: item.path,
            parent_path: item.parent_path,
            parent_folder_id: item.parent_folder_id,
            drive_id: item.drive_id,
            is_root: true
          }));
          
          setFiles(fileNodes);
        }
      } else {
        // 8. Create FileNodes from the relevant items
        const fileNodes: FileNode[] = relevantItems.map(item => ({
          id: item.id,
          name: item.name,
          mime_type: item.mime_type,
          path: item.path,
          parent_path: item.parent_path,
          parent_folder_id: item.parent_folder_id,
          drive_id: item.drive_id,
          is_root: targetFolderIds.includes(item.id) || targetFolderDriveIds.includes(item.drive_id)
        }));
        
        // Set files state to update tree
        setFiles(fileNodes);
      }
      
      // Log stats
      const folderCount = relevantItems.filter(f => f.mime_type === 'application/vnd.google-apps.folder').length;
      const fileCount = relevantItems.length - folderCount;
      console.log(`Loaded ${folderCount} folders and ${fileCount} files`);
      
    } catch (err: any) {
      console.error('Error fetching nested files:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Initial fetch of all files on component mount
  useEffect(() => {
    async function fetchInitialFiles() {
      try {
        setLoading(true);
        
        // First get all root folders (using the direct approach that works)
        const { data: folders, error: folderError } = await supabase
          .from('sources_google')
          .select('id, name, mime_type, path, parent_path, is_root, drive_id')
          .eq('mime_type', 'application/vnd.google-apps.folder')
          .order('name');
          
        if (folderError) {
          console.error('Error fetching root folders:', folderError);
          throw folderError;
        }
        
        // Find target folders by name
        const targetFolders = folders.filter(folder =>
          TARGET_ROOT_FOLDERS.includes(folder.name) && 
          folder.name !== 'Dynamic Healing Discussion Group'
        );
        
        console.log("Target folders for file tree:", targetFolders);
        
        // Get all files and folders 
        const { data, error } = await supabase
          .from('sources_google')
          .select('id, name, mime_type, path, parent_path, is_root');
          
        if (error) throw error;
        
        // Filter out Dynamic Healing Discussion Group
        const filteredData = data.filter(item => {
          // Skip the root folder itself
          if (item.name === 'Dynamic Healing Discussion Group') {
            return false;
          }
          
          // Skip items with paths that include the excluded folder
          if (item.path && item.path.includes('Dynamic Healing Discussion Group')) {
            return false;
          }
          
          return true;
        });
        
        // Get the IDs of target folders
        const targetFolderIds = new Set(targetFolders.map(f => f.id));
        
        // Map to our simple FileNode structure, ensuring target folders are marked as roots
        const fileNodes: FileNode[] = filteredData.map(item => ({
          id: item.id,
          name: item.name,
          mime_type: item.mime_type,
          path: item.path,
          parent_path: item.parent_path,
          is_root: targetFolderIds.has(item.id) || item.is_root
        }));
        
        setFiles(fileNodes);
      } catch (err: any) {
        console.error('Error fetching initial files:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchInitialFiles();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {error}
        </div>
      )}
      
      <div className="mb-6">
        <div className="text-xl font-semibold flex items-center gap-3 px-2 py-3 border-b">
          <span className="text-2xl">🗂️</span>
          <span className="bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
            All Files Except Dynamic Healing Discussion Group
          </span>
        </div>
      </div>
      
      {/* Test button for target root folders */}
      <div className="mb-6">
        <div className="flex gap-2">
          <button 
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition"
            onClick={findTargetRootFolders}
            disabled={testingRoots}
          >
            {testingRoots ? 'Searching...' : 'Find Target Root Folders'}
          </button>
          
          <button 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            onClick={fetchNestedFilesForTargetFolders}
            disabled={testingRoots || rootFolders.length === 0}
          >
            {loading ? 'Loading Files...' : 'Show Files in Target Folders'}
          </button>
        </div>
        
        {rootFolders.length > 0 && (
          <div className="mt-4 p-4 bg-gray-100 rounded border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold">Found {rootFolders.length} root folders:</h3>
              <div className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                <span className="font-semibold">{rootFolders.filter(folder => 
                  TARGET_ROOT_FOLDERS.includes(folder.name)
                ).length}</span> of {TARGET_ROOT_FOLDERS.length} target folders found
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {rootFolders.map(folder => {
                const isTargetFolder = TARGET_ROOT_FOLDERS.includes(folder.name);
                return (
                  <div 
                    key={folder.id} 
                    className={`p-3 rounded shadow ${
                      isTargetFolder ? 'bg-green-50 border border-green-200' : 'bg-white'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <p className="font-semibold">{folder.name}</p>
                      {isTargetFolder && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                          Target
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">Drive ID: {folder.drive_id || folder.id}</p>
                    <p className="text-sm text-gray-500">Path: {folder.path || 'N/A'}</p>
                    <p className="text-sm text-gray-500">
                      Is Root: {folder.is_root === true || folder.is_root === 1 ? 'Yes' : 'No'}
                    </p>
                  </div>
                );
              })}
            </div>
            
            <div className="p-3 bg-white rounded shadow">
              <h4 className="font-semibold">Target folders not found:</h4>
              <div className="mt-2">
                {TARGET_ROOT_FOLDERS.filter(
                  name => !rootFolders.some(folder => folder.name === name)
                ).length === 0 ? (
                  <p className="text-green-600">✓ All target folders were found!</p>
                ) : (
                  <ul className="list-disc pl-5">
                    {TARGET_ROOT_FOLDERS.filter(
                      name => !rootFolders.some(folder => folder.name === name)
                    ).map(name => (
                      <li key={name} className="text-red-500">{name}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex">
        <div className="w-full">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-blue-500 animate-pulse">Loading files...</div>
            </div>
          ) : (
            <FileTree2 files={files} />
          )}
        </div>
      </div>
    </div>
  );
}

export default Viewer2;