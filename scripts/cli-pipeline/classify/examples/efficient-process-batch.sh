#!/bin/bash

# Process a larger batch of documents efficiently with concurrency and rate limiting
# This script balances processing speed with API rate limits

# Change to the project root directory
cd "$(dirname "$0")/../../../.."

# Define parameters - adjust these according to your needs
BATCH_SIZE=100         # Number of documents to process
CONCURRENCY=3          # Number of concurrent requests (balance with rate limits)
MAX_RETRIES=5          # Number of retries for failed requests
RETRY_DELAY=2000       # Initial delay between retries (ms)
EXTENSIONS="mp4,pdf,docx,txt,pptx"  # Target only specific file types

# Process a batch of documents with balanced concurrency
echo "Starting batch processing with concurrency=$CONCURRENCY"
echo "Processing up to $BATCH_SIZE documents with extensions: $EXTENSIONS"

# Run the classify-subjects command with concurrent processing
ts-node scripts/cli-pipeline/classify/index.ts classify-subjects \
  --update-title \
  --skip-classified \
  --limit $BATCH_SIZE \
  --extensions "$EXTENSIONS" \
  --concurrency $CONCURRENCY \
  --max-retries $MAX_RETRIES \
  --retry-delay $RETRY_DELAY \
  --verbose

echo "✅ Batch processing complete"