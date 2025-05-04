#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"

# Change to project root directory
cd "$PROJECT_ROOT"

echo "Verifying CLI script setup..."

# 1. Check for any remaining references to old path
echo "Checking for old path references..."
find packages/cli -type f -exec grep -l "scripts/" {} \; 2>/dev/null

# 2. Verify all scripts are executable
echo -e "\nVerifying script permissions..."
find scripts/cli-pipeline -type f -name "*.sh" -exec ls -l {} \;

# 3. Test a sample script execution
echo -e "\nTesting script execution..."
if [ -f scripts/cli-pipeline/build-cli.sh ]; then
    scripts/cli-pipeline/build-cli.sh --dry-run 2>&1 || echo "Script test failed"
fi

# 4. Verify package.json scripts
echo -e "\nVerifying package.json scripts..."
cat packages/cli/package.json | grep -A 20 '"scripts":' 