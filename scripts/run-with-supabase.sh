#!/bin/bash
# run-with-supabase.sh - Universal wrapper for running commands with Supabase credentials
# Usage: ./scripts/run-with-supabase.sh your-command-here [args...]

# Get script dir and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Try to load credentials from environment
SUPA_URL="${SUPABASE_URL:-${CLI_SUPABASE_URL:-${VITE_SUPABASE_URL:-}}}"
SUPA_KEY="${SUPABASE_KEY:-${CLI_SUPABASE_KEY:-${SUPABASE_SERVICE_ROLE_KEY:-${VITE_SUPABASE_SERVICE_ROLE_KEY:-}}}}"

# Check if we need to load from .env files
if [ -z "$SUPA_URL" ] || [ -z "$SUPA_KEY" ]; then
  # Try each .env file in order of precedence
  for env_file in ".env.local" ".env.development" ".env"; do
    FULL_PATH="${ROOT_DIR}/${env_file}"
    if [ -f "$FULL_PATH" ]; then
      echo "Loading variables from ${env_file}..."
      # shellcheck disable=SC1090
      source "$FULL_PATH"
      
      # Refresh variables
      SUPA_URL="${SUPABASE_URL:-${CLI_SUPABASE_URL:-${VITE_SUPABASE_URL:-}}}"
      SUPA_KEY="${SUPABASE_KEY:-${CLI_SUPABASE_KEY:-${SUPABASE_SERVICE_ROLE_KEY:-${VITE_SUPABASE_SERVICE_ROLE_KEY:-}}}}"
      
      # Break if we found what we need
      if [ -n "$SUPA_URL" ] && [ -n "$SUPA_KEY" ]; then
        break
      fi
    fi
  done
fi

# Verify we have credentials
if [ -z "$SUPA_URL" ] || [ -z "$SUPA_KEY" ]; then
  echo "❌ ERROR: Supabase credentials not found!"
  echo "Please run ./scripts/debug/supabase-fix.sh to set up your credentials."
  exit 1
fi

echo "→ Using Supabase URL: ${SUPA_URL}"
echo "→ Using Supabase key (${#SUPA_KEY} chars)"

# If no command was specified, just export the variables
if [ $# -eq 0 ]; then
  echo "No command specified. Run 'source $0' to export variables in current shell."
  echo "Or run '$0 your-command' to execute a command with the variables set."
  
  # Export variables so they're available in current shell if sourced
  export SUPABASE_URL="${SUPA_URL}"
  export SUPABASE_KEY="${SUPA_KEY}"
  export SUPABASE_SERVICE_ROLE_KEY="${SUPA_KEY}"
  export CLI_SUPABASE_URL="${SUPA_URL}"
  export CLI_SUPABASE_KEY="${SUPA_KEY}"
  export VITE_SUPABASE_URL="${SUPA_URL}"
  export VITE_SUPABASE_SERVICE_ROLE_KEY="${SUPA_KEY}"
else
  # Run the specified command with all Supabase variables set
  SUPABASE_URL="${SUPA_URL}" \
  SUPABASE_KEY="${SUPA_KEY}" \
  SUPABASE_SERVICE_ROLE_KEY="${SUPA_KEY}" \
  CLI_SUPABASE_URL="${SUPA_URL}" \
  CLI_SUPABASE_KEY="${SUPA_KEY}" \
  VITE_SUPABASE_URL="${SUPA_URL}" \
  VITE_SUPABASE_SERVICE_ROLE_KEY="${SUPA_KEY}" \
  "$@"
fi
