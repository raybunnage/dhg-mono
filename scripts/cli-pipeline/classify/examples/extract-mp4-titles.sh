#!/bin/bash

# Extract titles for MP4 files in the expert_documents table
# This script will:
# 1. Find MP4 files in sources_google that have missing titles in expert_documents
# 2. Extract and update titles using the subject-classification-prompt
# 3. Process up to 50 documents with concurrency

# Change to the project root directory
cd "$(dirname "$0")/../../../.."

# Run the extract-titles command with options:
ts-node scripts/cli-pipeline/classify/index.ts extract-titles \
  --limit 50 \
  --concurrency 3 \
  --max-retries 3 \
  --verbose

echo "✅ MP4 title extraction complete"