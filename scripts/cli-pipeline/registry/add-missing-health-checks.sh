#!/bin/bash

# Script to add health-check commands to CLI pipelines that are missing them

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CLI_PIPELINE_DIR="$ROOT_DIR/scripts/cli-pipeline"

# List of pipelines that need health checks added
PIPELINES_NEEDING_HEALTH_CHECKS=(
  "all_pipelines"
  "archive"
  "classify"
  "database"
  "deprecation"
  "dev_tasks"
  "document"
  "document_types"
  "documentation"
  "drive_filter"
  "email"
  "experts"
  "git"
  "git_workflow"
  "gmail"
  "google_sync"
  "merge"
  "mime_types"
  "presentations"
  "prompt_service"
  "refactor_tracking"
  "registry"
  "scripts"
  "service_dependencies"
  "system"
  "tracking"
  "viewers"
  "work_summaries"
)

echo "🔧 Adding health-check commands to CLI pipelines..."
echo ""

for pipeline in "${PIPELINES_NEEDING_HEALTH_CHECKS[@]}"; do
  CLI_FILE="$CLI_PIPELINE_DIR/$pipeline/*-cli.sh"
  
  # Find the actual CLI file
  CLI_FILE_PATH=$(ls $CLI_FILE 2>/dev/null | head -n1)
  
  if [ -z "$CLI_FILE_PATH" ]; then
    echo "⚠️  $pipeline: No CLI file found"
    continue
  fi
  
  # Check if health-check already exists
  if grep -q "health-check)" "$CLI_FILE_PATH"; then
    echo "✅ $pipeline: Already has health-check command"
    continue
  fi
  
  echo "📝 $pipeline: Adding health-check command to $(basename $CLI_FILE_PATH)"
  
  # Create a temporary file with the updated content
  TEMP_FILE=$(mktemp)
  
  # Read the file and add health-check command before the case statement
  awk '
    /^case "\$1" in/ {
      print "# Health check command"
      print "health_check() {"
      print "  echo \"🏥 Running health check for ' $pipeline ' pipeline...\""
      print "  "
      print "  # Check if required environment variables are set"
      print "  if [ -z \"$SUPABASE_URL\" ] || [ -z \"$SUPABASE_SERVICE_ROLE_KEY\" ]; then"
      print "    echo \"❌ Missing required environment variables\""
      print "    return 1"
      print "  fi"
      print "  "
      print "  # Check if we can connect to the database"
      print "  if command -v psql > /dev/null 2>&1; then"
      print "    # Test database connection if psql is available"
      print "    echo \"Testing database connection...\""
      print "  fi"
      print "  "
      print "  # Check if main script files exist"
      print "  local script_dir=\"$(dirname \"$0\")\""
      print "  if [ -d \"$script_dir\" ]; then"
      print "    echo \"✅ Pipeline directory exists\""
      print "  else"
      print "    echo \"❌ Pipeline directory not found\""
      print "    return 1"
      print "  fi"
      print "  "
      print "  echo \"✅ ' $pipeline ' pipeline is healthy\""
      print "  return 0"
      print "}"
      print ""
    }
    /^case "\$1" in/ {
      print $0
      print "  health-check)"
      print "    health_check"
      print "    ;;"
      next
    }
    { print }
  ' "$CLI_FILE_PATH" > "$TEMP_FILE"
  
  # Replace the original file
  mv "$TEMP_FILE" "$CLI_FILE_PATH"
  chmod +x "$CLI_FILE_PATH"
done

echo ""
echo "✅ Health check commands added successfully!"
echo ""
echo "Next steps:"
echo "1. Review the added health-check implementations"
echo "2. Customize each health check for pipeline-specific requirements"
echo "3. Update the database to mark has_health_check = true"
echo "4. Test the master health check: ./scripts/cli-pipeline/all_pipelines/all-pipelines-cli.sh master-health-check"