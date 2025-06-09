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

// Get all branches with detailed information
app.get('/api/git/branches', async (req, res) => {
  try {
    // Get all branches with their last commit info
    const { stdout: branchList } = await execAsync('git branch -a --format="%(refname:short)|%(committerdate:iso)|%(committername)|%(subject)"');
    
    // Get current branch
    const { stdout: currentBranch } = await execAsync('git branch --show-current');
    const current = currentBranch.trim();
    
    // Get merged branches
    const { stdout: mergedBranches } = await execAsync('git branch --merged');
    const merged = mergedBranches.split('\n').map(b => b.trim().replace('* ', ''));
    
    // Process branch data
    const branches = branchList
      .trim()
      .split('\n')
      .filter(line => line && !line.includes('HEAD'))
      .map(line => {
        const [name, date, author, message] = line.split('|');
        const cleanName = name.replace('remotes/origin/', '');
        const isRemote = name.startsWith('remotes/');
        const isCurrent = cleanName === current;
        const isMerged = merged.includes(cleanName);
        
        return {
          name: cleanName,
          fullName: name,
          isRemote,
          isCurrent,
          isMerged,
          lastCommit: {
            date,
            author,
            message
          }
        };
      });
    
    // Get additional info for local branches
    const localBranches = branches.filter(b => !b.isRemote);
    const enhancedBranches = await Promise.all(localBranches.map(async (branch) => {
      try {
        // Check if branch has upstream
        const { stdout: upstream } = await execAsync(`git rev-parse --abbrev-ref ${branch.name}@{upstream} 2>/dev/null || echo ""`);
        const hasUpstream = upstream.trim() !== '';
        
        // Get ahead/behind if has upstream
        let ahead = 0, behind = 0;
        if (hasUpstream) {
          const { stdout: counts } = await execAsync(`git rev-list --left-right --count ${branch.name}...${branch.name}@{upstream} 2>/dev/null || echo "0\t0"`);
          [ahead, behind] = counts.trim().split('\t').map(n => parseInt(n) || 0);
        }
        
        // Calculate age in days
        const lastCommitDate = new Date(branch.lastCommit.date);
        const ageInDays = Math.floor((Date.now() - lastCommitDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Determine if branch can be deleted safely
        const canDelete = branch.isMerged && !branch.isCurrent && branch.name !== 'main' && branch.name !== 'master' && branch.name !== 'development';
        
        // Suggest cleanup if old and merged, or very old
        const suggestCleanup = (branch.isMerged && ageInDays > 30) || (!branch.isMerged && ageInDays > 90);
        
        return {
          ...branch,
          hasUpstream,
          ahead,
          behind,
          ageInDays,
          canDelete,
          suggestCleanup
        };
      } catch (error) {
        return branch;
      }
    }));
    
    res.json({ 
      branches: enhancedBranches,
      remoteBranches: branches.filter(b => b.isRemote),
      currentBranch: current
    });
  } catch (error) {
    console.error('Failed to get branches:', error);
    res.status(500).json({ 
      error: 'Failed to get branches',
      details: error.message
    });
  }
});

// Delete a branch
app.delete('/api/git/branches/:branchName', async (req, res) => {
  try {
    const { branchName } = req.params;
    const { force = false } = req.body;
    
    // Safety checks
    const protectedBranches = ['main', 'master', 'development', 'production'];
    if (protectedBranches.includes(branchName)) {
      return res.status(400).json({ error: 'Cannot delete protected branch' });
    }
    
    // Check if branch exists
    const { stdout: branchExists } = await execAsync(`git show-ref --verify --quiet refs/heads/${branchName} && echo "exists" || echo "not found"`);
    if (branchExists.trim() === 'not found') {
      return res.status(404).json({ error: 'Branch not found' });
    }
    
    // Delete the branch
    const deleteCommand = force ? `git branch -D ${branchName}` : `git branch -d ${branchName}`;
    const { stdout, stderr } = await execAsync(deleteCommand);
    
    if (stderr && stderr.includes('not fully merged')) {
      return res.status(400).json({ 
        error: 'Branch not fully merged',
        details: 'Use force delete if you are sure you want to delete this branch'
      });
    }
    
    res.json({ 
      success: true,
      message: `Branch ${branchName} deleted successfully`,
      output: stdout
    });
  } catch (error) {
    console.error('Failed to delete branch:', error);
    res.status(500).json({ 
      error: 'Failed to delete branch',
      details: error.message
    });
  }
});

// Cleanup suggested branches
app.post('/api/git/cleanup-branches', async (req, res) => {
  try {
    const { branches = [], dryRun = true } = req.body;
    
    if (!Array.isArray(branches) || branches.length === 0) {
      return res.status(400).json({ error: 'No branches provided for cleanup' });
    }
    
    const results = [];
    
    for (const branchName of branches) {
      try {
        // Skip protected branches
        const protectedBranches = ['main', 'master', 'development', 'production'];
        if (protectedBranches.includes(branchName)) {
          results.push({ branch: branchName, status: 'skipped', reason: 'Protected branch' });
          continue;
        }
        
        if (dryRun) {
          results.push({ branch: branchName, status: 'would-delete', reason: 'Dry run mode' });
        } else {
          const { stdout } = await execAsync(`git branch -d ${branchName}`);
          results.push({ branch: branchName, status: 'deleted', output: stdout.trim() });
        }
      } catch (error) {
        results.push({ branch: branchName, status: 'error', error: error.message });
      }
    }
    
    res.json({ 
      dryRun,
      results,
      summary: {
        total: branches.length,
        deleted: results.filter(r => r.status === 'deleted').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        errors: results.filter(r => r.status === 'error').length
      }
    });
  } catch (error) {
    console.error('Failed to cleanup branches:', error);
    res.status(500).json({ 
      error: 'Failed to cleanup branches',
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

// Get commits for a specific worktree
app.get('/api/git/worktree-commits/:worktreePath', async (req, res) => {
  try {
    const { worktreePath } = req.params;
    const { limit = 50 } = req.query;
    
    // Decode the path (it might be URL encoded)
    const decodedPath = decodeURIComponent(worktreePath);
    
    // Get commit hashes first
    const { stdout: hashesOutput } = await execAsync(
      `cd "${decodedPath}" && git log --format="%H" -${limit}`
    );
    
    const hashes = hashesOutput.trim().split('\n').filter(h => h);
    
    // Get detailed info for each commit
    const commits = await Promise.all(hashes.map(async (hash) => {
      try {
        // Get basic commit info
        const { stdout: commitInfo } = await execAsync(
          `cd "${decodedPath}" && git log --format="%s|%an|%ae|%ar|%ai" -1 ${hash}`
        );
        
        // Get full commit message to extract task ID
        const { stdout: fullMessage } = await execAsync(
          `cd "${decodedPath}" && git log --format="%B" -1 ${hash}`
        );
        
        const [subject, authorName, authorEmail, relativeTime, date] = commitInfo.trim().split('|');
        
        // Extract task ID from full commit message if present
        const taskIdMatch = fullMessage.match(/Task:\s*#([a-f0-9-]+)/i);
        const taskId = taskIdMatch ? taskIdMatch[1] : null;
        
        return {
          hash,
          subject,
          authorName,
          authorEmail,
          relativeTime,
          date,
          taskId
        };
      } catch (error) {
        console.error(`Error processing commit ${hash}:`, error);
        return {
          hash,
          subject: 'Error retrieving commit',
          authorName: 'Unknown',
          authorEmail: '',
          relativeTime: 'Unknown',
          date: '',
          taskId: null
        };
      }
    }));
    
    // Get current branch name
    const { stdout: branchName } = await execAsync(
      `cd "${decodedPath}" && git branch --show-current`
    );
    
    res.json({ 
      worktreePath: decodedPath,
      branch: branchName.trim(),
      commits,
      totalCommits: commits.length
    });
    
  } catch (error) {
    console.error('Failed to get worktree commits:', error);
    res.status(500).json({ 
      error: 'Failed to get worktree commits',
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Git server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET    /api/git/worktrees      - Get list of git worktrees with status');
  console.log('  GET    /api/git/worktree-commits/:path - Get commits for a specific worktree');
  console.log('  GET    /api/git/branches       - Get all branches with detailed info');
  console.log('  DELETE /api/git/branches/:name - Delete a specific branch');
  console.log('  POST   /api/git/cleanup-branches - Cleanup multiple branches');
  console.log('  POST   /api/git/execute        - Execute whitelisted git commands');
});