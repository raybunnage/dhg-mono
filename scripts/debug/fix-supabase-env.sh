#!/bin/bash
# fix-supabase-env.sh - Script to fix Supabase environment variables

# This script sets up a hook to ensure Supabase environment variables
# are always available across the different naming patterns

# Print header
echo "📊 Setting up Supabase environment variable compatibility layer..."

# Get the shell config file based on the current shell
SHELL_NAME=$(basename "$SHELL")
if [ "$SHELL_NAME" = "bash" ]; then
  SHELL_CONFIG="$HOME/.bashrc"
  [ -f "$HOME/.bash_profile" ] && SHELL_CONFIG="$HOME/.bash_profile"
elif [ "$SHELL_NAME" = "zsh" ]; then
  SHELL_CONFIG="$HOME/.zshrc"
else
  echo "⚠️ Unsupported shell: $SHELL_NAME"
  echo "Please manually add the environment variable compatibility code to your shell config file."
  exit 1
fi

# Create a file with the Supabase environment variable normalization code
SUPABASE_ENV_FILE="$HOME/.supabase_env_compat"

cat > "$SUPABASE_ENV_FILE" << 'EOL'
# Supabase environment variable compatibility layer
# This ensures that Supabase environment variables are available in all formats

# Function to normalize Supabase environment variables
normalize_supabase_env() {
  # If CLI_ variables are set, use them as the source of truth
  if [[ -n "$CLI_SUPABASE_URL" && -n "$CLI_SUPABASE_KEY" ]]; then
    export SUPABASE_URL="$CLI_SUPABASE_URL"
    export SUPABASE_KEY="$CLI_SUPABASE_KEY"
    export SUPABASE_SERVICE_ROLE_KEY="$CLI_SUPABASE_KEY"
    export VITE_SUPABASE_URL="$CLI_SUPABASE_URL"
    export VITE_SUPABASE_SERVICE_ROLE_KEY="$CLI_SUPABASE_KEY"
  # If non-prefixed variables are set, use them
  elif [[ -n "$SUPABASE_URL" ]]; then
    # URL is set, now check for a key
    local KEY=""
    if [[ -n "$SUPABASE_KEY" ]]; then
      KEY="$SUPABASE_KEY"
    elif [[ -n "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
      KEY="$SUPABASE_SERVICE_ROLE_KEY"
      export SUPABASE_KEY="$KEY"
    fi
    
    if [[ -n "$KEY" ]]; then
      export CLI_SUPABASE_URL="$SUPABASE_URL"
      export CLI_SUPABASE_KEY="$KEY"
      export VITE_SUPABASE_URL="$SUPABASE_URL"
      export VITE_SUPABASE_SERVICE_ROLE_KEY="$KEY"
    fi
  # If VITE_ variables are set, use them
  elif [[ -n "$VITE_SUPABASE_URL" && -n "$VITE_SUPABASE_SERVICE_ROLE_KEY" ]]; then
    export SUPABASE_URL="$VITE_SUPABASE_URL"
    export SUPABASE_KEY="$VITE_SUPABASE_SERVICE_ROLE_KEY"
    export SUPABASE_SERVICE_ROLE_KEY="$VITE_SUPABASE_SERVICE_ROLE_KEY"
    export CLI_SUPABASE_URL="$VITE_SUPABASE_URL"
    export CLI_SUPABASE_KEY="$VITE_SUPABASE_SERVICE_ROLE_KEY"
  fi
}

# Run normalization
normalize_supabase_env
EOL

# Add the source command to the shell config file if it's not already there
if ! grep -q "source \"$SUPABASE_ENV_FILE\"" "$SHELL_CONFIG"; then
  echo "" >> "$SHELL_CONFIG"
  echo "# Source Supabase environment variable compatibility layer" >> "$SHELL_CONFIG"
  echo "[ -f \"$SUPABASE_ENV_FILE\" ] && source \"$SUPABASE_ENV_FILE\"" >> "$SHELL_CONFIG"
  
  echo "✅ Successfully added Supabase environment variable compatibility to $SHELL_CONFIG"
  echo "Please run 'source $SHELL_CONFIG' to apply the changes to your current session."
else
  echo "✅ Supabase environment variable compatibility already configured in $SHELL_CONFIG"
fi

# Create a helper script in the project to set environment variables for a single command
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SUPABASE_ENV_SCRIPT="$PROJECT_ROOT/scripts/debug/set-supabase-env.sh"

cat > "$SUPABASE_ENV_SCRIPT" << 'EOL'
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
EOL

# Make it executable
chmod +x "$SUPABASE_ENV_SCRIPT"

echo "✅ Created helper script: $SUPABASE_ENV_SCRIPT"
echo ""
echo "You can now run commands with normalized Supabase environment variables like this:"
echo "./scripts/debug/set-supabase-env.sh ./scripts/cli-pipeline/script-pipeline-main.sh generate-summary"
echo ""
echo "This script ensures that all variants of Supabase environment variables are set,"
echo "regardless of which format is available in your environment or .env files."