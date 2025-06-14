/**
 * Proxy Server Base Service (Refactored) - Index
 * 
 * Exports the refactored ProxyServerBaseService with proper lifecycle management
 */

export { ProxyServerBaseService } from './ProxyServerBaseService';
export * from './types';

// Note: Unlike the original standalone class, this extends SingletonService
// and requires proper configuration to be passed to the constructor.