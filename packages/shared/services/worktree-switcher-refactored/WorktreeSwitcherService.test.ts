/**
 * WorktreeSwitcherService Tests
 */

import { WorktreeSwitcherService } from './WorktreeSwitcherService';
import { execSync } from 'child_process';
import { jest } from '@jest/globals';

// Mock child_process
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

describe('WorktreeSwitcherService', () => {
  let service: WorktreeSwitcherService;
  const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton instance for testing
    (WorktreeSwitcherService as any).instance = undefined;
    service = WorktreeSwitcherService.getInstance({
      gitCommand: 'git'
    });
  });

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }
    // Reset singleton instance after each test
    (WorktreeSwitcherService as any).instance = undefined;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = WorktreeSwitcherService.getInstance();
      const instance2 = WorktreeSwitcherService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should initialize with default git command', () => {
      const instance = WorktreeSwitcherService.getInstance();
      expect(instance).toBeDefined();
    });

    it('should use custom git command from config', () => {
      const instance = WorktreeSwitcherService.getInstance({
        gitCommand: '/usr/local/bin/git'
      });
      expect(instance).toBeDefined();
    });
  });

  describe('Service Lifecycle', () => {
    it('should initialize successfully when git is available', async () => {
      mockExecSync.mockReturnValue('git version 2.39.0');
      
      await service.start();
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.details.gitAvailable).toContain('git version');
    });

    it('should throw error on initialization when git is not available', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('git: command not found');
      });
      
      await expect(service.start()).rejects.toThrow('Git is not available');
    });

    it('should handle service shutdown gracefully', async () => {
      mockExecSync.mockReturnValue('git version 2.39.0');
      
      await service.start();
      await service.shutdown();
      
      expect(service.isStarted()).toBe(false);
    });
  });

  describe('Worktree Management', () => {
    beforeEach(async () => {
      mockExecSync.mockReturnValue('git version 2.39.0');
      await service.start();
    });

    it('should parse worktree list output correctly', () => {
      const mockWorktreeOutput = `worktree /Users/test/project
HEAD abc123def456
branch refs/heads/main

worktree /Users/test/project-feature
HEAD def456abc123
branch refs/heads/feature/new-feature

worktree /Users/test/project-detached
HEAD xyz789uvw012
detached
`;

      mockExecSync
        .mockReturnValueOnce('git version 2.39.0') // For healthCheck (if called)
        .mockReturnValueOnce(mockWorktreeOutput); // For getWorktrees

      const worktrees = service.getWorktrees();

      expect(worktrees).toHaveLength(3);
      
      expect(worktrees[0]).toEqual({
        path: '/Users/test/project',
        head: 'abc123def456',
        branch: 'refs/heads/main',
        name: 'project',
        isActive: false,
        hasCursor: false,
        cursorPid: null,
        hasPeacock: false,
        peacockColor: null
      });

      expect(worktrees[1]).toEqual({
        path: '/Users/test/project-feature',
        head: 'def456abc123',
        branch: 'refs/heads/feature/new-feature',
        name: 'project-feature',
        isActive: false,
        hasCursor: false,
        cursorPid: null,
        hasPeacock: false,
        peacockColor: null
      });

      expect(worktrees[2]).toEqual({
        path: '/Users/test/project-detached',
        head: 'xyz789uvw012',
        detached: true,
        name: 'project-detached',
        isActive: false,
        hasCursor: false,
        cursorPid: null,
        hasPeacock: false,
        peacockColor: null
      });
    });

    it('should handle empty worktree list', () => {
      mockExecSync.mockReturnValueOnce('');

      const worktrees = service.getWorktrees();

      expect(worktrees).toHaveLength(0);
    });

    it('should handle single worktree', () => {
      const mockWorktreeOutput = `worktree /Users/test/project
HEAD abc123def456
branch refs/heads/main
`;

      mockExecSync.mockReturnValueOnce(mockWorktreeOutput);

      const worktrees = service.getWorktrees();

      expect(worktrees).toHaveLength(1);
      expect(worktrees[0].name).toBe('project');
      expect(worktrees[0].branch).toBe('refs/heads/main');
    });

    it('should handle git command errors gracefully', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('fatal: not a git repository');
      });

      const worktrees = service.getWorktrees();

      expect(worktrees).toHaveLength(0);
      expect(service.getMetrics().errors).toBe(1);
    });

    it('should parse worktree names from paths correctly', () => {
      const mockWorktreeOutput = `worktree /long/path/to/my-awesome-project
HEAD abc123def456
branch refs/heads/main
`;

      mockExecSync.mockReturnValueOnce(mockWorktreeOutput);

      const worktrees = service.getWorktrees();

      expect(worktrees[0].name).toBe('my-awesome-project');
    });
  });

  describe('Metrics', () => {
    beforeEach(async () => {
      mockExecSync.mockReturnValue('git version 2.39.0');
      await service.start();
    });

    it('should track worktree query metrics', () => {
      mockExecSync.mockReturnValue('');

      service.getWorktrees();
      service.getWorktrees();

      const metrics = service.getMetrics();
      expect(metrics.totalQueries).toBe(2);
      expect(metrics.lastQueryTime).toBeDefined();
    });

    it('should track worktrees found count', () => {
      const mockWorktreeOutput = `worktree /Users/test/project1
HEAD abc123
branch refs/heads/main

worktree /Users/test/project2
HEAD def456
branch refs/heads/feature
`;

      mockExecSync.mockReturnValueOnce(mockWorktreeOutput);

      service.getWorktrees();

      const metrics = service.getMetrics();
      expect(metrics.worktreesFound).toBe(2);
    });

    it('should track error metrics', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Command failed');
      });

      service.getWorktrees();

      const metrics = service.getMetrics();
      expect(metrics.errors).toBe(1);
    });

    it('should reset metrics', () => {
      mockExecSync.mockReturnValue('');
      
      service.getWorktrees();
      expect(service.getMetrics().totalQueries).toBe(1);
      
      service.resetMetrics();
      expect(service.getMetrics().totalQueries).toBe(0);
    });
  });

  describe('Health Check', () => {
    it('should report healthy when git is available', async () => {
      mockExecSync.mockReturnValue('git version 2.39.0');
      await service.start();

      const health = await service.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.details.gitAvailable).toBe('git version 2.39.0');
      expect(health.details.metrics).toBeDefined();
    });

    it('should report unhealthy when git is not available', async () => {
      mockExecSync
        .mockReturnValueOnce('git version 2.39.0') // For start()
        .mockImplementationOnce(() => { // For healthCheck()
          throw new Error('git: command not found');
        });
      
      await service.start();
      const health = await service.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.details.gitAvailable).toBe('error');
      expect(health.details.error).toBe('git: command not found');
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      mockExecSync.mockReturnValue('git version 2.39.0');
      await service.start();
    });

    it('should handle malformed worktree output', () => {
      const malformedOutput = `worktree /path/1
HEAD abc123
malformed line without prefix
worktree /path/2
branch refs/heads/main
`;

      mockExecSync.mockReturnValueOnce(malformedOutput);

      const worktrees = service.getWorktrees();

      expect(worktrees).toHaveLength(2);
      expect(worktrees[0].path).toBe('/path/1');
      expect(worktrees[1].path).toBe('/path/2');
    });

    it('should handle output with trailing newlines', () => {
      const outputWithNewlines = `worktree /path/1
HEAD abc123
branch refs/heads/main


`;

      mockExecSync.mockReturnValueOnce(outputWithNewlines);

      const worktrees = service.getWorktrees();

      expect(worktrees).toHaveLength(1);
      expect(worktrees[0].path).toBe('/path/1');
    });

    it('should handle worktrees without branches', () => {
      const outputNoBranch = `worktree /path/1
HEAD abc123
`;

      mockExecSync.mockReturnValueOnce(outputNoBranch);

      const worktrees = service.getWorktrees();

      expect(worktrees).toHaveLength(1);
      expect(worktrees[0].branch).toBeUndefined();
      expect(worktrees[0].detached).toBeUndefined();
    });

    it('should handle custom git command', async () => {
      await service.shutdown();
      (WorktreeSwitcherService as any).instance = undefined;
      
      const customService = WorktreeSwitcherService.getInstance({
        gitCommand: '/usr/local/bin/git'
      });

      mockExecSync.mockReturnValue('git version 2.39.0');
      await customService.start();

      expect(mockExecSync).toHaveBeenCalledWith('/usr/local/bin/git --version', { encoding: 'utf8' });
      
      await customService.shutdown();
    });
  });
});