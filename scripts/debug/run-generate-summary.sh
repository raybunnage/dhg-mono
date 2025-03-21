#!/bin/bash
# run-generate-summary.sh - A simplified script to run the summary generator

# Script directory and root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
OUTPUT_FILE="${ROOT_DIR}/docs/script-reports/script-summary-$(date +%Y-%m-%d).md"

# Create output directory if it doesn't exist
mkdir -p "${ROOT_DIR}/docs/script-reports"

# Display intro
echo "📊 Running modified script summary generator..."
echo "Output file: ${OUTPUT_FILE}"

# Debug: Print all relevant environment variables
echo "DEBUG: Environment variables:"
echo "  SUPABASE_URL=${SUPABASE_URL:-not set}"
echo "  CLI_SUPABASE_URL=${CLI_SUPABASE_URL:-not set}"
echo "  VITE_SUPABASE_URL=${VITE_SUPABASE_URL:-not set}"

# Attempt to load from .env files if environment variables aren't set
if [ -z "${SUPABASE_URL}" ] && [ -z "${CLI_SUPABASE_URL}" ] && [ -z "${VITE_SUPABASE_URL}" ]; then
  echo "No Supabase URL found in environment, checking .env files..."
  ENV_FILES=(".env.local" ".env.development" ".env")
  
  for env_file in "${ENV_FILES[@]}"; do
    FULL_PATH="${ROOT_DIR}/${env_file}"
    if [ -f "$FULL_PATH" ]; then
      echo "Loading variables from ${env_file}..."
      # shellcheck disable=SC1090
      source "$FULL_PATH"
      
      # Check if we got the variables we need
      if [ -n "${SUPABASE_URL}" ] || [ -n "${CLI_SUPABASE_URL}" ] || [ -n "${VITE_SUPABASE_URL}" ]; then
        echo "Found Supabase URL in ${env_file}"
        break
      fi
    fi
  done
fi

# First try CLI_ prefixed vars, then non-prefixed, then VITE_ prefixed
EFFECTIVE_SUPABASE_URL="${CLI_SUPABASE_URL:-${SUPABASE_URL:-${VITE_SUPABASE_URL:-}}}"
EFFECTIVE_SUPABASE_KEY="${CLI_SUPABASE_KEY:-${SUPABASE_KEY:-${SUPABASE_SERVICE_ROLE_KEY:-${VITE_SUPABASE_SERVICE_ROLE_KEY:-}}}}"

# Check if we have the required environment variables
if [ -z "$EFFECTIVE_SUPABASE_URL" ] || [ -z "$EFFECTIVE_SUPABASE_KEY" ]; then
  echo "⚠️ Missing Supabase credentials!"
  echo "Please set one of these environment variable pairs:"
  echo "  - SUPABASE_URL and SUPABASE_KEY"
  echo "  - CLI_SUPABASE_URL and CLI_SUPABASE_KEY"
  echo "  - VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY"
  
  # Ask user if they want to enter credentials manually
  read -p "Would you like to enter Supabase credentials now? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter Supabase URL: " EFFECTIVE_SUPABASE_URL
    read -p "Enter Supabase Key: " EFFECTIVE_SUPABASE_KEY
    
    # Exit if either is still empty
    if [ -z "$EFFECTIVE_SUPABASE_URL" ] || [ -z "$EFFECTIVE_SUPABASE_KEY" ]; then
      echo "⚠️ You must provide both URL and key. Exiting."
      exit 1
    fi
  else
    echo "Exiting without generating report."
    exit 1
  fi
fi

# Install dependencies if needed
if ! command -v node &> /dev/null; then
  echo "⚠️ Node.js not found. Please install Node.js to run this script."
  exit 1
fi

# Try to install @supabase/supabase-js if not already installed
if ! npm list @supabase/supabase-js &> /dev/null; then
  echo "Installing @supabase/supabase-js..."
  npm install --no-save @supabase/supabase-js &> /dev/null
fi

# Execute the script
echo "Running script with Supabase URL: ${EFFECTIVE_SUPABASE_URL}"
echo "Key length: ${#EFFECTIVE_SUPABASE_KEY} characters"
SUPABASE_URL="${EFFECTIVE_SUPABASE_URL}" \
SUPABASE_KEY="${EFFECTIVE_SUPABASE_KEY}" \
CLI_SUPABASE_URL="${EFFECTIVE_SUPABASE_URL}" \
CLI_SUPABASE_KEY="${EFFECTIVE_SUPABASE_KEY}" \
VITE_SUPABASE_URL="${EFFECTIVE_SUPABASE_URL}" \
VITE_SUPABASE_SERVICE_ROLE_KEY="${EFFECTIVE_SUPABASE_KEY}" \
SUPABASE_SERVICE_ROLE_KEY="${EFFECTIVE_SUPABASE_KEY}" \
OUTPUT_PATH="${OUTPUT_FILE}" \
SCRIPT_LIMIT="50" \
INCLUDE_DELETED="false" \
node "${SCRIPT_DIR}/modified-generate-summary.js"

# Check if the report was generated successfully
if [ -f "${OUTPUT_FILE}" ]; then
  echo "✅ Summary report generation completed successfully"
  echo "Report saved to: ${OUTPUT_FILE}"
else
  echo "❌ Failed to generate summary report"
  exit 1
fi

echo ""
echo "🔍 RECOMMENDATION: Add these lines to your ~/.bashrc or ~/.zshrc file:"
echo "# Supabase environment variables"
echo "export SUPABASE_URL=\"${EFFECTIVE_SUPABASE_URL}\""
echo "export SUPABASE_KEY=\"${EFFECTIVE_SUPABASE_KEY}\""
echo "export SUPABASE_SERVICE_ROLE_KEY=\"${EFFECTIVE_SUPABASE_KEY}\""
echo "export CLI_SUPABASE_URL=\"${EFFECTIVE_SUPABASE_URL}\""
echo "export CLI_SUPABASE_KEY=\"${EFFECTIVE_SUPABASE_KEY}\""