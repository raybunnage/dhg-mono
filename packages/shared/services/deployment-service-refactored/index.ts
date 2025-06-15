/**
 * DeploymentService - Production deployment management with validation and rollback
 * 
 * This service handles:
 * - Pre-deployment validations (TypeScript, dependencies, env, build, tests)
 * - Deployment to staging and production environments
 * - Post-deployment health checks
 * - Deployment rollback capabilities
 * - Deployment history and status tracking
 * 
 * @example
 * ```typescript
 * import { DeploymentService } from '@shared/services/deployment-service-refactored';
 * 
 * const deploymentService = DeploymentService.getInstance();
 * 
 * // Run all validations
 * const result = await deploymentService.createDeployment({
 *   deploymentType: 'staging',
 *   dryRun: true
 * });
 * 
 * // Deploy to production
 * const prodResult = await deploymentService.createDeployment({
 *   deploymentType: 'production',
 *   skipValidations: ['tests'] // Skip test validation
 * });
 * 
 * // Rollback if needed
 * await deploymentService.rollback(prodResult.deploymentId);
 * ```
 */

export { DeploymentService } from './DeploymentService';
export * from './types';

// For backward compatibility with existing imports
import { DeploymentService } from './DeploymentService';
export const deploymentService = DeploymentService.getInstance();