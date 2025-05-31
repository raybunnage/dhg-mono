#!/bin/bash

# Test the document classification process
# This script runs the test-classify-document-types.ts file to verify document types are being
# properly delivered to Claude AI and classification is working as expected

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Go to the repository root
cd "$SCRIPT_DIR/../../.."

# Set environment variables
source .env.development

# Run the TypeScript file
echo "Running document classification test..."
npx ts-node scripts/cli-pipeline/document/test-classify-document-types.ts