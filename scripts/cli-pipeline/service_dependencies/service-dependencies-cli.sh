#!/usr/bin/env bash

# Service Dependencies CLI
# Manages service dependency mapping and analysis across the monorepo
# Refactored to use SimpleCLIPipeline base class

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Source the base class
source "$SCRIPT_DIR/../base-classes/SimpleCLIPipeline.sh" || {
    echo "Error: Failed to source SimpleCLIPipeline.sh"
    exit 1
}

# Initialize with pipeline name
init_cli_pipeline "service_dependencies" "Service Dependencies CLI - Dependency mapping and analysis"

# Function to run TypeScript commands with fallback
run_ts_command() {
    local command_name="$1"
    shift
    
    local command_script="$SCRIPT_DIR/commands/$command_name.ts"
    if [[ -f "$command_script" ]]; then
        cd "$PROJECT_ROOT" && npx ts-node --project "$PROJECT_ROOT/tsconfig.node.json" "$command_script" "$@"
    else
        log_warn "$command_name.ts not found"
        log_info "Fallback: Basic $command_name operation"
        case "$command_name" in
            "scan-services")
                log_info "Would scan packages/shared/services for services"
                find "$PROJECT_ROOT/packages/shared/services" -name "*.ts" -type f | grep -v test | head -5 | sed 's|.*/||g' | sed 's|\.ts$||g' | xargs -I {} echo "  - Found: {}"
                ;;
            "scan-apps")
                log_info "Would scan apps/ directory for applications"
                find "$PROJECT_ROOT/apps" -name "package.json" | head -5 | xargs dirname | sed 's|.*/||g' | xargs -I {} echo "  - Found app: {}"
                ;;
            "scan-pipelines")
                log_info "Would scan scripts/cli-pipeline for pipelines"
                find "$PROJECT_ROOT/scripts/cli-pipeline" -name "*-cli.sh" | head -5 | sed 's|.*/||g' | sed 's|-cli\.sh$||g' | xargs -I {} echo "  - Found pipeline: {}"
                ;;
            "scan-commands")
                log_info "Would scan CLI pipelines for commands"
                ;;
            "analyze-dependencies"|"validate-dependencies"|"cleanup-orphaned"|"refresh-usage-stats")
                log_info "Would perform $command_name analysis"
                ;;
            "export-report"|"service-usage"|"app-dependencies")
                log_info "Would generate $command_name report"
                ;;
            "init-system"|"reset-data")
                log_info "Would perform $command_name operation"
                ;;
        esac
    fi
}

# Define commands

command_help() {
    show_help
}

command_scan-services() {
    log_info "🔍 Scanning for shared services..."
    run_ts_command "scan-services" "$@"
}

command_scan-apps() {
    log_info "🔍 Scanning for applications..."
    run_ts_command "scan-apps" "$@"
}

command_scan-pipelines() {
    log_info "🔍 Scanning for CLI pipelines..."
    run_ts_command "scan-pipelines" "$@"
}

command_scan-commands() {
    log_info "🔍 Scanning for CLI commands..."
    run_ts_command "scan-commands" "$@"
}

command_update-registry() {
    log_info "🔄 Updating registry with latest data..."
    run_ts_command "update-registry" "$@"
}

command_analyze-dependencies() {
    log_info "🔬 Analyzing service dependencies..."
    run_ts_command "analyze-dependencies" "$@"
}

command_validate-dependencies() {
    log_info "✅ Validating dependency relationships..."
    run_ts_command "validate-dependencies" "$@"
}

command_cleanup-orphaned() {
    log_info "🧹 Cleaning up orphaned dependencies..."
    run_ts_command "cleanup-orphaned" "$@"
}

command_refresh-usage-stats() {
    log_info "📊 Refreshing usage statistics..."
    run_ts_command "refresh-usage-stats" "$@"
}

command_export-report() {
    log_info "📄 Generating dependency report..."
    run_ts_command "export-report" "$@"
}

command_service-usage() {
    log_info "📊 Analyzing service usage..."
    run_ts_command "service-usage" "$@"
}

command_app-dependencies() {
    log_info "📊 Analyzing app dependencies..."
    run_ts_command "app-dependencies" "$@"
}

command_health-check() {
    log_info "🏥 Running health check..."
    
    local health_script="$SCRIPT_DIR/health-check.sh"
    if [[ -f "$health_script" ]]; then
        bash "$health_script" "$@"
    else
        log_warn "health-check.sh not found"
        log_info "Basic health check:"
        if [[ -d "$SCRIPT_DIR/commands" ]]; then
            local command_count=$(find "$SCRIPT_DIR/commands" -name "*.ts" | wc -l)
            log_success "Found $command_count TypeScript command files"
        else
            log_error "Commands directory not found"
        fi
        if [[ -f "$PROJECT_ROOT/tsconfig.node.json" ]]; then
            log_success "TypeScript configuration found"
        else
            log_error "TypeScript configuration missing"
        fi
    fi
}

command_init-system() {
    log_info "🚀 Initializing dependency mapping system..."
    run_ts_command "init-system" "$@"
}

command_reset-data() {
    log_warn "⚠️  Resetting dependency data..."
    run_ts_command "reset-data" "$@"
}

# Override help to add comprehensive examples and options
show_help() {
    echo "$PIPELINE_DESCRIPTION"
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
    echo "  help                   Show this help message"
    echo ""
    echo "OPTIONS:"
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

# Main execution
route_command "$@"