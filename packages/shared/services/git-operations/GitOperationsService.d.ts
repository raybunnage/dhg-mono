export interface Worktree {
    path: string;
    commit: string;
    branch: string;
    lastCommit?: {
        hash: string;
        message: string;
        relativeTime: string;
        author: string;
    };
    uncommittedChanges?: number;
    ahead?: number;
    behind?: number;
    needsAttention?: boolean;
}
export interface Branch {
    name: string;
    fullName: string;
    isRemote: boolean;
    isCurrent: boolean;
    isMerged: boolean;
    lastCommit: {
        date: string;
        author: string;
        message: string;
    };
    hasUpstream?: boolean;
    ahead?: number;
    behind?: number;
    ageInDays?: number;
    canDelete?: boolean;
    suggestCleanup?: boolean;
}
export interface Commit {
    hash: string;
    subject: string;
    authorName: string;
    authorEmail: string;
    relativeTime: string;
    date: string;
    taskId?: string | null;
}
export interface BranchCleanupResult {
    branch: string;
    status: 'deleted' | 'skipped' | 'would-delete' | 'error';
    reason?: string;
    output?: string;
    error?: string;
}
/**
 * Service for Git operations
 * Extracted from dhg-admin-code/git-server.cjs
 */
export declare class GitOperationsService {
    private protectedBranches;
    /**
     * Get all git worktrees with enhanced information
     */
    getWorktrees(): Promise<Worktree[]>;
    /**
     * Enhance worktree with additional information
     */
    private enhanceWorktreeInfo;
    /**
     * Get all branches with detailed information
     */
    getBranches(): Promise<{
        branches: Branch[];
        remoteBranches: Branch[];
        currentBranch: string;
    }>;
    /**
     * Enhance branch with additional information
     */
    private enhanceBranchInfo;
    /**
     * Delete a branch
     */
    deleteBranch(branchName: string, force?: boolean): Promise<{
        success: boolean;
        message: string;
        output?: string;
        error?: string;
    }>;
    /**
     * Cleanup multiple branches
     */
    cleanupBranches(branches: string[], dryRun?: boolean): Promise<{
        dryRun: boolean;
        results: BranchCleanupResult[];
        summary: {
            total: number;
            deleted: number;
            skipped: number;
            errors: number;
        };
    }>;
    /**
     * Execute a whitelisted git command
     */
    executeCommand(command: string): Promise<{
        success: boolean;
        stdout?: string;
        stderr?: string;
        error?: string;
    }>;
    /**
     * Get commits for a specific worktree
     */
    getWorktreeCommits(worktreePath: string, limit?: number): Promise<{
        worktreePath: string;
        branch: string;
        commits: Commit[];
        totalCommits: number;
    }>;
    /**
     * Get detailed commit information
     */
    private getCommitInfo;
}
//# sourceMappingURL=GitOperationsService.d.ts.map