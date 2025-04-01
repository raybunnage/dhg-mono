#!/bin/bash
# Generate a browser-based recursive folder search script

cat << 'EOF'
=== Recursive Folder Search ===
This script provides JavaScript code to recursively search a Google Drive folder.

Steps:
1. Open the DHG Improve Experts app in Chrome: https://dhg-improve-experts.netlify.app
2. Make sure you're authenticated with Google Drive
3. Open Chrome DevTools (F12 or Cmd+Option+I)
4. Copy and paste the following code into the Console tab:
=====================================

// Dynamic Healing Discussion Group folder ID
const folderId = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';

// Set a longer timeout for operations (10 minutes)
const TIMEOUT = 600000;

// Run a recursive dry run search
console.log('Starting recursive search for folder...');
const search = async () => {
  try {
    // Get Google Drive service from the app
    const googleDriveService = window.googleDriveService || 
      (await import('./src/services/googleDriveService')).default;
    
    if (!googleDriveService) {
      console.error('Could not find Google Drive service');
      return;
    }
    
    // Array to hold all files, including those in subfolders
    let allFiles = [];
    
    // Function to get files from a specific folder
    async function getFilesInFolder(currentFolderId, parentPath = '') {
      console.log(`Searching folder: ${currentFolderId} (path: ${parentPath || '/'})`);
      
      // Get files in the current folder
      const query = `'${currentFolderId}' in parents and trashed=false`;
      const result = await googleDriveService.listFiles(query);
      
      if (!result || !result.files) {
        console.error('No results returned for folder:', currentFolderId);
        return [];
      }
      
      // Enhance files with path information
      const folderFiles = result.files.map(file => {
        // Calculate the full path for this file
        const filePath = parentPath 
          ? `${parentPath}/${file.name}` 
          : `/${file.name}`;
        
        return {
          ...file,
          path: filePath,
          parentPath: parentPath || '/'
        };
      });
      
      // Add these files to our collection
      allFiles = [...allFiles, ...folderFiles];
      
      // Process status update (for large folders)
      if (allFiles.length % 100 === 0) {
        console.log(`Found ${allFiles.length} files so far...`);
      }
      
      // Find all subfolders in the current results
      const subFolders = folderFiles.filter(file => 
        file.mimeType === 'application/vnd.google-apps.folder'
      );
      
      // Recursively process each subfolder
      for (const folder of subFolders) {
        const folderPath = parentPath 
          ? `${parentPath}/${folder.name}` 
          : `/${folder.name}`;
          
        await getFilesInFolder(folder.id, folderPath);
      }
      
      return folderFiles;
    }
    
    // Start recursive search from the root folder
    await getFilesInFolder(folderId);
    
    // Sort files by path for easier browsing
    allFiles.sort((a, b) => a.path.localeCompare(b.path));
    
    // Get file type breakdown
    const fileTypes = {};
    allFiles.forEach(file => {
      const type = file.mimeType || 'unknown';
      fileTypes[type] = (fileTypes[type] || 0) + 1;
    });
    
    // Show overall results
    console.log(`Found ${allFiles.length} total files (recursively)`);
    
    // Show file types breakdown
    console.log('\nFile type breakdown:');
    Object.entries(fileTypes)
      .sort((a, b) => b[1] - a[1])  // Sort by count, descending
      .forEach(([type, count]) => {
        console.log(`${type}: ${count} files`);
      });
    
    // Show sample of files
    console.log('\nSample of files:');
    allFiles.slice(0, 20).forEach((file, i) => {
      console.log(`${i+1}. ${file.path} (${file.mimeType})`);
    });
    
    console.log(`\n... and ${Math.max(0, allFiles.length - 20)} more files`);
    
    return {
      files: allFiles,
      totalCount: allFiles.length,
      fileTypes
    };
  } catch (error) {
    console.error('Error during recursive search:', error);
  }
};

// Execute the search
search();

=====================================

After running this code in your browser console, you'll see a complete list of all files 
in the folder and subfolders.
EOF

echo "
You can change the folder ID in the script to search different folders:
- Dynamic Healing Discussion Group: 1wriOM2j2IglnMcejplqG_XcCxSIfoRMV"