#!/bin/bash

# Extract titles for MP4 files for a specific expert
# Usage: ./extract-expert-titles.sh EXPERT_NAME
# Example: ./extract-expert-titles.sh "Navieux"

# Change to the project root directory
cd "$(dirname "$0")/../../../.."

# Check if expert name is provided
if [ -z "$1" ]; then
  echo "Error: Expert name is required"
  echo "Usage: ./extract-expert-titles.sh EXPERT_NAME"
  exit 1
fi

EXPERT_NAME="$1"
echo "Extracting titles for expert: $EXPERT_NAME"

# Run the extract-titles command for the specific expert
ts-node scripts/cli-pipeline/classify/index.ts extract-titles \
  --limit 100 \
  --expert "$EXPERT_NAME" \
  --concurrency 3 \
  --max-retries 3 \
  --verbose

echo "✅ Title extraction complete for expert: $EXPERT_NAME"