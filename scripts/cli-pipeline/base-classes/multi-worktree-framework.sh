#!/usr/bin/env bash

# Multi-Worktree CLI Pipeline Refactoring Framework
# Shared utilities and coordination framework for parallel CLI pipeline refactoring

# Framework configuration
FRAMEWORK_VERSION="1.0.0"
COORDINATION_DB_TABLE="cli_pipeline_refactoring_coordination"
SHARED_GLITCH_LOG="docs/living-docs/cli-service-integration-issues.md"

# Source base classes
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/CLIPipelineBase.sh"

# Multi-worktree coordination functions

# Register worktree group and pipelines
register_worktree_group() {
    local group_name="$1"
    local worktree_path="$2"
    local assigned_pipelines="$3"
    
    log_info "Registering worktree group: $group_name"
    log_info "Worktree path: $worktree_path"
    log_info "Assigned pipelines: $assigned_pipelines"
    
    # Create coordination record
    local coordination_data="{
        \"group_name\": \"$group_name\",
        \"worktree_path\": \"$worktree_path\", 
        \"assigned_pipelines\": \"$assigned_pipelines\",
        \"status\": \"registered\",
        \"started_at\": \"$(date -Iseconds)\",
        \"progress\": 0
    }"
    
    echo "$coordination_data" > "/tmp/cli-refactor-$group_name.json"
    log_success "Group $group_name registered successfully"
}

# Update progress for a pipeline
update_pipeline_progress() {
    local group_name="$1"
    local pipeline_name="$2"
    local status="$3"  # started, analyzing, migrating, testing, completed, failed
    local notes="$4"
    
    log_info "Updating progress: $group_name/$pipeline_name -> $status"
    
    # Append to progress log
    echo "$(date -Iseconds)|$group_name|$pipeline_name|$status|$notes" >> "/tmp/cli-refactor-progress.log"
    
    # Update coordination file
    local coord_file="/tmp/cli-refactor-$group_name.json"
    if [[ -f "$coord_file" ]]; then
        # Update the JSON file (simplified approach)
        local timestamp=$(date -Iseconds)
        echo "{\"last_update\": \"$timestamp\", \"current_pipeline\": \"$pipeline_name\", \"status\": \"$status\"}" > "/tmp/cli-refactor-$group_name-current.json"
    fi
}

# Check for conflicts with other groups
check_pipeline_conflicts() {
    local pipeline_name="$1"
    local group_name="$2"
    
    # Check if another group is working on the same pipeline
    if grep -q "|$pipeline_name|" /tmp/cli-refactor-progress.log 2>/dev/null; then
        local conflicting_group
        conflicting_group=$(grep "|$pipeline_name|" /tmp/cli-refactor-progress.log | tail -1 | cut -d'|' -f2)
        
        if [[ "$conflicting_group" != "$group_name" ]]; then
            log_warn "Potential conflict: $pipeline_name also being worked on by $conflicting_group"
            return 1
        fi
    fi
    
    return 0
}

# Analyze pipeline complexity and service dependencies
analyze_pipeline_complexity() {
    local pipeline_path="$1"
    local pipeline_name=$(basename "$pipeline_path" -cli.sh)
    
    log_info "Analyzing complexity for: $pipeline_name"
    
    if [[ ! -f "$pipeline_path" ]]; then
        log_error "Pipeline not found: $pipeline_path"
        return 1
    fi
    
    # Count commands (functions starting with command_ or functions called in case statements)
    local command_count
    command_count=$(grep -c "^[[:space:]]*command_\|).*;" "$pipeline_path" 2>/dev/null || echo "0")
    
    # Count service dependencies (imports, service calls)
    local service_count
    service_count=$(grep -c "Service\|service\|import.*from" "$pipeline_path" 2>/dev/null || echo "0")
    
    # Count lines of code (excluding comments and blank lines)
    local loc
    loc=$(grep -c -v "^[[:space:]]*#\|^[[:space:]]*$" "$pipeline_path" 2>/dev/null || echo "0")
    
    # Calculate complexity score
    local complexity_score=$((command_count * 10 + service_count * 5 + loc / 10))
    
    # Determine complexity level
    local complexity_level="LOW"
    if [[ $complexity_score -gt 100 ]]; then
        complexity_level="HIGH"
    elif [[ $complexity_score -gt 50 ]]; then
        complexity_level="MEDIUM"
    fi
    
    log_info "Complexity Analysis for $pipeline_name:"
    log_info "  Commands: $command_count"
    log_info "  Services: $service_count" 
    log_info "  Lines: $loc"
    log_info "  Score: $complexity_score"
    log_info "  Level: $complexity_level"
    
    echo "$complexity_level"
}

# Get pipeline domain/category
get_pipeline_domain() {
    local pipeline_name="$1"
    
    case "$pipeline_name" in
        *database*|*db*) echo "DATA" ;;
        *google*|*gmail*|*drive*) echo "GOOGLE" ;;
        *media*|*audio*|*video*) echo "MEDIA" ;;
        *git*|*worktree*) echo "GIT" ;;
        *doc*|*document*) echo "DOCUMENTS" ;;
        *server*|*proxy*|*deployment*) echo "INFRASTRUCTURE" ;;
        *test*|*util*|*script*) echo "UTILITIES" ;;
        *task*|*work*|*dev*) echo "DEVELOPMENT" ;;
        *monitor*|*track*|*registry*) echo "MONITORING" ;;
        *auth*|*expert*|*ai*) echo "SERVICES" ;;
        *all-pipeline*|*system*) echo "SYSTEM" ;;
        *) echo "GENERAL" ;;
    esac
}

# Generate migration plan for a pipeline
generate_migration_plan() {
    local pipeline_path="$1"
    local pipeline_name=$(basename "$pipeline_path" -cli.sh)
    local group_name="$2"
    
    log_info "Generating migration plan for: $pipeline_name"
    
    # Analyze the pipeline
    local complexity
    complexity=$(analyze_pipeline_complexity "$pipeline_path")
    local domain
    domain=$(get_pipeline_domain "$pipeline_name")
    
    # Create migration plan
    local plan_file="/tmp/migration-plan-$pipeline_name.md"
    cat > "$plan_file" << EOF
# Migration Plan: $pipeline_name

## Analysis
- **Group**: $group_name
- **Complexity**: $complexity
- **Domain**: $domain
- **Path**: $pipeline_path

## Migration Steps
1. [ ] **Analysis Phase** - Understand current functionality
2. [ ] **Service Audit** - Identify service dependencies
3. [ ] **Base Class Selection** - Choose appropriate base class
4. [ ] **Code Archival** - Archive redundant/outdated code
5. [ ] **Migration Implementation** - Implement using base class
6. [ ] **Service Integration** - Hook up refactored services
7. [ ] **Testing & Validation** - Ensure functionality preservation
8. [ ] **Database Updates** - Update tracking and documentation

## Service Dependencies (To Be Identified)
- [ ] List services currently used
- [ ] Identify missing services needed
- [ ] Note integration issues

## Quality Gates
- [ ] No functionality regression
- [ ] Help system standardized
- [ ] Error handling consistent
- [ ] Performance maintained/improved
- [ ] Service integration successful

## Generated: $(date)
EOF
    
    log_success "Migration plan created: $plan_file"
    echo "$plan_file"
}

# Submit issue to shared glitch log
submit_glitch() {
    local pipeline_name="$1"
    local group_name="$2"
    local issue_type="$3"  # missing_service, integration_error, performance, etc.
    local description="$4"
    local impact="$5"      # low, medium, high
    
    local timestamp=$(date -Iseconds)
    local issue_entry="
### Issue: $pipeline_name ($group_name)
- **Type**: $issue_type
- **Impact**: $impact
- **Description**: $description
- **Reported**: $timestamp by $group_name
- **Status**: 🔄 **OPEN**
"
    
    # Append to shared glitch log
    echo "$issue_entry" >> "$SHARED_GLITCH_LOG"
    
    log_warn "Glitch reported: $issue_type in $pipeline_name"
}

# Get refactored service path with fallback
get_service_with_fallback() {
    local service_name="$1"
    local pipeline_name="$2"
    local group_name="$3"
    
    # Try refactored service first
    local refactored_path="$PROJECT_ROOT/packages/shared/services/$service_name-refactored"
    local standard_path="$PROJECT_ROOT/packages/shared/services/$service_name"
    
    if [[ -d "$refactored_path" ]]; then
        log_success "Using refactored service: $service_name"
        echo "$refactored_path"
        return 0
    elif [[ -d "$standard_path" ]]; then
        log_warn "Using non-refactored service: $service_name"
        submit_glitch "$pipeline_name" "$group_name" "non_refactored_service" \
            "Service $service_name not yet refactored" "medium"
        echo "$standard_path"
        return 0
    else
        log_error "Service not found: $service_name"
        submit_glitch "$pipeline_name" "$group_name" "missing_service" \
            "Service $service_name not available" "high"
        return 1
    fi
}

# Coordinate with other worktrees
coordinate_worktrees() {
    local action="$1"  # sync, status, complete
    local group_name="$2"
    
    case "$action" in
        "sync")
            log_info "Syncing coordination data for $group_name"
            # Fetch latest coordination data from other worktrees
            # This could involve git fetch/merge or shared file system
            ;;
        "status")
            log_info "Coordination status:"
            if [[ -f "/tmp/cli-refactor-progress.log" ]]; then
                tail -10 "/tmp/cli-refactor-progress.log"
            fi
            ;;
        "complete")
            log_success "Group $group_name completed their assigned pipelines"
            update_pipeline_progress "$group_name" "ALL" "completed" "Group work finished"
            ;;
    esac
}

# Generate final report for a group
generate_group_report() {
    local group_name="$1"
    local output_file="/tmp/group-$group_name-report.md"
    
    cat > "$output_file" << EOF
# CLI Pipeline Refactoring Report - Group $group_name

## Summary
- **Group**: $group_name
- **Completion Date**: $(date)
- **Framework Version**: $FRAMEWORK_VERSION

## Pipelines Migrated
EOF
    
    # Add completed pipelines from progress log
    if [[ -f "/tmp/cli-refactor-progress.log" ]]; then
        grep "|$group_name|.*|completed|" "/tmp/cli-refactor-progress.log" | while IFS='|' read -r timestamp group pipeline status notes; do
            echo "- ✅ **$pipeline** - $notes" >> "$output_file"
        done
    fi
    
    cat >> "$output_file" << EOF

## Issues Encountered
$(grep -A 5 "($group_name)" "$SHARED_GLITCH_LOG" 2>/dev/null || echo "No issues reported")

## Performance Metrics
- Total pipelines: TBD
- Average migration time: TBD
- Success rate: TBD

## Recommendations
- List any service gaps discovered
- Suggest improvements for future migrations
- Note any framework enhancements needed

Generated by CLI Pipeline Refactoring Framework v$FRAMEWORK_VERSION
EOF
    
    log_success "Group report generated: $output_file"
    echo "$output_file"
}

# Checkpoint commit helper function
checkpoint_commit() {
    local checkpoint_num="$1"
    local pipeline_name="$2"
    local group_name="$3"
    local checkpoint_name="$4"
    local details="$5"
    
    # Update progress log with checkpoint
    echo "$(date -Iseconds)|$group_name|$pipeline_name|checkpoint-$checkpoint_num|$checkpoint_name completed" >> temp/group-progress.log
    
    # Stage and commit with standard message
    git add -A
    git commit -m "checkpoint(cli-pipeline): $checkpoint_name for $pipeline_name

Group: $group_name
$details"
    
    log_success "Checkpoint $checkpoint_num committed: $checkpoint_name"
}

# List checkpoints for a pipeline
list_pipeline_checkpoints() {
    local pipeline_name="$1"
    
    log_info "📍 Checkpoints for $pipeline_name:"
    git log --oneline --grep="checkpoint(cli-pipeline).*$pipeline_name" | head -10
}

# Rollback to specific checkpoint
rollback_to_checkpoint() {
    local pipeline_name="$1"
    local checkpoint_num="$2"
    
    local checkpoint_commit=$(git log --oneline --grep="checkpoint(cli-pipeline).*$pipeline_name" | grep -E "(checkpoint-$checkpoint_num|CHECKPOINT-$checkpoint_num)" | head -1 | awk '{print $1}')
    
    if [[ -n "$checkpoint_commit" ]]; then
        log_info "🔄 Rolling back $pipeline_name to checkpoint $checkpoint_num (commit: $checkpoint_commit)"
        git checkout "$checkpoint_commit" -- "scripts/cli-pipeline/*/$pipeline_name"
        log_success "Rollback complete"
    else
        log_error "No checkpoint $checkpoint_num found for $pipeline_name"
        return 1
    fi
}

# Get last checkpoint for a pipeline
get_last_checkpoint() {
    local pipeline_name="$1"
    
    local last_checkpoint=$(git log --oneline --grep="checkpoint(cli-pipeline).*$pipeline_name" | head -1)
    if [[ -n "$last_checkpoint" ]]; then
        echo "$last_checkpoint" | sed -E 's/.*checkpoint-([0-9]+).*/\1/'
    else
        echo "0"
    fi
}

# Export functions for use by worktree groups
export -f register_worktree_group
export -f update_pipeline_progress
export -f check_pipeline_conflicts
export -f analyze_pipeline_complexity
export -f get_pipeline_domain
export -f generate_migration_plan
export -f submit_glitch
export -f get_service_with_fallback
export -f coordinate_worktrees
export -f generate_group_report
export -f checkpoint_commit
export -f list_pipeline_checkpoints
export -f rollback_to_checkpoint
export -f get_last_checkpoint

log_info "Multi-worktree CLI pipeline refactoring framework loaded"
log_info "Framework version: $FRAMEWORK_VERSION"