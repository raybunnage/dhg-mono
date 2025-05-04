#!/bin/bash

# Test Google Document Classification
# This script runs the test-google-doc-classification.ts file to classify Google Drive files
# without updating the database

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Go to the repository root
cd "$SCRIPT_DIR/../../.."

# Set environment variables
source .env.development

# Run the TypeScript file
echo "Running Google document classification test..."
npx ts-node scripts/cli-pipeline/document/test-google-doc-classification.ts