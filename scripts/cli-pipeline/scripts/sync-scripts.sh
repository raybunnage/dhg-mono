#!/bin/bash

# Script to sync scripts with the database
# This is a wrapper around the direct-db-sync.ts script

# Get the script directory and root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Load environment variables
for ENV_FILE in "${ROOT_DIR}/.env" "${ROOT_DIR}/.env.local" "${ROOT_DIR}/.env.development"; do
  if [ -f "${ENV_FILE}" ]; then
    echo "Loading environment variables from ${ENV_FILE}..."
    set -a
    source "${ENV_FILE}"
    set +a
  fi
done

# Run the direct database sync script
echo "Running direct database sync..."
ts-node "${SCRIPT_DIR}/direct-db-sync.ts"

# Check if sync was successful
if [ $? -eq 0 ]; then
  echo "✅ Script sync completed successfully!"
else
  echo "❌ Script sync failed!"
  exit 1
fi

exit 0