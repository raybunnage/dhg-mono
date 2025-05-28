import React, { useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useSearchParams } from 'react-router-dom';
import { FileTree, type FileNode } from '@/components/FileTree';
import { FileViewer } from '@/components/FileViewer';
import { toast } from 'react-hot-toast';

// Import any required components
// You'll need to implement or import the FileTree and ExpertDocumentView components

function Viewer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRepairingPaths, setIsRepairingPaths] = useState(false);
  const [repairResult, setRepairResult] = useState<{fixed: number, errors: number} | null>(null);
  
  // Fetch files from sources_google
  useEffect(() => {
    async function fetchFiles() {
      try {
        setLoading(true);
        
        // First, fetch sources_google entries
        const { data: sourcesData, error: sourcesError } = await supabase
          .from('google_sources')
          .select(`
            *,
            google_expert_documents(id, processing_status, processed_content, batch_id, error_message, 
                            queued_at, processing_started_at, processing_completed_at, 
                            processing_error, retry_count)
          `)
          .order('name');
          
        if (sourcesError) throw sourcesError;
        
        // Transform the data to match FileNode interface
        const fileNodes: FileNode[] = sourcesData.map(source => ({
          id: source.id,
          name: source.name,
          mime_type: source.mime_type || '',
          path: source.path,
          parent_path: source.parent_path,
          parent_folder_id: source.parent_folder_id,
          content_extracted: source.content_extracted,
          web_view_link: source.web_view_link,
          metadata: source.metadata,
          expertDocument: source.expert_documents?.[0] || null,
          drive_id: source.drive_id,
          is_root: source.is_root  // Include is_root field from the database
        }));
        
        // Count the root folders
        const rootFolders = fileNodes.filter(node => 
          node.is_root === true && 
          node.mime_type === 'application/vnd.google-apps.folder'
        );
        console.log(`Found ${rootFolders.length} root folders`);
        
        setFiles(fileNodes);
        
        // Run relationship analysis
        setTimeout(() => {
          analyzeFileRelationships();
        }, 1000);
      } catch (err: any) {
        console.error('Error fetching files:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchFiles();
  }, []);

  // Handle file selection
  const handleFileSelect = (fileIds: string[]) => {
    if (fileIds.length > 0) {
      const selectedFileId = fileIds[0]; // Take the first one if multiple are selected
      const file = files.find(f => f.id === selectedFileId);
      if (file) {
        setSelectedFile(file);
        // Update URL with the selected file ID
        setSearchParams({ fileId: selectedFileId });
      }
    } else {
      setSelectedFile(null);
    }
  };
  
  // Handle file click from the tree
  const handleFileClick = (file: FileNode) => {
    setSelectedFile(file);
    // Update URL with the selected file ID
    setSearchParams({ fileId: file.id });
  };

  // Calculate the number of root folders
  const rootFolderCount = files.filter(node => 
    node.is_root === true && 
    node.mime_type === 'application/vnd.google-apps.folder'
  ).length;
  
  // EMERGENCY REPAIR FUNCTION - This will directly fix path issues in the database
  const repairChildrenPaths = async () => {
    try {
      setIsRepairingPaths(true);
      toast.loading('Repairing file paths in database...');
      
      // Get all root folders
      const rootFolders = files.filter(
        f => f.is_root === true && f.mime_type === 'application/vnd.google-apps.folder'
      );
      
      console.log(`Found ${rootFolders.length} root folders to process`);
      
      let fixedCount = 0;
      let errorCount = 0;
      
      // For each root folder, fix all its children and nested structure
      for (const rootFolder of rootFolders) {
        // Skip folders that don't have a proper path
        if (!rootFolder.path) {
          console.log(`Root folder ${rootFolder.name} has no path - setting it now`);
          
          // Fix the root folder path first
          try {
            const rootPath = `/${rootFolder.name}`;
            await supabase
              .from('google_sources')
              .update({ path: rootPath })
              .eq('id', rootFolder.id);
              
            rootFolder.path = rootPath;
            fixedCount++;
          } catch (err) {
            console.error(`Failed to set path for root folder ${rootFolder.name}:`, err);
            errorCount++;
            continue;
          }
        }
        
        // Find children by parent_folder_id (both direct ID and drive_id)
        const idChildrenQuery = supabase
          .from('google_sources')
          .select('id, name, mime_type, path, parent_path, parent_folder_id, drive_id');
          
        // We need to use filter correctly based on what IDs we have
        if (rootFolder.id && rootFolder.drive_id) {
          idChildrenQuery.or(`parent_folder_id.eq.${rootFolder.id},parent_folder_id.eq.${rootFolder.drive_id}`);
        } else if (rootFolder.id) {
          idChildrenQuery.eq('parent_folder_id', rootFolder.id);
        } else if (rootFolder.drive_id) {
          idChildrenQuery.eq('parent_folder_id', rootFolder.drive_id);
        }
          
        const { data: children, error: childrenError } = await idChildrenQuery;
        
        if (childrenError) {
          console.error(`Failed to fetch children for ${rootFolder.name}:`, childrenError);
          errorCount++;
          continue;
        }
        
        console.log(`Found ${children.length} children for root folder ${rootFolder.name}`);
        
        // Fix each child's path and parent_path
        for (const child of children) {
          // Ensure correct paths for this child
          const correctParentPath = rootFolder.path;
          const correctPath = `${correctParentPath}/${child.name}`;
          
          // Skip if the paths are already correct
          if (child.parent_path === correctParentPath && child.path === correctPath) {
            console.log(`Child ${child.name} already has correct paths`);
            continue;
          }
          
          // Update the child's paths
          try {
            await supabase
              .from('google_sources')
              .update({
                parent_path: correctParentPath,
                path: correctPath
              })
              .eq('id', child.id);
              
            fixedCount++;
            console.log(`Fixed paths for ${child.name}`);
            
            // If this child is a folder, fix its children too (recursive fix)
            if (child.mime_type === 'application/vnd.google-apps.folder') {
              // Build query for grandchildren
              const grandChildrenQuery = supabase
                .from('google_sources')
                .select('id, name, parent_folder_id');
                
              // Use the right filter based on available IDs
              if (child.id && child.drive_id) {
                grandChildrenQuery.or(`parent_folder_id.eq.${child.id},parent_folder_id.eq.${child.drive_id}`);
              } else if (child.id) {
                grandChildrenQuery.eq('parent_folder_id', child.id);
              } else if (child.drive_id) {
                grandChildrenQuery.eq('parent_folder_id', child.drive_id);
              }
              
              const { data: grandChildren, error: grandChildrenError } = await grandChildrenQuery;
                
              if (grandChildrenError) {
                console.error(`Failed to fetch grandchildren for ${child.name}:`, grandChildrenError);
                continue;
              }
              
              console.log(`Found ${grandChildren.length} grandchildren for folder ${child.name}`);
              
              // Update each grandchild's parent_path
              for (const grandChild of grandChildren) {
                const correctGrandChildPath = `${correctPath}/${grandChild.name}`;
                
                try {
                  await supabase
                    .from('google_sources')
                    .update({
                      parent_path: correctPath,
                      path: correctGrandChildPath
                    })
                    .eq('id', grandChild.id);
                    
                  fixedCount++;
                } catch (err) {
                  console.error(`Failed to fix paths for grandchild ${grandChild.name}:`, err);
                  errorCount++;
                }
              }
            }
          } catch (err) {
            console.error(`Failed to fix paths for child ${child.name}:`, err);
            errorCount++;
          }
        }
      }
      
      console.log(`Path repair completed: ${fixedCount} fixed, ${errorCount} errors`);
      toast.success(`Fixed ${fixedCount} path issues`);
      
      // Store the result
      setRepairResult({ fixed: fixedCount, errors: errorCount });
      
      // Refresh the files to show the fixed structure
      // We need to reload to see the changes
      window.location.reload();
    } catch (err) {
      console.error('Error in path repair:', err);
      toast.error('Failed to repair paths');
    } finally {
      setIsRepairingPaths(false);
      toast.dismiss();
    }
  };
  
  // Debug function to help identify parent-child relationship issues
  const analyzeFileRelationships = () => {
    // Count files with each parent_path
    const parentPathCounts = files.reduce((acc, file) => {
      if (file.parent_path) {
        acc[file.parent_path] = (acc[file.parent_path] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    
    // Count files with each parent_folder_id
    const parentFolderIdCounts = files.reduce((acc, file) => {
      if (file.parent_folder_id) {
        acc[file.parent_folder_id] = (acc[file.parent_folder_id] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    
    // Check for folders that have a path but no children
    const foldersWithoutChildren = files.filter(file => 
      file.mime_type === 'application/vnd.google-apps.folder' && 
      file.path &&
      !files.some(child => child.parent_path === file.path)
    );
    
    // Check for files that have parent_path but the parent path doesn't exist
    const orphanedFiles = files.filter(file => 
      file.parent_path && 
      !files.some(parent => parent.path === file.parent_path)
    );
    
    console.log('File relationship analysis:', {
      totalFiles: files.length,
      rootFolders: rootFolderCount,
      filesWithParentPath: files.filter(f => f.parent_path).length,
      filesWithParentFolderId: files.filter(f => f.parent_folder_id).length,
      topParentPaths: Object.entries(parentPathCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
      topParentFolderIds: Object.entries(parentFolderIdCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
      foldersWithoutChildren: foldersWithoutChildren.length,
      orphanedFiles: orphanedFiles.length
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Root Folder Counter Badge */}
      <div className="bg-green-100 text-green-800 px-4 py-2 mb-4 rounded-lg shadow-sm border border-green-200 flex justify-between items-center">
        <div>
          <span className="font-bold">Root Folders:</span> {rootFolderCount}
          <span className="ml-2 text-xs bg-green-200 px-2 py-1 rounded-full">
            Updated {new Date().toLocaleTimeString()}
          </span>
        </div>
        <div className="flex gap-2">
          <button 
            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
            onClick={repairChildrenPaths}
            disabled={isRepairingPaths}
          >
            {isRepairingPaths ? 'Repairing Paths...' : 'EMERGENCY FIX: Repair File Paths'}
          </button>
          
          <button 
            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
            onClick={() => {
              analyzeFileRelationships();
              alert('Check browser console for detailed relationship analysis');
            }}
          >
            Debug Relationships
          </button>
        </div>
      </div>
      
      {/* Show repair results if available */}
      {repairResult && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
          <h3 className="font-bold mb-1">Path Repair Results:</h3>
          <p>
            <span className="font-medium">Fixed:</span> <span className="text-green-700">{repairResult.fixed}</span> paths
            {repairResult.errors > 0 && 
              <span className="ml-3 text-red-700">Errors: {repairResult.errors}</span>
            }
          </p>
          <p className="mt-1 text-gray-700">
            {repairResult.fixed > 0 
              ? "File paths have been repaired. You should now see the complete folder hierarchy." 
              : "No paths needed repair."}
          </p>
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {error}
        </div>
      )}
      
      <div className="flex">
        <div className={`w-1/2 ${selectedFile ? 'pr-4' : ''}`}>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-blue-500 animate-pulse">Loading files...</div>
            </div>
          ) : (
            <>
              <div className="mb-2 text-sm bg-green-100 p-2 rounded border border-green-200">
                <p><strong>File Tree Statistics:</strong></p>
                <ul className="list-disc pl-5 mt-1">
                  <li>Total items: {files.length}</li>
                  <li>Root folders: {rootFolderCount}</li>
                  <li>Files only: {files.filter(f => f.mime_type !== 'application/vnd.google-apps.folder').length}</li>
                </ul>
                
                <div className="mt-2">
                  <details>
                    <summary className="cursor-pointer font-medium text-blue-700">Parent Relationship Debug</summary>
                    <div className="mt-1 p-2 bg-white rounded text-xs max-h-40 overflow-auto">
                      <p className="font-bold">Root Folders:</p>
                      <ul className="list-disc pl-5">
                        {files
                          .filter(f => f.is_root === true && f.mime_type === 'application/vnd.google-apps.folder')
                          .map((folder, i) => (
                            <li key={i}>
                              {folder.name} 
                              <span className="text-gray-500 ml-1">
                                (ID: {folder.id?.substring(0, 6)}..., 
                                path: {folder.path?.substring(0, 15) || 'null'}, 
                                parent_path: {folder.parent_path?.substring(0, 15) || 'null'}, 
                                parent_folder_id: {folder.parent_folder_id?.substring(0, 6) || 'null'})
                              </span>
                            </li>
                          ))}
                      </ul>
                      
                      <p className="font-bold mt-2">Child Files Count by Parent Path:</p>
                      {Object.entries(
                        files.reduce((acc, file) => {
                          if (file.parent_path) {
                            acc[file.parent_path] = (acc[file.parent_path] || 0) + 1;
                          }
                          return acc;
                        }, {} as Record<string, number>)
                      )
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5)
                        .map(([path, count], i) => (
                          <div key={i} className="ml-2">
                            {path.substring(0, 20)}... : {count} files
                          </div>
                        ))}
                    </div>
                  </details>
                </div>
              </div>
              <FileTree 
                files={files}
                onSelectionChange={handleFileSelect}
                onFileClick={handleFileClick}
              />
            </>
          )}
        </div>
        
        {selectedFile && (
          <FileViewer file={selectedFile} />
        )}
      </div>
    </div>
  );
}

export default Viewer; 