/**
 * Logger Service Exports
 * 
 * Usage:
 * - Browser/Universal: import { logger } from '@shared/services/logger';
 * - Node.js only: import { nodeLogger } from '@shared/services/logger/logger-node';
 */

// Export types
export * from './logger.types';

// Export base logger (browser-safe)
export { LoggerService, logger } from './logger';

// Note: logger-node should be imported directly when needed in Node.js environments
// to avoid bringing Node.js dependencies into browser bundles