import { createServerHandler } from '../utils/api-utils';
import fs from 'fs';
import path from 'path';
import { supabase } from '../integrations/supabase/client';

export default createServerHandler(async (req, res) => {
  // Check for POST request
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    // Parse request body
    const { action, fileId, filePath, newPath } = req.body;
    
    console.log(`Received docs-sync API request:`, { action, filePath });

    // Handle different actions
    if (action === 'archive-file') {
      // Add debug log
      console.log('Handling archive-file action');
      return await handleArchiveFile(req, res, fileId, filePath, newPath);
    } else if (action === 'delete-file') {
      return await handleDeleteFile(req, res, fileId, filePath);
    } else {
      return res.status(400).json({ success: false, message: `Invalid action: '${action}'` });
    }
  } catch (error) {
    console.error('Error in docs-sync API:', error);
    return res.status(500).json({
      success: false,
      message: `Server error: ${error.message}`
    });
  }
});

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

/**
 * Delete a file from the filesystem
 */
async function handleDeleteFile(req, res, fileId, filePath) {
  if (!filePath) {
    return res.status(400).json({ 
      success: false, 
      message: 'File path is required' 
    });
  }

  try {
    // Resolve the absolute path of the file
    const repoRoot = process.cwd();
    const tryAbsolutePath = req.body.tryAbsolutePath === true;
    
    console.log(`Looking for file to delete: ${filePath}`);
    console.log(`Repository root: ${repoRoot}`);
    console.log(`Try absolute path: ${tryAbsolutePath}`);
    
    // Try multiple possible locations for the file
    const possiblePaths = [
      // First try direct path if it's an absolute path or we're explicitly trying that
      ...(filePath.startsWith('/') || tryAbsolutePath ? [filePath] : []),
      // Then try repo-relative paths
      path.join(repoRoot, filePath),
      path.join(repoRoot, 'docs', filePath),
      // Try removing 'docs/' prefix if it exists
      filePath.startsWith('docs/') ? path.join(repoRoot, filePath.substring(5)) : null,
      // Try some common structures
      path.join(repoRoot, '..', filePath),
      path.join(repoRoot, '..', 'docs', filePath),
      // Normalize the path in case it has '..' or '.' segments
      path.normalize(filePath)
    ].filter(Boolean); // Remove null entries
    
    // Add any additional paths that might be needed
    if (filePath.includes('cli-pipeline')) {
      possiblePaths.push(
        path.join(repoRoot, 'docs', 'cli-pipeline', path.basename(filePath)),
        path.join(repoRoot, 'scripts', 'cli-pipeline', path.basename(filePath))
      );
    }
    
    console.log(`Checking these locations:`, possiblePaths);
    
    // Find the first path that exists
    let fileExists = false;
    let foundPath = '';
    
    for (const checkPath of possiblePaths) {
      try {
        if (fs.existsSync(checkPath)) {
          fileExists = true;
          foundPath = checkPath;
          console.log(`Found file at: ${foundPath}`);
          break;
        }
      } catch (pathError) {
        console.warn(`Error checking path ${checkPath}:`, pathError.message);
        // Continue to next path
      }
    }

    // If file still not found, use the exec command to find it
    if (!fileExists) {
      try {
        console.log('Trying to find file using exec find command');
        const { exec } = require('child_process');
        const util = require('util');
        const execAsync = util.promisify(exec);
        
        const fileName = path.basename(filePath);
        const findCmd = `find ${repoRoot}/.. -name "${fileName}" -type f | grep -v "node_modules\\|.git" | head -1`;
        
        console.log(`Executing find command: ${findCmd}`);
        const { stdout } = await execAsync(findCmd);
        
        if (stdout.trim()) {
          foundPath = stdout.trim();
          fileExists = true;
          console.log(`Found file via find command at: ${foundPath}`);
        }
      } catch (findError) {
        console.warn('Error running find command:', findError.message);
      }
    }

    // Check if we found the file
    if (!fileExists) {
      console.log(`File not found in any of the checked locations: ${filePath}`);
      
      // Still return success in case the file was already deleted or never existed
      return res.status(200).json({
        success: true,
        message: `File ${filePath} was not found but database record will be deleted`,
        fileFound: false,
        triedPaths: possiblePaths
      });
    }

    // Delete the file
    fs.unlinkSync(foundPath);
    console.log(`Deleted file: ${foundPath}`);

    return res.status(200).json({
      success: true,
      message: 'File deleted successfully',
      fileFound: true,
      deletedPath: foundPath
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    return res.status(500).json({
      success: false,
      message: `Error deleting file: ${error.message}`
    });
  }
}