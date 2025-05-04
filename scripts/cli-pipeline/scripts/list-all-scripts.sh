#!/bin/bash
# list-all-scripts.sh - List all script files that would be tracked by the database

# Get script directory and root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TS_SCRIPT="${SCRIPT_DIR}/script-pipeline-main.ts"

# Load environment variables from .env files
for ENV_FILE in "${ROOT_DIR}/.env" "${ROOT_DIR}/.env.development" "${ROOT_DIR}/.env.local"; do
  if [ -f "${ENV_FILE}" ]; then
    echo "Loading environment variables from ${ENV_FILE}..."
    set -a
    source "${ENV_FILE}"
    set +a
  fi
done

# Ensure we have a valid CLAUDE_API_KEY (copy from ANTHROPIC_API_KEY if needed)
if [ -z "$CLAUDE_API_KEY" ] && [ -n "$ANTHROPIC_API_KEY" ]; then
  echo "Setting CLAUDE_API_KEY from ANTHROPIC_API_KEY"
  export CLAUDE_API_KEY="$ANTHROPIC_API_KEY"
fi

# Create the temporary script to list all files
TMP_SCRIPT="${ROOT_DIR}/scripts/cli-pipeline/scripts/temp-list-scripts.ts"

cat > "${TMP_SCRIPT}" << 'EOF'
/**
 * Temporary script to list all files that would be tracked by the database
 */
import { scriptPipelineService } from '../shared/services/script-pipeline-service';
import { cliService } from '../shared/services/cli-service';
import { logger } from '../shared/services/logger-service';
import { environmentService } from '../shared/services/environment-service';
import * as fs from 'fs';
import * as path from 'path';

// Access the private method through a workaround
(async () => {
  try {
    // Use any trick to access the private method
    const service = scriptPipelineService as any;
    const scriptFiles = await service.findScriptFilesOnDisk();
    
    // Group files by directory for better analysis
    const dirGroups: Record<string, string[]> = {};
    
    scriptFiles.forEach((file: string) => {
      const dir = path.dirname(file);
      if (!dirGroups[dir]) {
        dirGroups[dir] = [];
      }
      dirGroups[dir].push(path.basename(file));
    });
    
    // Output summary
    console.log(`\n===== SCRIPT FILES SUMMARY =====`);
    console.log(`Total script files found: ${scriptFiles.length}\n`);
    
    console.log(`----- By File Extension -----`);
    const extCount: Record<string, number> = {};
    scriptFiles.forEach((file: string) => {
      const ext = path.extname(file).toLowerCase();
      extCount[ext] = (extCount[ext] || 0) + 1;
    });
    
    Object.entries(extCount)
      .sort((a, b) => b[1] - a[1])
      .forEach(([ext, count]) => {
        console.log(`${ext}: ${count} files`);
      });
    
    console.log(`\n----- By Directory (showing first 10) -----`);
    Object.entries(dirGroups)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 10)
      .forEach(([dir, files]) => {
        console.log(`${dir}: ${files.length} files`);
      });
    
    console.log(`\n----- Full File List -----`);
    scriptFiles.sort().forEach((file: string) => {
      console.log(file);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
EOF

# Run the temporary script
echo "Running script to list all tracked script files..."
ts-node "${TMP_SCRIPT}"

# Clean up the temporary script
rm "${TMP_SCRIPT}"