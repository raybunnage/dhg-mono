#!/bin/bash

# Update titles with concurrency for expert documents
# This script uses concurrent processing to update titles faster

# Change to the project root directory
cd "$(dirname "$0")/../../../.."

# Run the classify-subjects command with concurrency:
# 1. Process up to 50 documents
# 2. Process 3 documents concurrently
# 3. Update titles and only find documents missing titles
ts-node scripts/cli-pipeline/classify/index.ts classify-subjects \
  --missing-titles-only \
  --update-title \
  --limit 50 \
  --concurrency 3 \
  --max-retries 3 \
  --retry-delay 1500 \
  --verbose

echo "✅ Title update with concurrency complete"