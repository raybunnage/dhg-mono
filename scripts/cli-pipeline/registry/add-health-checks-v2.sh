#!/bin/bash

# Script to add health-check commands to CLI pipelines that are missing them

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CLI_PIPELINE_DIR="$ROOT_DIR/scripts/cli-pipeline"

# Function to add health check to a pipeline
add_health_check() {
  local pipeline_name="$1"
  local cli_file="$2"
  
  # Check if health-check already exists
  if grep -q "health-check)" "$cli_file"; then
    echo "✅ $pipeline_name: Already has health-check command"
    return
  fi
  
  echo "📝 $pipeline_name: Adding health-check command"
  
  # Create a temporary file
  local temp_file=$(mktemp)
  
  # Flag to track if we've added the function
  local added_function=false
  local in_case=false
  
  # Process the file line by line
  while IFS= read -r line; do
    # Check if we're entering the case statement
    if [[ "$line" =~ ^case[[:space:]]+.*[[:space:]]+in$ ]]; then
      in_case=true
      
      # Add the health check function before the case statement
      if [ "$added_function" = false ]; then
        cat >> "$temp_file" << EOF
# Health check function
health_check() {
  echo "🏥 Running health check for $pipeline_name pipeline..."
  
  # Check if required environment variables are set
  if [ -z "\$SUPABASE_URL" ] || [ -z "\$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Missing required environment variables"
    return 1
  fi
  
  # Check if pipeline directory exists
  local script_dir="\$(dirname "\$0")"
  if [ -d "\$script_dir" ]; then
    echo "✅ Pipeline directory exists"
  else
    echo "❌ Pipeline directory not found"
    return 1
  fi
  
  # Pipeline-specific checks can be added here
  echo "✅ $pipeline_name pipeline is healthy"
  return 0
}

EOF
        added_function=true
      fi
      
      echo "$line" >> "$temp_file"
      
      # Add the health-check case right after the case statement
      cat >> "$temp_file" << EOF
  health-check)
    health_check
    ;;
EOF
      
    else
      echo "$line" >> "$temp_file"
    fi
  done < "$cli_file"
  
  # Replace the original file
  mv "$temp_file" "$cli_file"
  chmod +x "$cli_file"
}

echo "🔧 Adding health-check commands to CLI pipelines..."
echo ""

# List of pipelines to check
PIPELINES=(
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
  "work_summaries"
)

# Process each pipeline
for pipeline in "${PIPELINES[@]}"; do
  # Find the CLI file
  cli_file=""
  
  if [ -f "$CLI_PIPELINE_DIR/$pipeline/${pipeline}-cli.sh" ]; then
    cli_file="$CLI_PIPELINE_DIR/$pipeline/${pipeline}-cli.sh"
  elif [ -f "$CLI_PIPELINE_DIR/$pipeline/$(echo $pipeline | sed 's/_/-/g')-cli.sh" ]; then
    cli_file="$CLI_PIPELINE_DIR/$pipeline/$(echo $pipeline | sed 's/_/-/g')-cli.sh"
  elif [ "$pipeline" = "document" ] && [ -f "$CLI_PIPELINE_DIR/$pipeline/doc-cli.sh" ]; then
    cli_file="$CLI_PIPELINE_DIR/$pipeline/doc-cli.sh"
  fi
  
  if [ -n "$cli_file" ] && [ -f "$cli_file" ]; then
    add_health_check "$pipeline" "$cli_file"
  else
    echo "⚠️  $pipeline: CLI file not found"
  fi
done

echo ""
echo "✅ Health check processing complete!"
echo ""
echo "Next steps:"
echo "1. Customize each health check for pipeline-specific requirements"
echo "2. Test individual health checks"
echo "3. Update the database health check flags"
echo "4. Run master health check"