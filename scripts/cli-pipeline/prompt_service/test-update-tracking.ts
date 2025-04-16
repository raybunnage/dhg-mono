#!/usr/bin/env node

/**
 * Test for prompt update command tracking
 * A simple test to verify that the command tracking works with prompt update commands
 */
import { trackCommandExecution } from '../../../packages/shared/services/tracking-service/cli-tracking-wrapper';
import { Logger } from '../../../packages/shared/utils/logger';

async function testPromptUpdateTracking() {
  try {
    await trackCommandExecution('prompt_service', 'test-update', async () => {
      Logger.info('This is a test command execution');
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Return result info
      return {
        promptName: 'test-prompt',
        filePath: 'test-file.md'
      };
    }, {
      getResultSummary: (result) => ({
        recordsAffected: 1,
        affectedEntity: 'prompts',
        summary: `Updated prompt "${result.promptName}" from file ${result.filePath}`
      })
    });
    
    Logger.info('Test completed successfully');
  } catch (error) {
    Logger.error(`Test failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Run the test
testPromptUpdateTracking();