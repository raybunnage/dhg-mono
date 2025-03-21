#!/bin/bash
# set-supabase-env.sh - Run a command with normalized Supabase environment variables

# Function to normalize Supabase environment variables
normalize_supabase_env() {
  # Start with what we have in the environment
  local SUPA_URL="${SUPABASE_URL:-${CLI_SUPABASE_URL:-${VITE_SUPABASE_URL:-}}}"
  local SUPA_KEY="${SUPABASE_KEY:-${CLI_SUPABASE_KEY:-${SUPABASE_SERVICE_ROLE_KEY:-${VITE_SUPABASE_SERVICE_ROLE_KEY:-}}}}"
  
  # If we still don't have values, try to get them from .env files
  if [ -z "$SUPA_URL" ] || [ -z "$SUPA_KEY" ]; then
    local ENV_FILES=(".env.local" ".env.development" ".env")
    
    for env_file in "${ENV_FILES[@]}"; do
      if [ -f "$env_file" ]; then
        echo "Loading variables from $env_file..."
        
        # Extract values from the .env file
        local URL_FROM_FILE=$(grep -E "SUPABASE_URL|CLI_SUPABASE_URL|VITE_SUPABASE_URL" "$env_file" | head -1 | cut -d '=' -f2- | tr -d ' ')
        local KEY_FROM_FILE=$(grep -E "SUPABASE_KEY|SUPABASE_SERVICE_ROLE_KEY|CLI_SUPABASE_KEY|VITE_SUPABASE_SERVICE_ROLE_KEY" "$env_file" | head -1 | cut -d '=' -f2- | tr -d ' ')
        
        # Use these values if they're set and we don't already have values
        [ -z "$SUPA_URL" ] && [ -n "$URL_FROM_FILE" ] && SUPA_URL="$URL_FROM_FILE"
        [ -z "$SUPA_KEY" ] && [ -n "$KEY_FROM_FILE" ] && SUPA_KEY="$KEY_FROM_FILE"
        
        # Break if we have both values
        if [ -n "$SUPA_URL" ] && [ -n "$SUPA_KEY" ]; then
          break
        fi
      fi
    done
  fi
  
  # Export all environment variables
  export SUPABASE_URL="$SUPA_URL"
  export SUPABASE_KEY="$SUPA_KEY"
  export SUPABASE_SERVICE_ROLE_KEY="$SUPA_KEY"
  export CLI_SUPABASE_URL="$SUPA_URL"
  export CLI_SUPABASE_KEY="$SUPA_KEY"
  export VITE_SUPABASE_URL="$SUPA_URL"
  export VITE_SUPABASE_SERVICE_ROLE_KEY="$SUPA_KEY"
  
  # Output what we've set
  echo "✅ Using Supabase URL: ${SUPA_URL}"
  echo "✅ Supabase key length: ${#SUPA_KEY} characters"
}

# Show usage if no arguments
if [ $# -eq 0 ]; then
  echo "Usage: $0 command [arguments]"
  echo "Runs the specified command with normalized Supabase environment variables."
  exit 1
fi

# Normalize environment variables
normalize_supabase_env

# Run the command with the normalized environment
echo "🚀 Running command: $@"
"$@"
exit $?
