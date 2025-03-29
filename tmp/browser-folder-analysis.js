/**
 * DR Clawson Papers - Browser Folder Analysis
 * 
 * This script can be run in the browser console when you're viewing 
 * the Google Drive folder to analyze its contents.
 * 
 * Instructions:
 * 1. Open the Google Drive folder in your browser
 * 2. Press F12 or Cmd+Option+I to open DevTools
 * 3. Paste this script into the Console tab
 * 4. Press Enter to run it
 */

// Configure folder ID
const FOLDER_ID = "1lLO4dx_V3XhJSb4btA-hH15yxlPhllY2";
const FOLDER_NAME = "DR Clawson papers";

console.log(`=== Analysis of "${FOLDER_NAME}" (${FOLDER_ID}) ===`);
console.log("Starting folder analysis...");

// Helper function to format file sizes
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Main analysis function
async function analyzeFolderContents() {
  try {
    // Verify the folder exists
    const folderResponse = await gapi.client.drive.files.get({
      fileId: FOLDER_ID,
      fields: 'id,name,mimeType'
    });
    
    console.log(`Folder name: ${folderResponse.result.name}`);
    
    if (folderResponse.result.mimeType !== 'application/vnd.google-apps.folder') {
      console.error("The ID does not belong to a folder!");
      return;
    }
    
    // Collect all files recursively
    const allFiles = await collectAllFiles(FOLDER_ID);
    console.log(`Found ${allFiles.length} total files and folders`);
    
    // Analyze file types
    const mimeTypes = {};
    let totalSize = 0;
    
    allFiles.forEach(file => {
      const type = file.mimeType || 'unknown';
      mimeTypes[type] = (mimeTypes[type] || 0) + 1;
      
      // Add to total size if available
      if (file.size) {
        totalSize += parseInt(file.size, 10);
      }
    });
    
    // Count folders
    const folders = allFiles.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
    const files = allFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
    
    console.log(`\n=== Summary ===`);
    console.log(`Total items: ${allFiles.length}`);
    console.log(`Folders: ${folders.length}`);
    console.log(`Files: ${files.length}`);
    console.log(`Total size: ${formatFileSize(totalSize)}`);
    
    console.log(`\n=== File Type Breakdown ===`);
    Object.entries(mimeTypes)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        // Simplify type names for better readability
        const simplifiedType = type
          .replace('application/vnd.google-apps.', '')
          .replace('application/', '')
          .replace('video/', 'video: ')
          .replace('audio/', 'audio: ')
          .replace('image/', 'image: ');
          
        console.log(`${simplifiedType}: ${count} files`);
      });
  
  } catch (error) {
    console.error("Error analyzing folder:", error);
  }
}

// Function to collect all files recursively
async function collectAllFiles(folderId, pageToken, allFiles = []) {
  try {
    // Query for all files in this folder
    let query = `'${folderId}' in parents and trashed = false`;
    
    const response = await gapi.client.drive.files.list({
      q: query,
      pageSize: 1000,
      pageToken: pageToken,
      fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, parents)'
    });
    
    const files = response.result.files || [];
    allFiles.push(...files);
    
    console.log(`Found ${files.length} items in the current batch`);
    
    // Handle pagination
    if (response.result.nextPageToken) {
      return collectAllFiles(folderId, response.result.nextPageToken, allFiles);
    }
    
    // Process subfolders recursively
    const folders = files.filter(file => file.mimeType === 'application/vnd.google-apps.folder');
    
    for (const folder of folders) {
      console.log(`Looking in subfolder: ${folder.name}`);
      await collectAllFiles(folder.id, null, allFiles);
    }
    
    return allFiles;
  } catch (error) {
    console.error(`Error collecting files from folder ${folderId}:`, error);
    return allFiles;
  }
}

// First, check if the Google API is available
if (typeof gapi === 'undefined' || !gapi.client || !gapi.client.drive) {
  console.error("Google Drive API is not loaded or not authorized.");
  console.log("Please make sure you're signed in to Google and viewing a Google Drive folder.");
} else {
  console.log("Google Drive API is available. Starting analysis...");
  analyzeFolderContents();
}