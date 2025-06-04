export interface GitBranch {
  name: string;
  current: boolean;
  remote: boolean;
  lastCommit: {
    hash: string;
    date: string;
    author: string;
    message: string;
  };
  worktree?: {
    path: string;
    locked: boolean;
  };
  mergeStatus: {
    merged: boolean;
    mergedInto?: string[];
    unmergedCommits: number;
  };
  safety: {
    canDelete: boolean;
    reasons: string[];
  };
}

export interface GitWorktree {
  path: string;
  branch: string;
  commit: string;
  locked: boolean;
  prunable: boolean;
}