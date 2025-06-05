#!/usr/bin/env ts-node
/**
 * Shell Command Tracker
 * 
 * A utility script to track shell command execution.
 * To be used from bash scripts to integrate with the command tracking service.
 * 
 * Usage:
 *   ts-node shell-command-tracker.ts [pipeline_name] [command_name] [command_to_execute]
 * 
 * Example:
 *   ts-node shell-command-tracker.ts "google_sync" "sync-folders" "ts-node scripts/cli-pipeline/google_sync/sync-folders.ts"
 */

import { spawn } from 'child_process';
import { commandTrackingService } from './command-tracking-service';
import { Logger } from '../../utils/logger';

// Parse arguments
const pipelineName = process.argv[2];
const commandName = process.argv[3];
const command = process.argv.slice(4).join(' ');

if (!pipelineName || !commandName || !command) {
  console.error('Usage: ts-node shell-command-tracker.ts [pipeline_name] [command_name] [command_to_execute]');
  process.exit(1);
}

/**
 * Execute a shell command and track its execution
 */
async function executeTrackedCommand(
  pipelineName: string, 
  commandName: string, 
  command: string
): Promise<void> {
  console.log(`Executing command: ${command}`);
  
  // Start tracking
  let trackingId: string | undefined;
  const startTime = new Date();
  
  try {
    trackingId = await commandTrackingService.startTracking(pipelineName, commandName);
    
    // Split the command into parts
    const parts = command.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);
    
    // Spawn the command
    const childProcess = spawn(cmd, args, {
      stdio: 'inherit',
      shell: true
    });
    
    // Handle command completion
    childProcess.on('close', async (code) => {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      console.log(`Command exited with code ${code}`);
      
      if (trackingId) {
        if (code === 0) {
          await commandTrackingService.completeTracking(trackingId, {
            summary: `Command executed successfully in ${duration}ms`
          });
        } else {
          await commandTrackingService.failTracking(
            trackingId,
            `Command failed with exit code ${code}`
          );
        }
      }
      
      process.exit(code || 0);
    });
    
    // Handle errors
    childProcess.on('error', async (error) => {
      console.error(`Error executing command: ${error.message}`);
      
      if (trackingId) {
        await commandTrackingService.failTracking(
          trackingId,
          `Error executing command: ${error.message}`
        );
      }
      
      process.exit(1);
    });
  } catch (error) {
    Logger.error(`Error in command tracking: ${error instanceof Error ? error.message : String(error)}`);
    
    // If tracking failed but we still want to execute the command
    const childProcess = spawn(command, [], {
      stdio: 'inherit',
      shell: true
    });
    
    childProcess.on('close', (code) => {
      process.exit(code || 0);
    });
    
    childProcess.on('error', (error) => {
      console.error(`Error executing command: ${error.message}`);
      process.exit(1);
    });
  }
}

// Execute the command with tracking
executeTrackedCommand(pipelineName, commandName, command).catch(error => {
  console.error('Error:', error);
  process.exit(1);
});