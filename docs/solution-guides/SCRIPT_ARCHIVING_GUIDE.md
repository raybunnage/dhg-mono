# Script Archiving System Guide

This document provides a comprehensive overview of the script archiving system implemented in the DHG platform. It covers the UI components, backend services, and how these components work together to archive script files instead of deleting them completely.

## Overview

The script archiving system allows users to move script files to an `.archived_scripts` folder rather than permanently deleting them. This approach preserves script history while keeping the active scripts list clean. The system consists of:

1. **UI Components**: Archive button on the Scripts page
2. **Database Filtering**: Logic to exclude archived scripts from display
3. **Backend Service**: API endpoints for archive operations
4. **File System Operations**: Moving files to archive folders

## UI Components and Database Filtering

### Script List Filtering

The Scripts page (`/apps/dhg-improve-experts/src/pages/Scripts.tsx`) implements multiple layers of filtering to exclude archived scripts:

1. **Database Query Filter**: The initial database query excludes scripts with paths containing `.archived_scripts`:

```typescript
// In fetchScripts() function
let query = supabase
  .from('scripts')
  .select('*', { count: 'exact' })
  .not('file_path', 'ilike', '%.archived_scripts%'); // Skip archived scripts
```

2. **Client-side Filtering**: Additional safety filter to ensure archived scripts are excluded:

```typescript
// Additional client-side filtering to make sure we exclude all archived scripts
const filteredScripts = data?.filter(script => 
  script.file_path && !script.file_path.includes('.archived_scripts')
) || [];
```

3. **Folder Structure Filtering**: When organizing scripts into folders, any script in an archive folder is excluded:

```typescript
// Skip any scripts in .archived_scripts folders
if (script.file_path.includes('/.archived_scripts/')) return;

// Skip folders with .archived_scripts in the name
if (folderPath.includes('.archived_scripts')) return;
```

### Archive Button Implementation

The Archive button in the UI triggers the archiving process:

```typescript
<button 
  onClick={(e) => {
    e.stopPropagation();
    
    // Extract just the filename from the file_path
    const fileName = selectedScript.file_path.split('/').pop();
    
    const confirmArchive = window.confirm(
      `Are you sure you want to archive the script "${fileName}"?\n\nThis will move the file to the .archived_scripts folder and update its path in the database. The script will no longer appear in the list but will still exist on disk.`
    );
    if (confirmArchive) {
      handleArchiveScript(selectedScript);
    }
  }}
  className="mr-3 bg-amber-50 hover:bg-amber-100 text-amber-600 hover:text-amber-700 text-xs px-3 py-1 rounded-md flex items-center"
>
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
    <path d="M21 8v13H3V8"></path>
    <path d="M1 3h22v5H1z"></path>
    <path d="M10 12h4"></path>
  </svg>
  Archive
</button>
```

### Archive Handler Function

The archive handler function coordinates the UI, API call, and database update:

```typescript
// Handle script archiving (move file to .archived_scripts folder and update the database record)
const handleArchiveScript = async (script: Script) => {
  if (!script) {
    toast.error('Invalid script selected for archiving');
    return;
  }
  
  setLoading(true);
  try {
    // First, try to archive the file (move it to .archived_scripts folder)
    const result = await scriptFileService.archiveFile(script.file_path);
    console.log('File archive result:', result);
    
    if (result.success) {
      // Update the file path in the database to the new archived location
      const { error: updateError } = await supabase
        .from('scripts')
        .update({
          file_path: result.new_path,
          updated_at: new Date().toISOString()
        })
        .eq('id', script.id);
      
      if (updateError) {
        throw updateError;
      }
      
      // Extract just the filename for the success message
      const fileName = script.file_path.split('/').pop();
      toast.success(`Script "${fileName}" has been archived`);
      
      // Update the UI by removing this script from the list
      // (archived scripts won't show in the list since they're in .archived_scripts)
      setScripts(prev => prev.filter(s => s.id !== script.id));
      
      // If the currently selected script was archived, clear selection
      if (selectedScript?.id === script.id) {
        setSelectedScript(null);
      }
    } else {
      throw new Error('Failed to archive the script file');
    }
  } catch (error: any) {
    console.error('Error archiving script:', error);
    toast.error(`Failed to archive script: ${error?.message || 'Unknown error'}`);
  } finally {
    setLoading(false);
  }
};
```

## Backend Service Implementation

### Script File Service (Frontend Service)

The frontend service (`scriptFileService.ts`) makes API calls to the script server:

```typescript
// Archive a script file (move it to .archived_scripts folder)
async archiveFile(filePath: string): Promise<{ success: boolean; message: string; new_path: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/script-file/archive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: filePath }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to archive script file');
    }
    
    return {
      success: true,
      message: data.message || 'File archived successfully',
      new_path: data.new_path || ''
    };
  } catch (error: any) {
    console.error('Error archiving script file:', error);
    throw error;
  }
}
```

### Simple Script Server (Backend)

The Node.js server (`simple-script-server.js`) handles the actual file operations:

```javascript
// Handle POST request for script file archiving
else if (pathname === '/api/script-file/archive' && req.method === 'POST') {
  // Archive a script file (move it to .archived_scripts folder)
  try {
    // Read the request body (expecting JSON with 'path' property)
    const body = await readRequestBody(req);
    const filePath = body.path;
    
    if (!filePath) {
      sendJson(res, 400, { error: 'File path required in request body' });
      return;
    }
    
    // Security check
    const normalizedPath = path.normalize(filePath);
    // Allow .sh, .js, .ts, .py files
    const allowedExtensions = ['.sh', '.js', '.ts', '.py'];
    if (!allowedExtensions.some(ext => normalizedPath.endsWith(ext))) {
      sendJson(res, 400, { 
        error: 'Only script files allowed (.sh, .js, .ts, .py)',
        extensions: allowedExtensions
      });
      return;
    }
    
    // Project root - need to go up to the repository root
    const projectRoot = path.join(__dirname, '..', '..');
    
    // Try multiple locations
    const possiblePaths = [
      path.join(projectRoot, normalizedPath),
      path.join(__dirname, normalizedPath),
      path.join(__dirname, '..', normalizedPath),
      path.join(projectRoot, 'scripts', normalizedPath)
    ];
    
    // Try to find the file and archive it
    let fileFound = false;
    for (const tryPath of possiblePaths) {
      try {
        if (fs.existsSync(tryPath)) {
          fileFound = true;
          console.log(`Found file to archive: ${tryPath}`);
          
          // Create archive directory path based on the original location
          const originalDirname = path.dirname(tryPath);
          const archiveDirPath = path.join(originalDirname, ARCHIVED_SCRIPTS_FOLDER);
          
          // Make sure the archive directory exists
          if (!fs.existsSync(archiveDirPath)) {
            fs.mkdirSync(archiveDirPath, { recursive: true });
            console.log(`Created archive directory: ${archiveDirPath}`);
          }
          
          // Create the new path for the archived file
          const filename = path.basename(tryPath);
          const archivedFilePath = path.join(archiveDirPath, filename);
          
          try {
            // Move the file to the archived location
            fs.renameSync(tryPath, archivedFilePath);
            
            // Generate the new path for database update (relative to project root)
            let newRelativePath = archivedFilePath.replace(projectRoot + '/', '');
            
            sendJson(res, 200, {
              success: true,
              message: `File ${normalizedPath} archived successfully`,
              original_path: normalizedPath,
              new_path: newRelativePath
            });
            return;
          } catch (moveError) {
            console.error(`Error archiving ${tryPath}:`, moveError);
            // Send a 500 error specifically for the archive failure
            sendJson(res, 500, { 
              error: `Failed to archive file: ${moveError.message}`,
              file_path: normalizedPath
            });
            return;
          }
        }
      } catch (error) {
        console.error(`Error checking ${tryPath}:`, error);
      }
    }
    
    // If we got here and fileFound is still false, the file wasn't found
    if (!fileFound) {
      sendJson(res, 404, {
        success: false,
        error: `File ${normalizedPath} not found`,
        tried_paths: possiblePaths
      });
    }
  } catch (error) {
    console.error('Error in archive endpoint:', error);
    sendJson(res, 500, { error: `Server error: ${error.message}` });
  }
}
```

## Script Pipeline Integration

The script pipeline doesn't directly handle archiving but accommodates it through:

1. The `script-pipeline-main.sh` controls overall script processing but doesn't directly interact with archiving.

2. The `script-manager.sh` primarily focuses on script classification and retrieval, but respects the archiving system by not including archived scripts in operations.

3. Both shell scripts work with unarchived scripts, relying on the database filtering mentioned earlier to skip archived scripts.

## How the System Works Together

1. **User Initiates Archive**: 
   - User clicks the "Archive" button on the Scripts page
   - UI displays a confirmation dialog explaining what will happen

2. **Frontend Service Call**:
   - `handleArchiveScript()` calls `scriptFileService.archiveFile()`
   - This makes a POST request to the Node.js server endpoint `/api/script-file/archive`

3. **Backend Processing**:
   - Server locates the script file on disk
   - Creates a `.archived_scripts` folder in the same directory if it doesn't exist
   - Moves the file to this folder using `fs.renameSync()`
   - Returns the new file path to the frontend

4. **Database Update**:
   - Frontend updates the script record with the new file path
   - New path includes `.archived_scripts` which will cause it to be excluded from future queries

5. **UI Update**:
   - Script is removed from the UI list
   - Success message is displayed

## Applying This Pattern to Other Code

To apply this archiving pattern elsewhere:

1. **Create Database Filtering**:
   - Ensure database queries exclude items with paths containing `.archived_xxx`
   - Add similar client-side filtering for safety

2. **Implement Archive Function**:
   - Add an "Archive" button/option to the UI
   - Create a handler function similar to `handleArchiveScript()`

3. **Backend Service**:
   - Add an endpoint to your backend service for archive operations
   - Implement file system logic to move files to `.archived_xxx` folders

4. **Database Integration**:
   - Update database records to reflect the new archive path
   - Ensure all queries exclude archived items with appropriate filters

This pattern provides a non-destructive way to clean up active items while preserving history.