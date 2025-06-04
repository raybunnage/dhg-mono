const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.GIT_SERVER_PORT || 3005; // Dedicated port for git server

// Enable CORS for the Vite dev server
app.use(cors({
  origin: ['http://localhost:5177', 'http://localhost:5173'],
  credentials: true
}));

app.use(express.json());

// Get worktrees endpoint with enhanced info
app.get('/api/git/worktrees', async (req, res) => {
  try {
    const { stdout, stderr } = await execAsync('git worktree list');
    
    if (stderr) {
      console.error('Git worktree error:', stderr);
    }

    // Parse the output
    const worktrees = stdout
      .trim()
      .split('\n')
      .map(line => {
        // Parse format: /path/to/worktree  commit-hash [branch-name]
        const match = line.match(/^(.+?)\s+([a-f0-9]+)\s+\[(.+?)\]$/);
        if (match) {
          return {
            path: match[1].trim(),
            commit: match[2].trim(),
            branch: match[3].trim()
          };
        }
        return null;
      })
      .filter(Boolean);

    // Enhance with additional info for each worktree
    const enhancedWorktrees = await Promise.all(worktrees.map(async (wt) => {
      try {
        // Get last commit info
        const { stdout: lastCommit } = await execAsync(
          `cd "${wt.path}" && git log -1 --format="%h|%s|%ar|%an" 2>/dev/null || echo ""`
        );
        
        const [commitHash, message, relativeTime, author] = lastCommit.trim().split('|');
        
        // Check for uncommitted changes
        const { stdout: statusOutput } = await execAsync(
          `cd "${wt.path}" && git status --porcelain 2>/dev/null | wc -l || echo "0"`
        );
        
        const uncommittedChanges = parseInt(statusOutput.trim()) || 0;
        
        // Check if branch is ahead/behind
        const { stdout: branchStatus } = await execAsync(
          `cd "${wt.path}" && git rev-list --left-right --count HEAD...@{u} 2>/dev/null || echo "0\t0"`
        );
        
        const [ahead, behind] = branchStatus.trim().split('\t').map(n => parseInt(n) || 0);
        
        return {
          ...wt,
          lastCommit: commitHash ? {
            hash: commitHash,
            message,
            relativeTime,
            author
          } : null,
          uncommittedChanges,
          ahead,
          behind,
          needsAttention: uncommittedChanges > 0 || ahead > 0 || behind > 0
        };
      } catch (error) {
        console.error(`Error getting info for worktree ${wt.path}:`, error);
        return wt; // Return basic info if enhanced info fails
      }
    }));

    res.json({ worktrees: enhancedWorktrees });
  } catch (error) {
    console.error('Failed to get worktrees:', error);
    res.status(500).json({ 
      error: 'Failed to get worktrees',
      details: error.message
    });
  }
});

// Execute git command endpoint (for future use)
app.post('/api/git/execute', async (req, res) => {
  const { command } = req.body;
  
  // Whitelist of allowed git commands for safety
  const allowedCommands = [
    'git status',
    'git branch',
    'git log --oneline -10',
    'git remote -v',
    'git worktree list'
  ];
  
  if (!allowedCommands.some(allowed => command.startsWith(allowed))) {
    return res.status(403).json({ error: 'Command not allowed' });
  }

  try {
    const { stdout, stderr } = await execAsync(command);
    res.json({ stdout, stderr });
  } catch (error) {
    res.status(500).json({ 
      error: 'Command failed',
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Git server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET  /api/git/worktrees - Get list of git worktrees');
  console.log('  POST /api/git/execute   - Execute whitelisted git commands');
});