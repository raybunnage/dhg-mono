#!/bin/bash
# document-pipeline-cli.sh - Simple CLI wrapper for the standalone document service

# Get script directory and root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SERVICE_FILE="${SCRIPT_DIR}/standalone-document-service.ts"

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

# Display usage information
function show_help() {
  echo "Usage: scripts/cli-pipeline/document/document-pipeline-cli.sh [option] [count]"
  echo "Options:"
  echo "  test-connection           - Test connection to Supabase"
  echo "  show-recent [n]           - Show the n most recent files (default: 20)"
  echo "  help                      - Show this help message"
  echo ""
  echo "This is a simplified version using the standalone document service"
  echo "that leverages TypeScript and a service-based architecture."
}

# Create temp file to run service commands
function run_ts_command() {
  local command=$1
  local count=$2
  local ts_file="${ROOT_DIR}/tmp/document-command-runner.ts"
  
  mkdir -p "${ROOT_DIR}/tmp"
  
  # Create the TypeScript runner file
  cat > "${ts_file}" << EOL
import { documentService } from '../scripts/cli-pipeline/document/standalone-document-service';

async function main() {
  try {
    switch('${command}') {
      case 'test-connection':
        await documentService.testConnection();
        break;
      case 'show-recent':
        await documentService.showRecentFiles(${count:-20});
        break;
      default:
        console.error('Unknown command: ${command}');
        process.exit(1);
    }
    process.exit(0);
  } catch (error) {
    console.error('Error executing command:', error);
    process.exit(1);
  }
}

main();
EOL

  # Run the TypeScript file
  cd "${ROOT_DIR}"
  npx ts-node --transpile-only "${ts_file}"
  return $?
}

# Main logic
option=$1
count=$2

# Process command line options
case $option in
  test-connection)
    run_ts_command "test-connection"
    exit $?
    ;;
  show-recent)
    # Validate count parameter
    if [[ -n "$count" && ! "$count" =~ ^[0-9]+$ ]]; then
      echo "Error: Count must be a positive integer"
      exit 1
    fi
    run_ts_command "show-recent" "${count:-20}"
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