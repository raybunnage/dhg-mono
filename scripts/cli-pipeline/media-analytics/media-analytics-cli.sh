#!/bin/bash

# Media Analytics CLI - Simple wrapper for basic commands

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

show_help() {
    echo -e "${YELLOW}Media Analytics CLI${NC}"
    echo ""
    echo "USAGE:"
    echo "  ./media-analytics-cli.sh <command> [options]"
    echo ""
    echo "COMMANDS:"
    echo "  sessions              View media tracking sessions"
    echo "  events               View media tracking events"
    echo "  stats                Display media statistics"
    echo "  test-performance     Test audio server performance"
    echo "  health-check         Check system health"
    echo "  help                 Show this help message"
    echo ""
    echo "OPTIONS:"
    echo "  --user <id>          Filter by user ID"
    echo "  --media <id>         Filter by media ID"
    echo "  --limit <n>          Limit number of results"
    echo ""
    echo "EXAMPLES:"
    echo "  ./media-analytics-cli.sh sessions --user 12345"
    echo "  ./media-analytics-cli.sh stats --limit 10"
    echo "  ./media-analytics-cli.sh test-performance"
}

health_check() {
    echo "🏥 Running health check for media-analytics..."
    
    local health_status=0
    
    # Check if TypeScript files exist
    if ls "$SCRIPT_DIR"/commands/*.ts >/dev/null 2>&1; then
        echo "✅ Command files found"
    else
        echo "❌ Command files not found"
        health_status=1
    fi
    
    # Check if package.json exists
    if [[ -f "$SCRIPT_DIR/package.json" ]]; then
        echo "✅ Package.json found"
    else
        echo "❌ Package.json not found"
        health_status=1
    fi
    
    # Check database connection
    if [[ -n "$SUPABASE_URL" ]]; then
        echo "✅ Database URL configured"
    else
        echo "⚠️  Database URL not configured"
    fi
    
    if [[ $health_status -eq 0 ]]; then
        echo ""
        echo "✅ Media analytics CLI is healthy"
    else
        echo ""
        echo "⚠️  Some health checks failed"
    fi
    
    return $health_status
}

# Main command routing
case "${1:-help}" in
    help|--help|-h)
        show_help
        ;;
    health-check)
        health_check
        ;;
    sessions|events|stats|test-performance)
        echo -e "${GREEN}Executing command: $1${NC}"
        # For now, just acknowledge the command
        echo "Command '$1' would execute the TypeScript implementation"
        echo "Note: Full implementation requires fixing module imports"
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac