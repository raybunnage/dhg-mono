import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeploymentService } from '../deployment-service';
import { SupabaseClientService } from '../supabase-client';

// Mock Supabase client
vi.mock('../supabase-client', () => ({
  SupabaseClientService: {
    getInstance: () => ({
      getClient: () => ({
        from: vi.fn(() => ({
          insert: vi.fn(() => ({ data: { id: 'test-deployment-id' }, error: null })),
          update: vi.fn(() => ({ data: {}, error: null })),
          select: vi.fn(() => ({ 
            data: [{ id: 'test-deployment-id', status: 'pending' }], 
            error: null 
          }))
        }))
      })
    })
  }
}));

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn((cmd, callback) => callback(null, { stdout: 'success', stderr: '' }))
}));

describe('DeploymentService', () => {
  let deploymentService: DeploymentService;

  beforeEach(() => {
    vi.clearAllMocks();
    deploymentService = DeploymentService.getInstance();
  });

  describe('getInstance', () => {
    it('should return the same instance', () => {
      const instance1 = DeploymentService.getInstance();
      const instance2 = DeploymentService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('createDeployment', () => {
    it('should create a deployment successfully', async () => {
      const config = {
        deploymentType: 'staging' as const,
        dryRun: false
      };

      const result = await deploymentService.createDeployment(config);

      expect(result).toBeDefined();
      expect(result.deploymentId).toBeTruthy();
      expect(result.status).toBe('completed');
    });

    it('should handle dry run mode', async () => {
      const config = {
        deploymentType: 'production' as const,
        dryRun: true
      };

      const result = await deploymentService.createDeployment(config);

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.deploymentId).toContain('dry-run');
    });

    it('should prevent concurrent deployments', async () => {
      const config = {
        deploymentType: 'staging' as const,
        dryRun: false
      };

      // Start first deployment
      const deployment1 = deploymentService.createDeployment(config);

      // Try to start second deployment
      await expect(deploymentService.createDeployment(config))
        .rejects.toThrow('Another deployment is already in progress');

      // Wait for first deployment to complete
      await deployment1;
    });
  });

  describe('validateTypeScript', () => {
    it('should validate TypeScript successfully', async () => {
      const result = await deploymentService.validateTypeScript();

      expect(result).toBeDefined();
      expect(result.type).toBe('typescript');
      expect(result.status).toBe('passed');
    });
  });

  describe('validateDependencies', () => {
    it('should validate dependencies successfully', async () => {
      const result = await deploymentService.validateDependencies();

      expect(result).toBeDefined();
      expect(result.type).toBe('dependencies');
      expect(result.status).toBe('passed');
    });
  });

  describe('validateEnvironment', () => {
    it('should validate environment successfully', async () => {
      const result = await deploymentService.validateEnvironment();

      expect(result).toBeDefined();
      expect(result.type).toBe('environment');
      expect(result.status).toBe('passed');
    });
  });

  describe('getDeploymentStatus', () => {
    it('should get deployment status', async () => {
      const status = await deploymentService.getDeploymentStatus('test-deployment-id');

      expect(status).toBeDefined();
      expect(status.id).toBe('test-deployment-id');
      expect(status.status).toBe('pending');
    });

    it('should return null for non-existent deployment', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({ 
            data: [], 
            error: null 
          }))
        }))
      };

      vi.mocked(SupabaseClientService.getInstance().getClient).mockReturnValueOnce(mockSupabase as any);

      const status = await deploymentService.getDeploymentStatus('non-existent');
      expect(status).toBeNull();
    });
  });

  describe('rollback', () => {
    it('should rollback deployment successfully', async () => {
      const result = await deploymentService.rollback('test-deployment-id', 'Test rollback');

      expect(result).toBeDefined();
      expect(result.status).toBe('rolled_back');
    });
  });
});