// Mapping between clist aliases and actual worktree paths
export const worktreeAliasMapping = {
  // c1/cdev → 🟢 Development
  'c1': '/Users/raybunnage/Documents/github/dhg-mono',
  'cdev': '/Users/raybunnage/Documents/github/dhg-mono',
  
  // c2/cadmin → 🔵 Admin Code
  'c2': '/Users/raybunnage/Documents/github/dhg-mono-admin-code',
  'cadmin': '/Users/raybunnage/Documents/github/dhg-mono-admin-code',
  
  // c3/chub → 🟣 Hub
  'c3': '/Users/raybunnage/Documents/github/dhg-mono-dhg-hub',
  'chub': '/Users/raybunnage/Documents/github/dhg-mono-dhg-hub',
  
  // c4/cdocs → 🟠 Docs
  'c4': '/Users/raybunnage/Documents/github/dhg-mono-feature/dhg-mono-docs',
  'cdocs': '/Users/raybunnage/Documents/github/dhg-mono-feature/dhg-mono-docs',
  
  // c5/cgmail → 🔴 Gmail
  'c5': '/Users/raybunnage/Documents/github/dhg-mono-gmail-cli-pipeline-research-app',
  'cgmail': '/Users/raybunnage/Documents/github/dhg-mono-gmail-cli-pipeline-research-app',
  
  // c6/caudio → 🟡 Audio (Note: actual path may be dhg-mono-dhg-mono-audio)
  'c6': '/Users/raybunnage/Documents/github/dhg-mono-improve-audio',
  'caudio': '/Users/raybunnage/Documents/github/dhg-mono-improve-audio',
  
  // c7/ccli → 🔷 CLI Pipelines
  'c7': '/Users/raybunnage/Documents/github/dhg-mono-improve-cli-pipelines',
  'ccli': '/Users/raybunnage/Documents/github/dhg-mono-improve-cli-pipelines',
  
  // c8/cgoogle → 🩷 Google
  'c8': '/Users/raybunnage/Documents/github/dhg-mono-improve-google',
  'cgoogle': '/Users/raybunnage/Documents/github/dhg-mono-improve-google',
  
  // c9/csuite → 🟩 Suite
  'c9': '/Users/raybunnage/Documents/github/dhg-mono-improve-suite',
  'csuite': '/Users/raybunnage/Documents/github/dhg-mono-improve-suite',
  
  // c0/cfix → 🟪 Bug Fixes
  'c0': '/Users/raybunnage/Documents/github/dhg-mono-integration-bug-fixes-tweaks',
  'cfix': '/Users/raybunnage/Documents/github/dhg-mono-integration-bug-fixes-tweaks'
};

// Reverse mapping from path to alias info
export const pathToAliasInfo: Record<string, { number: string; name: string; emoji: string }> = {
  '/Users/raybunnage/Documents/github/dhg-mono': { 
    number: 'c1', 
    name: 'cdev', 
    emoji: '🟢' 
  },
  '/Users/raybunnage/Documents/github/dhg-mono-admin-code': { 
    number: 'c2', 
    name: 'cadmin', 
    emoji: '🔵' 
  },
  '/Users/raybunnage/Documents/github/dhg-mono-dhg-hub': { 
    number: 'c3', 
    name: 'chub', 
    emoji: '🟣' 
  },
  '/Users/raybunnage/Documents/github/dhg-mono-feature/dhg-mono-docs': { 
    number: 'c4', 
    name: 'cdocs', 
    emoji: '🟠' 
  },
  '/Users/raybunnage/Documents/github/dhg-mono-gmail-cli-pipeline-research-app': { 
    number: 'c5', 
    name: 'cgmail', 
    emoji: '🔴' 
  },
  '/Users/raybunnage/Documents/github/dhg-mono-improve-audio': { 
    number: 'c6', 
    name: 'caudio', 
    emoji: '🟡' 
  },
  // Also map the alternate path name from GitManagement defaultWorktrees
  '/Users/raybunnage/Documents/github/dhg-mono-dhg-mono-audio': { 
    number: 'c6', 
    name: 'caudio', 
    emoji: '🟡' 
  },
  '/Users/raybunnage/Documents/github/dhg-mono-improve-cli-pipelines': { 
    number: 'c7', 
    name: 'ccli', 
    emoji: '🔷' 
  },
  '/Users/raybunnage/Documents/github/dhg-mono-improve-google': { 
    number: 'c8', 
    name: 'cgoogle', 
    emoji: '🩷' 
  },
  // Also map the alternate path name from GitManagement defaultWorktrees
  '/Users/raybunnage/Documents/github/dhg-mono-dhg-mono-admin-google': { 
    number: 'c8', 
    name: 'cgoogle', 
    emoji: '🩷' 
  },
  '/Users/raybunnage/Documents/github/dhg-mono-improve-suite': { 
    number: 'c9', 
    name: 'csuite', 
    emoji: '🟩' 
  },
  '/Users/raybunnage/Documents/github/dhg-mono-integration-bug-fixes-tweaks': { 
    number: 'c0', 
    name: 'cfix', 
    emoji: '🟪' 
  }
};

// Helper function to get alias info from worktree path
export function getWorktreeAliasInfo(path: string): { number: string; name: string; emoji: string } | null {
  return pathToAliasInfo[path] || null;
}