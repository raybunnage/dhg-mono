#!/bin/bash

# Deprecation Analysis CLI Pipeline
# Manages deprecation evaluation, operation, and monitoring

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Load common functions
source "$PROJECT_ROOT/scripts/cli-pipeline/common/functions.sh" 2>/dev/null || {
  # Fallback if common functions don't exist
  track_command() {
    echo "🔍 Tracking command: $1"
    shift
    eval "$@"
  }
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
  echo "  analyze-scripts      Analyze inactive scripts"
  echo "  analyze-commands     Analyze low-usage CLI commands"
  echo "  analyze-pipelines    Analyze pipeline usage patterns"
  echo "  generate-report      Generate comprehensive deprecation report"
  echo ""
  echo "OPERATION COMMANDS:"
  echo "  mark-deprecated      Mark items for deprecation"
  echo "  archive-service      Archive a deprecated service"
  echo "  archive-script       Archive a deprecated script"
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

analyze_commands() {
  echo "📊 Analyzing low-usage CLI commands..."
  track_command "analyze-commands" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/analyze-commands.ts ${@}"
}

analyze_pipelines() {
  echo "📊 Analyzing pipeline usage patterns..."
  track_command "analyze-pipelines" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/analyze-pipelines.ts ${@}"
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
  track_command "health-check" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/health-check.ts ${@}"
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

# Main command processor
case "${1:-}" in
  # Evaluation
  "analyze-services")
    analyze_services "${@:2}"
    ;;
  "analyze-scripts")
    analyze_scripts "${@:2}"
    ;;
  "analyze-commands")
    analyze_commands "${@:2}"
    ;;
  "analyze-pipelines")
    analyze_pipelines "${@:2}"
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