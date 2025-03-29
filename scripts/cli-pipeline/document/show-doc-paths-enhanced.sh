#!/bin/bash

# Enhanced script to show documentation file paths using ts-node
# This uses an interactive menu-based TypeScript script with improved error handling

# Change to project root directory for proper loading of environment files
cd "$(dirname "$0")/../.."
echo "Current directory: $(pwd)"

# Run the enhanced TypeScript script
ts-node scripts/cli-pipeline/display-doc-paths-enhanced.ts