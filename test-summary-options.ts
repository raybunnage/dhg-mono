// Simple script to extract and show the options for generate-summary command
import { generateSummaryCommand } from './scripts/cli-pipeline/presentations/commands/generate-summary';

console.log('Options for generate-summary command:');
generateSummaryCommand.options.forEach((option: any) => {
  console.log(`${option.flags} - ${option.description}`);
});