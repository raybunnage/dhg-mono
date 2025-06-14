#!/bin/bash

# Deployment Management CLI
# Handles safe deployment from development to production

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Source the utilities
source "$PROJECT_ROOT/scripts/cli-pipeline/shared/cli-utils.sh"

# Track command for analytics
track_command "deployment" "$1"

# Function to show help
show_help() {
    echo "Deployment Management CLI"
    echo ""
    echo "Usage: ./deployment-cli.sh [command] [options]"
    echo ""
    echo "Commands:"
    echo "  validate-all          Run all pre-deployment validations"
    echo "  validate-typescript   Check TypeScript compilation"
    echo "  validate-dependencies Check dependency consistency"
    echo "  validate-env         Verify environment configuration"
    echo "  verify-build         Test production build locally"
    echo "  deploy-staging       Deploy to staging environment"
    echo "  deploy-production    Deploy to production (requires confirmation)"
    echo "  rollback            Rollback a deployment"
    echo "  status              Check deployment status"
    echo "  history             View deployment history"
    echo "  health-check        Check production site health"
    echo ""
    echo "Options:"
    echo "  --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./deployment-cli.sh validate-all"
    echo "  ./deployment-cli.sh deploy-staging"
    echo "  ./deployment-cli.sh deploy-production"
    echo "  ./deployment-cli.sh rollback --deployment-id deploy-123456"
    echo "  ./deployment-cli.sh status"
}

# Check if no arguments provided or help requested
if [ $# -eq 0 ] || [ "$1" == "--help" ] || [ "$1" == "help" ]; then
    show_help
    exit 0
fi

# Change to script directory
cd "$SCRIPT_DIR"

# Run the deployment CLI with all arguments
ts-node deployment-cli.ts "$@"