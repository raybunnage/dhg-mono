#!/bin/bash

# Set variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Navigate to CLI directory and build
cd "$CLI_DIR" && npm run build

# Return to original directory
cd - > /dev/null

echo "CLI build completed"
echo "Now you can run the analyze-scripts.sh script from the packages/cli/scripts directory"