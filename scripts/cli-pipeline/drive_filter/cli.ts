#!/usr/bin/env ts-node
import { Command } from 'commander';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';

const program = new Command();

// Import commands
import createProfileCommand from './commands/create-profile';
import updateProfileCommand from './commands/update-profile';
import deleteProfileCommand from './commands/delete-profile';
import listProfilesCommand from './commands/list-profiles';
import setActiveProfileCommand from './commands/set-active-profile';
import getActiveProfileCommand from './commands/get-active-profile';
import addDriveToProfileCommand from './commands/add-drive-to-profile';
import removeDriveFromProfileCommand from './commands/remove-drive-from-profile';
import listDrivesInProfileCommand from './commands/list-drives-in-profile';
import applyMigrationsCommand from './commands/apply-migrations';
import healthCheckCommand from './commands/health-check';

// Add commands to the program
program
  .name('drive_filter')
  .description('Filter drives CLI for managing filter profiles')
  .version('1.0.0');

// Register all commands
program.addCommand(createProfileCommand);
program.addCommand(updateProfileCommand);
program.addCommand(deleteProfileCommand);
program.addCommand(listProfilesCommand);
program.addCommand(setActiveProfileCommand);
program.addCommand(getActiveProfileCommand);
program.addCommand(addDriveToProfileCommand);
program.addCommand(removeDriveFromProfileCommand);
program.addCommand(listDrivesInProfileCommand);
program.addCommand(applyMigrationsCommand);
program.addCommand(healthCheckCommand);

program.on('command:*', async function (operands) {
  // Handle unrecognized commands
  console.error(`Error: unknown command '${operands[0]}'`);
  console.log('Available commands:');
  program.commands.forEach(cmd => {
    console.log(`  ${cmd.name()}`);
  });
  process.exitCode = 1;
});

// Global option for profile 
program.option('-p, --profile <profileName>', 'Specify a profile to use for this command');

async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error('An error occurred:', error);
    process.exitCode = 1;
  }
}

main();