#!/bin/bash

# Path to the CLI package
CLI_DIR="../../packages/cli"

# Navigate to CLI directory and build
cd "$CLI_DIR" && npm run build

# Return to original directory
cd - > /dev/null

echo "CLI build completed"
echo "Now remember to run the analyze-scripts.sh script from the dhg-mono root directory"