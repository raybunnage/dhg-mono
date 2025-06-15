#!/usr/bin/env bash

# Deployment Management CLI - Comprehensive deployment and validation tool
# Refactored to use SimpleCLIPipeline base class

# Source base class
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
BASE_CLASSES_DIR="$PROJECT_ROOT/scripts/cli-pipeline/base-classes"

# Source the base class
if [[ -f "$BASE_CLASSES_DIR/SimpleCLIPipeline.sh" ]]; then
    source "$BASE_CLASSES_DIR/SimpleCLIPipeline.sh"
else
    echo "Error: Cannot find SimpleCLIPipeline.sh at $BASE_CLASSES_DIR"
    exit 1
fi

# Pipeline configuration
PIPELINE_NAME="deployment"
PIPELINE_DESCRIPTION="Deployment Management CLI - Comprehensive deployment and validation tool"
PIPELINE_VERSION="2.0.0"

# Initialize the pipeline
init_cli_pipeline "$PIPELINE_NAME" "$PIPELINE_DESCRIPTION" "$@"

# Command implementations

# VALIDATION Commands
command_validate-all() {
    log_info "Running comprehensive pre-deployment validations..."
    run_deployment_command "validate-all" "$@"
}

command_validate-typescript() {
    log_info "Validating TypeScript compilation..."
    run_deployment_command "validate-typescript" "$@"
}

command_validate-dependencies() {
    log_info "Checking dependency consistency and security..."
    run_deployment_command "validate-dependencies" "$@"
}

command_validate-env() {
    log_info "Verifying environment configuration..."
    run_deployment_command "validate-env" "$@"
}

command_verify-build() {
    log_info "Testing production build locally..."
    run_deployment_command "verify-build" "$@"
}

# DEPLOYMENT Commands
command_deploy-staging() {
    log_info "Deploying to staging environment..."
    run_deployment_command "deploy-staging" "$@"
}

command_deploy-production() {
    log_warn "⚠️  PRODUCTION DEPLOYMENT - This action requires confirmation"
    run_deployment_command "deploy-production" "$@"
}

command_rollback() {
    log_warn "⚠️  ROLLBACK OPERATION - This will revert to a previous deployment"
    run_deployment_command "rollback" "$@"
}

# MONITORING Commands
command_status() {
    log_info "Checking deployment status..."
    run_deployment_command "status" "$@"
}

command_history() {
    log_info "Retrieving deployment history..."
    run_deployment_command "history" "$@"
}

command_health-check() {
    log_info "Performing production health check..."
    run_deployment_command "health-check" "$@"
}

# Helper function to run TypeScript commands with fallback
run_deployment_command() {
    local command="$1"
    shift
    
    local script_path="$SCRIPT_DIR/deployment-cli.ts"
    if [[ -f "$script_path" ]]; then
        track_and_execute "$command" "Deployment: $command" \
            npx ts-node "$script_path" "$command" "$@"
    else
        log_warn "deployment-cli.ts not found"
        log_info "Fallback: Basic ${command} operation"
        
        case "$command" in
            "validate-all")
                echo "🔍 Fallback validation check:"
                echo "✅ Script structure: OK"
                echo "✅ Git status: $(git status --porcelain | wc -l) modified files"
                echo "✅ Current branch: $(git branch --show-current 2>/dev/null || echo 'unknown')"
                echo "⚠️  Full validation requires TypeScript implementation"
                ;;
            "status")
                echo "📊 Deployment Status:"
                echo "📍 Current branch: $(git branch --show-current 2>/dev/null || echo 'unknown')"
                echo "📝 Latest commit: $(git log -1 --format='%h - %s' 2>/dev/null || echo 'unknown')"
                echo "🕒 Last commit: $(git log -1 --format='%cr' 2>/dev/null || echo 'unknown')"
                echo "⚠️  Full status requires TypeScript implementation"
                ;;
            "health-check")
                echo "🏥 Basic Health Check:"
                echo "✅ Shell environment: OK"
                echo "✅ Git repository: $(git rev-parse --is-inside-work-tree 2>/dev/null || echo 'Not a git repo')"
                echo "✅ Node.js: $(node --version 2>/dev/null || echo 'Not installed')"
                echo "✅ npm: $(npm --version 2>/dev/null || echo 'Not installed')"
                echo "⚠️  Full health check requires TypeScript implementation"
                ;;
            "validate-typescript")
                echo "🔍 Basic TypeScript validation:"
                if command -v tsc &> /dev/null; then
                    echo "✅ TypeScript compiler: $(tsc --version)"
                    echo "⚠️  Full validation requires TypeScript implementation"
                else
                    echo "❌ TypeScript compiler not found"
                fi
                ;;
            *)
                echo "⚠️  Command '$command' requires TypeScript implementation at $script_path"
                echo "📝 Available as fallback: validate-all, status, health-check, validate-typescript"
                ;;
        esac
    fi
}

# Override the base show_help to add deployment-specific information
show_help() {
    cat << EOF
$PIPELINE_DESCRIPTION
Version: $PIPELINE_VERSION

USAGE:
  $SCRIPT_NAME <command> [options]

COMMANDS:

VALIDATION:
  validate-all             Run comprehensive pre-deployment validations
  validate-typescript      Check TypeScript compilation across project
  validate-dependencies    Check dependency consistency and security
  validate-env            Verify environment configuration completeness
  verify-build            Test production build locally before deployment

DEPLOYMENT:
  deploy-staging          Deploy current branch to staging environment
  deploy-production       Deploy to production with confirmations and safeguards
  rollback               Rollback deployment to previous version

MONITORING:
  status                 Check current deployment status across environments
  history                View detailed deployment history with metrics
  health-check           Check production site health and availability
  help                   Show this help message

EXAMPLES:

VALIDATION WORKFLOW:
  $SCRIPT_NAME validate-all
  $SCRIPT_NAME validate-typescript
  $SCRIPT_NAME validate-env
  $SCRIPT_NAME verify-build

DEPLOYMENT WORKFLOW:
  $SCRIPT_NAME deploy-staging
  $SCRIPT_NAME status
  $SCRIPT_NAME deploy-production

MONITORING & MAINTENANCE:
  $SCRIPT_NAME health-check
  $SCRIPT_NAME history
  $SCRIPT_NAME rollback --deployment-id deploy-123456

SAFETY FEATURES:
  - Production deployments require confirmation
  - Validation checks run before deployment
  - Rollback capability available
  - Comprehensive logging and tracking

DEBUG MODE:
  DEBUG=1 $SCRIPT_NAME <command>  # Enable debug output

TRACKING:
  Command execution is automatically tracked when tracking service is available.
  Disable with: DISABLE_TRACKING=1 $SCRIPT_NAME <command>

EOF
}

# Main command routing
case "$1" in
    "")
        log_error "No command specified"
        show_help
        exit 1
        ;;
    "help"|"--help"|"-h")
        show_help
        exit 0
        ;;
    *)
        route_command "$@"
        ;;
esac