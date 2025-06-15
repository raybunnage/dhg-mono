/**
 * DeploymentService - Re-export from refactored location
 * This maintains backward compatibility while using the refactored service
 */

export * from '../deployment-service-refactored';

// Default export for backward compatibility
import { deploymentService } from '../deployment-service-refactored';
export default deploymentService;