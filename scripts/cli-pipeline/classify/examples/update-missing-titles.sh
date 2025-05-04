#!/bin/bash

# Update missing titles in expert_documents using the classify-subjects command
# This script will find expert documents that are missing titles and use the classify-subjects
# command to extract titles from their content and update the database.

# Change to the project root directory
cd "$(dirname "$0")/../../../.."

# Run the classify-subjects command with options to:
# 1. Only find documents missing titles
# 2. Update the title field with the extracted title
# 3. Process up to 100 documents
ts-node scripts/cli-pipeline/classify/index.ts classify-subjects \
  --missing-titles-only \
  --update-title \
  --limit 100 \
  --verbose

echo "✅ Title update complete"