/**
 * CLI Tracking Wrapper
 * 
 * Utility to wrap CLI command functions with automatic tracking.
 * This makes it easy to add tracking to existing CLI commands without modifying them.
 */
import { commandTrackingService } from './command-tracking-service';
import { Logger } from '../../utils/logger';

/**
 * Track a CLI command execution
 * 
 * @example
 * // Basic usage
 * const trackCommand = require('../../../packages/shared/services/tracking-service/cli-tracking-wrapper').trackCommandExecution;
 * 
 * program
 *   .command('sync')
 *   .action((options) => trackCommand('google_sync', 'sync', async () => {
 *     // Your command implementation
 *     // ...
 *     return { recordsAffected: 10, affectedEntity: 'files', summary: 'Synced 10 files' };
 *   }));
 */
export async function trackCommandExecution<T>(
  pipelineName: string,
  commandName: string,
  executeFn: () => Promise<T | void>,
  options?: {
    getResultSummary?: (result: T) => {
      recordsAffected?: number;
      affectedEntity?: string;
      summary?: string;
    };
  }
): Promise<T | void> {
  const startTime = new Date();
  let trackingId: string;
  
  try {
    // Start tracking
    trackingId = await commandTrackingService.startTracking(pipelineName, commandName);
    
    // Execute the command
    const result = await executeFn();
    
    // Get result summary if provided
    let resultSummary;
    if (options?.getResultSummary && result) {
      resultSummary = options.getResultSummary(result as T);
    }
    
    // Complete tracking
    await commandTrackingService.completeTracking(trackingId, resultSummary);
    
    return result;
  } catch (error) {
    // Track failure
    Logger.error(`Command ${pipelineName}/${commandName} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    if (trackingId!) {
      await commandTrackingService.failTracking(
        trackingId!,
        error instanceof Error ? error.message : String(error)
      );
    }
    
    // Re-throw the error to let the caller handle it
    throw error;
  }
}

/**
 * Simpler tracking for one-off commands
 * Uses a single call to log the command execution
 */
export async function trackSimpleCommand<T>(
  pipelineName: string,
  commandName: string,
  executeFn: () => Promise<T | void>,
  options?: {
    getResultSummary?: (result: T) => {
      recordsAffected?: number;
      affectedEntity?: string;
      summary?: string;
    };
  }
): Promise<T | void> {
  const startTime = new Date();
  
  try {
    // Execute the command
    const result = await executeFn();
    
    // Get result summary if provided
    let resultSummary: {
      recordsAffected?: number;
      affectedEntity?: string;
      summary?: string;
    } = {};
    
    if (options?.getResultSummary && result) {
      resultSummary = options.getResultSummary(result as T);
    }
    
    // Log success
    await commandTrackingService.trackCommand({
      pipelineName,
      commandName,
      startTime,
      status: 'success',
      recordsAffected: resultSummary.recordsAffected,
      affectedEntity: resultSummary.affectedEntity,
      summary: resultSummary.summary
    });
    
    return result;
  } catch (error) {
    // Log failure
    await commandTrackingService.trackCommand({
      pipelineName,
      commandName,
      startTime,
      status: 'error',
      errorMessage: error instanceof Error ? error.message : String(error)
    });
    
    // Re-throw the error
    throw error;
  }
}