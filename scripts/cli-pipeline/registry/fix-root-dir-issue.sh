#!/bin/bash

# Fix the common $ROOT_DIR issue in CLI scripts
# Many scripts use $ROOT_DIR instead of $PROJECT_ROOT for tsconfig.node.json

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CLI_PIPELINE_DIR="$PROJECT_ROOT/scripts/cli-pipeline"

echo "🔧 Fixing \$ROOT_DIR references in CLI scripts..."

# Find all CLI shell scripts that have the issue
find "$CLI_PIPELINE_DIR" -name "*-cli.sh" -type f | while read -r file; do
  if grep -q '\$ROOT_DIR/tsconfig.node.json' "$file"; then
    echo "📝 Fixing: $file"
    # Replace $ROOT_DIR with $PROJECT_ROOT in the tsconfig.node.json path
    sed -i '' 's/\$ROOT_DIR\/tsconfig\.node\.json/\$PROJECT_ROOT\/tsconfig.node.json/g' "$file"
  fi
done

echo "✅ Fixed all \$ROOT_DIR references"
echo ""
echo "🔍 Checking for any remaining issues..."
remaining=$(grep -r '\$ROOT_DIR' "$CLI_PIPELINE_DIR" --include="*-cli.sh" | grep -v "ROOT_DIR=" | wc -l)

if [ "$remaining" -gt 0 ]; then
  echo "⚠️  Found $remaining remaining \$ROOT_DIR references that may need manual review:"
  grep -r '\$ROOT_DIR' "$CLI_PIPELINE_DIR" --include="*-cli.sh" | grep -v "ROOT_DIR="
else
  echo "✅ No remaining \$ROOT_DIR issues found"
fi