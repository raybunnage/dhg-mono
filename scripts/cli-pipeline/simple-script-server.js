// Ultra simple script file server
// Node.js ES Modules version
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// Configuration
const PORT = 3002;
const ARCHIVED_SCRIPTS_FOLDER = '.archived_scripts';

// Get directory name (ES modules compatible)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Server
const server = http.createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  console.log(`Request: ${req.url}`);
  
  // Parse URL and query
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;
  
  console.log(`Parsed pathname: "${pathname}"`); // Debug log
  
  if (pathname === '/api/script-file') {
    const filePath = url.searchParams.get('path');
    
    if (!filePath) {
      sendJson(res, 400, { error: 'File path required' });
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
    
    // Try to find the file
    for (const tryPath of possiblePaths) {
      try {
        if (fs.existsSync(tryPath)) {
          const content = fs.readFileSync(tryPath, 'utf8');
          const fileName = path.basename(tryPath);
          const stats = fs.statSync(tryPath);
          
          console.log(`Found file: ${tryPath}`);
          
          sendJson(res, 200, {
            file_path: normalizedPath,
            title: fileName,
            content,
            size: stats.size,
            created_at: stats.birthtime,
            updated_at: stats.mtime
          });
          return;
        }
      } catch (error) {
        console.error(`Error reading ${tryPath}:`, error);
      }
    }
    
    // File not found
    sendJson(res, 404, { 
      error: 'File not found',
      file_path: normalizedPath,
      tried_paths: possiblePaths 
    });
  }
  else if (pathname === '/api/script-files') {
    // List all script files
    try {
      const projectRoot = path.join(__dirname, '..', '..');
      // Exclude .archived_scripts folders regardless of where they are in the path
      const cmd = `find ${projectRoot}/scripts -name "*.sh" -o -name "*.js" -o -name "*.ts" -o -name "*.py" -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.archived_scripts/*" -not -path "*/\\.archived_scripts/*" | head -100`;
      
      const output = execSync(cmd, { encoding: 'utf8' }).trim();
      const files = output.split('\n').filter(Boolean);
      
      // Normalize paths
      const relativePaths = files.map(f => f.replace(projectRoot + '/', ''));
      
      sendJson(res, 200, {
        total: relativePaths.length,
        files: relativePaths
      });
    } catch (error) {
      console.error('Error finding files:', error);
      sendJson(res, 500, { error: 'Server error' });
    }
  }
  // Handle DELETE request for script file
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
  else if (pathname === '/api/script-file' && req.method === 'DELETE') {
    const filePath = url.searchParams.get('path');
    
    if (!filePath) {
      sendJson(res, 400, { error: 'File path required' });
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
    
    // Try to find and delete the file
    let fileFound = false;
    for (const tryPath of possiblePaths) {
      try {
        if (fs.existsSync(tryPath)) {
          fileFound = true;
          console.log(`Deleting file: ${tryPath}`);
          
          try {
            // Delete the file
            fs.unlinkSync(tryPath);
            
            sendJson(res, 200, {
              success: true,
              message: `File ${normalizedPath} deleted successfully`,
              file_path: normalizedPath
            });
            return;
          } catch (unlinkError) {
            console.error(`Error unlinking ${tryPath}:`, unlinkError);
            // Send a 500 error specifically for the deletion failure
            sendJson(res, 500, { 
              error: `Failed to delete file: ${unlinkError.message}`,
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
      // Return success anyway to avoid error toast when file is already gone
      sendJson(res, 200, {
        success: true,
        message: `File ${normalizedPath} was already deleted or not found`,
        file_path: normalizedPath
      });
    }
  }
  else {
    // Unknown endpoint
    sendJson(res, 404, { error: 'Endpoint not found' });
  }
});

// Helper to send JSON responses
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Helper to read JSON request body
function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    
    req.on('data', chunk => {
      chunks.push(chunk);
    });
    
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString();
        const jsonBody = body ? JSON.parse(body) : {};
        resolve(jsonBody);
      } catch (error) {
        reject(error);
      }
    });
    
    req.on('error', reject);
  });
}

// Start server
server.listen(PORT, () => {
  console.log(`Simple Script Server running at http://localhost:${PORT}`);
  console.log(`Try: http://localhost:${PORT}/api/script-file?path=scripts/run-with-supabase.sh`);
});