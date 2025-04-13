/**
 * Helper functions for the claude-service
 * These are temporary wrappers until the full migration to the shared package is complete
 */

import { ClaudeService } from '@dhg/shared/services/claude-service';
import { LoggerUtils } from '../utils/logger-utils';
import config from '../utils/config';

export interface PromptOptions {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

// Create a singleton instance of the Claude service
const claudeService = new ClaudeService();

/**
 * Send a prompt to Claude
 * @param options The prompt options
 * @returns The Claude response
 */
export async function sendPrompt(options: PromptOptions): Promise<string> {
  LoggerUtils.debug('Sending prompt to Claude', { modelRequested: options.model });
  
  try {
    // Use the shared ClaudeService implementation
    return await claudeService.sendPrompt(
      options.prompt,
      options.model || config.defaultModel,
      options.temperature || 0.7,
      options.maxTokens || 4000
    );
  } catch (error) {
    LoggerUtils.error('Error sending prompt to Claude', error);
    throw new Error(`Failed to send prompt to Claude: ${error instanceof Error ? error.message : String(error)}`);
  }
}