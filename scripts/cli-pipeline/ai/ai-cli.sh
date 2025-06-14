#!/usr/bin/env bash

# ai-cli.sh - Migrated to CLI Pipeline Framework
# Tools for AI services and prompt management

# Source the base class
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../base-classes/ServiceCLIPipeline.sh"

# Pipeline configuration
PIPELINE_NAME="ai"
PIPELINE_DESCRIPTION="Tools for AI services and prompt management"
PIPELINE_VERSION="2.0.0"

# Initialize pipeline
init_cli_pipeline "$PIPELINE_NAME" "$PIPELINE_DESCRIPTION" "$@"

# Service setup
setup_service_integrations() {
    # Check for Claude service
    if check_service_available "claude-service"; then
        log_success "Claude service available"
    else
        log_warn "Claude service not available - some features may be limited"
    fi
    
    # Check for prompt service
    if check_service_available "prompt-service"; then
        log_success "Prompt service available"
    else
        log_warn "Prompt service not available - using direct file access"
    fi
}

# Initialize services
setup_service_integrations

# Command: prompt-lookup - Look up a prompt template by name
command_prompt_lookup() {
    local prompt_name="$1"
    local description="Look up a prompt template by name"
    
    if [[ -z "$prompt_name" ]]; then
        log_error "Prompt name required"
        echo "Usage: $0 prompt-lookup <prompt-name>"
        return 1
    fi
    
    if [[ -f "$SCRIPT_DIR/prompt-lookup.sh" ]]; then
        track_and_execute "prompt_lookup" "$description" \
            "$SCRIPT_DIR/prompt-lookup.sh" "$@"
    else
        log_error "prompt-lookup.sh not found"
        return 1
    fi
}

# Command: validate-ai-assets - Validate AI asset integrity
command_validate_ai_assets() {
    local description="Validate AI asset integrity"
    
    if [[ -f "$SCRIPT_DIR/validate-ai-assets.sh" ]]; then
        track_and_execute "validate_ai_assets" "$description" \
            "$SCRIPT_DIR/validate-ai-assets.sh" "$@"
    else
        log_error "validate-ai-assets.sh not found"
        return 1
    fi
}

# Command: validate-prompt-relationships - Validate relationships between prompts
command_validate_prompt_relationships() {
    local description="Validate relationships between prompts"
    
    if [[ -f "$SCRIPT_DIR/validate-prompt-relationships.sh" ]]; then
        track_and_execute "validate_prompt_relationships" "$description" \
            "$SCRIPT_DIR/validate-prompt-relationships.sh" "$@"
    else
        log_error "validate-prompt-relationships.sh not found"
        return 1
    fi
}

# Command: run-ai-analyze - Run AI analysis on content
command_run_ai_analyze() {
    local description="Run AI analysis on content"
    
    if [[ -f "$SCRIPT_DIR/run-ai-analyze.sh" ]]; then
        track_and_execute "run_ai_analyze" "$description" \
            "$SCRIPT_DIR/run-ai-analyze.sh" "$@"
    else
        log_error "run-ai-analyze.sh not found"
        return 1
    fi
}

# Command: check-claude-api-key - Verify Claude API key is valid
command_check_claude_api_key() {
    local description="Verify Claude API key is valid"
    
    # Quick check for API key in environment
    if [[ -z "$CLAUDE_API_KEY" ]]; then
        log_warn "CLAUDE_API_KEY not set in environment"
    fi
    
    if [[ -f "$SCRIPT_DIR/check-claude-api-key.sh" ]]; then
        track_and_execute "check_claude_api_key" "$description" \
            "$SCRIPT_DIR/check-claude-api-key.sh" "$@"
    else
        log_error "check-claude-api-key.sh not found"
        return 1
    fi
}

# Command: health-check - Run health check for AI pipeline
command_health_check() {
    local description="Run health check for AI pipeline"
    
    log_info "🏥 Running AI pipeline health check..."
    
    # Check basic requirements
    local health_status=0
    
    # Check Claude API key
    if [[ -z "$CLAUDE_API_KEY" ]]; then
        log_warn "CLAUDE_API_KEY not configured"
        health_status=1
    else
        log_success "Claude API key configured"
    fi
    
    # Check prompt directory
    if [[ -d "$PROJECT_ROOT/prompts" ]]; then
        log_success "Prompts directory found"
    else
        log_warn "Prompts directory not found"
        health_status=1
    fi
    
    # Run detailed health check if script exists
    if [[ -f "$SCRIPT_DIR/health-check.sh" ]]; then
        track_and_execute "health_check" "$description" \
            "$SCRIPT_DIR/health-check.sh" "$@"
    else
        if [[ $health_status -eq 0 ]]; then
            log_success "✅ AI pipeline is healthy"
        else
            log_warn "⚠️ AI pipeline has configuration issues"
        fi
        return $health_status
    fi
}

# Override show_help to add command-specific details
show_help() {
    echo -e "${BLUE}AI CLI - Tools for AI services and prompt management${NC}"
    echo ""
    echo "USAGE:"
    echo "  $0 <command> [options]"
    echo ""
    echo "COMMANDS:"
    echo "  prompt-lookup <name>               Look up a prompt template by name"
    echo "  validate-ai-assets                 Validate AI asset integrity"
    echo "  validate-prompt-relationships      Validate relationships between prompts"
    echo "  run-ai-analyze                     Run AI analysis on content"
    echo "  check-claude-api-key               Verify Claude API key is valid"
    echo "  health-check                       Run health check for AI pipeline"
    echo ""
    echo "GLOBAL OPTIONS:"
    echo "  --debug                           Enable debug mode"
    echo "  --verbose                         Enable verbose output"
    echo ""
    echo "EXAMPLES:"
    echo "  # Look up a specific prompt"
    echo "  $0 prompt-lookup script-analysis-prompt"
    echo ""
    echo "  # Validate all AI assets"
    echo "  $0 validate-ai-assets"
    echo ""
    echo "  # Check Claude API key"
    echo "  $0 check-claude-api-key"
    echo ""
    echo "  # Run full health check"
    echo "  $0 health-check --verbose"
    echo ""
    echo "ENVIRONMENT:"
    echo "  CLAUDE_API_KEY    Required for Claude AI service access"
}

# Map hyphenated commands to underscored functions
case "$1" in
    prompt-lookup)
        shift
        command_prompt_lookup "$@"
        ;;
    validate-ai-assets)
        shift
        command_validate_ai_assets "$@"
        ;;
    validate-prompt-relationships)
        shift
        command_validate_prompt_relationships "$@"
        ;;
    run-ai-analyze)
        shift
        command_run_ai_analyze "$@"
        ;;
    check-claude-api-key)
        shift
        command_check_claude_api_key "$@"
        ;;
    health-check)
        shift
        command_health_check "$@"
        ;;
    *)
        # Let base class handle standard routing
        route_command "$@"
        ;;
esac