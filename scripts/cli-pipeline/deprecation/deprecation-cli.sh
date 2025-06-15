#!/bin/bash

# Deprecation Analysis CLI Pipeline
# Manages deprecation evaluation, operation, and monitoring
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
init_cli_pipeline "deprecation" "Deprecation Analysis CLI - Deprecation evaluation, operation, and monitoring"

# Function to run TypeScript commands with fallback
run_deprecation_command() {
    local script_path="$1"
    shift
    
    local full_path="$SCRIPT_DIR/$script_path"
    if [[ -f "$full_path" ]]; then
        cd "$PROJECT_ROOT" && npx ts-node "$full_path" "$@"
    else
        log_warn "$script_path not found"
        log_info "Fallback: Basic ${script_path##*/} operation"
        
        local script_name=$(basename "$script_path" .ts)
        case "$script_name" in
            "analyze-services")
                log_info "Would analyze unused services in packages/shared/services"
                local service_count=$(find "$PROJECT_ROOT/packages/shared/services" -name "*.ts" -type f | grep -v test | wc -l)
                echo "  - Found $service_count services to analyze for usage"
                ;;
            "analyze-scripts")
                log_info "Would analyze inactive scripts"
                local script_count=$(find "$PROJECT_ROOT/scripts" -name "*.ts" -o -name "*.js" | wc -l)
                echo "  - Found $script_count scripts to analyze"
                ;;
            "analyze-script-usage")
                log_info "Would perform detailed script usage analysis across monorepo"
                ;;
            "analyze-commands"|"analyze-pipelines")
                log_info "Would analyze $script_name patterns and usage"
                ;;
            "archive-"*|"restore-"*|"list-archived")
                log_info "Would perform $script_name operation"
                ;;
            "validate-"*)
                log_info "Would validate $script_name"
                ;;
            "generate-"*|"mark-deprecated"|"monitor-usage"|"usage-trends")
                log_info "Would execute $script_name operation"
                ;;
            "export-candidates"|"import-plan"|"validate-plan"|"cleanup-"*)
                log_info "Would perform $script_name utility operation"
                ;;
        esac
    fi
}

# Define commands

command_help() {
    show_help
}

# EVALUATION COMMANDS
command_analyze-services() {
    log_info "📊 Analyzing unused services..."
    run_deprecation_command "commands/analyze-services.ts" "$@"
}

command_analyze-scripts() {
    log_info "📊 Analyzing inactive scripts..."
    run_deprecation_command "commands/analyze-scripts.ts" "$@"
}

command_analyze-script-usage() {
    log_info "🔍 Analyzing detailed script usage across monorepo..."
    run_deprecation_command "commands/analyze-script-usage.ts" "$@"
}

command_analyze-commands() {
    log_info "📊 Analyzing low-usage CLI commands..."
    run_deprecation_command "commands/analyze-commands.ts" "$@"
}

command_analyze-pipelines() {
    log_info "📊 Analyzing pipeline usage patterns..."
    run_deprecation_command "commands/analyze-pipelines.ts" "$@"
}

command_generate-report() {
    log_info "📝 Generating comprehensive deprecation report..."
    run_deprecation_command "commands/generate-report.ts" "$@"
}

# OPERATION COMMANDS
command_mark-deprecated() {
    log_info "🏷️  Marking items for deprecation..."
    run_deprecation_command "commands/mark-deprecated.ts" "$@"
}

command_archive-service() {
    log_info "📦 Archiving deprecated service..."
    run_deprecation_command "commands/archive-service.ts" "$@"
}

command_archive-script() {
    log_info "📦 Archiving deprecated script..."
    run_deprecation_command "commands/archive-script.ts" "$@"
}

command_archive-scripts() {
    log_info "📦 Archiving unused scripts..."
    run_deprecation_command "commands/archive-scripts.ts" "$@"
}

command_archive-likely-obsolete() {
    log_info "📦 Archiving likely obsolete scripts (Phase 2B)..."
    run_deprecation_command "archive-likely-obsolete-scripts.ts" "$@"
}

command_restore-script() {
    log_info "♻️ Restoring archived script..."
    run_deprecation_command "commands/restore-script.ts" "$@"
}

command_restore-batch() {
    log_info "♻️ Batch restoring archived scripts..."
    run_deprecation_command "commands/restore-batch.ts" "$@"
}

command_list-archived() {
    log_info "📋 Listing archived scripts..."
    run_deprecation_command "commands/list-archived.ts" "$@"
}

# VALIDATION COMMANDS
command_validate-imports() {
    log_info "🔍 Validating imports for archived scripts..."
    run_deprecation_command "commands/validate-imports.ts" "$@"
}

command_validate-cli-commands() {
    log_info "🔍 Validating CLI commands..."
    run_deprecation_command "commands/validate-cli-commands.ts" "$@"
}

command_validate-archiving() {
    log_info "🔍 Running comprehensive archiving validation..."
    echo ""
    echo "Step 1: Validating imports..."
    command_validate-imports
    echo ""
    echo "Step 2: Validating CLI commands..."
    command_validate-cli-commands
}

command_cleanup-commands() {
    log_info "🧹 Cleaning up unimplemented commands..."
    run_deprecation_command "commands/cleanup-unimplemented-commands.ts" "$@"
}

command_deprecate-command() {
    log_info "🚫 Deprecating CLI command..."
    run_deprecation_command "commands/deprecate-command.ts" "$@"
}

command_generate-migration() {
    log_info "🔄 Generating migration plan..."
    run_deprecation_command "commands/generate-migration.ts" "$@"
}

# MONITORING COMMANDS
command_monitor-usage() {
    log_info "📈 Monitoring usage of deprecated items..."
    run_deprecation_command "commands/monitor-usage.ts" "$@"
}

command_health-check() {
    log_info "🏥 Checking deprecation tracking health..."
    
    local health_script="$SCRIPT_DIR/health-check.sh"
    if [[ -f "$health_script" ]]; then
        bash "$health_script"
    else
        log_warn "health-check.sh not found"
        log_info "Basic health check:"
        
        # Check environment variables
        if [[ -z "$SUPABASE_URL" ]] || [[ -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
            log_error "Missing required environment variables"
            return 1
        else
            log_success "Environment variables configured"
        fi
        
        # Check commands directory
        if [[ -d "$SCRIPT_DIR/commands" ]]; then
            local command_count=$(find "$SCRIPT_DIR/commands" -name "*.ts" | wc -l)
            log_success "Found $command_count TypeScript command files"
        else
            log_error "Commands directory not found"
        fi
        
        log_success "✅ Deprecation tracking pipeline is healthy"
    fi
}

command_usage-trends() {
    log_info "📊 Showing usage trends..."
    run_deprecation_command "commands/usage-trends.ts" "$@"
}

# UTILITY COMMANDS
command_export-candidates() {
    log_info "📤 Exporting deprecation candidates..."
    run_deprecation_command "commands/export-candidates.ts" "$@"
}

command_import-plan() {
    log_info "📥 Importing deprecation plan..."
    run_deprecation_command "commands/import-plan.ts" "$@"
}

command_validate-plan() {
    log_info "✅ Validating deprecation plan..."
    run_deprecation_command "commands/validate-plan.ts" "$@"
}

# Override help to add comprehensive deprecation management examples
show_help() {
    echo "$PIPELINE_DESCRIPTION"
    echo "========================"
    echo ""
    echo "USAGE:"
    echo "  ./deprecation-cli.sh <command> [options]"
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
    echo "  help                 Show this help message"
    echo ""
    echo "EXAMPLES:"
    echo "  ./deprecation-cli.sh analyze-services"
    echo "  ./deprecation-cli.sh mark-deprecated --type service --name old-service"
    echo "  ./deprecation-cli.sh generate-report --output deprecation-report.md"
    echo "  ./deprecation-cli.sh validate-archiving"
    echo "  ./deprecation-cli.sh monitor-usage"
}

# Main execution
route_command "$@"