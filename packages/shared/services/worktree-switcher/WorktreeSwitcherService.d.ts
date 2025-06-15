export interface Worktree {
    path: string;
    head: string;
    branch?: string;
    detached?: boolean;
    name: string;
    isActive: boolean;
    hasCursor: boolean;
    cursorPid: string | null;
    hasPeacock: boolean;
    peacockColor: string | null;
}
export declare class WorktreeSwitcherService {
    private static instance;
    private constructor();
    static getInstance(): WorktreeSwitcherService;
    /**
     * Get all git worktrees with enhanced information
     */
    getWorktrees(): Worktree[];
    /**
     * Open or focus a worktree in Cursor
     */
    openInCursor(worktreePath: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Create a new worktree
     */
    createWorktree(branchName: string, baseBranch?: string): Promise<{
        success: boolean;
        path?: string;
        error?: string;
    }>;
    /**
     * Remove a worktree
     */
    removeWorktree(worktreePath: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Get default colors for branches
     */
    getDefaultColor(branch?: string): string;
    /**
     * Generate HTML for worktree switcher UI
     */
    generateHTML(worktrees: Worktree[]): string;
}
//# sourceMappingURL=WorktreeSwitcherService.d.ts.map