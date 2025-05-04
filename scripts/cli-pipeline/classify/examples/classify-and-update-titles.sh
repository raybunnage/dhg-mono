#!/bin/bash

# Classify subjects and update titles for expert documents
# This script will classify subjects and update the title field in one operation

# Change to the project root directory
cd "$(dirname "$0")/../../../.."

# Run the classify-subjects command with options to:
# 1. Update the title field with the extracted title
# 2. Process up to 20 documents (adjust as needed)
# 3. Skip documents that have already been classified
ts-node scripts/cli-pipeline/classify/index.ts classify-subjects \
  --update-title \
  --skip-classified \
  --limit 20 \
  --verbose

echo "✅ Classification and title update complete"