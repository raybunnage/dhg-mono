/**
 * Helper functions and properties for config
 * These are temporary wrappers until the full migration to the shared package is complete
 */

import config from './config';
import { config as sharedConfig } from '@dhg/shared/utils';

// Backward compatibility properties
export const configHelpers = {
  // Claude API
  get anthropicApiKey(): string {
    return config.claudeApiKey || sharedConfig.claudeApiKey;
  },

  // Output directory
  get defaultOutputDir(): string {
    return process.env.DEFAULT_OUTPUT_DIR || './output';
  },

  // Supabase Config
  get supabaseUrl(): string {
    return config.supabaseUrl || sharedConfig.supabaseUrl;
  },

  get supabaseKey(): string {
    return config.supabaseKey || sharedConfig.supabaseKey;
  },

  // Default model
  get defaultModel(): string {
    return config.defaultModel || sharedConfig.defaultModel || 'claude-3-opus-20240229';
  }
};

export default configHelpers;