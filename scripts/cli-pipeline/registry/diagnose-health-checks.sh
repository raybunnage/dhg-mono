#!/bin/bash

# Diagnose health check failures for CLI pipelines

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CLI_PIPELINE_DIR="$PROJECT_ROOT/scripts/cli-pipeline"

echo "🔍 Diagnosing health check failures..."
echo ""

# Test each unhealthy pipeline individually
pipelines=(
  "ai"
  "classification"
  "document_types"
  "documentation"
  "experts"
  "git"
  "merge"
  "presentations"
  "prompt_service"
  "worktree"
  "google_sync"
  "media-processing"
  "script-analysis"
  "deprecation"
)

for pipeline in "${pipelines[@]}"; do
  echo "═══════════════════════════════════════════════════════"
  echo "Testing: $pipeline"
  echo "═══════════════════════════════════════════════════════"
  
  cli_script=$(find "$CLI_PIPELINE_DIR/$pipeline" -name "*-cli.sh" -type f | head -1)
  
  if [ -z "$cli_script" ]; then
    echo "❌ No CLI script found for $pipeline"
    continue
  fi
  
  echo "Script: $cli_script"
  echo "Running health check..."
  
  # Run health check and capture just the last few lines of output
  output=$("$cli_script" health-check 2>&1 | tail -20)
  exit_code=$?
  
  if [ $exit_code -eq 0 ]; then
    echo "✅ Health check passed"
  else
    echo "❌ Health check failed (exit code: $exit_code)"
    echo "Last 20 lines of output:"
    echo "$output"
  fi
  
  echo ""
done

echo "Summary complete. Common issues found:"
echo "1. TypeScript compilation errors (import.meta.env in CommonJS)"
echo "2. Missing or renamed database tables"
echo "3. Incorrect variable references (\$ROOT_DIR vs \$PROJECT_ROOT)"
echo "4. Missing environment variables or configuration"