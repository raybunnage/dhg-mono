const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.GIT_API_PORT || 3009;

app.use(cors());
app.use(express.json());

// Get all branches with detailed information
app.get('/api/git/branches', async (req, res) => {
  try {
    const branches = await getAllBranches();
    res.json({ success: true, data: branches });
  } catch (error) {
    console.error('Error getting branches:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a branch
app.delete('/api/git/branches/:branchName', async (req, res) => {
  try {
    const { branchName } = req.params;
    const { force } = req.query;
    
    const flag = force === 'true' ? '-D' : '-d';
    await execAsync(`git branch ${flag} ${branchName}`);
    
    // Try to delete remote branch
    try {
      await execAsync(`git push origin --delete ${branchName}`);
    } catch {
      // Remote branch might not exist
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting branch:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Prune worktrees
app.post('/api/git/worktrees/prune', async (req, res) => {
  try {
    await execAsync('git worktree prune');
    res.json({ success: true });
  } catch (error) {
    console.error('Error pruning worktrees:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Execute CLI command endpoint
app.post('/api/execute-command', async (req, res) => {
  try {
    const { command, args = [] } = req.body;
    
    // Security: Only allow specific whitelisted commands
    const allowedCommands = [
      './scripts/cli-pipeline/continuous_docs/continuous-docs-cli.sh'
    ];
    
    if (!allowedCommands.includes(command)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Command not allowed' 
      });
    }
    
    // Join command and args
    const fullCommand = `${command} ${args.join(' ')}`;
    console.log('Executing command:', fullCommand);
    
    // Execute with a timeout of 30 seconds
    const { stdout, stderr } = await execAsync(fullCommand, {
      timeout: 30000,
      cwd: process.cwd()
    });
    
    res.json({ 
      success: true, 
      stdout: stdout.trim(), 
      stderr: stderr.trim() 
    });
  } catch (error) {
    console.error('Error executing command:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stdout: error.stdout?.trim(),
      stderr: error.stderr?.trim()
    });
  }
});

async function getAllBranches() {
  try {
    // Get all branches (local and remote)
    const { stdout: branchList } = await execAsync('git branch -a --format="%(refname:short)|%(HEAD)"');
    const branches = branchList.trim().split('\n').map(line => {
      const [name, isCurrent] = line.split('|');
      return {
        name: name.replace('origin/', ''),
        current: isCurrent === '*',
        remote: name.startsWith('origin/')
      };
    });

    // Get worktree information
    const worktrees = await getWorktrees();
    
    // Get detailed information for each branch
    const detailedBranches = await Promise.all(
      branches.map(async (branch) => {
        const details = await getBranchDetails(branch.name);
        const worktree = worktrees.find(w => w.branch === branch.name);
        const mergeStatus = await getMergeStatus(branch.name);
        const safety = await analyzeBranchSafety(branch.name, worktree, mergeStatus);

        return {
          ...branch,
          ...details,
          worktree: worktree ? {
            path: worktree.path,
            locked: worktree.locked
          } : undefined,
          mergeStatus,
          safety
        };
      })
    );

    // Remove duplicates
    const uniqueBranches = deduplicateBranches(detailedBranches);
    
    return uniqueBranches;
  } catch (error) {
    console.error('Error getting branches:', error);
    throw error;
  }
}

async function getWorktrees() {
  try {
    const { stdout } = await execAsync('git worktree list --porcelain');
    const worktrees = [];
    
    const lines = stdout.trim().split('\n');
    let currentWorktree = {};
    
    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        if (currentWorktree.path) {
          worktrees.push(currentWorktree);
        }
        currentWorktree = { path: line.substring(9) };
      } else if (line.startsWith('HEAD ')) {
        currentWorktree.commit = line.substring(5);
      } else if (line.startsWith('branch ')) {
        currentWorktree.branch = line.substring(7).replace('refs/heads/', '');
      } else if (line === 'locked') {
        currentWorktree.locked = true;
      } else if (line === 'prunable') {
        currentWorktree.prunable = true;
      }
    }
    
    if (currentWorktree.path) {
      worktrees.push(currentWorktree);
    }
    
    return worktrees;
  } catch (error) {
    console.error('Error getting worktrees:', error);
    return [];
  }
}

async function getBranchDetails(branchName) {
  try {
    const { stdout } = await execAsync(
      `git log -1 --format="%H|%ai|%an|%s" ${branchName} 2>/dev/null || echo ""`
    );
    
    if (!stdout.trim()) {
      return {
        lastCommit: {
          hash: '',
          date: '',
          author: '',
          message: 'No commits'
        }
      };
    }

    const [hash, date, author, message] = stdout.trim().split('|');
    
    return {
      lastCommit: {
        hash: hash || '',
        date: date || '',
        author: author || '',
        message: message || ''
      }
    };
  } catch (error) {
    return {
      lastCommit: {
        hash: '',
        date: '',
        author: '',
        message: 'Error getting commit info'
      }
    };
  }
}

async function getMergeStatus(branchName) {
  try {
    const mainBranches = ['main', 'master', 'development'];
    const mergedInto = [];
    
    for (const mainBranch of mainBranches) {
      try {
        const { stdout } = await execAsync(
          `git branch --merged ${mainBranch} 2>/dev/null | grep -w "${branchName}" || echo ""`
        );
        if (stdout.trim()) {
          mergedInto.push(mainBranch);
        }
      } catch {
        // Branch doesn't exist or other error
      }
    }

    // Count unmerged commits
    let unmergedCommits = 0;
    if (mergedInto.length === 0) {
      try {
        const { stdout } = await execAsync(
          `git rev-list --count ${branchName} ^development 2>/dev/null || echo "0"`
        );
        unmergedCommits = parseInt(stdout.trim()) || 0;
      } catch {
        unmergedCommits = 0;
      }
    }

    return {
      merged: mergedInto.length > 0,
      mergedInto: mergedInto.length > 0 ? mergedInto : undefined,
      unmergedCommits
    };
  } catch (error) {
    return {
      merged: false,
      unmergedCommits: 0
    };
  }
}

async function analyzeBranchSafety(branchName, worktree, mergeStatus) {
  const reasons = [];
  let canDelete = true;

  // Don't delete current branch
  try {
    const { stdout } = await execAsync('git branch --show-current');
    if (stdout.trim() === branchName) {
      canDelete = false;
      reasons.push('Currently checked out branch');
    }
  } catch {}

  // Don't delete if in worktree
  if (worktree) {
    canDelete = false;
    reasons.push(`Active in worktree at ${worktree.path}`);
  }

  // Warn about unmerged commits
  if (!mergeStatus.merged && mergeStatus.unmergedCommits > 0) {
    canDelete = false;
    reasons.push(`Has ${mergeStatus.unmergedCommits} unmerged commits`);
  }

  // Don't delete protected branches
  const protectedBranches = ['main', 'master', 'development', 'staging', 'production'];
  if (protectedBranches.includes(branchName)) {
    canDelete = false;
    reasons.push('Protected branch');
  }

  if (canDelete && reasons.length === 0) {
    reasons.push('Safe to delete');
  }

  return {
    canDelete,
    reasons
  };
}

function deduplicateBranches(branches) {
  const seen = new Set();
  return branches.filter(branch => {
    const cleanName = branch.name.replace('origin/', '');
    if (seen.has(cleanName)) {
      return false;
    }
    seen.add(cleanName);
    return true;
  });
}

app.listen(PORT, () => {
  console.log(`Git API server running on http://localhost:${PORT}`);
});