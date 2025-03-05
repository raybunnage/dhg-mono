// Ultra simple markdown file server
// Node.js v12+ compatible - uses only core modules
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const PORT = 3001;

// Server
const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
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
  
  if (pathname === '/api/markdown-file') {
    const filePath = url.searchParams.get('path');
    
    if (!filePath) {
      sendJson(res, 400, { error: 'File path required' });
      return;
    }
    
    // Security check
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.endsWith('.md') && !normalizedPath.endsWith('.mdx')) {
      sendJson(res, 400, { error: 'Only markdown files allowed' });
      return;
    }
    
    // Project root
    const projectRoot = __dirname;
    
    // Try multiple locations
    const possiblePaths = [
      path.join(projectRoot, normalizedPath),
      path.join(projectRoot, '..', normalizedPath),
      path.join(projectRoot, '..', '..', normalizedPath),
    ];
    
    // Try to find the file
    for (const tryPath of possiblePaths) {
      try {
        if (fs.existsSync(tryPath)) {
          const content = fs.readFileSync(tryPath, 'utf8');
          const fileName = path.basename(tryPath);
          
          console.log(`Found file: ${tryPath}`);
          
          sendJson(res, 200, {
            file_path: normalizedPath,
            title: fileName.replace(/\.md[x]?$/, ''),
            content
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
  else if (pathname === '/api/markdown-files') {
    // List all markdown files
    try {
      const projectRoot = __dirname;
      const cmd = `find ${projectRoot}/.. -name "*.md" -type f -not -path "*/node_modules/*" -not -path "*/.git/*" | head -20`;
      
      const output = execSync(cmd, { encoding: 'utf8' }).trim();
      const files = output.split('\n').filter(Boolean);
      
      // Normalize paths
      const relativePaths = files.map(f => f.replace(projectRoot, '').replace(/^\/+/, ''));
      
      sendJson(res, 200, {
        total: relativePaths.length,
        files: relativePaths
      });
    } catch (error) {
      console.error('Error finding files:', error);
      sendJson(res, 500, { error: 'Server error' });
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

// Start server
server.listen(PORT, () => {
  console.log(`Simple Markdown Server running at http://localhost:${PORT}`);
  console.log(`Try: http://localhost:${PORT}/api/markdown-file?path=README.md`);
});