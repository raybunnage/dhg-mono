#!/bin/bash

# This script runs the documentation queue processor with the supplied environment variables
# Usage: ./run-docs-processor.sh [options]
# Options are passed directly to the Node.js script

# Set up environment variables for Supabase connection
source .env.local 2>/dev/null || source .env 2>/dev/null

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo "Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env or .env.local"
  exit 1
fi

# Set the service key as the Supabase key for the script
export SUPABASE_KEY=$SUPABASE_SERVICE_KEY

# Run the processor script
node scripts/process-docs-queue.js "$@"