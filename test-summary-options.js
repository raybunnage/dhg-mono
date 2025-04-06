// Simple script to extract and show the options for generate-summary command
const { generateSummaryCommand } = require('./scripts/cli-pipeline/presentations/commands/generate-summary');

console.log('Options for generate-summary command:');
generateSummaryCommand.options.forEach(option => {
  console.log(`${option.flags} - ${option.description}`);
});