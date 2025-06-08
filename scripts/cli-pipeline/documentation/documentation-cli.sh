#!/bin/bash
set -e

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Load environment variables
ENV_DEV_FILE="${PROJECT_ROOT}/.env.development"
if [ -f "$ENV_DEV_FILE" ]; then
  export $(grep -E "SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY" "$ENV_DEV_FILE" | xargs)
fi

# Track command execution
track_command() {
    local pipeline_name="documentation"
    local command_name="$1"
    shift
    local full_command="$@"
    
    local TRACKER_TS="$PROJECT_ROOT/packages/shared/services/tracking-service/shell-command-tracker.ts"
    if [ -f "$TRACKER_TS" ]; then
        npx ts-node --project "$PROJECT_ROOT/tsconfig.node.json" "$TRACKER_TS" "$pipeline_name" "$command_name" "$full_command"
    else
        echo "ℹ️ Tracking not available. Running command directly."
        eval "$full_command"
    fi
}
DOCS_DIR="$PROJECT_ROOT/docs"
CONTINUOUSLY_UPDATED_DIR="$DOCS_DIR/continuously-updated"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

show_help() {
    echo "Documentation Archiving Pipeline"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  archive-reports          Archive old script reports"
    echo "  archive-specs           Archive outdated technical specs"
    echo "  archive-solutions       Archive resolved solution guides"
    echo "  watch-continuous        Monitor and update continuously tracked documents"
    echo "  add-continuous          Add a document to continuous tracking"
    echo "  list-continuous         List all continuously tracked documents"
    echo "  update-continuous       Update all continuously tracked documents"
    echo "  analyze-relevance       Analyze document relevance for archiving"
    echo "  clean-archived          Remove very old archived documents"
    echo "  health-check            Run health check for documentation pipeline"
    echo ""
    echo "Options:"
    echo "  --dry-run              Show what would be done without making changes"
    echo "  --days <n>             Archive documents older than n days (default: 30)"
    echo "  --category <type>      Target specific category (reports|specs|solutions|scripts)"
    echo ""
}

case "$1" in
    "archive-reports")
        track_command "archive-reports" "$2"
        echo -e "${BLUE}Archiving old script reports...${NC}"
        ts-node "$SCRIPT_DIR/archive-script-reports.ts" "${@:2}"
        ;;
        
    "archive-specs")
        track_command "archive-specs" "$2"
        echo -e "${BLUE}Archiving outdated technical specs...${NC}"
        ts-node "$SCRIPT_DIR/archive-technical-specs.ts" "${@:2}"
        ;;
        
    "archive-solutions")
        track_command "archive-solutions" "$2"
        echo -e "${BLUE}Archiving resolved solution guides...${NC}"
        ts-node "$SCRIPT_DIR/archive-solution-guides.ts" "${@:2}"
        ;;
        
    "watch-continuous")
        track_command "watch-continuous" "$2"
        echo -e "${BLUE}Monitoring continuously tracked documents...${NC}"
        ts-node "$SCRIPT_DIR/watch-continuous-docs.ts" "${@:2}"
        ;;
        
    "add-continuous")
        track_command "add-continuous" "$2"
        if [ -z "$2" ]; then
            echo -e "${RED}Error: Please provide a document path to track${NC}"
            exit 1
        fi
        echo -e "${BLUE}Adding document to continuous tracking...${NC}"
        ts-node "$SCRIPT_DIR/add-continuous-tracking.ts" "$2" "${@:3}"
        ;;
        
    "list-continuous")
        track_command "list-continuous" ""
        echo -e "${BLUE}Listing continuously tracked documents...${NC}"
        ts-node "$SCRIPT_DIR/list-continuous-docs.ts"
        ;;
        
    "update-continuous")
        track_command "update-continuous" "$2"
        echo -e "${BLUE}Updating all continuously tracked documents...${NC}"
        ts-node "$SCRIPT_DIR/update-continuous-docs.ts" "${@:2}"
        ;;
        
    "analyze-relevance")
        track_command "analyze-relevance" "$2"
        echo -e "${BLUE}Analyzing document relevance...${NC}"
        ts-node "$SCRIPT_DIR/analyze-document-relevance.ts" "${@:2}"
        ;;
        
    "clean-archived")
        track_command "clean-archived" "$2"
        echo -e "${BLUE}Cleaning very old archived documents...${NC}"
        ts-node "$SCRIPT_DIR/clean-old-archives.ts" "${@:2}"
        ;;
        
    "health-check")
        track_command "health-check" "$SCRIPT_DIR/health-check.sh"
        ;;
        
    "--help"|"-h"|"")
        show_help
        ;;
        
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        show_help
        exit 1
        ;;
  health-check)
    echo "🏥 Running health check for documentation pipeline..."
    if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
      echo "❌ Missing required environment variables"
      exit 1
    fi
    echo "✅ documentation pipeline is healthy"
    ;;
esac
