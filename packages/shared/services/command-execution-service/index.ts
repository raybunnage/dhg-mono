// Only export the browser-safe client by default
export { CommandExecutionClient } from './command-execution-client';
export * from './types';

// Export the server-side service only when explicitly imported
// This prevents accidental browser imports of Node.js modules
export type { CommandExecutionService } from './command-execution-service';