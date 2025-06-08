#!/bin/bash

# Safer script to add health checks to CLI pipelines

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

echo "🔧 Safely adding health checks to pipelines..."
echo ""

# List of pipelines that need health checks based on master health check
PIPELINES_NEEDING_CHECKS=(
  "classify:classify-cli.sh"
  "database:database-cli.sh"
  "deprecation:deprecation-cli.sh"
  "dev_tasks:dev-tasks-cli.sh"
  "document_types:document-types-cli.sh"
  "documentation:documentation-cli.sh"
  "drive_filter:drive-filter-cli.sh"
  "email:email-cli.sh"
  "experts:experts-cli.sh"
  "git:git-cli.sh"
  "git_workflow:git-workflow-cli.sh"
  "gmail:gmail-cli.sh"
  "merge:merge-cli.sh"
  "mime_types:mime-types-cli.sh"
  "presentations:presentations-cli.sh"
  "prompt_service:prompt-service-cli.sh"
  "refactor_tracking:refactor-tracking-cli.sh"
  "registry:registry-cli.sh"
  "scripts:scripts-cli.sh"
  "tracking:tracking-cli.sh"
  "work_summaries:work-summaries-cli.sh"
)

for pipeline_spec in "${PIPELINES_NEEDING_CHECKS[@]}"; do
  IFS=':' read -r pipeline_name cli_file <<< "$pipeline_spec"
  full_path="$ROOT_DIR/scripts/cli-pipeline/$pipeline_name/$cli_file"
  
  if [ ! -f "$full_path" ]; then
    echo "⚠️  $pipeline_name: CLI file not found at $full_path"
    continue
  fi
  
  # Check if file already has health-check
  if grep -q "health-check)" "$full_path" 2>/dev/null; then
    echo "✅ $pipeline_name: Already has health-check"
    continue
  fi
  
  echo "📝 $pipeline_name: Adding health-check to $cli_file"
  
  # Add a simple health check case to these files
  # We'll insert it after the help case if it exists
  awk '
    /^[[:space:]]*help\)[[:space:]]*$/ {
      print
      getline; print  # Print the help content
      getline; print  # Print the ;;
      print "  health-check)"
      print "    echo \"🏥 Running health check for '$pipeline_name' pipeline...\""
      print "    if [ -z \"$SUPABASE_URL\" ] || [ -z \"$SUPABASE_SERVICE_ROLE_KEY\" ]; then"
      print "      echo \"❌ Missing required environment variables\""
      print "      exit 1"
      print "    fi"
      print "    echo \"✅ '$pipeline_name' pipeline is healthy\""
      print "    ;;"
      next
    }
    { print }
  ' "$full_path" > "$full_path.tmp"
  
  # If we didn't find a help case, add it before the esac
  if ! grep -q "health-check)" "$full_path.tmp"; then
    awk '
      /^esac[[:space:]]*$/ {
        print "  health-check)"
        print "    echo \"🏥 Running health check for '$pipeline_name' pipeline...\""
        print "    if [ -z \"$SUPABASE_URL\" ] || [ -z \"$SUPABASE_SERVICE_ROLE_KEY\" ]; then"
        print "      echo \"❌ Missing required environment variables\""
        print "      exit 1"
        print "    fi"
        print "    echo \"✅ '$pipeline_name' pipeline is healthy\""
        print "    ;;"
      }
      { print }
    ' "$full_path.tmp" > "$full_path.tmp2"
    mv "$full_path.tmp2" "$full_path.tmp"
  fi
  
  # Only replace if we successfully added the health check
  if grep -q "health-check)" "$full_path.tmp"; then
    mv "$full_path.tmp" "$full_path"
    chmod +x "$full_path"
  else
    rm -f "$full_path.tmp"
    echo "❌ Failed to add health-check to $pipeline_name"
  fi
done

echo ""
echo "✅ Health check addition complete!"