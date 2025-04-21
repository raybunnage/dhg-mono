#!/bin/bash
# Script to reset and reclassify documents in one step

echo "=== Step 1: Reset documents to needs_reprocessing status ==="
ts-node /Users/raybunnage/Documents/github/dhg-mono/test-scripts/reset-documents.ts

echo ""
echo "=== Step 2: Reclassify documents ==="
cd /Users/raybunnage/Documents/github/dhg-mono && ./scripts/cli-pipeline/google_sync/google-sync-cli.sh reclassify-docs --limit 5

echo ""
echo "=== Done! ==="