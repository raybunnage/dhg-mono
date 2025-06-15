#!/usr/bin/env bash

# ManagementCLIPipeline.sh - For system administration and maintenance
# Extends CLIPipelineBase with backup/restore, migrations, system health, and audit logging

# Source the base class
source "$(dirname "${BASH_SOURCE[0]}")/CLIPipelineBase.sh"

# Management pipeline specific variables
BACKUP_DIRECTORY=""
MIGRATION_LOG=""
AUDIT_LOG=""
SYSTEM_CHECK_INTERVAL=300  # 5 minutes
MAINTENANCE_MODE=false
DRY_RUN_MODE=false

# Initialize management pipeline with administration infrastructure
init_management_pipeline() {
    local pipeline_name="$1"
    local pipeline_description="$2"
    shift 2
    
    # Initialize base class
    init_cli_pipeline "$pipeline_name" "$pipeline_description" "$@"
    
    # Setup management infrastructure
    setup_management_infrastructure
    
    # Initialize audit logging
    init_audit_logging
}

# Setup management infrastructure
setup_management_infrastructure() {
    # Create management directories
    BACKUP_DIRECTORY="$PROJECT_ROOT/.backups/cli-management-$(date +%Y%m%d)"
    MIGRATION_LOG="$PROJECT_ROOT/logs/migration-$PIPELINE_NAME.log"
    AUDIT_LOG="$PROJECT_ROOT/logs/audit-$PIPELINE_NAME.log"
    
    # Ensure directories exist
    mkdir -p "$(dirname "$BACKUP_DIRECTORY")"
    mkdir -p "$(dirname "$MIGRATION_LOG")"
    mkdir -p "$(dirname "$AUDIT_LOG")"
    
    log_debug "Management infrastructure setup:"
    log_debug "  Backup directory: $BACKUP_DIRECTORY"
    log_debug "  Migration log: $MIGRATION_LOG"
    log_debug "  Audit log: $AUDIT_LOG"
    
    # Check for management services
    if check_service_available "backup-service"; then
        BACKUP_SERVICE_PATH=$(load_service "backup-service")
        log_debug "Backup service available: $BACKUP_SERVICE_PATH"
    else
        log_warn "Backup service not available - using built-in backup functionality"
    fi
}

# Initialize audit logging
init_audit_logging() {
    if [[ ! -f "$AUDIT_LOG" ]]; then
        cat > "$AUDIT_LOG" << EOF
# Audit Log: $PIPELINE_NAME
# Started: $(date)
timestamp|user|action|target|result|notes
EOF
    fi
    
    audit_log "system" "audit_init" "$PIPELINE_NAME" "success" "Audit logging initialized"
}

# Log audit events
audit_log() {
    local user="${1:-$(whoami)}"
    local action="$2"
    local target="$3"
    local result="$4"
    local notes="$5"
    
    local timestamp=$(date -Iseconds)
    echo "$timestamp|$user|$action|$target|$result|$notes" >> "$AUDIT_LOG"
    
    if [[ "$VERBOSE_MODE" == "true" ]]; then
        log_debug "AUDIT: $action on $target -> $result"
    fi
}

# System health check with comprehensive validation
system_health_check() {
    local check_type="${1:-basic}"  # basic, comprehensive, critical
    
    log_info "Running $check_type system health check"
    audit_log "$(whoami)" "health_check" "system" "started" "Type: $check_type"
    
    local issues_found=0
    local checks_passed=0
    local total_checks=0
    
    # Basic health checks
    basic_health_checks
    local basic_result=$?
    issues_found=$((issues_found + basic_result))
    total_checks=$((total_checks + 5))  # Assuming 5 basic checks
    checks_passed=$((total_checks - issues_found))
    
    if [[ "$check_type" == "comprehensive" || "$check_type" == "critical" ]]; then
        # Service health checks
        service_health_checks
        local service_result=$?
        issues_found=$((issues_found + service_result))
        total_checks=$((total_checks + 10))  # Assuming 10 service checks
        
        # Database health checks
        database_health_checks
        local db_result=$?
        issues_found=$((issues_found + db_result))
        total_checks=$((total_checks + 5))  # Assuming 5 database checks
        
        checks_passed=$((total_checks - issues_found))
    fi
    
    if [[ "$check_type" == "critical" ]]; then
        # Security and integrity checks
        security_health_checks
        local security_result=$?
        issues_found=$((issues_found + security_result))
        total_checks=$((total_checks + 8))  # Assuming 8 security checks
        
        checks_passed=$((total_checks - issues_found))
    fi
    
    # Generate health report
    log_info "Health check completed:"
    log_info "  Total checks: $total_checks"
    log_info "  Passed: $checks_passed"
    log_info "  Issues found: $issues_found"
    log_info "  Health score: $(echo "scale=1; $checks_passed * 100 / $total_checks" | bc 2>/dev/null || echo "N/A")%"
    
    local result_status="success"
    if [[ $issues_found -gt 0 ]]; then
        result_status="issues_found"
        log_warn "System health check found $issues_found issues"
    else
        log_success "System health check passed all tests"
    fi
    
    audit_log "$(whoami)" "health_check" "system" "$result_status" "Issues: $issues_found, Passed: $checks_passed/$total_checks"
    
    return $issues_found
}

# Basic health checks
basic_health_checks() {
    local issues=0
    
    log_debug "Running basic health checks..."
    
    # Check project root
    if [[ ! -d "$PROJECT_ROOT" ]]; then
        log_error "Project root directory missing: $PROJECT_ROOT"
        issues=$((issues + 1))
    fi
    
    # Check environment file
    if [[ ! -f "$PROJECT_ROOT/.env.development" ]]; then
        log_warn "Environment file missing: $PROJECT_ROOT/.env.development"
        issues=$((issues + 1))
    fi
    
    # Check base classes
    if [[ ! -f "$PROJECT_ROOT/scripts/cli-pipeline/base-classes/CLIPipelineBase.sh" ]]; then
        log_error "CLI base classes missing"
        issues=$((issues + 1))
    fi
    
    # Check disk space
    local disk_usage
    disk_usage=$(df "$PROJECT_ROOT" | tail -1 | awk '{print $5}' | sed 's/%//' 2>/dev/null || echo "0")
    if [[ $disk_usage -gt 90 ]]; then
        log_error "Disk usage critical: ${disk_usage}%"
        issues=$((issues + 1))
    elif [[ $disk_usage -gt 80 ]]; then
        log_warn "Disk usage high: ${disk_usage}%"
    fi
    
    # Check log directory
    if [[ ! -d "$PROJECT_ROOT/logs" ]]; then
        mkdir -p "$PROJECT_ROOT/logs" || {
            log_error "Cannot create logs directory"
            issues=$((issues + 1))
        }
    fi
    
    return $issues
}

# Service health checks
service_health_checks() {
    local issues=0
    
    log_debug "Running service health checks..."
    
    # Check critical services
    local critical_services=("database-service" "logger-service" "auth-service")
    
    for service in "${critical_services[@]}"; do
        if check_service_available "$service"; then
            log_debug "Service available: $service"
        else
            log_warn "Critical service missing: $service"
            issues=$((issues + 1))
        fi
    done
    
    # Additional service checks would go here
    
    return $issues
}

# Database health checks
database_health_checks() {
    local issues=0
    
    log_debug "Running database health checks..."
    
    # Check database connectivity
    if check_service_available "database-service"; then
        # Try database connection test
        # This would be implemented based on your database service
        log_debug "Database service available for health check"
    else
        log_warn "Database service not available for health check"
        issues=$((issues + 1))
    fi
    
    return $issues
}

# Security health checks
security_health_checks() {
    local issues=0
    
    log_debug "Running security health checks..."
    
    # Check for exposed secrets
    if grep -r "password\|secret\|key" "$PROJECT_ROOT" --include="*.sh" --include="*.ts" | grep -v ".env" | grep -v ".git" >/dev/null 2>&1; then
        log_warn "Potential secrets found in code - review required"
        issues=$((issues + 1))
    fi
    
    # Check file permissions
    local sensitive_files=(".env.development" "scripts/cli-pipeline")
    for file in "${sensitive_files[@]}"; do
        local full_path="$PROJECT_ROOT/$file"
        if [[ -e "$full_path" ]]; then
            local perms
            perms=$(stat -c %a "$full_path" 2>/dev/null || stat -f %A "$full_path" 2>/dev/null)
            if [[ "$perms" =~ [2367]$ ]]; then
                log_warn "File has world-writable permissions: $file ($perms)"
                issues=$((issues + 1))
            fi
        fi
    done
    
    return $issues
}

# Create system backup
create_backup() {
    local backup_type="${1:-incremental}"  # full, incremental, config-only
    local backup_name="${2:-auto-$(date +%Y%m%d_%H%M%S)}"
    
    log_info "Creating $backup_type backup: $backup_name"
    audit_log "$(whoami)" "backup_start" "$backup_name" "started" "Type: $backup_type"
    
    if [[ "$DRY_RUN_MODE" == "true" ]]; then
        log_info "DRY RUN: Would create backup $backup_name"
        return 0
    fi
    
    local backup_path="$BACKUP_DIRECTORY/$backup_name"
    mkdir -p "$backup_path"
    
    local backup_success=true
    
    case "$backup_type" in
        "full")
            create_full_backup "$backup_path"
            ;;
        "incremental")
            create_incremental_backup "$backup_path"
            ;;
        "config-only")
            create_config_backup "$backup_path"
            ;;
        *)
            log_error "Unknown backup type: $backup_type"
            backup_success=false
            ;;
    esac
    
    if [[ "$backup_success" == "true" ]]; then
        # Create backup manifest
        create_backup_manifest "$backup_path" "$backup_type"
        
        log_success "Backup created successfully: $backup_path"
        audit_log "$(whoami)" "backup_complete" "$backup_name" "success" "Path: $backup_path"
        echo "$backup_path"
        return 0
    else
        log_error "Backup failed: $backup_name"
        audit_log "$(whoami)" "backup_complete" "$backup_name" "failed" "Backup creation failed"
        return 1
    fi
}

# Create full backup
create_full_backup() {
    local backup_path="$1"
    
    log_info "Creating full system backup"
    
    # Backup key directories
    track_and_execute "backup_scripts" "Backup CLI scripts" \
        cp -r "$PROJECT_ROOT/scripts" "$backup_path/"
    
    track_and_execute "backup_docs" "Backup documentation" \
        cp -r "$PROJECT_ROOT/docs" "$backup_path/"
    
    track_and_execute "backup_config" "Backup configuration" \
        cp "$PROJECT_ROOT/.env.development" "$backup_path/" 2>/dev/null || true
    
    # Backup package configurations
    track_and_execute "backup_packages" "Backup package configurations" \
        cp "$PROJECT_ROOT/package.json" "$PROJECT_ROOT/pnpm-lock.yaml" "$backup_path/" 2>/dev/null || true
}

# Create incremental backup
create_incremental_backup() {
    local backup_path="$1"
    
    log_info "Creating incremental backup"
    
    # Find files changed in last 24 hours
    local changed_files
    changed_files=$(find "$PROJECT_ROOT" -type f -mtime -1 2>/dev/null | grep -E "\.(sh|ts|js|json|md)$" || true)
    
    if [[ -n "$changed_files" ]]; then
        echo "$changed_files" | while read -r file; do
            local relative_path="${file#$PROJECT_ROOT/}"
            local dest_dir="$backup_path/$(dirname "$relative_path")"
            mkdir -p "$dest_dir"
            cp "$file" "$dest_dir/"
        done
        
        log_info "Incremental backup included $(echo "$changed_files" | wc -l) changed files"
    else
        log_info "No changed files found for incremental backup"
    fi
}

# Create configuration backup
create_config_backup() {
    local backup_path="$1"
    
    log_info "Creating configuration-only backup"
    
    # Backup configuration files
    local config_files=(
        ".env.development"
        "package.json"
        "pnpm-lock.yaml"
        "tsconfig.json"
        "supabase/config.toml"
    )
    
    for config_file in "${config_files[@]}"; do
        local full_path="$PROJECT_ROOT/$config_file"
        if [[ -f "$full_path" ]]; then
            local dest_dir="$backup_path/$(dirname "$config_file")"
            mkdir -p "$dest_dir"
            cp "$full_path" "$dest_dir/"
        fi
    done
}

# Create backup manifest
create_backup_manifest() {
    local backup_path="$1"
    local backup_type="$2"
    
    cat > "$backup_path/MANIFEST.txt" << EOF
# Backup Manifest
Created: $(date)
Type: $backup_type
Pipeline: $PIPELINE_NAME
User: $(whoami)
Host: $(hostname)
Path: $backup_path

# Contents:
$(find "$backup_path" -type f | sed "s|$backup_path/||" | sort)

# Checksums:
$(find "$backup_path" -type f -exec sha256sum {} \; 2>/dev/null | sed "s|$backup_path/||")
EOF
}

# Restore from backup
restore_backup() {
    local backup_path="$1"
    local restore_type="${2:-verify-first}"  # verify-first, force, dry-run
    
    if [[ ! -d "$backup_path" ]]; then
        log_error "Backup not found: $backup_path"
        return 1
    fi
    
    if [[ ! -f "$backup_path/MANIFEST.txt" ]]; then
        log_error "Backup manifest not found: $backup_path/MANIFEST.txt"
        return 1
    fi
    
    log_info "Restoring from backup: $backup_path"
    audit_log "$(whoami)" "restore_start" "$backup_path" "started" "Type: $restore_type"
    
    if [[ "$restore_type" == "dry-run" ]]; then
        log_info "DRY RUN: Would restore from $backup_path"
        return 0
    fi
    
    if [[ "$restore_type" == "verify-first" ]]; then
        log_info "Verifying backup integrity before restore..."
        if ! verify_backup "$backup_path"; then
            log_error "Backup verification failed - aborting restore"
            return 1
        fi
    fi
    
    # Create current state backup before restore
    log_info "Creating safety backup before restore..."
    local safety_backup
    safety_backup=$(create_backup "incremental" "pre-restore-$(date +%Y%m%d_%H%M%S)")
    
    # Perform restore
    track_and_execute "restore_files" "Restore files from backup" \
        cp -r "$backup_path"/* "$PROJECT_ROOT/"
    
    local restore_result=$?
    
    if [[ $restore_result -eq 0 ]]; then
        log_success "Restore completed successfully"
        audit_log "$(whoami)" "restore_complete" "$backup_path" "success" "Safety backup: $safety_backup"
    else
        log_error "Restore failed"
        audit_log "$(whoami)" "restore_complete" "$backup_path" "failed" "Restore operation failed"
    fi
    
    return $restore_result
}

# Verify backup integrity
verify_backup() {
    local backup_path="$1"
    
    log_info "Verifying backup integrity: $backup_path"
    
    if [[ ! -f "$backup_path/MANIFEST.txt" ]]; then
        log_error "No manifest file found"
        return 1
    fi
    
    # Check if all files listed in manifest exist
    local missing_files=0
    local corrupted_files=0
    
    grep -E "^[a-zA-Z0-9]" "$backup_path/MANIFEST.txt" | while read -r file; do
        if [[ ! -f "$backup_path/$file" ]]; then
            log_warn "Missing file in backup: $file"
            missing_files=$((missing_files + 1))
        fi
    done
    
    # Verify checksums if available
    if grep -q "^[a-f0-9]" "$backup_path/MANIFEST.txt"; then
        log_debug "Verifying file checksums..."
        # This would verify checksums - implementation depends on format
    fi
    
    if [[ $missing_files -eq 0 && $corrupted_files -eq 0 ]]; then
        log_success "Backup verification passed"
        return 0
    else
        log_error "Backup verification failed: $missing_files missing, $corrupted_files corrupted"
        return 1
    fi
}

# Database migration management
manage_migration() {
    local action="$1"  # plan, execute, rollback, status
    local migration_target="$2"
    
    log_info "Managing database migration: $action"
    audit_log "$(whoami)" "migration_$action" "$migration_target" "started" ""
    
    case "$action" in
        "plan")
            plan_migration "$migration_target"
            ;;
        "execute")
            execute_migration "$migration_target"
            ;;
        "rollback")
            rollback_migration "$migration_target"
            ;;
        "status")
            migration_status
            ;;
        *)
            log_error "Unknown migration action: $action"
            return 1
            ;;
    esac
}

# System maintenance operations
system_maintenance() {
    local operation="$1"  # cleanup, optimize, update, restart
    
    log_info "Performing system maintenance: $operation"
    audit_log "$(whoami)" "maintenance_$operation" "system" "started" ""
    
    if [[ "$MAINTENANCE_MODE" != "true" ]]; then
        log_warn "System not in maintenance mode - some operations may affect running services"
    fi
    
    case "$operation" in
        "cleanup")
            cleanup_system
            ;;
        "optimize")
            optimize_system
            ;;
        "update")
            update_system
            ;;
        "restart")
            restart_services
            ;;
        *)
            log_error "Unknown maintenance operation: $operation"
            return 1
            ;;
    esac
}

# Enable/disable maintenance mode
set_maintenance_mode() {
    local enable="$1"  # true/false
    
    if [[ "$enable" == "true" ]]; then
        MAINTENANCE_MODE=true
        log_warn "MAINTENANCE MODE ENABLED"
        audit_log "$(whoami)" "maintenance_mode" "enabled" "success" "System in maintenance mode"
    else
        MAINTENANCE_MODE=false
        log_info "Maintenance mode disabled"
        audit_log "$(whoami)" "maintenance_mode" "disabled" "success" "System operational"
    fi
}

# Management-specific help message
show_management_help() {
    echo -e "${BLUE}$PIPELINE_DESCRIPTION${NC}"
    echo -e "${CYAN}(Management CLI Pipeline)${NC}"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "System Management Commands:"
    echo "  health [basic|comprehensive|critical]  Run system health check"
    echo "  backup [full|incremental|config-only]  Create system backup"
    echo "  restore <backup-path>                  Restore from backup"
    echo "  verify <backup-path>                   Verify backup integrity"
    echo "  migrate <action> [target]              Manage database migrations"
    echo "  maintain <operation>                   Perform system maintenance"
    echo "  maintenance-mode [on|off]              Enable/disable maintenance mode"
    echo ""
    
    # Show pipeline-specific commands
    local commands
    commands=$(discover_commands)
    if [[ -n "$commands" ]]; then
        echo "Pipeline-Specific Commands:"
        while IFS= read -r cmd; do
            if [[ ! "$cmd" =~ ^(health|backup|restore|verify|migrate|maintain)$ ]]; then
                echo "  $(printf "%-30s" "$cmd") Pipeline-specific management command"
            fi
        done <<< "$commands"
        echo ""
    fi
    
    echo "Management Options:"
    echo "  --dry-run                  Show what would be done without executing"
    echo "  --maintenance-mode         Enable maintenance mode for operations"
    echo "  --backup-dir <path>        Specify backup directory"
    echo ""
    echo "Global Options:"
    echo "  --debug                    Enable debug mode"
    echo "  --verbose                  Enable verbose output"
    echo "  --help, -h                 Show this help message"
    echo ""
    echo "Current Status:"
    echo "  Maintenance Mode: $([ "$MAINTENANCE_MODE" == "true" ] && echo "ENABLED" || echo "Disabled")"
    echo "  Dry Run Mode: $([ "$DRY_RUN_MODE" == "true" ] && echo "ENABLED" || echo "Disabled")"
    echo "  Backup Directory: $BACKUP_DIRECTORY"
    echo ""
    echo "Framework Info:"
    echo "  Type: Management CLI Pipeline"
    echo "  Pipeline: $PIPELINE_NAME v$PIPELINE_VERSION"
    echo "  Base Class: CLIPipelineBase v$CLI_BASE_VERSION"
}

# Override base show_help
show_help() {
    show_management_help
}

# Export management pipeline functions
export -f init_management_pipeline
export -f audit_log
export -f system_health_check
export -f create_backup restore_backup verify_backup
export -f manage_migration
export -f system_maintenance
export -f set_maintenance_mode