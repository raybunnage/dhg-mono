#!/bin/bash
# CLI Pipeline Environment Loader
# This script loads environment variables from the repository root and app-specific files
# Usage: source load-env.sh [--verbose]

# Determine repository root
if [ -z "$REPO_ROOT" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
fi

VERBOSE=false
if [[ "$1" == "--verbose" ]]; then
  VERBOSE=true
fi

# Define environment file locations with order of precedence
ROOT_ENV_FILE="$REPO_ROOT/.env"
ROOT_ENV_DEV="$REPO_ROOT/.env.development"
ROOT_ENV_LOCAL="$REPO_ROOT/.env.local" 
APP_ENV_FILE="$REPO_ROOT/apps/dhg-improve-experts/.env.development"

# Function to log messages (only if verbose is true)
function log_msg {
  if $VERBOSE; then
    echo "$1"
  fi
}

# Load environment variables in order of precedence
if [[ -f "$ROOT_ENV_FILE" ]]; then
  log_msg "Loading base environment variables from $ROOT_ENV_FILE"
  set -a
  source "$ROOT_ENV_FILE"
  set +a
else
  log_msg "Base .env file not found at $ROOT_ENV_FILE"
fi

if [[ -f "$ROOT_ENV_DEV" ]]; then
  log_msg "Loading development environment variables from $ROOT_ENV_DEV"
  set -a
  source "$ROOT_ENV_DEV"
  set +a
else
  log_msg "Development .env file not found at $ROOT_ENV_DEV"
fi

if [[ -f "$ROOT_ENV_LOCAL" ]]; then
  log_msg "Loading local environment variables from $ROOT_ENV_LOCAL"
  set -a
  source "$ROOT_ENV_LOCAL"
  set +a
else
  log_msg "Local .env file not found at $ROOT_ENV_LOCAL"
fi

# Fallback to app-specific .env.development if needed
if [[ -f "$APP_ENV_FILE" ]]; then
  log_msg "Loading app-specific environment variables from $APP_ENV_FILE"
  set -a
  source "$APP_ENV_FILE"
  set +a
else
  log_msg "App-specific .env file not found at $APP_ENV_FILE"
fi

# Check if any environment file was found
if [[ ! -f "$ROOT_ENV_FILE" && ! -f "$ROOT_ENV_DEV" && ! -f "$ROOT_ENV_LOCAL" && ! -f "$APP_ENV_FILE" ]]; then
  echo "ERROR: No environment files found"
  return 1
fi

# Ensure CLI_ prefixed variables are set properly
# If CLI_ variable is not set but non-CLI version exists, use that
if [[ -z "$CLI_SUPABASE_URL" && -n "$SUPABASE_URL" ]]; then
  export CLI_SUPABASE_URL="$SUPABASE_URL"
  log_msg "Setting CLI_SUPABASE_URL from SUPABASE_URL"
elif [[ -z "$CLI_SUPABASE_URL" && -n "$VITE_SUPABASE_URL" ]]; then
  export CLI_SUPABASE_URL="$VITE_SUPABASE_URL"
  log_msg "Setting CLI_SUPABASE_URL from VITE_SUPABASE_URL"
fi

if [[ -z "$CLI_SUPABASE_KEY" && -n "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
  export CLI_SUPABASE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
  log_msg "Setting CLI_SUPABASE_KEY from SUPABASE_SERVICE_ROLE_KEY"
elif [[ -z "$CLI_SUPABASE_KEY" && -n "$VITE_SUPABASE_SERVICE_ROLE_KEY" ]]; then
  export CLI_SUPABASE_KEY="$VITE_SUPABASE_SERVICE_ROLE_KEY"
  log_msg "Setting CLI_SUPABASE_KEY from VITE_SUPABASE_SERVICE_ROLE_KEY"
fi

if [[ -z "$CLI_CLAUDE_API_KEY" && -n "$ANTHROPIC_API_KEY" ]]; then
  export CLI_CLAUDE_API_KEY="$ANTHROPIC_API_KEY"
  log_msg "Setting CLI_CLAUDE_API_KEY from ANTHROPIC_API_KEY"
elif [[ -z "$CLI_CLAUDE_API_KEY" && -n "$VITE_ANTHROPIC_API_KEY" ]]; then
  export CLI_CLAUDE_API_KEY="$VITE_ANTHROPIC_API_KEY"
  log_msg "Setting CLI_CLAUDE_API_KEY from VITE_ANTHROPIC_API_KEY"
fi

# Verify if critical variables are set
if [[ -n "$CLI_SUPABASE_URL" && -n "$CLI_SUPABASE_KEY" && -n "$CLI_CLAUDE_API_KEY" ]]; then
  log_msg "✅ Environment configuration complete. All required variables are set."
  return 0
else
  # Generate warning for missing variables
  if [[ -z "$CLI_SUPABASE_URL" ]]; then
    echo "WARNING: CLI_SUPABASE_URL is not set"
  fi
  if [[ -z "$CLI_SUPABASE_KEY" ]]; then
    echo "WARNING: CLI_SUPABASE_KEY is not set"
  fi
  if [[ -z "$CLI_CLAUDE_API_KEY" ]]; then
    echo "WARNING: CLI_CLAUDE_API_KEY is not set"
  fi
  return 0
fi