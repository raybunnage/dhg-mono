# Document Archiving System Guide

This guide provides a detailed explanation of the document archiving system in the DHG platform. It covers the complete workflow for archiving documents using the Archive button on the Docs page.

## Overview

The document archiving system allows users to move files to an `.archive_docs` folder rather than permanently deleting them. This approach preserves document history while keeping the active document list clean. The system consists of:

1. **UI Components**: Archive button on the Docs page
2. **Database Filtering**: Logic to exclude archived documents from display
3. **Backend API**: Server-side endpoints for archive operations
4. **File System Operations**: Moving files to archive folders

## Architecture

The archiving workflow involves these components:

```
┌─────────────────┐     ┌────────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  UI Component   │────▶│ markdownFileService│────▶│ API Endpoint    │────▶│ File System      │
│  Archive Button │     │ archiveFile()      │     │ docs-sync.ts    │     │ Move to .archive │
└─────────────────┘     └────────────────────┘     └─────────────────┘     └──────────────────┘
                             │                           │                        │
                             ▼                           ▼                        ▼
                        ┌─────────────────┐     ┌─────────────────┐     ┌──────────────────┐
                        │ Database Update │     │ Path Resolution │     │ Update Database  │
                        │ file_path       │     │ Multiple Paths  │     │ With New Path    │
                        └─────────────────┘     └─────────────────┘     └──────────────────┘
```

## UI Components

### Archive Button in the Docs Page

The Archive button is located in the document viewer header section of the Docs page:

```typescript
// From pages/Docs.tsx
<button 
  onClick={(e) => {
    e.stopPropagation(); // Prevent summary toggle
    
    // Extract just the filename from the file_path
    const fileName = selectedFile.file_path.split('/').pop();
    
    const confirmArchive = window.confirm(
      `Are you sure you want to archive the file "${fileName}"?\n\nThis will move the file to an .archive_docs folder and update its path in the database. The file will no longer appear in the list but will still exist on disk.`
    );
    if (confirmArchive) {
      handleArchiveFile(selectedFile);
    }
  }}
  className="ml-auto mr-3 bg-amber-50 hover:bg-amber-100 text-amber-600 hover:text-amber-700 text-xs px-3 py-1 rounded-md flex items-center"
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

The archive handler function in the Docs page coordinates the archiving process:

```typescript
// Handle document archiving (move to .archive_docs folder)
const handleArchiveFile = async (file: DocumentationFile) => {
  if (!file) {
    toast.error('Invalid file selected for archiving');
    return;
  }
  
  setLoading(true);
  try {
    // Use markdownFileService to archive the file
    const result = await markdownFileService.archiveFile(file.file_path);
    
    if (result.success) {
      // Update the file path in the database to reflect the new archived location
      const { error: updateError } = await supabase
        .from('documentation_files')
        .update({
          file_path: result.newPath,
          updated_at: new Date().toISOString()
        })
        .eq('id', file.id);
      
      if (updateError) {
        throw updateError;
      }
      
      // Extract just the filename for the success message
      const fileName = file.file_path.split('/').pop();
      toast.success(`File "${fileName}" has been archived`);
      
      // Update the UI
      // Since we filter out archived files, just remove this file from the list
      setDocumentationFiles(prev => prev.filter(f => f.id !== file.id));
      
      // Rebuild groups to reflect the archived file
      const updatedGroups = buildDocumentTypeGroups(
        documentationFiles.filter(f => f.id !== file.id),
        documentTypes
      );
      setDocumentTypeGroups(updatedGroups);
      
      // If the currently selected file was archived, clear selection
      if (selectedFile?.id === file.id) {
        setSelectedFile(null);
      }
    } else {
      throw new Error(result.message || 'Failed to archive file');
    }
  } catch (error) {
    console.error('Error archiving file:', error);
    toast.error(`Failed to archive file: ${error.message || 'Unknown error'}`);
  } finally {
    setLoading(false);
  }
};
```

## Database Filtering

The Docs page implements filtering to exclude archived documents from display:

```typescript
// In fetchDocumentationFiles() function in Docs.tsx
const validFiles = (data || []).filter(file => 
  file && file.file_path && 
  // Exclude files under the file_types folder at the repo root
  // The path could be like "/file_types/..." or start with "file_types/..."
  !file.file_path.includes('/file_types/') && 
  !file.file_path.startsWith('file_types/') &&
  // Exclude files in .archive_docs folders
  !file.file_path.includes('/.archive_docs/') &&
  !file.file_path.startsWith('.archive_docs/') &&
  // Exclude .txt files
  !file.file_path.endsWith('.txt')
);
```

This filtering happens at multiple levels:
1. Initial database query filters
2. Client-side filtering after fetching the data
3. Folder structure filtering when organizing documents by folder

## Frontend Service Implementation

The `markdownFileService.ts` service provides the `archiveFile` method:

```typescript
/**
 * Archive a markdown file (move it to .archive_docs folder)
 */
async archiveFile(filePath: string): Promise<{ success: boolean; message: string; newPath: string }> {
  try {
    console.log(`Attempting to archive file: ${filePath}`);
    
    const response = await fetch('/api/docs-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        action: 'archive-file',
        filePath: filePath 
      }),
    });
    
    // Safely parse the JSON response
    let data;
    try {
      const text = await response.text();
      data = text ? JSON.parse(text) : {};
      console.log('Archive response:', data);
    } catch (parseError) {
      console.error('Error parsing API response:', parseError);
      // If we can't parse the response, check if the operation might have succeeded anyway
      if (response.ok) {
        return {
          success: true,
          message: 'File archived successfully (response parse error)',
          newPath: filePath.replace(/^(.+\/)?([^\/]+)$/, '$1.archive_docs/$2') // Best guess at new path
        };
      }
      
      throw new Error(`Failed to parse server response: ${parseError.message}`);
    }
    
    if (!response.ok) {
      throw new Error(data?.message || `Failed to archive file: Server returned ${response.status}`);
    }
    
    return {
      success: true,
      message: data?.message || 'File archived successfully',
      newPath: data?.newPath || ''
    };
  } catch (error: any) {
    console.error('Error archiving file:', error);
    throw error;
  }
}
```

## Backend API Implementation

The `/api/docs-sync` endpoint in `docs-sync.ts` handles the server-side archive operation:

```typescript
/**
 * Archive a file by moving it to an .archive_docs folder in the same directory
 */
async function handleArchiveFile(req, res, fileId, filePath, providedNewPath = null) {
  if (!filePath) {
    return res.status(400).json({ 
      success: false, 
      message: 'File path is required' 
    });
  }

  try {
    // Resolve the absolute path of the file
    const repoRoot = process.cwd();
    
    // Try multiple possible locations for the file
    const possiblePaths = [
      path.join(repoRoot, filePath),                     // Path relative to repo root
      path.join(repoRoot, 'docs', filePath),             // In docs folder
      path.join(repoRoot, '..', filePath),               // One level up
      path.join(repoRoot, '..', 'docs', filePath),       // One level up, in docs folder
      path.normalize(filePath)                           // Path as is (if absolute)
    ];
    
    console.log(`Looking for file to archive: ${filePath}`);
    console.log(`Checking these locations:`, possiblePaths);
    
    // Find the first path that exists
    let fileExists = false;
    let absoluteFilePath = '';
    let basePath = repoRoot;
    
    for (const checkPath of possiblePaths) {
      if (fs.existsSync(checkPath)) {
        fileExists = true;
        absoluteFilePath = checkPath;
        
        // Determine which base path was used to find the file
        if (checkPath.startsWith(path.join(repoRoot, 'docs'))) {
          basePath = path.join(repoRoot, 'docs');
        } else if (checkPath.startsWith(path.join(repoRoot, '..'))) {
          basePath = path.join(repoRoot, '..');
        } else if (checkPath === path.normalize(filePath)) {
          basePath = path.dirname(filePath);
        }
        
        console.log(`Found file at: ${absoluteFilePath}`);
        break;
      }
    }

    // Check if we found the file
    if (!fileExists) {
      return res.status(404).json({ 
        success: false, 
        message: `File not found: ${filePath}` 
      });
    }

    // If newPath is provided, use it; otherwise, create archive path
    let newPath = providedNewPath;
    if (!newPath) {
      // Extract directory and filename
      const fileDir = path.dirname(filePath);
      const fileName = path.basename(filePath);
      
      // Create archive folder path
      const archiveDir = fileDir === '.' ? '.archive_docs' : `${fileDir}/.archive_docs`;
      newPath = `${archiveDir}/${fileName}`;
    }

    // Create absolute paths
    // Use the same base path that we found the file in
    const absoluteNewPath = path.join(basePath, newPath);
    const absoluteArchiveDir = path.dirname(absoluteNewPath);

    // Create archive directory if it doesn't exist
    if (!fs.existsSync(absoluteArchiveDir)) {
      try {
        fs.mkdirSync(absoluteArchiveDir, { recursive: true });
        console.log(`Created archive directory: ${absoluteArchiveDir}`);
      } catch (mkdirError) {
        console.error(`Error creating archive directory: ${absoluteArchiveDir}`, mkdirError);
        // Try with direct shell command as a fallback
        try {
          const { execSync } = require('child_process');
          execSync(`mkdir -p "${absoluteArchiveDir}"`);
          console.log(`Created archive directory using shell command: ${absoluteArchiveDir}`);
        } catch (shellError) {
          console.error(`Shell command for creating directory also failed:`, shellError);
          throw new Error(`Failed to create archive directory: ${shellError.message}`);
        }
      }
    }

    // Move file to archive folder
    try {
      fs.renameSync(absoluteFilePath, absoluteNewPath);
      console.log(`Archived file from ${absoluteFilePath} to ${absoluteNewPath}`);
    } catch (moveError) {
      console.error(`Error moving file with fs.renameSync:`, moveError);
      
      // Try with cp and rm as a fallback
      try {
        const { execSync } = require('child_process');
        execSync(`cp "${absoluteFilePath}" "${absoluteNewPath}" && rm "${absoluteFilePath}"`);
        console.log(`Archived file using shell commands: ${absoluteFilePath} to ${absoluteNewPath}`);
      } catch (shellError) {
        console.error(`Shell command for moving file also failed:`, shellError);
        throw new Error(`Failed to move file: ${shellError.message}`);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'File archived successfully',
      newPath: newPath
    });
  } catch (error) {
    console.error('Error archiving file:', error);
    return res.status(500).json({
      success: false,
      message: `Error archiving file: ${error.message}`
    });
  }
}
```

## Key Lessons and Best Practices

1. **Path Resolution Strategy**:
   - Try multiple potential file paths to handle different repository structures
   - Use both relative and absolute paths for maximum flexibility
   - Implement fallback mechanisms when primary methods fail

2. **Error Handling**:
   - Implement comprehensive error handling at each level
   - Provide clear, user-friendly error messages
   - Include fallback mechanisms (e.g., shell commands when Node.js methods fail)

3. **Database Consistency**:
   - Update database records to reflect the new archived path
   - Filter archived files from queries to keep the UI clean
   - Maintain the relationship between file system and database

4. **User Experience**:
   - Confirm before archiving to prevent accidental operations
   - Display clear success/error messages using toast notifications
   - Update the UI immediately after successful archiving

## Common Issues and Solutions

### 1. Netlify Deployment and API Availability

**Problem**: The Archive button works in development environment but not in production on Netlify.

**Solution**: This is a common issue when APIs aren't properly configured as Netlify functions. To fix this:

1. Create a Netlify function for the API endpoint:
   ```
   /netlify/functions/docs-sync.js
   ```

2. Update the `netlify.toml` configuration to include:
   ```toml
   [build]
     functions = "netlify/functions"

   [[redirects]]
     from = "/api/docs-sync"
     to = "/.netlify/functions/docs-sync"
     status = 200
     force = true
   ```

3. Implement the function with compatible handler:
   ```javascript
   // In netlify/functions/docs-sync.js
   exports.handler = async (event, context) => {
     // Parse request body and handle operations
     // Return appropriate responses
   };
   ```

This deployment pattern ensures your API is properly accessible in the Netlify production environment.

### 2. File Not Found Error

**Problem**: The Archive button returns a "File not found" error even though the file exists.

**Solution**: The backend API is likely having trouble locating the file. Check the following:

- Ensure the file path in the database matches the actual file system path
- Verify that the repository structure is as expected
- Add additional path resolution strategies to the `possiblePaths` array in `handleArchiveFile`

### 3. Permission Issues

**Problem**: Unable to create archive directory or move files due to permission errors.

**Solution**: The API implements a fallback mechanism using shell commands:

```javascript
// If mkdirSync fails, try a shell command
try {
  const { execSync } = require('child_process');
  execSync(`mkdir -p "${absoluteArchiveDir}"`);
} catch (shellError) {
  throw new Error(`Failed to create archive directory: ${shellError.message}`);
}
```

Ensure the server process has appropriate file system permissions.

### 4. Database Update Failure

**Problem**: File is moved successfully, but database update fails.

**Solution**: Implement a transaction-like approach where you:
1. Verify database connection before attempting file operations
2. Consider rolling back the file move if database update fails

## Applying This Pattern to Other Code

To implement document archiving in other parts of the application:

1. **Create UI Component**:
   - Add an Archive button to the component
   - Implement a confirmation dialog
   - Create a handler function that calls the appropriate service

2. **Implement Backend API**:
   - Use the existing `/api/docs-sync` endpoint or create a similar one
   - Ensure path resolution logic works for your specific file types
   - Implement proper error handling and fallbacks

3. **Add Filtering Logic**:
   - Update database queries to exclude archived files
   - Add client-side filtering as a safety measure
   - Update UI state to remove archived files

4. **Update Database Records**:
   - Ensure the database record is updated with the new file path
   - Maintain any relationships or references to the file
   - Consider adding metadata about when the file was archived

This archiving pattern provides a non-destructive way to clean up active files while preserving access to historical content.

## API Deployment Fix Summary

The document archiving functionality was fixed on 2025-03-23. Two approaches were implemented to ensure reliable archiving across all environments:

### 1. Netlify Function Approach

This approach fixed the issue where the API wasn't properly configured as a Netlify serverless function:

1. Created a standalone Netlify function in `/netlify/functions/docs-sync.js` that implements the same functionality as the original API
2. Updated the Netlify configuration to include the functions directory and a redirect rule in `netlify.toml`
3. Ensured compatibility with both the development server and production Netlify environment

### 2. Standalone Server Approach (Recommended)

This approach provides a more robust solution that doesn't rely on Netlify functions:

1. Created a standalone server in `scripts/docs-archive-server.js` based on the successful script archiving server model
2. The server handles file operations directly with more reliable path resolution
3. Updated `markdownFileService.ts` to try the standalone server first, then fall back to the Netlify function
4. Created a simple startup script `run-docs-archive-server.sh` for easy server launching

## Running the Standalone Server

To use the standalone server approach (recommended for all environments):

1. Start the docs archive server:
   ```bash
   # From the repository root
   ./scripts/run-docs-archive-server.sh
   ```

2. The server will run on port 3003 and handle all document file operations
3. The `markdownFileService` will automatically detect and use this server if it's running

## Benefits of Standalone Server Approach

1. Works in all environments (local, staging, production)
2. More reliable file path resolution
3. Direct file system access without Netlify function constraints
4. Simpler debugging with detailed console logs
5. No deployment configuration needed
6. Based on the proven script-server model that's already working in production

Both approaches enable the Archive button on the Docs page to work properly across all deployment environments, providing a consistent user experience.