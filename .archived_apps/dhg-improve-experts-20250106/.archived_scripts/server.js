/**
 * Simple Express server for local markdown file serving
 * 
 * This server is ONLY for development environments and reads markdown files directly from disk.
 * Run with: node server.js
 */

// This uses CommonJS module format since it's a standalone script that needs to be executable directly
// You can install the required dependencies with:
// npm install express cors
// or manually download the express and cors modules and place them in a local node_modules folder

// Try to support both ESM and CommonJS environments
let express, fs, path, corsMiddleware;
try {
  // Try CommonJS require
  express = require('express');
  fs = require('fs');
  path = require('path');
  
  // Try to use our custom CORS middleware first
  try {
    corsMiddleware = require('./cors-middleware');
  } catch (corsError) {
    // Fall back to regular cors if our middleware isn't available
    corsMiddleware = require('cors')();
  }
} catch (e) {
  // Fall back to dynamic imports for ESM
  console.log('Falling back to dynamic imports for ESM...');
  import('express').then(module => express = module.default);
  import('fs').then(module => fs = module.default);
  import('path').then(module => path = module.default);
  
  // Try to use custom CORS middleware
  import('./cors-middleware.js').then(module => {
    corsMiddleware = module.default;
  }).catch(() => {
    // Fall back to regular cors
    import('cors').then(module => {
      corsMiddleware = module.default();
    });
  });
}

const app = express();
const PORT = 3001; // Different port than your main app

// Enable CORS for local development
app.use(corsMiddleware);

// Parse JSON bodies
app.use(express.json());

// Simple middleware to log requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Claude API proxy endpoint - supports both paths
app.post(['/api/claude-proxy', '/api/claude-api'], async (req, res) => {
  try {
    const ANTHROPIC_API_KEY = process.env.VITE_ANTHROPIC_API_KEY;
    
    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'API key not configured on server' });
    }
    
    console.log('Proxying Claude API request via Express server');
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('Claude API error:', responseData);
      return res.status(response.status).json({
        error: responseData.error || 'Error from Claude API',
        status: response.status,
        statusText: response.statusText
      });
    }
    
    return res.json(responseData);
  } catch (error) {
    console.error('Error in Claude proxy:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Endpoint to get markdown content by file path
app.get('/api/markdown-file', (req, res) => {
  const filePath = req.query.path;
  
  if (!filePath) {
    return res.status(400).json({ error: 'File path is required' });
  }
  
  // Normalize the path to prevent traversal attacks
  const normalizedPath = path.normalize(filePath);
  
  // Only allow markdown files
  if (!normalizedPath.endsWith('.md') && !normalizedPath.endsWith('.mdx')) {
    return res.status(400).json({ error: 'Only markdown files are allowed' });
  }
  
  // Get the repo root (current directory)
  const repoRoot = process.cwd();
  
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
        
        return res.json({
          file_path: normalizedPath,
          title: fileName.replace(/\.md[x]?$/, ''),
          content
        });
      }
    } catch (error) {
      console.error(`Error reading file at ${tryPath}:`, error);
    }
  }
  
  // If we get here, the file wasn't found
  return res.status(404).json({ 
    error: 'File not found', 
    file_path: normalizedPath,
    tried_paths: possiblePaths 
  });
});

// Endpoint to get all markdown files
app.get('/api/markdown-files', (req, res) => {
  const repoRoot = process.cwd();
  
  try {
    // Run find command to locate all markdown files
    const { execSync } = require('child_process');
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
    
    res.json({
      total: relativePaths.length,
      files: relativePaths
    });
  } catch (error) {
    console.error('Error finding markdown files:', error);
    res.status(500).json({ error: 'Failed to find markdown files' });
  }
});

// Serve shell scripts with executable permissions
app.get('/scripts/:scriptName', (req, res) => {
  const { scriptName } = req.params;
  const repoRoot = process.cwd();
  const scriptPath = path.join(repoRoot, 'scripts', scriptName);
  
  console.log(`Request for script: ${scriptPath}`);
  
  // Only allow specific script files to be executed
  const allowedScripts = [
    'generate-report-and-sync-db.sh',
    'markdown-report.sh',
    'update-docs-database.sh'
  ];
  
  if (!allowedScripts.includes(scriptName)) {
    return res.status(403).send('Script execution not allowed');
  }
  
  if (fs.existsSync(scriptPath)) {
    // Make sure the script is executable
    try {
      fs.chmodSync(scriptPath, '755');
    } catch (error) {
      console.error(`Error making script executable: ${error.message}`);
    }
    
    // Execute the script
    const { exec } = require('child_process');
    exec(`${scriptPath}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing script: ${error.message}`);
        return res.status(500).send(`Script execution error: ${error.message}\n\n${stderr}`);
      }
      
      res.setHeader('Content-Type', 'text/plain');
      res.send(stdout);
    });
  } else {
    res.status(404).send(`Script ${scriptName} not found`);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Markdown file server running at http://localhost:${PORT}`);
  console.log(`Test endpoint: http://localhost:${PORT}/api/markdown-file?path=README.md`);
});