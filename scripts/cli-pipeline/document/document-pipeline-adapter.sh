#!/bin/bash
# document-pipeline-adapter.sh - Bridge script between bash and TypeScript services
# This script acts as an adapter that compiles and runs the TypeScript service

# Get script directory and root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SERVICE_FILE="${SCRIPT_DIR}/document-pipeline-service.ts"
TEMP_DIR="${ROOT_DIR}/tmp"

# Create temp directory if it doesn't exist
mkdir -p "${TEMP_DIR}"

# Log configuration
LOG_FILE="${ROOT_DIR}/document-analysis-results/document-pipeline-$(date +%Y-%m-%d_%H-%M-%S).log"
exec > >(tee -a "${LOG_FILE}") 2>&1

# Load environment variables from .env files
if [ -f "${ROOT_DIR}/.env.development" ]; then
  echo "Loading environment variables from .env.development..."
  set -a # automatically export all variables
  source "${ROOT_DIR}/.env.development"
  set +a
fi

if [ -f "${ROOT_DIR}/.env.local" ]; then
  echo "Loading environment variables from .env.local..."
  set -a
  source "${ROOT_DIR}/.env.local"
  set +a
fi

# Create ts-node execution script
TS_SCRIPT="${TEMP_DIR}/document-pipeline-runner.ts"

cat > "${TS_SCRIPT}" << EOL
// document-pipeline-runner.ts
// This script imports the document pipeline service and runs the requested function

// Use absolute path for import
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

async function main() {
  // Get command line arguments
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    switch (command) {
      case 'sync':
        const syncResult = await documentPipelineService.syncFiles();
        console.log(\`Sync result: \${syncResult ? '✅ Success' : '❌ Failed'}\`);
        process.exit(syncResult ? 0 : 1);
        break;
        
      case 'find-new':
        const newFiles = await documentPipelineService.findNewFiles();
        console.log(\`Find new files result: Added \${newFiles.added} files with \${newFiles.errors} errors\`);
        process.exit(newFiles.errors === 0 ? 0 : 1);
        break;
        
      case 'show-untyped':
        const untypedResult = await documentPipelineService.showUntypedFiles();
        process.exit(untypedResult ? 0 : 1);
        break;
        
      case 'show-recent':
        const recentResult = await documentPipelineService.showRecentFiles();
        process.exit(recentResult ? 0 : 1);
        break;
        
      case 'classify-recent':
        const count = parseInt(args[1] || '10', 10);
        const classifyResult = await documentPipelineService.classifyDocuments(count, false);
        console.log(\`Classify recent result: \${classifyResult ? '✅ Success' : '❌ Failed'}\`);
        process.exit(classifyResult ? 0 : 1);
        break;
        
      case 'classify-untyped':
        const untypedCount = parseInt(args[1] || '10', 10);
        const classifyUntypedResult = await documentPipelineService.classifyDocuments(untypedCount, true);
        console.log(\`Classify untyped result: \${classifyUntypedResult ? '✅ Success' : '❌ Failed'}\`);
        process.exit(classifyUntypedResult ? 0 : 1);
        break;
        
      case 'generate-summary':
        const summaryCount = args[1] === 'all' ? -1 : parseInt(args[1] || '50', 10);
        const summaryResult = await documentPipelineService.generateSummary(summaryCount);
        console.log(\`Generate summary result: \${summaryResult ? '✅ Success' : '❌ Failed'}\`);
        process.exit(summaryResult ? 0 : 1);
        break;
        
      default:
        console.error(\`Unknown command: \${command}\`);
        console.log('Available commands:');
        console.log('  sync                      - Synchronize database with files on disk');
        console.log('  find-new                  - Find and insert new files on disk into the database');
        console.log('  show-untyped              - Show all documentation files without a document type');
        console.log('  show-recent               - Show the 20 most recent files based on update date');
        console.log('  classify-recent [n]       - Classify the n most recent files (default: 10)');
        console.log('  classify-untyped [n]      - Classify untyped files (default: 10)');
        console.log('  generate-summary [n]      - Generate a summary report of documents (default: 50, use "all" for all docs)');
        process.exit(1);
    }
  } catch (error) {
    console.error('Error executing command:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
EOL

# Display usage information
function show_help() {
  echo "Usage: scripts/cli-pipeline/document/document-pipeline-adapter.sh [option] [count]"
  echo "Options:"
  echo "  sync                      - Synchronize database with files on disk (standardize metadata, hard delete missing files)"
  echo "  find-new                  - Find and insert new files on disk into the database"
  echo "  show-untyped              - Show all documentation files without a document type"
  echo "  show-recent               - Show the 20 most recent files based on update date"
  echo "  classify-recent [n]       - Classify the n most recent files (default: 10)"
  echo "  classify-untyped [n]      - Classify untyped files, optionally specify number to process (default: 10)"
  echo "  generate-summary [n]      - Generate a summary report of documents"
  echo "                              n: Number of documents (default: 50, use 'all' for all documents)"
  echo "  help                      - Show this help message"
  echo ""
  echo "Environment Variables Required:"
  echo "  For classification (classify-recent, classify-untyped):"
  echo "    CLAUDE_API_KEY or ANTHROPIC_API_KEY     - Your Claude API key"
  echo ""
  echo "  For database operations (all commands):"
  echo "    SUPABASE_URL                            - Your Supabase URL"
  echo "    SUPABASE_SERVICE_ROLE_KEY               - Your Supabase service role key"
}

# Main logic
option=$1
count=$2

# Check if the environment variables are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "⚠️ Missing Supabase credentials. Database operations will fail."
  echo "Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables."
  exit 1
fi

if [ -z "$CLAUDE_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ] && [ "$option" == "classify-recent" ] || [ "$option" == "classify-untyped" ]; then
  echo "⚠️ Missing Claude API key. Classification will fail."
  echo "Please set CLAUDE_API_KEY or ANTHROPIC_API_KEY environment variable."
  exit 1
fi

# Process command line options with input validation
case $option in
  sync|find-new|show-untyped|show-recent)
    # Execute TypeScript service
    echo "Executing $option via TypeScript service..."
    cd "${ROOT_DIR}"
    npx ts-node --transpile-only "${TS_SCRIPT}" $option
    exit $?
    ;;
    
  classify-recent|classify-untyped)
    # Validate count parameter
    if [[ -n "$count" && ! "$count" =~ ^[0-9]+$ ]]; then
      echo "Error: Count must be a positive integer"
      exit 1
    fi
    
    # Execute TypeScript service with count
    echo "Executing $option via TypeScript service with count: ${count:-10}..."
    cd "${ROOT_DIR}"
    npx ts-node --transpile-only "${TS_SCRIPT}" $option ${count:-10}
    exit $?
    ;;
    
  generate-summary)
    # Validate count parameter
    if [[ -n "$count" && "$count" != "all" && ! "$count" =~ ^[0-9]+$ ]]; then
      echo "Error: Count must be a positive integer or 'all'"
      exit 1
    fi
    
    # Execute TypeScript service with count
    echo "Executing generate-summary via TypeScript service with count: ${count:-50}..."
    cd "${ROOT_DIR}"
    npx ts-node --transpile-only "${TS_SCRIPT}" generate-summary ${count:-50}
    exit $?
    ;;
    
  help|"")
    show_help
    exit 0
    ;;
    
  *)
    echo "Error: Unknown option '$option'"
    show_help
    exit 1
    ;;
esac