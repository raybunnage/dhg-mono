#!/usr/bin/env node

import http from 'http';
import path from 'path';
import { exec, execSync } from 'child_process';
import os from 'os';
import fs from 'fs';

const PORT = process.env.WORKTREE_SWITCHER_PORT || 3010;

// Get all git worktrees
function getWorktrees() {
  try {
    const output = execSync('git worktree list --porcelain', { encoding: 'utf8' });
    const worktrees = [];
    let current = {};
    
    output.split('\n').forEach(line => {
      if (line.startsWith('worktree ')) {
        if (current.path) worktrees.push(current);
        current = { path: line.substring(9) };
      } else if (line.startsWith('HEAD ')) {
        current.head = line.substring(5);
      } else if (line.startsWith('branch ')) {
        current.branch = line.substring(7);
      } else if (line === 'detached') {
        current.detached = true;
      }
    });
    
    if (current.path) worktrees.push(current);
    
    // Get additional info for each worktree
    return worktrees.map(wt => {
      const name = path.basename(wt.path);
      const isActive = wt.path === process.cwd();
      
      // Check if Cursor/VS Code is running for this worktree
      let cursorPid = null;
      try {
        if (os.platform() === 'darwin') {
          // macOS: Check for Cursor processes with this path
          const psOutput = execSync(`ps aux | grep -i cursor | grep "${wt.path}" | grep -v grep`, { encoding: 'utf8' });
          if (psOutput) {
            cursorPid = psOutput.trim().split(/\s+/)[1];
          }
        }
      } catch (e) {
        // No process found
      }
      
      // Check for Peacock configuration
      let peacockColor = null;
      let hasPeacock = false;
      try {
        const settingsPath = path.join(wt.path, '.vscode', 'settings.json');
        if (fs.existsSync(settingsPath)) {
          const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
          if (settings['peacock.color']) {
            peacockColor = settings['peacock.color'];
            hasPeacock = true;
          }
        }
      } catch (e) {
        // No settings or error reading
      }
      
      return {
        ...wt,
        name,
        isActive,
        hasCursor: !!cursorPid,
        cursorPid,
        hasPeacock,
        peacockColor
      };
    });
  } catch (error) {
    console.error('Error getting worktrees:', error);
    return [];
  }
}

// Open or focus a worktree in Cursor
function openInCursor(worktreePath, callback) {
  const command = os.platform() === 'darwin' 
    ? `open -a "Cursor" "${worktreePath}"`
    : os.platform() === 'win32'
    ? `code "${worktreePath}"`
    : `cursor "${worktreePath}"`;
    
  exec(command, (error, stdout, stderr) => {
    if (error) {
      callback(error);
    } else {
      callback(null, { success: true, message: `Opened ${worktreePath} in Cursor` });
    }
  });
}

// HTML template for the switcher UI
function getHTML(worktrees) {
  const worktreeButtons = worktrees.map((wt, index) => {
    // Use Peacock color if available, otherwise default colors
    const defaultColor = wt.branch?.includes('main') ? '#42b883' :
                        wt.branch?.includes('development') ? '#007ACC' :
                        wt.branch?.includes('improve-cli-pipelines') ? '#832561' :
                        wt.branch?.includes('feature') ? '#fd9827' :
                        wt.branch?.includes('fix') || wt.branch?.includes('bug') ? '#dd5145' :
                        '#fbc02d';
    
    const color = wt.peacockColor || defaultColor;
    const icon = wt.isActive ? '📍' : wt.hasCursor ? '🖥️' : '📁';
    const hotkey = index < 9 ? `(${index + 1})` : '';
    
    return `
      <div class="worktree-card" data-path="${wt.path}" style="border-color: ${color};">
        <div class="worktree-header" style="background-color: ${color};">
          <span class="worktree-icon">${icon}</span>
          <span class="worktree-name">${wt.name}</span>
          <span class="hotkey">${hotkey}</span>
        </div>
        <div class="worktree-info">
          <div class="branch-name">${wt.branch || 'detached'}</div>
          <div class="worktree-path">${wt.path}</div>
          ${wt.isActive ? '<div class="status active">Current</div>' : ''}
          ${wt.hasCursor ? '<div class="status cursor-open">Cursor Open</div>' : ''}
          ${wt.hasPeacock ? '<div class="status peacock">🦚 Peacock</div>' : '<div class="status no-peacock">⚠️ No Peacock</div>'}
        </div>
      </div>
    `;
  }).join('');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Worktree Switcher</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #1e1e1e;
          color: #d4d4d4;
          padding: 20px;
          min-height: 100vh;
        }
        
        .container {
          max-width: 1200px;
          margin: 0 auto;
        }
        
        h1 {
          text-align: center;
          margin-bottom: 30px;
          color: #fff;
          font-weight: 300;
          font-size: 2.5em;
        }
        
        .worktrees-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
          margin-bottom: 40px;
        }
        
        .worktree-card {
          background: #252526;
          border: 2px solid;
          border-radius: 8px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .worktree-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 5px 20px rgba(0,0,0,0.5);
        }
        
        .worktree-header {
          padding: 15px;
          color: white;
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 500;
        }
        
        .worktree-icon {
          font-size: 1.2em;
        }
        
        .worktree-name {
          flex: 1;
          font-size: 1.1em;
        }
        
        .hotkey {
          opacity: 0.7;
          font-size: 0.9em;
        }
        
        .worktree-info {
          padding: 15px;
        }
        
        .branch-name {
          font-size: 1.1em;
          margin-bottom: 8px;
          color: #fff;
        }
        
        .worktree-path {
          font-size: 0.85em;
          color: #888;
          margin-bottom: 10px;
          word-break: break-all;
        }
        
        .status {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 0.8em;
          margin-right: 8px;
        }
        
        .status.active {
          background: #28a745;
          color: white;
        }
        
        .status.cursor-open {
          background: #007ACC;
          color: white;
        }
        
        .status.peacock {
          background: #28a745;
          color: white;
        }
        
        .status.no-peacock {
          background: #ffc107;
          color: #000;
        }
        
        .shortcuts {
          background: #2d2d30;
          padding: 20px;
          border-radius: 8px;
          margin-top: 40px;
        }
        
        .shortcuts h2 {
          margin-bottom: 15px;
          color: #fff;
        }
        
        .shortcut-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 10px;
        }
        
        .shortcut-item {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .key {
          background: #1e1e1e;
          padding: 4px 8px;
          border-radius: 4px;
          font-family: monospace;
          min-width: 30px;
          text-align: center;
        }
        
        .loading {
          text-align: center;
          padding: 40px;
          font-size: 1.2em;
        }
        
        .error {
          background: #f44336;
          color: white;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🌳 Worktree Switcher</h1>
        
        <div class="worktrees-grid">
          ${worktreeButtons}
        </div>
        
        <div class="shortcuts">
          <h2>⌨️ Keyboard Shortcuts</h2>
          <div class="shortcut-list">
            <div class="shortcut-item">
              <span class="key">1-9</span>
              <span>Open worktree by number</span>
            </div>
            <div class="shortcut-item">
              <span class="key">R</span>
              <span>Refresh list</span>
            </div>
            <div class="shortcut-item">
              <span class="key">?</span>
              <span>Show help</span>
            </div>
          </div>
        </div>
      </div>
      
      <script>
        // Handle keyboard shortcuts
        document.addEventListener('keypress', (e) => {
          const key = e.key;
          
          if (key >= '1' && key <= '9') {
            const index = parseInt(key) - 1;
            const cards = document.querySelectorAll('.worktree-card');
            if (cards[index]) {
              cards[index].click();
            }
          } else if (key === 'r' || key === 'R') {
            location.reload();
          }
        });
        
        // Handle clicks
        document.querySelectorAll('.worktree-card').forEach(card => {
          card.addEventListener('click', () => {
            const path = card.dataset.path;
            card.style.opacity = '0.5';
            
            fetch('/open', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path })
            })
            .then(res => res.json())
            .then(data => {
              if (data.success) {
                // Brief visual feedback
                card.style.borderColor = '#4CAF50';
                setTimeout(() => {
                  card.style.opacity = '1';
                }, 500);
              } else {
                card.style.opacity = '1';
                alert('Failed to open worktree: ' + (data.error || 'Unknown error'));
              }
            })
            .catch(err => {
              card.style.opacity = '1';
              alert('Error: ' + err.message);
            });
          });
        });
        
        // Auto-refresh every 5 seconds to update status
        setInterval(() => {
          fetch('/worktrees')
            .then(res => res.json())
            .then(data => {
              if (data.worktrees) {
                // Could update the UI here without full reload
                // For now, keeping it simple
              }
            });
        }, 5000);
      </script>
    </body>
    </html>
  `;
}

// Create the server
const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  if (req.url === '/' && req.method === 'GET') {
    // Serve the UI
    const worktrees = getWorktrees();
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(getHTML(worktrees));
    
  } else if (req.url === '/worktrees' && req.method === 'GET') {
    // API endpoint to get worktrees
    const worktrees = getWorktrees();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ worktrees }));
    
  } else if (req.url === '/open' && req.method === 'POST') {
    // API endpoint to open a worktree
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { path: worktreePath } = JSON.parse(body);
        openInCursor(worktreePath, (error, result) => {
          if (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          }
        });
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request' }));
      }
    });
    
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

// Start the server
server.listen(PORT, () => {
  console.log(`🌳 Worktree Switcher Server running at http://localhost:${PORT}`);
  console.log(`   Open in browser to switch between worktrees`);
  console.log(`   Press Ctrl+C to stop\n`);
});