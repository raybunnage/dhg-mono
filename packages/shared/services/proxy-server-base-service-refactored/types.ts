/**
 * Type definitions for ProxyServerBaseService (Refactored)
 */

/**
 * Configuration for creating a proxy server
 */
export interface ProxyServerConfig {
  name: string;
  port: number;
  description?: string;
}

/**
 * Information about a running proxy server
 */
export interface ProxyServerInfo {
  name: string;
  description: string;
  port: number;
  status: 'running' | 'stopped' | 'error';
  uptime: number; // seconds
  startTime: string | null;
  endpoints: string[];
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  healthy: boolean;
  details?: Record<string, any>;
}

/**
 * Proxy server instance for registry
 */
export interface ProxyServerInstance {
  name: string;
  port: number;
  server: any; // ProxyServerBase instance
  category: ProxyServerCategory;
}

/**
 * Categories for organizing proxy servers
 */
export type ProxyServerCategory = 
  | 'development'
  | 'media'
  | 'testing'
  | 'infrastructure';

/**
 * Port range allocations from CLAUDE.md
 */
export const PORT_RANGES = {
  viteApps: { start: 5000, end: 5199 },
  proxyServers: { start: 9876, end: 9899 },
  otherServices: { start: 8080, end: 8099 },
  legacyPorts: { start: 3000, end: 3999 } // Existing servers
} as const;

/**
 * Registry of all proxy servers and their default ports
 * This mirrors the information in CLAUDE.md
 */
export const PROXY_PORT_REGISTRY: Record<string, number> = {
  // Infrastructure proxies
  'vite-fix-proxy': 9876,
  'continuous-monitoring-proxy': 9877,
  'proxy-manager-proxy': 9878,
  
  // Development proxies
  'git-operations-proxy': 9879,
  'file-browser-proxy': 9880,
  'continuous-docs-proxy': 9881,
  
  // Media proxies
  'audio-streaming-proxy': 9882,
  'google-drive-proxy': 9883,
  'media-processing-proxy': 9884,
  
  // Testing proxies
  'service-health-proxy': 9885,
  'integration-test-proxy': 9886,
  
  // Legacy ports (will be migrated)
  'legacy-audio-server': 3006,
  'legacy-git-server': 3005,
  'legacy-file-browser': 3002,
};

// NEW TYPES FOR REFACTORED SERVICE

/**
 * Metrics for the ProxyServerBaseService
 */
export interface ProxyServerBaseMetrics {
  requestsReceived: number;
  requestsCompleted: number;
  requestsFailed: number;
  averageResponseTime: number;
  totalResponseTime: number;
  uptimeSeconds: number;
  startCount: number;
  stopCount: number;
  restartCount: number;
  healthCheckCount: number;
  healthCheckFailures: number;
  activeConnections: number;
  peakConnections: number;
  errors: number;
}

/**
 * Configuration for the ProxyServerBaseService
 */
export interface ProxyServerBaseServiceConfig {
  proxyConfig: ProxyServerConfig;
}