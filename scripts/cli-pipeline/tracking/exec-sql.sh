#!/bin/bash

# Execute SQL Script Utility
# Runs a SQL script against the Supabase database

# Get directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Load environment variables
if [ -f "$ROOT_DIR/.env.development" ]; then
  source "$ROOT_DIR/.env.development"
  export SUPABASE_URL
  export SUPABASE_SERVICE_ROLE_KEY
  export SUPABASE_ANON_KEY
  # Export other necessary environment variables
fi

# Make script executable
chmod +x "$SCRIPT_DIR/exec-sql.sh"

# Change to the root directory
cd "$ROOT_DIR"

# Run the TypeScript implementation with all arguments
NODE_PATH="$ROOT_DIR/node_modules" npx ts-node -P "$ROOT_DIR/tsconfig.json" "$SCRIPT_DIR/exec-sql.ts" "$@"