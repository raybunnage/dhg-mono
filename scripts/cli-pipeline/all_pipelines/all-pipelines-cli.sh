#!/bin/bash
# All Pipelines CLI
# This is a master CLI that can run health checks across all pipelines

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TRACKER_TS="${PROJECT_ROOT}/packages/shared/services/tracking-service/shell-command-tracker.ts"

# Load environment variables from project root .env.development file if it exists
ENV_DEV_FILE="${PROJECT_ROOT}/.env.development"
if [ -f "$ENV_DEV_FILE" ]; then
  echo "Loading environment variables from $ENV_DEV_FILE"
  # Export environment variables for Supabase
  export $(grep -E "SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY" "$ENV_DEV_FILE" | xargs)
fi

# Function to execute a command with tracking
track_command() {
  local pipeline_name="all_pipelines"
  local command_name="$1"
  shift
  local full_command="$@"
  
  # Check if we have a TS tracking wrapper
  if [ -f "$TRACKER_TS" ]; then
    npx ts-node --project "$PROJECT_ROOT/tsconfig.node.json" "$TRACKER_TS" "$pipeline_name" "$command_name" "$full_command"
  else
    # Fallback to direct execution without tracking
    echo "ℹ️ Tracking not available. Running command directly."
    eval "$full_command"
  fi
}

# Command handler for master-health-check
master_health_check() {
  # Run the shell-based master health check script
  track_command "master-health-check" "$SCRIPT_DIR/run-all-health-checks.sh $@"
}

# Command handler for usage-report
usage_report() {
  track_command "usage-report" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/cli.ts usage-report $@"
}

# Command handler for classification-rollup
classification_rollup() {
  track_command "classification-rollup" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/cli.ts classification-rollup $@"
}

# Command handler for clear-cache
clear_cache() {
  track_command "clear-cache" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/cli.ts clear-cache $@"
}

# Command handler for quick-restart
quick_restart() {
  track_command "quick-restart" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/cli.ts quick-restart $@"
}

# Command handler for clear-all-caches (shell version)
clear_all_caches() {
  track_command "clear-all-caches" "$SCRIPT_DIR/clear-all-caches.sh $@"
}

# Command handler for clear-app-cache
clear_app_cache() {
  track_command "clear-app-cache" "$SCRIPT_DIR/clear-app-cache.sh $@"
}

# Command handler for dev-fresh
dev_fresh() {
  track_command "dev-fresh" "$SCRIPT_DIR/dev-fresh.sh $@"
}

# Command handler for nuclear-clean
nuclear_clean() {
  track_command "nuclear-clean" "$SCRIPT_DIR/nuclear-clean.sh $@"
}

# Command handler for app-reinstall
app_reinstall() {
  track_command "app-reinstall" "$SCRIPT_DIR/app-reinstall.sh $@"
}

# Command handler for check-deprecated-commands
check_deprecated_commands() {
  track_command "check-deprecated-commands" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/check-deprecated-commands.ts $@"
}

# Command handler for update-deprecated-to-archive
update_deprecated_to_archive() {
  track_command "update-deprecated-to-archive" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/update-deprecated-to-archive.ts $@"
}

# Command handler for populate-command-registry
populate_command_registry() {
  track_command "populate-command-registry" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/populate-command-registry.ts $@"
}

# Command handler for populate-pipeline-tables
populate_pipeline_tables() {
  track_command "populate-pipeline-tables" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/populate-pipeline-tables.ts $@"
}

# Command handler for sync-command-status
sync_command_status() {
  track_command "sync-command-status" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/sync-command-status.ts $@"
}

# Print help information
# Health check function
health_check() {
  echo "🏥 Running health check for all-pipelines..."
  
  # Check basic requirements
  local health_status=0
  
  # Check if ts-node is available
  if command -v ts-node >/dev/null 2>&1; then
    echo "✅ ts-node is available"
  else
    echo "❌ ts-node is not available"
    health_status=1
  fi
  
  # Check if Supabase environment is configured
  if [[ -n "$SUPABASE_URL" ]] && [[ -n "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
    echo "✅ Supabase environment configured"
  else
    echo "⚠️  Supabase environment not configured"
    health_status=1
  fi
  
  # Check if node_modules exist
  if [[ -d "$SCRIPT_DIR/../../../node_modules" ]]; then
    echo "✅ Node modules installed"
  else
    echo "❌ Node modules not found"
    health_status=1
  fi
  
  # Check TypeScript files
  if ls "$SCRIPT_DIR"/*.ts >/dev/null 2>&1; then
    echo "✅ TypeScript files found"
  else
    echo "⚠️  No TypeScript files found"
  fi
  
  if [[ $health_status -eq 0 ]]; then
    echo ""
    echo "✅ All pipelines CLI is healthy"
  else
    echo ""
    echo "⚠️  Some health checks failed"
  fi
  
  return $health_status
}

show_help() {
  echo "All Pipelines CLI - Master CLI for running health checks across all pipelines"
  echo ""
  echo "USAGE:"
  echo "  ./all-pipelines-cli.sh <command> [options]"
  echo ""
  echo "COMMANDS:"
  echo "  (* = frequently used commands based on usage statistics)"
  echo ""
  echo "MONITORING:"
  echo "  * master-health-check       Run health checks for all pipelines and report status (25 uses)"
  echo "    health-check              Run health check for this CLI itself"
  echo ""
  echo "REPORTING:"
  echo "  * usage-report              Generate a markdown report of CLI command usage (6 uses)"
  echo "  * classification-rollup     Generate a rollup report of subject classifications (8 uses)"
  echo ""
  echo "CACHE MANAGEMENT:"
  echo "  * clear-cache               Clear caches via TypeScript (limited functionality)"
  echo "  * clear-all-caches          Clear ALL caches comprehensively (Vite, dist, build, etc.)"
  echo "  * clear-app-cache <app>     Clear cache for a specific app (e.g., dhg-audio)"
  echo "  * dev-fresh <app>           Clear cache and start fresh dev server for an app"
  echo "    quick-restart             Quick restart - kills Vite and clears Vite cache only"
  echo "  * app-reinstall <app>       Reinstall node_modules for a specific app only (targeted fix)"
  echo "    nuclear-clean <app|all>   NUCLEAR option - removes ALL caches and node_modules, forces reinstall"
  echo ""
  echo "SYSTEM:"
  echo "    check-deprecated-commands Check deprecated commands that should be archived"
  echo "    update-deprecated-to-archive Update all deprecated commands to archived status"
  echo "    populate-command-registry Scan all pipelines and populate command registry"
  echo "    populate-pipeline-tables  Populate database table usage for each pipeline"
  echo "  * sync-command-status       Sync command status by scanning CLI files for active/deprecated commands"
  echo "    help                      Show this help message"
  echo ""
  echo "COMMON OPTIONS:"
  echo ""
  echo "  For master-health-check:"
  echo "    --verbose                 Display detailed output from each health check"
  echo "    --include <pipelines>     Comma-separated list of pipelines to include"
  echo ""
  echo "  For usage-report:"
  echo "    --days <number>           Number of days to look back (default: 30)"
  echo "    --output <path>           Custom output file path"
  echo ""
  echo "  For classification-rollup:"
  echo "    --min-count <number>      Minimum count to include in report (default: 1)"
  echo "    --format <format>         Output format: markdown or json (default: markdown)"
  echo ""
  echo "  For clear-cache:"
  echo "    --verbose                 Show detailed output during cleanup"
  echo "    --skip-browser            Skip browser cache clearing instructions"
  echo "    --nuclear                 Remove all node_modules (requires full reinstall)"
  echo ""
  echo "  For quick-restart:"
  echo "    --app <name>              App name to restart (e.g., dhg-admin-explore)"
  echo ""
  echo "EXAMPLES:"
  echo ""
  echo "MONITORING:"
  echo "  # Run health checks for all pipelines"
  echo "  ./all-pipelines-cli.sh master-health-check"
  echo ""
  echo "  # Run health checks for specific pipelines"
  echo "  ./all-pipelines-cli.sh master-health-check --include google_sync,document"
  echo ""
  echo "REPORTING:"
  echo "  # Generate a CLI usage report"
  echo "  ./all-pipelines-cli.sh usage-report"
  echo ""
  echo "  # Generate a classification rollup report"
  echo "  ./all-pipelines-cli.sh classification-rollup"
  echo ""
  echo "CACHE MANAGEMENT:"
  echo "  # Clear all caches across the entire monorepo"
  echo "  ./all-pipelines-cli.sh clear-all-caches"
  echo ""
  echo "  # Clear cache for a specific app"
  echo "  ./all-pipelines-cli.sh clear-app-cache dhg-audio"
  echo ""
  echo "  # Clear cache and start fresh dev server"
  echo "  ./all-pipelines-cli.sh dev-fresh dhg-hub"
  echo ""
  echo "  # Clear caches via TypeScript (limited)"
  echo "  ./all-pipelines-cli.sh clear-cache"
  echo ""
  echo "  # Clear all caches with verbose output"
  echo "  ./all-pipelines-cli.sh clear-cache --verbose"
  echo ""
  echo "  # Nuclear option - remove all node_modules"
  echo "  ./all-pipelines-cli.sh clear-cache --nuclear"
  echo ""
  echo "  # Quick restart for a specific app"
  echo "  ./all-pipelines-cli.sh quick-restart --app dhg-admin-explore"
  echo ""
  echo "APP REINSTALL (RECOMMENDED):"
  echo "  # Reinstall node_modules for just one app (keeps root and other apps intact)"
  echo "  ./all-pipelines-cli.sh app-reinstall dhg-admin-code"
  echo ""
  echo "NUCLEAR CLEAN (EXTREME):"
  echo "  # Nuclear clean for a specific app (removes all caches and node_modules)"
  echo "  ./all-pipelines-cli.sh nuclear-clean dhg-admin-code"
  echo ""
  echo "  # Nuclear clean for entire monorepo"
  echo "  ./all-pipelines-cli.sh nuclear-clean all"
}

# Main command router
case "$1" in
  "master-health-check")
    master_health_check "${@:2}"
    ;;
  "usage-report")
    usage_report "${@:2}"
    ;;
  "classification-rollup")
    classification_rollup "${@:2}"
    ;;
  "clear-cache")
    clear_cache "${@:2}"
    ;;
  "quick-restart")
    quick_restart "${@:2}"
    ;;
  "clear-all-caches")
    clear_all_caches "${@:2}"
    ;;
  "clear-app-cache")
    clear_app_cache "${@:2}"
    ;;
  "dev-fresh")
    dev_fresh "${@:2}"
    ;;
  "app-reinstall")
    app_reinstall "${@:2}"
    ;;
  "nuclear-clean")
    nuclear_clean "${@:2}"
    ;;
  "check-deprecated-commands")
    check_deprecated_commands "${@:2}"
    ;;
  "update-deprecated-to-archive")
    update_deprecated_to_archive "${@:2}"
    ;;
  "populate-command-registry")
    populate_command_registry "${@:2}"
    ;;
  "populate-pipeline-tables")
    populate_pipeline_tables "${@:2}"
    ;;
  "sync-command-status")
    sync_command_status "${@:2}"
    ;;
  "health-check")
    health_check
    ;;
  "help"|"--help"|"-h")
    show_help
    ;;
  *)
    if [ -z "$1" ]; then
      show_help
    else
      echo "Unknown command: $1"
      echo "Run './all-pipelines-cli.sh help' for usage information."
      exit 1
    fi
    ;;
esac