#!/usr/bin/env bash

# Service Dependencies CLI
# Manages service dependency mapping and analysis across the monorepo
# Usage: ./service-dependencies-cli.sh [command] [options]

set -e

# Script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env.development" ]; then
  set -a
  source "$PROJECT_ROOT/.env.development"
  set +a
fi

# Parse debug flag from command line arguments
DEBUG_MODE=false
for arg in "$@"; do
  if [ "$arg" = "--debug" ]; then
    DEBUG_MODE=true
    break
  fi
done

# Function to track commands
track_command() {
  local pipeline_name="service_dependencies"
  local command_name="$1"
  shift
  local full_command="$@"
  
  # Filter out the --debug flag from the command arguments
  full_command=$(echo "$full_command" | sed 's/--debug//g')
  
  # Run directly if debug mode is enabled
  if [ "$DEBUG_MODE" = true ]; then
    echo "🐛 DEBUG MODE: Running command directly without tracking"
    echo "📋 Executing: $full_command"
    eval "$full_command"
    return
  fi
  
  local TRACKER_TS="$PROJECT_ROOT/packages/shared/services/tracking-service/shell-command-tracker.ts"
  if [ -f "$TRACKER_TS" ]; then
    echo "🔍 Tracking command: $command_name"
    npx ts-node --project "$PROJECT_ROOT/tsconfig.node.json" "$TRACKER_TS" "$pipeline_name" "$command_name" "$full_command"
  else
    echo "ℹ️ Tracking not available. Running command directly."
    eval "$full_command"
  fi
}

# Help message
show_help() {
  echo "Service Dependencies CLI"
  echo "======================="
  echo ""
  echo "Manages service dependency mapping and analysis across the monorepo."
  echo "Tracks relationships between apps, CLI pipelines, commands, and shared services."
  echo ""
  echo "COMMANDS:"
  echo ""
  echo "REGISTRY MANAGEMENT:"
  echo "  scan-services           Discover and register all shared services"
  echo "  scan-apps              Discover and register all applications"
  echo "  scan-pipelines         Discover and register all CLI pipelines"
  echo "  scan-commands          Discover and register all CLI commands"
  echo "  update-registry        Update existing registrations with latest data"
  echo ""
  echo "DEPENDENCY ANALYSIS:"
  echo "  analyze-dependencies   Scan code for service usage relationships"
  echo "    --target <type>      Target type: 'apps', 'pipelines', 'commands', 'all'"
  echo "    --granular           Include command-level dependencies"
  echo "    --force              Re-analyze existing dependencies"
  echo ""
  echo "VALIDATION & MAINTENANCE:"
  echo "  validate-dependencies  Verify dependency relationships are still valid"
  echo "  cleanup-orphaned       Remove dependencies for deleted apps/services"
  echo "  refresh-usage-stats    Update usage statistics from command tracking"
  echo ""
  echo "REPORTING:"
  echo "  export-report          Generate dependency reports"
  echo "    --format <format>    Output format: 'markdown', 'json', 'csv'"
  echo "    --target <type>      Report focus: 'services', 'apps', 'pipelines', 'overview'"
  echo "  service-usage          Show usage analysis for a specific service"
  echo "    --service <name>     Service name to analyze"
  echo "  app-dependencies       Show dependencies for a specific app"
  echo "    --app <name>         App name to analyze"
  echo ""
  echo "SYSTEM:"
  echo "  health-check           Check pipeline health and database connectivity"
  echo "  init-system            Initialize the dependency mapping system"
  echo "  reset-data             Clear all dependency data (DESTRUCTIVE)"
  echo ""
  echo "OPTIONS:"
  echo "  --debug                Run commands directly without tracking"
  echo "  --dry-run              Preview mode without making changes"
  echo "  --verbose, -v          Show detailed output"
  echo "  --limit <number>       Limit number of items to process"
  echo "  --force                Force operation even if conditions would prevent it"
  echo ""
  echo "EXAMPLES:"
  echo ""
  echo "Initialize the system:"
  echo "  ./service-dependencies-cli.sh init-system"
  echo ""
  echo "Populate all registries:"
  echo "  ./service-dependencies-cli.sh scan-services"
  echo "  ./service-dependencies-cli.sh scan-apps"
  echo "  ./service-dependencies-cli.sh scan-pipelines"
  echo "  ./service-dependencies-cli.sh scan-commands"
  echo ""
  echo "Analyze dependencies:"
  echo "  ./service-dependencies-cli.sh analyze-dependencies --target all"
  echo "  ./service-dependencies-cli.sh analyze-dependencies --target apps --granular"
  echo ""
  echo "Generate reports:"
  echo "  ./service-dependencies-cli.sh export-report --format markdown --target overview"
  echo "  ./service-dependencies-cli.sh service-usage --service supabase-client"
  echo "  ./service-dependencies-cli.sh app-dependencies --app dhg-hub"
  echo ""
  echo "Maintenance:"
  echo "  ./service-dependencies-cli.sh validate-dependencies"
  echo "  ./service-dependencies-cli.sh refresh-usage-stats"
}

# Check if no arguments provided
if [ $# -eq 0 ] || [ -z "$1" ]; then
  show_help
  exit 0
fi

# Main command processor
case "$1" in
  "scan-services")
    echo "🔍 Scanning for shared services..."
    track_command "scan-services" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/commands/scan-services.ts ${@:2}"
    ;;
  "scan-apps")
    echo "🔍 Scanning for applications..."
    track_command "scan-apps" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/commands/scan-apps.ts ${@:2}"
    ;;
  "scan-pipelines")
    echo "🔍 Scanning for CLI pipelines..."
    track_command "scan-pipelines" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/commands/scan-pipelines.ts ${@:2}"
    ;;
  "scan-commands")
    echo "🔍 Scanning for CLI commands..."
    track_command "scan-commands" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/commands/scan-commands.ts ${@:2}"
    ;;
  "update-registry")
    echo "🔄 Updating registry with latest data..."
    track_command "update-registry" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/commands/update-registry.ts ${@:2}"
    ;;
  "analyze-dependencies")
    echo "🔬 Analyzing service dependencies..."
    track_command "analyze-dependencies" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/commands/analyze-dependencies.ts ${@:2}"
    ;;
  "validate-dependencies")
    echo "✅ Validating dependency relationships..."
    track_command "validate-dependencies" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/commands/validate-dependencies.ts ${@:2}"
    ;;
  "cleanup-orphaned")
    echo "🧹 Cleaning up orphaned dependencies..."
    track_command "cleanup-orphaned" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/commands/cleanup-orphaned.ts ${@:2}"
    ;;
  "refresh-usage-stats")
    echo "📊 Refreshing usage statistics..."
    track_command "refresh-usage-stats" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/commands/refresh-usage-stats.ts ${@:2}"
    ;;
  "export-report")
    echo "📄 Generating dependency report..."
    track_command "export-report" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/commands/export-report.ts ${@:2}"
    ;;
  "service-usage")
    echo "📊 Analyzing service usage..."
    track_command "service-usage" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/commands/service-usage.ts ${@:2}"
    ;;
  "app-dependencies")
    echo "📊 Analyzing app dependencies..."
    track_command "app-dependencies" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/commands/app-dependencies.ts ${@:2}"
    ;;
  "health-check")
    echo "🏥 Running health check..."
    track_command "health-check" "$SCRIPT_DIR/health-check.sh ${@:2}"
    ;;
  "init-system")
    echo "🚀 Initializing dependency mapping system..."
    track_command "init-system" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/commands/init-system.ts ${@:2}"
    ;;
  "reset-data")
    echo "⚠️  Resetting dependency data..."
    track_command "reset-data" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/commands/reset-data.ts ${@:2}"
    ;;
  "help"|"--help"|"-h")
    show_help
    ;;
  *)
    echo "Unknown command: $1"
    echo ""
    show_help
    exit 1
    ;;
esac