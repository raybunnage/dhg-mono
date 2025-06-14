#!/bin/bash

# Proxy Pipeline CLI - Manage proxy servers
# This CLI provides commands to start, stop, and manage proxy servers

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Source command tracking if available
TRACKING_SCRIPT="$PROJECT_ROOT/scripts/cli-pipeline/all_pipelines/command-tracking.sh"
if [ -f "$TRACKING_SCRIPT" ]; then
    source "$TRACKING_SCRIPT"
else
    # Fallback function if tracking not available
    track_command() {
        # Just log to console
        echo "[Command] $1: $2 - $3" >&2
    }
fi

show_help() {
    echo -e "${BLUE}Proxy Pipeline CLI${NC}"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  start-all              Start all proxy servers with health monitoring"
    echo "  start <proxy-name>     Start a specific proxy server"
    echo "  update-registry        Update sys_server_ports_registry database table"
    echo "  list                   List all available proxy servers"
    echo "  health-check           Check health status of all running proxies"
    echo "  help                   Show this help message"
    echo ""
    echo "Available Proxy Servers:"
    echo "  vite-fix               Vite environment fix proxy (9876)"
    echo "  monitoring             Continuous monitoring proxy (9877)"
    echo "  manager                Proxy manager (9878)"
    echo "  git-operations         Git operations proxy (9879)"
    echo "  file-browser           File browser proxy (9880)"
    echo "  continuous-docs        Continuous docs proxy (9882)"
    echo "  audio-streaming        Audio streaming proxy (9883)"
    echo "  script-viewer          Script viewer proxy (9884)"
    echo "  markdown-viewer        Markdown viewer proxy (9885)"
    echo "  docs-archive           Docs archive proxy (9886)"
    echo "  worktree-switcher      Worktree switcher proxy (9887)"
    echo "  html-browser           HTML file browser (8080)"
    echo ""
    echo "Examples:"
    echo "  $0 start-all                    # Start all proxy servers"
    echo "  $0 start vite-fix               # Start the vite-fix proxy"
    echo "  $0 health-check                 # Check health of all proxies"
    echo "  $0 update-registry              # Update database registry"
}

start_proxy() {
    local proxy_name=$1
    
    case $proxy_name in
        "vite-fix")
            echo -e "${GREEN}Starting Vite Fix Proxy...${NC}"
            ts-node "$SCRIPT_DIR/start-vite-fix-proxy.ts"
            ;;
        "monitoring")
            echo -e "${GREEN}Starting Continuous Monitoring Proxy...${NC}"
            ts-node "$SCRIPT_DIR/start-continuous-monitoring-proxy.ts"
            ;;
        "manager")
            echo -e "${GREEN}Starting Proxy Manager...${NC}"
            ts-node "$SCRIPT_DIR/start-proxy-manager-proxy.ts"
            ;;
        "git-operations")
            echo -e "${GREEN}Starting Git Operations Proxy...${NC}"
            ts-node "$SCRIPT_DIR/start-git-operations-proxy.ts"
            ;;
        "file-browser")
            echo -e "${GREEN}Starting File Browser Proxy...${NC}"
            ts-node "$SCRIPT_DIR/start-file-browser-proxy.ts"
            ;;
        "continuous-docs")
            echo -e "${GREEN}Starting Continuous Docs Proxy...${NC}"
            ts-node "$SCRIPT_DIR/start-continuous-docs-proxy.ts"
            ;;
        "audio-streaming")
            echo -e "${GREEN}Starting Audio Streaming Proxy...${NC}"
            ts-node "$SCRIPT_DIR/start-audio-streaming-proxy.ts"
            ;;
        "script-viewer")
            echo -e "${GREEN}Starting Script Viewer Proxy...${NC}"
            ts-node "$SCRIPT_DIR/start-script-viewer-proxy.ts"
            ;;
        "markdown-viewer")
            echo -e "${GREEN}Starting Markdown Viewer Proxy...${NC}"
            ts-node "$SCRIPT_DIR/start-markdown-viewer-proxy.ts"
            ;;
        "docs-archive")
            echo -e "${GREEN}Starting Docs Archive Proxy...${NC}"
            ts-node "$SCRIPT_DIR/start-docs-archive-proxy.ts"
            ;;
        "worktree-switcher")
            echo -e "${GREEN}Starting Worktree Switcher Proxy...${NC}"
            ts-node "$SCRIPT_DIR/start-worktree-switcher-proxy.ts"
            ;;
        "html-browser")
            echo -e "${GREEN}Starting HTML File Browser...${NC}"
            ts-node "$SCRIPT_DIR/start-html-file-browser-proxy.ts"
            ;;
        *)
            echo -e "${RED}Unknown proxy: $proxy_name${NC}"
            echo "Run '$0 list' to see available proxies"
            exit 1
            ;;
    esac
}

health_check() {
    echo -e "${BLUE}Checking health of proxy servers...${NC}"
    echo ""
    
    # Array of proxy servers with their ports
    declare -A proxies=(
        ["Vite Fix Proxy"]=9876
        ["Continuous Monitoring"]=9877
        ["Proxy Manager"]=9878
        ["Git Operations"]=9879
        ["File Browser"]=9880
        ["Continuous Docs"]=9882
        ["Audio Streaming"]=9883
        ["Script Viewer"]=9884
        ["Markdown Viewer"]=9885
        ["Docs Archive"]=9886
        ["Worktree Switcher"]=9887
        ["HTML Browser"]=8080
    )
    
    for name in "${!proxies[@]}"; do
        port=${proxies[$name]}
        if curl -s -f "http://localhost:$port/health" > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} $name (port $port) - Online"
        else
            echo -e "${RED}✗${NC} $name (port $port) - Offline"
        fi
    done
}

list_proxies() {
    echo -e "${BLUE}Available Proxy Servers:${NC}"
    echo ""
    echo "Infrastructure Proxies:"
    echo "  - vite-fix (9876)         - Fix Vite environment issues"
    echo "  - monitoring (9877)       - System health monitoring"
    echo "  - manager (9878)          - Manage other proxy servers"
    echo ""
    echo "Viewer Proxies:"
    echo "  - continuous-docs (9882)  - Live documentation viewer"
    echo "  - script-viewer (9884)    - Script file viewer"
    echo "  - markdown-viewer (9885)  - Markdown document viewer"
    echo "  - docs-archive (9886)     - Archived documentation viewer"
    echo ""
    echo "Utility Proxies:"
    echo "  - git-operations (9879)   - Git operations interface"
    echo "  - file-browser (9880)     - File system browser"
    echo "  - audio-streaming (9883)  - Audio file streaming"
    echo "  - worktree-switcher (9887) - Git worktree management"
    echo ""
    echo "Management Proxies:"
    echo "  - html-browser (8080)     - HTML-based file browser"
}

# Main command handler
case "$1" in
    "start-all")
        track_command "proxy" "start-all" "Start all proxy servers"
        echo -e "${GREEN}Starting all proxy servers...${NC}"
        ts-node "$SCRIPT_DIR/start-all-proxy-servers.ts"
        ;;
    "start")
        if [ -z "$2" ]; then
            echo -e "${RED}Error: Please specify a proxy name${NC}"
            echo "Usage: $0 start <proxy-name>"
            exit 1
        fi
        track_command "proxy" "start-$2" "Start $2 proxy server"
        start_proxy "$2"
        ;;
    "update-registry")
        track_command "proxy" "update-registry" "Update server registry database"
        echo -e "${BLUE}Updating sys_server_ports_registry...${NC}"
        ts-node "$SCRIPT_DIR/update-server-registry.ts"
        ;;
    "list")
        track_command "proxy" "list" "List available proxy servers"
        list_proxies
        ;;
    "health-check")
        track_command "proxy" "health-check" "Check proxy server health"
        health_check
        ;;
    "help"|"--help"|"-h"|"")
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac