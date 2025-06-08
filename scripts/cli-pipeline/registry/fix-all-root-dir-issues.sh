#!/bin/bash

# Comprehensive fix for ROOT_DIR vs PROJECT_ROOT issues in CLI scripts

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CLI_PIPELINE_DIR="$PROJECT_ROOT/scripts/cli-pipeline"

echo "🔧 Comprehensive fix for ROOT_DIR vs PROJECT_ROOT issues..."
echo ""

# Step 1: Fix variable definitions (ROOT_DIR to PROJECT_ROOT)
echo "Step 1: Updating variable definitions..."
find "$CLI_PIPELINE_DIR" -name "*-cli.sh" -type f | while read -r file; do
  if grep -q '^ROOT_DIR=' "$file"; then
    echo "📝 Updating variable definition in: $(basename $(dirname $file))/$(basename $file)"
    sed -i '' 's/^ROOT_DIR=/PROJECT_ROOT=/g' "$file"
  fi
done

# Step 2: Update all references to ROOT_DIR to use PROJECT_ROOT
echo ""
echo "Step 2: Updating all ROOT_DIR references to PROJECT_ROOT..."
find "$CLI_PIPELINE_DIR" -name "*-cli.sh" -type f | while read -r file; do
  if grep -q '\$ROOT_DIR' "$file"; then
    echo "📝 Updating references in: $(basename $(dirname $file))/$(basename $file)"
    sed -i '' 's/\$ROOT_DIR/\$PROJECT_ROOT/g' "$file"
  fi
done

# Step 3: Fix any lingering ${ROOT_DIR} references (with braces)
echo ""
echo "Step 3: Fixing ${ROOT_DIR} references..."
find "$CLI_PIPELINE_DIR" -name "*-cli.sh" -type f | while read -r file; do
  if grep -q '${ROOT_DIR}' "$file"; then
    echo "📝 Fixing braced references in: $(basename $(dirname $file))/$(basename $file)"
    sed -i '' 's/${ROOT_DIR}/${PROJECT_ROOT}/g' "$file"
  fi
done

echo ""
echo "✅ Comprehensive fix complete!"
echo ""

# Verify no ROOT_DIR references remain
echo "🔍 Verification check..."
remaining=$(grep -r 'ROOT_DIR' "$CLI_PIPELINE_DIR" --include="*-cli.sh" | grep -v "PROJECT_ROOT=" | wc -l)

if [ "$remaining" -gt 0 ]; then
  echo "⚠️  Found $remaining remaining ROOT_DIR references:"
  grep -r 'ROOT_DIR' "$CLI_PIPELINE_DIR" --include="*-cli.sh" | grep -v "PROJECT_ROOT="
else
  echo "✅ No ROOT_DIR references found - all updated to PROJECT_ROOT!"
fi