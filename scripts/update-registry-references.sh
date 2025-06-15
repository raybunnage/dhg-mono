#!/bin/bash

# Update all references from registry_cli_pipelines to sys_cli_pipelines

echo "🔄 Updating references from registry_cli_pipelines to sys_cli_pipelines..."

# Find all files that reference registry_cli_pipelines
files=$(grep -r "registry_cli_pipelines" --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" --include="*.sql" --include="*.md" . | cut -d: -f1 | sort | uniq)

count=0
for file in $files; do
  # Skip migration files and this script
  if [[ $file == *"/migrations/"* ]] || [[ $file == *"update-registry-references.sh"* ]]; then
    echo "⏭️  Skipping: $file"
    continue
  fi
  
  echo "📝 Updating: $file"
  
  # Use sed to replace registry_cli_pipelines with sys_cli_pipelines
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' 's/registry_cli_pipelines/sys_cli_pipelines/g' "$file"
  else
    # Linux
    sed -i 's/registry_cli_pipelines/sys_cli_pipelines/g' "$file"
  fi
  
  count=$((count + 1))
done

echo "✅ Updated $count files"
echo ""
echo "📋 Files updated:"
for file in $files; do
  if [[ $file != *"/migrations/"* ]] && [[ $file != *"update-registry-references.sh"* ]]; then
    echo "  - $file"
  fi
done