#!/bin/bash

# Archival CLI - Safe code archival management system
# Implements phased archival strategy for cleaning up after refactoring

# Save the actual script directory before sourcing base class
ARCHIVAL_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_DIR="$ARCHIVAL_SCRIPT_DIR"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Source the base class
source "$SCRIPT_DIR/../base-classes/ManagementCLIPipeline.sh"

# Restore our script directory after sourcing
SCRIPT_DIR="$ARCHIVAL_SCRIPT_DIR"

# Initialize pipeline
init_management_pipeline "archival" "Code Archival Management System"

# Override show_help for archival-specific help
show_help() {
    echo -e "${BLUE}Archival CLI - Safe code archival management${NC}"
    echo -e "${YELLOW}⚠️  Critical operation - handles code archival${NC}"
    echo ""
    echo "USAGE:"
    echo "  $0 <command> [options]"
    echo ""
    echo "COMMANDS:"
    echo ""
    echo "DETECTION:"
    echo "  detect --phase <a|b|c>     Detect archival candidates for specified phase"
    echo "    --output <file>            Save candidates to JSON file"
    echo "    --confidence <high|all>    Filter by confidence level (default: high)"
    echo ""
    echo "REVIEW:"
    echo "  review --input <file>      Review candidates and generate manifest"
    echo "    --output <file>            Save manifest to markdown file"
    echo "    --interactive              Interactive review mode"
    echo ""
    echo "EXECUTION:"
    echo "  execute --manifest <file>  Execute archival based on manifest"
    echo "    --dry-run                  Show what would be archived without doing it"
    echo "    --confirm                  Actually perform the archival (required)"
    echo "    --backup-dir <dir>         Archive destination directory"
    echo ""
    echo "REPORTING:"
    echo "  status                     Show current archival status and metrics"
    echo "  history                    Show archival operation history"
    echo "  verify                     Verify system health after archival"
    echo ""
    echo "RECOVERY:"
    echo "  list-archives              List all archives with manifests"
    echo "  restore --archive <dir>    Restore files from an archive"
    echo "    --files <pattern>          Restore only matching files"
    echo ""
    echo "PHASES:"
    echo "  Phase A: High confidence targets (*.old, *.backup, refactored pairs)"
    echo "  Phase B: Unused code (0 imports, 90+ days old)"
    echo "  Phase C: Experimental/prototype code"
    echo ""
    echo "EXAMPLES:"
    echo "  # Detect Phase A candidates"
    echo "  $0 detect --phase a --output candidates.json"
    echo ""
    echo "  # Review and create manifest"
    echo "  $0 review --input candidates.json --output manifest.md"
    echo ""
    echo "  # Dry run to see what would happen"
    echo "  $0 execute --manifest manifest.md --dry-run"
    echo ""
    echo "  # Execute archival with confirmation"
    echo "  $0 execute --manifest manifest.md --confirm"
    echo ""
    echo "SAFETY:"
    echo "  - All operations create detailed logs"
    echo "  - Manifests document every decision"
    echo "  - Archives include restoration scripts"
    echo "  - Dry-run available for all operations"
}

# Command: detect - Find archival candidates
command_detect() {
    local phase=""
    local output=""
    local confidence="high"
    
    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --phase)
                phase="$2"
                shift 2
                ;;
            --output)
                output="$2"
                shift 2
                ;;
            --confidence)
                confidence="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done
    
    if [[ -z "$phase" ]]; then
        log_error "Phase required: --phase <a|b|c>"
        return 1
    fi
    
    log_info "🔍 Detecting archival candidates for Phase $phase"
    
    # Show warning for critical operation
    echo ""
    echo "⚠️  WARNING: ARCHIVAL DETECTION"
    echo "This will scan for files to archive in Phase $phase"
    echo ""
    
    # Run the detection command
    node "$ARCHIVAL_SCRIPT_DIR/commands/detect-candidates.cjs" \
        --phase "$phase" \
        --confidence "$confidence" \
        ${output:+--output "$output"}
}

# Command: review - Review candidates and create manifest
command_review() {
    local input=""
    local output="archival-manifest.json"
    local mode="interactive"
    
    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --input)
                input="$2"
                shift 2
                ;;
            --output)
                output="$2"
                shift 2
                ;;
            --batch)
                mode="batch"
                shift
                ;;
            --interactive)
                mode="interactive"
                shift
                ;;
            *)
                shift
                ;;
        esac
    done
    
    log_info "📋 Reviewing archival candidates"
    
    # Build command based on mode
    local cmd="node $ARCHIVAL_SCRIPT_DIR/commands/review-candidates.cjs"
    
    if [[ -n "$input" ]]; then
        cmd="$cmd --input $input"
    fi
    
    cmd="$cmd --output $output"
    
    if [[ "$mode" == "batch" ]]; then
        cmd="$cmd --batch"
    fi
    
    # Execute review command
    eval "$cmd"
}

# Command: execute - Execute archival based on manifest
command_execute() {
    local manifest=""
    local dry_run=false
    local verify=false
    
    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --manifest)
                manifest="$2"
                shift 2
                ;;
            --dry-run)
                dry_run=true
                shift
                ;;
            --verify)
                verify=true
                shift
                ;;
            *)
                shift
                ;;
        esac
    done
    
    if [[ -z "$manifest" ]]; then
        log_error "Manifest required: --manifest <file>"
        return 1
    fi
    
    if [[ "$dry_run" == true ]]; then
        log_info "🔍 DRY RUN: Showing what would be archived"
    else
        log_warn "⚠️  EXECUTING ARCHIVAL - This will move files!"
        echo ""
        echo "⚠️  WARNING: ARCHIVAL EXECUTION"
        echo "This will permanently move files to the archive directory!"
        echo ""
        
        # Simple confirmation
        read -p "Are you sure you want to proceed? (yes/no): " confirm
        if [[ "$confirm" != "yes" ]]; then
            log_info "Archival cancelled"
            return 0
        fi
    fi
    
    # Build and execute command
    local cmd="node $ARCHIVAL_SCRIPT_DIR/commands/execute-archival.cjs --manifest $manifest"
    
    if [[ "$dry_run" == true ]]; then
        cmd="$cmd --dry-run"
    fi
    
    if [[ "$verify" == true ]]; then
        cmd="$cmd --verify"
    fi
    
    eval "$cmd"
}

# Command: status - Show archival status
command_status() {
    log_info "📊 Archival System Status"
    
    track_and_execute "archival_status" "Show archival status and metrics" \
        npx ts-node "$SCRIPT_DIR/commands/show-status.ts"
}

# Command: verify - Verify system health after archival
command_verify() {
    log_info "🏥 Verifying system health after archival"
    
    # Run tests
    log_info "Running tests..."
    if npm test > /dev/null 2>&1; then
        log_success "Tests pass"
    else
        log_error "Tests failed - archival may have broken something"
        return 1
    fi
    
    # Check build
    log_info "Checking build..."
    if npm run build > /dev/null 2>&1; then
        log_success "Build succeeds"
    else
        log_error "Build failed - archival may have broken something"
        return 1
    fi
    
    log_success "System health verified - archival appears safe"
}

# Command: list-archives - List all archives
command_list-archives() {
    log_info "📦 Available Archives"
    
    local archive_dir="$PROJECT_ROOT/.archived"
    
    if [[ ! -d "$archive_dir" ]]; then
        log_warn "No archives found"
        return 0
    fi
    
    find "$archive_dir" -name "manifest.md" -type f | while read -r manifest; do
        local dir=$(dirname "$manifest")
        local name=$(basename "$dir")
        echo ""
        echo "Archive: $name"
        echo "Path: $dir"
        if [[ -f "$manifest" ]]; then
            echo "Files: $(grep -c "^-" "$manifest" 2>/dev/null || echo "0")"
        fi
    done
}

# Command: restore - Restore from archive
command_restore() {
    local archive=""
    local files=""
    
    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --archive)
                archive="$2"
                shift 2
                ;;
            --files)
                files="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done
    
    if [[ -z "$archive" ]]; then
        log_error "Archive required: --archive <dir>"
        return 1
    fi
    
    log_warn "⚠️  RESTORE OPERATION"
    show_critical_warning "RESTORE FROM ARCHIVE" "This will restore archived files"
    
    if ! prompt_confirmation "Are you sure you want to restore from $archive?"; then
        log_info "Restore cancelled"
        return 0
    fi
    
    track_and_execute "restore_archive" "Restore files from archive" \
        npx ts-node "$SCRIPT_DIR/commands/restore-archive.ts" \
            --archive "$archive" \
            ${files:+--files "$files"}
}

# Command: health-check
command_health-check() {
    log_info "🏥 Running archival system health check..."
    
    local health_status=0
    
    # Check if detection script exists
    if [[ -f "$SCRIPT_DIR/commands/detect-candidates.ts" ]]; then
        log_success "Detection command available"
    else
        log_error "Detection command not found"
        health_status=1
    fi
    
    # Check archive directory
    if [[ -d "$PROJECT_ROOT/.archived" ]]; then
        log_success "Archive directory exists"
    else
        log_warn "Archive directory not found (will be created on first use)"
    fi
    
    # Check database connection
    if [[ -n "$SUPABASE_URL" ]] && [[ -n "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
        log_success "Database configuration available"
    else
        log_warn "Database not configured - tracking will be limited"
    fi
    
    if [[ $health_status -eq 0 ]]; then
        log_success "Archival system is healthy"
    else
        log_warn "Some components need attention"
    fi
    
    return $health_status
}

# Route commands using the base class pattern
case "${1:-help}" in
    detect|review|execute|status|verify|list-archives|restore|health-check|help|--help)
        # Convert to function name format
        cmd="${1//-/_}"
        shift
        "command_$cmd" "$@"
        ;;
    *)
        log_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac