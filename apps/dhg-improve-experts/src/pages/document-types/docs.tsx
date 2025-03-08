const syncDatabase = async () => {
  setIsSyncing(true);
  try {
    // Get the repository root path
    const repoRoot = process.env.NEXT_PUBLIC_REPO_ROOT || '/Users/raybunnage/Documents/github/dhg-mono';
    
    // Initialize arrays to store file paths and metadata
    const allMarkdownFiles: Array<{
      path: string;
      filename: string;
      last_modified: string;
      size: number;
    }> = [];
    
    // Function to recursively process directories
    const processDirectory = async (dir: string) => {
      try {
        const items = await fs.promises.readdir(dir, { withFileTypes: true });
        
        for (const item of items) {
          const itemPath = path.join(dir, item.name);
          
          // Skip excluded directories
          if (item.isDirectory() && 
              !itemPath.includes('node_modules') && 
              !itemPath.includes('.git') && 
              !itemPath.includes('dist') && 
              !itemPath.includes('build') && 
              !itemPath.includes('coverage')) {
            // Process subdirectory recursively
            await processDirectory(itemPath);
          } else if (item.isFile() && item.name.endsWith('.md')) {
            // Process markdown file
            const stats = await fs.promises.stat(itemPath);
            const relativePath = itemPath.replace(repoRoot, '').replace(/^\//, '');
            
            allMarkdownFiles.push({
              path: relativePath,
              filename: item.name,
              last_modified: stats.mtime.toISOString(),
              size: stats.size
            });
          }
        }
      } catch (error) {
        console.error(`Error processing directory ${dir}:`, error);
      }
    };
    
    // Process root directories
    await processDirectory(repoRoot);
    
    // Get existing files from database
    const { data: existingFiles, error: fetchError } = await supabase
      .from('documentation_files')
      .select('*');
      
    if (fetchError) {
      throw fetchError;
    }
    
    // Create a map of existing files by path
    const existingFilesMap = new Map();
    existingFiles?.forEach(file => {
      existingFilesMap.set(file.path, file);
    });
    
    // Create a set of found file paths
    const foundFilePaths = new Set(allMarkdownFiles.map(file => file.path));
    
    // Identify files to update, insert, or mark as deleted
    const filesToUpdate: any[] = [];
    const filesToInsert: any[] = [];
    const filesToMarkDeleted: any[] = [];
    
    // Files to insert or update
    for (const file of allMarkdownFiles) {
      const existingFile = existingFilesMap.get(file.path);
      
      if (existingFile) {
        // File exists in DB, check if it needs updating
        if (
          existingFile.last_modified !== file.last_modified ||
          existingFile.size !== file.size ||
          existingFile.soft_deleted === true
        ) {
          filesToUpdate.push({
            id: existingFile.id,
            path: file.path,
            filename: file.filename,
            last_modified: file.last_modified,
            size: file.size,
            soft_deleted: false,
            updated_at: new Date().toISOString()
          });
        }
      } else {
        // New file, needs to be inserted
        filesToInsert.push({
          path: file.path,
          filename: file.filename,
          last_modified: file.last_modified,
          size: file.size,
          soft_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }
    
    // Files to mark as deleted (exist in DB but not found on disk)
    for (const [path, file] of existingFilesMap.entries()) {
      if (!foundFilePaths.has(path) && !file.soft_deleted) {
        filesToMarkDeleted.push({
          id: file.id,
          soft_deleted: true,
          updated_at: new Date().toISOString()
        });
      }
    }
    
    // Perform database operations
    const operations = [];
    
    // Insert new files
    if (filesToInsert.length > 0) {
      operations.push(
        supabase
          .from('documentation_files')
          .insert(filesToInsert)
      );
    }
    
    // Update existing files
    for (const file of filesToUpdate) {
      operations.push(
        supabase
          .from('documentation_files')
          .update({
            path: file.path,
            filename: file.filename,
            last_modified: file.last_modified,
            size: file.size,
            soft_deleted: file.soft_deleted,
            updated_at: file.updated_at
          })
          .eq('id', file.id)
      );
    }
    
    // Mark files as deleted
    for (const file of filesToMarkDeleted) {
      operations.push(
        supabase
          .from('documentation_files')
          .update({
            soft_deleted: file.soft_deleted,
            updated_at: file.updated_at
          })
          .eq('id', file.id)
      );
    }
    
    // Execute all operations
    await Promise.all(operations);
    
    // Refresh the file list
    fetchFiles();
    
    toast({
      title: "Database Synchronized",
      description: `Added: ${filesToInsert.length}, Updated: ${filesToUpdate.length}, Marked Deleted: ${filesToMarkDeleted.length}`,
      status: "success",
      duration: 5000,
      isClosable: true,
    });
  } catch (error) {
    console.error("Error syncing database:", error);
    toast({
      title: "Sync Failed",
      description: `Error: ${error.message}`,
      status: "error",
      duration: 5000,
      isClosable: true,
    });
  } finally {
    setIsSyncing(false);
  }
}; 