import { Command } from 'commander';
import { registerClassifyMarkdownCommand } from './classify-markdown';
import { registerValidateAssetsCommand } from './validate-assets';
import { registerExamineMarkdownCommand } from './examine-markdown';
import { registerWorkflowCommand } from './workflow';
import { registerDocumentProcessorCommand } from './documentation-processor';
import { scanScriptsCommand } from './scan-scripts';
import { analyzeScriptCommand } from './analyze-script';
import { batchAnalyzeScriptsCommand } from './batch-analyze-scripts';

/**
 * Register all commands with the Commander program
 */
export const registerCommands = (program: Command): void => {
  // Document processing commands
  registerClassifyMarkdownCommand(program);
  registerValidateAssetsCommand(program);
  registerExamineMarkdownCommand(program);
  registerWorkflowCommand(program);
  registerDocumentProcessorCommand(program);
  
  // Script analysis commands
  program.addCommand(scanScriptsCommand);
  program.addCommand(analyzeScriptCommand);
  program.addCommand(batchAnalyzeScriptsCommand);
};