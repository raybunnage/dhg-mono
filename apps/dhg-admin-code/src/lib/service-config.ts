/**
 * Service configuration for browser environment
 * Configures shared services with environment variables from Vite
 */
import { claudeService } from '@shared/services/claude-service/claude-service';

/**
 * Configure shared services for browser environment
 * This should be called early in the application lifecycle
 */
export function configureServices() {
  // Configure Claude service with browser environment variables
  if (import.meta.env.VITE_CLAUDE_API_KEY || import.meta.env.VITE_ANTHROPIC_API_KEY) {
    claudeService.configure({
      apiKey: import.meta.env.VITE_CLAUDE_API_KEY || import.meta.env.VITE_ANTHROPIC_API_KEY || '',
      baseUrl: import.meta.env.VITE_CLAUDE_API_BASE_URL || 'https://api.anthropic.com',
      apiVersion: import.meta.env.VITE_CLAUDE_API_VERSION || '2023-12-15',
      defaultModel: import.meta.env.VITE_DEFAULT_MODEL || 'claude-sonnet-4-20250514'
    });
  }
}