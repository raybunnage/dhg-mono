#!/bin/bash

# Source environment variables
[ -f .env ] && export $(grep -v '^#' .env | xargs)
[ -f .env.local ] && export $(grep -v '^#' .env.local | xargs)
[ -f .env.development ] && export $(grep -v '^#' .env.development | xargs)

# Import the command directly to test it
echo "Importing generate-summary command for testing..."
npx ts-node -e "
  import { generateSummaryCommand } from './scripts/cli-pipeline/presentations/commands/generate-summary';
  console.log('Command options:');
  generateSummaryCommand.options.forEach((option: any) => {
    console.log(\`\${option.flags} - \${option.description}\`);
  });
  console.log('\\nTesting --dry-run and --limit options:');
  console.log('These options would limit processing to 3 presentations in preview mode');
"