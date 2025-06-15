#!/bin/bash

# Proxy Pipeline CLI - Manage proxy servers
# This CLI provides commands to start, stop, and manage proxy servers
# Refactored to use SimpleCLIPipeline base class

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Source the base class
source "$SCRIPT_DIR/../base-classes/SimpleCLIPipeline.sh" || {
    echo "Error: Failed to source SimpleCLIPipeline.sh"
    exit 1
}

# Initialize with pipeline name
init_cli_pipeline "proxy" "Proxy Pipeline CLI - Manage proxy servers"

# Define proxy configurations
# Using a function instead of associative array for compatibility
get_proxy_config() {
    local proxy_name="$1"
    case "$proxy_name" in
        "vite-fix") echo "9876:Vite environment fix proxy:start-vite-fix-proxy.ts" ;;
        "monitoring") echo "9877:Continuous monitoring proxy:start-continuous-monitoring-proxy.ts" ;;
        "manager") echo "9878:Proxy manager:start-proxy-manager-proxy.ts" ;;
        "git-operations") echo "9879:Git operations proxy:start-git-operations-proxy.ts" ;;
        "file-browser") echo "9880:File browser proxy:start-file-browser-proxy.ts" ;;
        "continuous-docs") echo "9882:Continuous docs proxy:start-continuous-docs-proxy.ts" ;;
        "audio-streaming") echo "9883:Audio streaming proxy:start-audio-streaming-proxy.ts" ;;
        "script-viewer") echo "9884:Script viewer proxy:start-script-viewer-proxy.ts" ;;
        "markdown-viewer") echo "9885:Markdown viewer proxy:start-markdown-viewer-proxy.ts" ;;
        "docs-archive") echo "9886:Docs archive proxy:start-docs-archive-proxy.ts" ;;
        "worktree-switcher") echo "9887:Worktree switcher proxy:start-worktree-switcher-proxy.ts" ;;
        "html-browser") echo "8080:HTML file browser:start-html-file-browser-proxy.ts" ;;
        *) echo "" ;;
    esac
}

# Get all proxy names
get_all_proxy_names() {
    echo "vite-fix monitoring manager git-operations file-browser continuous-docs audio-streaming script-viewer markdown-viewer docs-archive worktree-switcher html-browser"
}

# Define commands

command_help() {
    show_help
}

command_start-all() {
    log_success "Starting all proxy servers..."
    
    local start_all_script="$SCRIPT_DIR/start-all-proxy-servers.ts"
    if [[ -f "$start_all_script" ]]; then
        cd "$PROJECT_ROOT" && npx ts-node "$start_all_script"
    else
        log_warn "start-all-proxy-servers.ts not found"
        log_info "Starting proxies individually..."
        for proxy in $(get_all_proxy_names); do
            command_start "$proxy"
        done
    fi
}

command_start() {
    local proxy_name="$1"
    
    if [[ -z "$proxy_name" ]]; then
        log_error "Please specify a proxy name"
        echo "Usage: ./proxy-cli.sh start <proxy-name>"
        return 1
    fi
    
    # Get proxy configuration
    local config=$(get_proxy_config "$proxy_name")
    if [[ -z "$config" ]]; then
        log_error "Unknown proxy: $proxy_name"
        echo "Run './proxy-cli.sh list' to see available proxies"
        return 1
    fi
    
    # Parse configuration
    IFS=':' read -r port description script_file <<< "$config"
    
    log_success "Starting $description..."
    
    local proxy_script="$SCRIPT_DIR/$script_file"
    if [[ -f "$proxy_script" ]]; then
        cd "$PROJECT_ROOT" && npx ts-node "$proxy_script"
    else
        log_warn "Script not found: $script_file"
        log_info "Proxy would run on port $port"
    fi
}

command_update-registry() {
    log_info "Updating sys_server_ports_registry..."
    
    local registry_script="$SCRIPT_DIR/update-server-registry.ts"
    if [[ -f "$registry_script" ]]; then
        cd "$PROJECT_ROOT" && npx ts-node "$registry_script"
    else
        log_warn "update-server-registry.ts not found"
        log_info "Fallback: Displaying registry information"
        echo ""
        echo "Port Registry (from CLAUDE.md):"
        for proxy in $(get_all_proxy_names); do
            local config=$(get_proxy_config "$proxy")
            IFS=':' read -r port description script_file <<< "$config"
            echo "  - $proxy: $port - $description"
        done
    fi
}

command_list() {
    log_info "Available Proxy Servers:"
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

command_health-check() {
    log_info "Checking health of proxy servers..."
    echo ""
    
    # Health check for each proxy
    local online_count=0
    local offline_count=0
    
    for proxy in $(get_all_proxy_names); do
        local config=$(get_proxy_config "$proxy")
        IFS=':' read -r port description script_file <<< "$config"
        
        # Try to connect to the health endpoint
        if curl -s -f "http://localhost:$port/health" > /dev/null 2>&1; then
            log_success "✓ $description (port $port) - Online"
            ((online_count++))
        else
            log_error "✗ $description (port $port) - Offline"
            ((offline_count++))
        fi
    done
    
    echo ""
    log_info "Summary: $online_count online, $offline_count offline"
}

# Override help to add examples and proxy details
show_help() {
    echo "$PIPELINE_DESCRIPTION"
    echo ""
    echo "USAGE:"
    echo "  ./proxy-cli.sh <command> [options]"
    echo ""
    echo "COMMANDS:"
    echo "  start-all              Start all proxy servers with health monitoring"
    echo "  start <proxy-name>     Start a specific proxy server"
    echo "  update-registry        Update sys_server_ports_registry database table"
    echo "  list                   List all available proxy servers"
    echo "  health-check           Check health status of all running proxies"
    echo "  help                   Show this help message"
    echo ""
    echo "AVAILABLE PROXY SERVERS:"
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
    echo "EXAMPLES:"
    echo "  ./proxy-cli.sh start-all                    # Start all proxy servers"
    echo "  ./proxy-cli.sh start vite-fix               # Start the vite-fix proxy"
    echo "  ./proxy-cli.sh health-check                 # Check health of all proxies"
    echo "  ./proxy-cli.sh update-registry              # Update database registry"
}

# Main execution
route_command "$@"