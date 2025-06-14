#!/usr/bin/env bash

# test-git-cli.sh - Migrated to CLI Pipeline Framework
# Git CLI testing utility

# Source the base class
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../base-classes/SimpleCLIPipeline.sh"

# Pipeline configuration
PIPELINE_NAME="test-git"
PIPELINE_DESCRIPTION="Git CLI testing utility"
PIPELINE_VERSION="2.0.0"

# Initialize pipeline
init_cli_pipeline "$PIPELINE_NAME" "$PIPELINE_DESCRIPTION" "$@"

# Command: run - Run all git CLI tests
command_run() {
    local description="Run all git CLI tests"
    
    log_info "Testing Git CLI Commands"
    log_info "======================="
    echo ""
    
    # Test help command
    log_info "1. Testing help command:"
    track_and_execute "test_help" "Test git CLI help" \
        "$SCRIPT_DIR/git-cli.sh" help
    echo ""
    
    # Test health check
    log_info "2. Testing health check:"
    track_and_execute "test_health_check" "Test git CLI health check" \
        "$SCRIPT_DIR/git-cli.sh" health-check
    echo ""
    
    # Test list worktrees
    log_info "3. Testing list worktrees:"
    track_and_execute "test_list_worktrees" "Test list worktrees command" \
        "$SCRIPT_DIR/git-cli.sh" list-worktrees
    echo ""
    
    # Test merge queue list
    log_info "4. Testing merge queue list:"
    track_and_execute "test_merge_queue" "Test merge queue list command" \
        "$SCRIPT_DIR/git-cli.sh" merge-queue-list
    echo ""
    
    log_success "Test complete!"
}

# Command: help - Test git CLI help command
command_help() {
    local description="Test git CLI help command"
    
    track_and_execute "test_help" "$description" \
        "$SCRIPT_DIR/git-cli.sh" help
}

# Command: health - Test git CLI health check
command_health() {
    local description="Test git CLI health check"
    
    track_and_execute "test_health_check" "$description" \
        "$SCRIPT_DIR/git-cli.sh" health-check
}

# Command: worktrees - Test list worktrees command
command_worktrees() {
    local description="Test list worktrees command"
    
    track_and_execute "test_list_worktrees" "$description" \
        "$SCRIPT_DIR/git-cli.sh" list-worktrees
}

# Command: queue - Test merge queue list command
command_queue() {
    local description="Test merge queue list command"
    
    track_and_execute "test_merge_queue" "$description" \
        "$SCRIPT_DIR/git-cli.sh" merge-queue-list
}

# Override show_help to add command-specific details
show_help() {
    echo -e "${BLUE}Test Git CLI - Git CLI testing utility${NC}"
    echo ""
    echo "USAGE:"
    echo "  $0 <command> [options]"
    echo ""
    echo "COMMANDS:"
    echo "  run         Run all git CLI tests (default)"
    echo "  help        Test git CLI help command"
    echo "  health      Test git CLI health check"
    echo "  worktrees   Test list worktrees command"
    echo "  queue       Test merge queue list command"
    echo ""
    echo "GLOBAL OPTIONS:"
    echo "  --debug     Enable debug mode"
    echo "  --verbose   Enable verbose output"
    echo ""
    echo "EXAMPLES:"
    echo "  # Run all tests"
    echo "  $0 run"
    echo "  $0"
    echo ""
    echo "  # Test specific command"
    echo "  $0 worktrees"
    echo "  $0 health --verbose"
}

# Default to 'run' command if none specified
if [[ -z "$1" ]] || [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
    if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
        show_help
        exit 0
    else
        # Default to run command
        command_run
        exit $?
    fi
fi

# Main command routing
route_command "$@"