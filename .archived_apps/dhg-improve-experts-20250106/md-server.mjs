/**
 * Simple Express server for local markdown file serving (ES Module version)
 * 
 * This server is ONLY for development environments and reads markdown files directly from disk.
 * Run with: node md-server.mjs
 */

// Use native Node.js modules only - no external dependencies
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import http from 'http';

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const PORT = 3001; // Different port than your main app

// Create a simple HTTP server with Node.js native modules
const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);
  
  // Enable CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  
  // Parse the URL
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;
  
  // Log request details
  console.log(`Request: ${pathname}, Query: ${url.search}`);
  
  // API router - handle different endpoints
  if (pathname === '/api/markdown-file') {
    handleMarkdownFile(req, res, url);
  } else if (pathname === '/api/markdown-files') {
    handleMarkdownFiles(req, res);
  } else if (pathname.startsWith('/api/markdown-id/')) {
    const id = pathname.split('/api/markdown-id/')[1];
    handleMarkdownById(req, res, id);
  } else {
    // Not found
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  }
});

// Handler for getting markdown content by file path
function handleMarkdownFile(req, res, url) {
  // Get query parameters
  const filePath = url.searchParams.get('path');
  
  if (!filePath) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'File path is required' }));
    return;
  }
  
  // Normalize the path to prevent traversal attacks
  const normalizedPath = path.normalize(filePath);
  
  // Only allow markdown files
  if (!normalizedPath.endsWith('.md') && !normalizedPath.endsWith('.mdx')) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Only markdown files are allowed' }));
    return;
  }
  
  // Get the repo root (current directory)
  const repoRoot = __dirname;
  
  // Try several possible locations for the file
  const possiblePaths = [
    // Direct path from repo root
    path.join(repoRoot, normalizedPath),
    
    // Path from parent directory
    path.join(repoRoot, '..', normalizedPath),
    
    // Path from grandparent directory (monorepo root)
    path.join(repoRoot, '..', '..', normalizedPath),
    
    // Try with /docs/ prefix if it doesn't have one
    !normalizedPath.includes('/docs/') 
      ? path.join(repoRoot, 'docs', normalizedPath)
      : null,
      
    // Try without /docs/ prefix if it has one
    normalizedPath.includes('/docs/') 
      ? path.join(repoRoot, normalizedPath.replace('/docs/', '/'))
      : null
  ].filter(Boolean);
  
  // Try each possible path
  for (const tryPath of possiblePaths) {
    try {
      if (fs.existsSync(tryPath)) {
        const content = fs.readFileSync(tryPath, 'utf8');
        const fileName = path.basename(tryPath);
        
        console.log(`Successfully read file: ${tryPath}`);
        
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          file_path: normalizedPath,
          title: fileName.replace(/\.md[x]?$/, ''),
          content
        }));
        return;
      }
    } catch (error) {
      console.error(`Error reading file at ${tryPath}:`, error);
    }
  }
  
  // If we get here, the file wasn't found
  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ 
    error: 'File not found', 
    file_path: normalizedPath,
    tried_paths: possiblePaths.map(p => p.toString())
  }));
}

// Handler for getting markdown by ID
function handleMarkdownById(req, res, id) {
  if (!id) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'ID is required' }));
    return;
  }
  
  console.log(`Requested markdown file with ID: ${id}`);
  
  try {
    // Get the repo root (current directory)
    const repoRoot = __dirname;
    
    // Fallback: Try to find markdown files with filename containing the ID
    // This isn't reliable but works as a fallback for some use cases
    const searchCmd = `find ${repoRoot}/.. -name "*.md" -type f -not -path "*/node_modules/*" -not -path "*/.git/*" | grep -i ${id} | head -1`;
    
    try {
      const foundFile = execSync(searchCmd, { encoding: 'utf8' }).trim();
      
      if (foundFile) {
        const relativePath = foundFile.replace(repoRoot, '').replace(/^\/+/, '');
        
        // Redirect to the markdown-file endpoint
        res.statusCode = 302;
        res.setHeader('Location', `/api/markdown-file?path=${encodeURIComponent(relativePath)}`);
        res.end();
        return;
      }
    } catch (searchError) {
      console.error('Error searching for files by ID:', searchError);
    }
    
    // If we get here, the file wasn't found
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Document not found' }));
  } catch (error) {
    console.error('Error handling markdown ID request:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Server error' }));
  }
}

// Handler for getting all markdown files
function handleMarkdownFiles(req, res) {
  const repoRoot = __dirname;
  
  try {
    // Run find command to locate all markdown files
    const cmd = `find ${repoRoot}/.. -name "*.md" -type f -not -path "*/node_modules/*" -not -path "*/.git/*" | sort`;
    
    const output = execSync(cmd, { encoding: 'utf8' }).trim();
    const files = output.split('\n').filter(Boolean);
    
    // Convert to relative paths
    const relativePaths = files.map(file => {
      // Try to make path relative to repo root
      if (file.startsWith(repoRoot)) {
        return file.substring(repoRoot.length + 1);
      }
      return file;
    });
    
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      total: relativePaths.length,
      files: relativePaths
    }));
  } catch (error) {
    console.error('Error finding markdown files:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Failed to find markdown files' }));
  }
}

// Start the server
server.listen(PORT, () => {
  console.log(`Markdown file server running at http://localhost:${PORT}`);
  console.log(`Test endpoint: http://localhost:${PORT}/api/markdown-file?path=README.md`);
});