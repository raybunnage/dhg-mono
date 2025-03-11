import { Command } from 'commander';
import { registerClassifyMarkdownCommand } from './classify-markdown';
import { registerValidateAssetsCommand } from './validate-assets';
import { registerExamineMarkdownCommand } from './examine-markdown';
import { registerWorkflowCommand } from './workflow';

/**
 * Register all commands with the Commander program
 */
export const registerCommands = (program: Command): void => {
  registerClassifyMarkdownCommand(program);
  registerValidateAssetsCommand(program);
  registerExamineMarkdownCommand(program);
  registerWorkflowCommand(program);
};