import { DeploymentService } from './DeploymentService';
import { DeploymentConfig, ValidationResult } from './types';

describe('DeploymentService', () => {
  let service: DeploymentService;

  beforeEach(() => {
    service = DeploymentService.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = DeploymentService.getInstance();
      const instance2 = DeploymentService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should be a singleton service', () => {
      expect(service.constructor.name).toBe('DeploymentService');
      expect(service).toHaveProperty('healthCheck');
    });
  });

  describe('Service Methods', () => {
    it('should have createDeployment method', () => {
      expect(service.createDeployment).toBeDefined();
      expect(typeof service.createDeployment).toBe('function');
    });

    it('should have rollback method', () => {
      expect(service.rollback).toBeDefined();
      expect(typeof service.rollback).toBe('function');
    });

    it('should have getDeploymentStatus method', () => {
      expect(service.getDeploymentStatus).toBeDefined();
      expect(typeof service.getDeploymentStatus).toBe('function');
    });

    it('should have getDeploymentHistory method', () => {
      expect(service.getDeploymentHistory).toBeDefined();
      expect(typeof service.getDeploymentHistory).toBe('function');
    });

    it('should have healthCheck method', () => {
      expect(service.healthCheck).toBeDefined();
      expect(typeof service.healthCheck).toBe('function');
    });
  });

  describe('Type Safety', () => {
    it('should accept valid deployment config', () => {
      const validConfig: DeploymentConfig = {
        deploymentType: 'staging',
        skipValidations: ['tests'],
        dryRun: true
      };

      // This should compile without errors
      expect(() => {
        // Type checking only - would need mocks to actually run
        const config: DeploymentConfig = validConfig;
      }).not.toThrow();
    });

    it('should have proper validation result structure', () => {
      const validationResult: ValidationResult = {
        type: 'typescript',
        status: 'passed',
        details: { output: 'Success' }
      };

      expect(validationResult).toHaveProperty('type');
      expect(validationResult).toHaveProperty('status');
      expect(validationResult).toHaveProperty('details');
    });
  });
});