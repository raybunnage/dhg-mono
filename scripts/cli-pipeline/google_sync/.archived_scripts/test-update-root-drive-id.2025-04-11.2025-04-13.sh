#!/bin/bash
# Archived on 2025-04-11 - Original file used with sources_google table

# Test script for the update-root-drive-id command
# This script runs the command with dry-run mode to show what would happen

# Change to the root directory of the project
cd "$(dirname "$0")/../../../"

# Run with dry run mode to see what would happen
echo "Testing update-root-drive-id with dry run mode..."
ts-node scripts/cli-pipeline/google_sync/update-root-drive-id.ts \
  --root-id 1wriOM2j2IglnMcejplqG_XcCxSIfoRMV \
  --dry-run \
  --batch-size 200

# To run the actual update (without dry-run), uncomment the following:
# echo -e "\nRunning actual update (this will modify the database)..."
# ts-node scripts/cli-pipeline/google_sync/update-root-drive-id.ts \
#   --root-id 1wriOM2j2IglnMcejplqG_XcCxSIfoRMV \
#   --batch-size 200

# Show help for the command
echo -e "\nShowing help for update-root-drive-id command..."
ts-node scripts/cli-pipeline/google_sync/update-root-drive-id.ts --help