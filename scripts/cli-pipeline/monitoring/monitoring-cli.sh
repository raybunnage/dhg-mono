#!/bin/bash

# Monitoring CLI - Continuous monitoring for DHG monorepo folders

set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"

# Load environment if available
if [ -f "$PROJECT_ROOT/.env.development" ]; then
    set -a
    source "$PROJECT_ROOT/.env.development"
    set +a
fi

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Track command usage
track_command() {
    local command="$1"
    if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
        npx tsx "$PROJECT_ROOT/scripts/cli-pipeline/core/command-history-tracker.ts" \
            "monitoring" "$command" "$*" > /dev/null 2>&1 || true
    fi
}

# Function to ensure dependencies are installed
ensure_deps() {
    if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
        echo -e "${YELLOW}Installing monitoring dependencies...${NC}"
        cd "$SCRIPT_DIR" && npm install
    fi
}

# Main menu
show_help() {
    echo -e "${BLUE}DHG Monitoring CLI${NC}"
    echo -e "${GREEN}Continuous monitoring for monorepo folders${NC}"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  scan <folder>          Scan a folder for insights"
    echo "  watch <folder>         Continuously monitor a folder"
    echo "  report <folder>        Generate detailed report with DB save"
    echo "  history <folder>       Show historical monitoring data"
    echo "  trends <folder>        Show monitoring trends over time"
    echo "  health                 Run health checks"
    echo "  quick <folder>         Quick scan (last 24h)"
    echo ""
    echo "Options:"
    echo "  --help                 Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 scan apps/dhg-improve-experts"
    echo "  $0 watch packages/shared/services --interval 15"
    echo "  $0 quick apps/dhg-hub"
    echo "  $0 history apps/dhg-hub --days 30"
    echo "  $0 trends packages/shared/services"
}

# Ensure dependencies
ensure_deps

# Process commands
case "$1" in
    scan)
        track_command "scan" "$@"
        shift
        cd "$SCRIPT_DIR" && npx tsx folder-monitor.ts scan "$@"
        ;;
        
    watch)
        track_command "watch" "$@"
        shift
        cd "$SCRIPT_DIR" && npx tsx folder-monitor.ts watch "$@"
        ;;
        
    quick)
        track_command "quick" "$@"
        shift
        folder="$1"
        echo -e "${BLUE}Quick scan of $folder (last 24 hours)...${NC}"
        cd "$SCRIPT_DIR" && npx tsx folder-monitor.ts scan "$folder" --since 1d
        ;;
        
    report)
        track_command "report" "$@"
        shift
        folder="$1"
        echo -e "${BLUE}Generating detailed report for $folder...${NC}"
        cd "$SCRIPT_DIR" && npx tsx folder-monitor.ts scan "$folder" --save
        ;;
        
    history)
        track_command "history" "$@"
        shift
        cd "$SCRIPT_DIR" && npx tsx folder-monitor.ts history "$@"
        ;;
        
    trends)
        track_command "trends" "$@"
        shift
        cd "$SCRIPT_DIR" && npx tsx folder-monitor.ts trends "$@"
        ;;
        
    health)
        track_command "health" "$@"
        echo -e "${BLUE}Running health checks...${NC}"
        # Run existing health check
        "$PROJECT_ROOT/scripts/cli-pipeline/maintenance-cli.sh" health-check
        ;;
        
    --help|help|-h)
        show_help
        ;;
        
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        show_help
        exit 1
        ;;
esac