/**
 * GitOperationsService Tests
 * 
 * Comprehensive test suite for GitOperationsService functionality
 */

import { GitOperationsService } from './GitOperationsService';
import { 
  GitWorktree, 
  GitBranch, 
  GitCommit, 
  GitOperationResult,
  GitOperationsServiceConfig 
} from './types';
import { Logger } from '../logger-service';

// Mock logger for testing
const mockLogger: Logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

import { exec } from 'child_process';
const mockExec = exec as jest.MockedFunction<typeof exec>;

describe('GitOperationsService', () => {
  let service: GitOperationsService;
  let config: GitOperationsServiceConfig;

  beforeEach(() => {
    config = {
      workingDirectory: '/test/repo',
      cacheTimeout: 30000,
      maxCacheSize: 1000,
      enableMetrics: true,
      gitPath: 'git'
    };
    
    // Reset singleton instance
    (GitOperationsService as any).instance = null;
    service = GitOperationsService.getInstance(config, mockLogger);
    
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Reset singleton
    (GitOperationsService as any).instance = null;
  });

  describe('Singleton Pattern', () => {
    test('should return same instance on multiple calls', () => {
      const instance1 = GitOperationsService.getInstance();
      const instance2 = GitOperationsService.getInstance();
      expect(instance1).toBe(instance2);
    });

    test('should use provided config on first call', () => {
      const customConfig = { workingDirectory: '/custom/path' };
      const instance = GitOperationsService.getInstance(customConfig);
      expect(instance.getConfig()).toEqual(expect.objectContaining(customConfig));
    });
  });

  describe('Initialization', () => {
    test('should initialize with default config', () => {
      const defaultService = GitOperationsService.getInstance();
      expect(defaultService.isHealthy()).toBe(true);
    });

    test('should initialize with custom config', () => {
      const customConfig = {
        workingDirectory: '/custom/repo',
        cacheTimeout: 60000
      };
      const customService = GitOperationsService.getInstance(customConfig);
      expect(customService.getConfig()).toEqual(expect.objectContaining(customConfig));
    });
  });

  describe('Health Checks', () => {
    test('should report healthy status', () => {
      expect(service.isHealthy()).toBe(true);
    });

    test('should provide health details', () => {
      const health = service.getHealth();
      expect(health).toEqual(expect.objectContaining({
        isHealthy: expect.any(Boolean),
        gitAvailable: expect.any(Boolean),
        workingDirectoryValid: expect.any(Boolean),
        repositoryValid: expect.any(Boolean),
        uptime: expect.any(Number),
        cacheSize: expect.any(Number),
        operationsCount: expect.any(Number)
      }));
    });
  });

  describe('Metrics', () => {
    test('should track operation metrics', () => {
      const initialMetrics = service.getMetrics();
      expect(initialMetrics).toEqual(expect.objectContaining({
        worktreeOperations: expect.any(Number),
        branchOperations: expect.any(Number),
        commitQueries: expect.any(Number),
        mergeOperations: expect.any(Number),
        statusChecks: expect.any(Number),
        cacheHits: expect.any(Number),
        cacheMisses: expect.any(Number),
        errors: expect.any(Number),
        totalExecutionTime: expect.any(Number),
        averageExecutionTime: expect.any(Number),
        operationsPerMinute: expect.any(Number)
      }));
    });

    test('should increment operation counters', async () => {
      mockExec.mockImplementation((command, callback) => {
        callback!(null, 'mock output', '');
      });

      const initialMetrics = service.getMetrics();
      await service.listWorktrees();
      const updatedMetrics = service.getMetrics();
      
      expect(updatedMetrics.worktreeOperations).toBe(initialMetrics.worktreeOperations + 1);
    });
  });

  describe('Worktree Operations', () => {
    test('should list worktrees successfully', async () => {
      const mockOutput = '/path/to/worktree  branch1  abcd1234\n/path/to/main     main     efgh5678';
      mockExec.mockImplementation((command, callback) => {
        callback!(null, mockOutput, '');
      });

      const result = await service.listWorktrees();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data![0]).toEqual(expect.objectContaining({
        path: '/path/to/worktree',
        branch: 'branch1',
        commit: 'abcd1234'
      }));
    });

    test('should handle worktree creation', async () => {
      mockExec.mockImplementation((command, callback) => {
        callback!(null, 'Preparing worktree', '');
      });

      const result = await service.createWorktree('/new/path', { branch: 'new-branch' });
      expect(result.success).toBe(true);
    });

    test('should handle worktree removal', async () => {
      mockExec.mockImplementation((command, callback) => {
        callback!(null, '', '');
      });

      const result = await service.removeWorktree('/path/to/remove');
      expect(result.success).toBe(true);
    });

    test('should handle git command errors', async () => {
      mockExec.mockImplementation((command, callback) => {
        callback!(new Error('Git command failed'), '', 'fatal: not a git repository');
      });

      const result = await service.listWorktrees();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Branch Operations', () => {
    test('should list branches successfully', async () => {
      const mockOutput = '* main  abcd1234 Latest commit\n  dev   efgh5678 Development branch';
      mockExec.mockImplementation((command, callback) => {
        callback!(null, mockOutput, '');
      });

      const result = await service.listBranches();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data![0]).toEqual(expect.objectContaining({
        name: 'main',
        current: true,
        commit: 'abcd1234'
      }));
    });

    test('should create branch successfully', async () => {
      mockExec.mockImplementation((command, callback) => {
        callback!(null, '', '');
      });

      const result = await service.createBranch('new-branch', 'main');
      expect(result.success).toBe(true);
    });

    test('should delete branch successfully', async () => {
      mockExec.mockImplementation((command, callback) => {
        callback!(null, 'Deleted branch feature-branch', '');
      });

      const result = await service.deleteBranch('feature-branch');
      expect(result.success).toBe(true);
    });
  });

  describe('Commit Operations', () => {
    test('should get commit history', async () => {
      const mockOutput = 'abcd1234|John Doe|john@example.com|2025-01-01|Initial commit\nefgh5678|Jane Doe|jane@example.com|2025-01-02|Second commit';
      mockExec.mockImplementation((command, callback) => {
        callback!(null, mockOutput, '');
      });

      const result = await service.getCommitHistory();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data![0]).toEqual(expect.objectContaining({
        hash: 'abcd1234',
        author: 'John Doe',
        email: 'john@example.com',
        message: 'Initial commit'
      }));
    });

    test('should get single commit details', async () => {
      const mockOutput = 'abcd1234|abc1234|John Doe|john@example.com|2025-01-01|Initial commit|2|10|5';
      mockExec.mockImplementation((command, callback) => {
        callback!(null, mockOutput, '');
      });

      const result = await service.getCommit('abcd1234');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({
        hash: 'abcd1234',
        shortHash: 'abc1234',
        author: 'John Doe',
        filesChanged: 2,
        insertions: 10,
        deletions: 5
      }));
    });
  });

  describe('Status Operations', () => {
    test('should get repository status', async () => {
      const mockOutput = 'On branch main\nYour branch is up to date\nnothing to commit, working tree clean';
      mockExec.mockImplementation((command, callback) => {
        callback!(null, mockOutput, '');
      });

      const result = await service.getStatus();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({
        branch: expect.any(String),
        clean: expect.any(Boolean),
        staged: expect.any(Array),
        unstaged: expect.any(Array),
        untracked: expect.any(Array)
      }));
    });
  });

  describe('Merge Operations', () => {
    test('should merge branch successfully', async () => {
      mockExec.mockImplementation((command, callback) => {
        callback!(null, 'Merge made by the \'recursive\' strategy', '');
      });

      const result = await service.mergeBranch('feature-branch');
      expect(result.success).toBe(true);
    });

    test('should handle merge conflicts', async () => {
      mockExec.mockImplementation((command, callback) => {
        callback!(new Error('Merge conflict'), '', 'CONFLICT: Merge conflict in file.txt');
      });

      const result = await service.mergeBranch('feature-branch');
      expect(result.success).toBe(false);
      expect(result.error).toContain('conflict');
    });
  });

  describe('Caching', () => {
    test('should cache worktree results', async () => {
      const mockOutput = '/path/to/worktree  branch1  abcd1234';
      mockExec.mockImplementation((command, callback) => {
        callback!(null, mockOutput, '');
      });

      // First call - cache miss
      await service.listWorktrees();
      const metrics1 = service.getMetrics();
      
      // Second call - cache hit
      await service.listWorktrees();
      const metrics2 = service.getMetrics();
      
      expect(metrics2.cacheHits).toBe(metrics1.cacheHits + 1);
    });

    test('should clear cache when requested', () => {
      service.clearCache();
      const health = service.getHealth();
      expect(health.cacheSize).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle command execution errors gracefully', async () => {
      mockExec.mockImplementation((command, callback) => {
        callback!(new Error('Command failed'), '', 'fatal: not a git repository');
      });

      const result = await service.listWorktrees();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(service.getMetrics().errors).toBeGreaterThan(0);
    });

    test('should handle invalid git output', async () => {
      mockExec.mockImplementation((command, callback) => {
        callback!(null, 'invalid output format', '');
      });

      const result = await service.listWorktrees();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse');
    });
  });

  describe('Configuration', () => {
    test('should return current configuration', () => {
      const currentConfig = service.getConfig();
      expect(currentConfig).toEqual(expect.objectContaining(config));
    });

    test('should validate configuration', () => {
      const validConfig = { workingDirectory: '/valid/path' };
      expect(() => GitOperationsService.getInstance(validConfig)).not.toThrow();
    });
  });
});