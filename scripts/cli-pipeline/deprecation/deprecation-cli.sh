#!/bin/bash

# Deprecation Analysis CLI Pipeline
# Manages deprecation evaluation, operation, and monitoring

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Load environment variables
ENV_DEV_FILE="${PROJECT_ROOT}/.env.development"
if [ -f "$ENV_DEV_FILE" ]; then
  export $(grep -E "SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY" "$ENV_DEV_FILE" | xargs)
fi

# Define track_command function
track_command() {
    local pipeline_name="deprecation"
    local command_name="$1"
    shift
    local full_command="$@"
    
    local TRACKER_TS="$PROJECT_ROOT/packages/shared/services/tracking-service/shell-command-tracker.ts"
    if [ -f "$TRACKER_TS" ]; then
        npx ts-node --project "$PROJECT_ROOT/tsconfig.node.json" "$TRACKER_TS" "$pipeline_name" "$command_name" "$full_command"
    else
        echo "ℹ️ Tracking not available. Running command directly."
        eval "$full_command"
    fi
}

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

show_help() {
  echo "Deprecation Analysis CLI"
  echo "========================"
  echo ""
  echo "Usage: $0 <command> [options]"
  echo ""
  echo "EVALUATION COMMANDS:"
  echo "  analyze-services     Analyze unused services and generate report"
  echo "  analyze-scripts      Analyze inactive scripts (basic)"
  echo "  analyze-script-usage Detailed script usage analysis (recommended)"
  echo "  analyze-commands     Analyze low-usage CLI commands"
  echo "  analyze-pipelines    Analyze pipeline usage patterns"
  echo "  generate-report      Generate comprehensive deprecation report"
  echo ""
  echo "OPERATION COMMANDS:"
  echo "  mark-deprecated      Mark items for deprecation"
  echo "  archive-service      Archive a deprecated service"
  echo "  archive-script       Archive a deprecated script (single)"
  echo "  archive-scripts      Archive multiple scripts (batch)"
  echo "  archive-likely-obsolete  Archive likely obsolete scripts (Phase 2B)"
  echo "  restore-script       Restore an archived script"
  echo "  restore-batch        Batch restore archived scripts by criteria"
  echo "  list-archived        List all archived scripts"
  echo ""
  echo "VALIDATION COMMANDS:"
  echo "  validate-imports     Check for broken imports of archived scripts"
  echo "  validate-cli-commands  Validate all CLI commands still work"
  echo "  validate-archiving   Run comprehensive validation suite"
  echo "  cleanup-commands     Remove unimplemented commands from registry"
  echo "  deprecate-command    Deprecate a CLI command"
  echo "  generate-migration   Generate migration plan for deprecated items"
  echo ""
  echo "MONITORING COMMANDS:"
  echo "  monitor-usage        Monitor usage of deprecated items"
  echo "  health-check         Check health of deprecation tracking"
  echo "  usage-trends         Show usage trends for potential deprecations"
  echo ""
  echo "UTILITY COMMANDS:"
  echo "  export-candidates    Export deprecation candidates to JSON"
  echo "  import-plan          Import deprecation plan from JSON"
  echo "  validate-plan        Validate a deprecation plan"
  echo ""
  echo "Examples:"
  echo "  $0 analyze-services"
  echo "  $0 mark-deprecated --type service --name old-service"
  echo "  $0 generate-report --output deprecation-report.md"
}

# Evaluation Commands
analyze_services() {
  echo "📊 Analyzing unused services..."
  track_command "analyze-services" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/analyze-services.ts ${@}"
}

analyze_scripts() {
  echo "📊 Analyzing inactive scripts..."
  track_command "analyze-scripts" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/analyze-scripts.ts ${@}"
}

analyze_script_usage() {
  echo "🔍 Analyzing detailed script usage across monorepo..."
  track_command "analyze-script-usage" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/analyze-script-usage.ts $*"
}

archive_scripts() {
  echo "📦 Archiving unused scripts..."
  track_command "archive-scripts" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/archive-scripts.ts $*"
}

restore_script() {
  echo "♻️ Restoring archived script..."
  track_command "restore-script" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/restore-script.ts $*"
}

list_archived() {
  echo "📋 Listing archived scripts..."
  track_command "list-archived" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/list-archived.ts $*"
}

analyze_commands() {
  echo "📊 Analyzing low-usage CLI commands..."
  track_command "analyze-commands" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/analyze-commands.ts $*"
}

analyze_pipelines() {
  echo "📊 Analyzing pipeline usage patterns..."
  track_command "analyze-pipelines" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/analyze-pipelines.ts $*"
}

archive_likely_obsolete() {
  echo "📦 Archiving likely obsolete scripts (Phase 2B)..."
  track_command "archive-likely-obsolete" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/archive-likely-obsolete-scripts.ts $*"
}

# Validation Commands
validate_imports() {
  echo "🔍 Validating imports for archived scripts..."
  track_command "validate-imports" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/validate-imports.ts $*"
}

validate_cli_commands() {
  echo "🔍 Validating CLI commands..."
  track_command "validate-cli-commands" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/validate-cli-commands.ts $*"
}

validate_archiving() {
  echo "🔍 Running comprehensive archiving validation..."
  echo ""
  echo "Step 1: Validating imports..."
  validate_imports
  echo ""
  echo "Step 2: Validating CLI commands..."
  validate_cli_commands
}

restore_batch() {
  echo "♻️ Batch restoring archived scripts..."
  track_command "restore-batch" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/restore-batch.ts $*"
}

generate_report() {
  echo "📝 Generating comprehensive deprecation report..."
  track_command "generate-report" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/generate-report.ts ${@}"
}

# Operation Commands
mark_deprecated() {
  echo "🏷️  Marking items for deprecation..."
  track_command "mark-deprecated" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/mark-deprecated.ts ${@}"
}

archive_service() {
  echo "📦 Archiving deprecated service..."
  track_command "archive-service" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/archive-service.ts ${@}"
}

archive_script() {
  echo "📦 Archiving deprecated script..."
  track_command "archive-script" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/archive-script.ts ${@}"
}

deprecate_command() {
  echo "🚫 Deprecating CLI command..."
  track_command "deprecate-command" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/deprecate-command.ts ${@}"
}

generate_migration() {
  echo "🔄 Generating migration plan..."
  track_command "generate-migration" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/generate-migration.ts ${@}"
}

# Monitoring Commands
monitor_usage() {
  echo "📈 Monitoring usage of deprecated items..."
  track_command "monitor-usage" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/monitor-usage.ts ${@}"
}

health_check() {
  echo "🏥 Checking deprecation tracking health..."
  track_command "health-check" "$SCRIPT_DIR/health-check.sh"
}

usage_trends() {
  echo "📊 Showing usage trends..."
  track_command "usage-trends" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/usage-trends.ts ${@}"
}

# Utility Commands
export_candidates() {
  echo "📤 Exporting deprecation candidates..."
  track_command "export-candidates" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/export-candidates.ts ${@}"
}

import_plan() {
  echo "📥 Importing deprecation plan..."
  track_command "import-plan" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/import-plan.ts ${@}"
}

validate_plan() {
  echo "✅ Validating deprecation plan..."
  track_command "validate-plan" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/validate-plan.ts ${@}"
}

cleanup_commands() {
  echo "🧹 Cleaning up unimplemented commands..."
  track_command "cleanup-commands" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/cleanup-unimplemented-commands.ts ${@}"
}

# Main command processor
case "${1:-}" in
  # Evaluation
  "analyze-services")
    analyze_services "${@:2}"
    ;;
  "analyze-scripts")
    analyze_scripts "${@:2}"
    ;;
  "analyze-script-usage")
    analyze_script_usage "${@:2}"
    ;;
  "archive-scripts")
    archive_scripts "${@:2}"
    ;;
  "restore-script")
    restore_script "${@:2}"
    ;;
  "list-archived")
    list_archived "${@:2}"
    ;;
  "analyze-commands")
    analyze_commands "${@:2}"
    ;;
  "analyze-pipelines")
    analyze_pipelines "${@:2}"
    ;;
  "archive-likely-obsolete")
    archive_likely_obsolete "${@:2}"
    ;;
  "validate-imports")
    validate_imports "${@:2}"
    ;;
  "validate-cli-commands")
    validate_cli_commands "${@:2}"
    ;;
  "validate-archiving")
    validate_archiving "${@:2}"
    ;;
  "restore-batch")
    restore_batch "${@:2}"
    ;;
  "generate-report")
    generate_report "${@:2}"
    ;;
    
  # Operation
  "mark-deprecated")
    mark_deprecated "${@:2}"
    ;;
  "archive-service")
    archive_service "${@:2}"
    ;;
  "archive-script")
    archive_script "${@:2}"
    ;;
  "deprecate-command")
    deprecate_command "${@:2}"
    ;;
  "generate-migration")
    generate_migration "${@:2}"
    ;;
    
  # Monitoring
  "monitor-usage")
    monitor_usage "${@:2}"
    ;;
  "health-check")
    health_check "${@:2}"
    ;;
  "usage-trends")
    usage_trends "${@:2}"
    ;;
    
  # Utility
  "export-candidates")
    export_candidates "${@:2}"
    ;;
  "import-plan")
    import_plan "${@:2}"
    ;;
  "validate-plan")
    validate_plan "${@:2}"
    ;;
    
  "cleanup-commands")
    cleanup_commands "${@:2}"
    ;;
    
  "help"|"--help"|"-h"|"")
    show_help
    ;;
    
  *)
    echo -e "${RED}Unknown command: $1${NC}"
    echo ""
    show_help
    exit 1
    ;;
esac
