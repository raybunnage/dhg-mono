#!/bin/bash

# Simple script to show documentation file paths using ts-node
# This uses a simplified TS script that only focuses on basic functionality

# Change to project root directory
cd "$(dirname "$0")/../.."
echo "Current directory: $(pwd)"

# Set DEBUG flag for more verbose output if needed
# export DEBUG=1

# Run the simplified TypeScript script with proper error handling
ts-node scripts/cli-pipeline/display-doc-paths-simple.ts
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo "Script exited with error code: $EXIT_CODE"
  exit $EXIT_CODE
fi