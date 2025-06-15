#!/usr/bin/env bash

# Servers Management CLI Pipeline
# Manages backend server lifecycle with dynamic port allocation
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
init_cli_pipeline "servers" "Servers Management CLI - Dynamic port allocation"

# Define commands

command_help() {
    show_help
}

command_start() {
    log_success "🚀 Starting all servers with dynamic port allocation..."
    
    local start_script="$PROJECT_ROOT/scripts/start-all-servers-dynamic.js"
    if [[ -f "$start_script" ]]; then
        cd "$PROJECT_ROOT" && node "$start_script"
    else
        log_warn "start-all-servers-dynamic.js not found"
        log_info "Fallback: Starting with basic start-all-servers.js"
        local fallback_script="$PROJECT_ROOT/scripts/start-all-servers.js"
        if [[ -f "$fallback_script" ]]; then
            cd "$PROJECT_ROOT" && node "$fallback_script"
        else
            log_error "No server start script found"
        fi
    fi
}

command_stop() {
    log_info "🛑 Stopping all servers..."
    
    local stop_script="$SCRIPT_DIR/commands/stop-all-servers.ts"
    if [[ -f "$stop_script" ]]; then
        cd "$PROJECT_ROOT" && npx ts-node "$stop_script"
    else
        log_warn "stop-all-servers.ts not found"
        log_info "Fallback: Using pkill to stop servers"
        pkill -f "vite\|ts-node\|node.*server"
        log_success "Stopped processes"
    fi
}

command_kill() {
    log_warn "💀 Force killing all servers..."
    
    local kill_script="$SCRIPT_DIR/kill-all-servers.sh"
    if [[ -f "$kill_script" ]]; then
        bash "$kill_script"
    else
        log_warn "kill-all-servers.sh not found"
        log_info "Fallback: Using pkill -9 to force kill servers"
        pkill -9 -f "vite\|ts-node\|node.*server"
        log_success "Force killed processes"
    fi
}

command_restart() {
    log_info "🔄 Restarting all servers..."
    
    local restart_script="$SCRIPT_DIR/commands/restart-servers.ts"
    if [[ -f "$restart_script" ]]; then
        cd "$PROJECT_ROOT" && npx ts-node "$restart_script"
    else
        log_warn "restart-servers.ts not found"
        log_info "Fallback: Stop then start"
        command_stop
        sleep 2
        command_start
    fi
}

command_status() {
    log_info "📊 Server Status"
    
    local status_script="$SCRIPT_DIR/commands/show-status.ts"
    if [[ -f "$status_script" ]]; then
        cd "$PROJECT_ROOT" && npx ts-node "$status_script"
    else
        log_warn "show-status.ts not found"
        log_info "Fallback: Basic process status"
        echo ""
        echo "Running Vite servers:"
        ps aux | grep -E "vite|5[0-9]{3}" | grep -v grep | head -10
    fi
}

command_health() {
    log_info "🏥 Checking server health..."
    
    local health_script="$SCRIPT_DIR/commands/check-health.ts"
    if [[ -f "$health_script" ]]; then
        cd "$PROJECT_ROOT" && npx ts-node "$health_script"
    else
        log_warn "check-health.ts not found"
        log_info "Fallback: Basic health check"
        echo ""
        echo "Testing common ports:"
        for port in 5005 5173 5174 5175 5176 5177 5178 5179 5180 5194; do
            if curl -s "http://localhost:$port" > /dev/null 2>&1; then
                log_success "Port $port: Online"
            else
                log_error "Port $port: Offline"
            fi
        done
    fi
}

command_list() {
    log_info "📋 Registered Servers"
    
    local list_script="$SCRIPT_DIR/commands/list-servers.ts"
    if [[ -f "$list_script" ]]; then
        cd "$PROJECT_ROOT" && npx ts-node "$list_script"
    else
        log_warn "list-servers.ts not found"
        log_info "Fallback: Port registry from CLAUDE.md"
        echo ""
        echo "Vite Apps (from CLAUDE.md):"
        echo "  - dhg-research: 5005"
        echo "  - dhg-hub-lovable: 5173"
        echo "  - dhg-hub: 5174"
        echo "  - dhg-admin-suite: 5175"
        echo "  - dhg-admin-google: 5176"
        echo "  - dhg-admin-code: 5177"
        echo "  - dhg-a: 5178"
        echo "  - dhg-b: 5179"
        echo "  - dhg-service-test: 5180"
        echo "  - dhg-audio: 5194"
    fi
}

command_register() {
    local server_name="$1"
    
    if [[ -z "$server_name" ]]; then
        log_error "Server name required"
        echo "Usage: ./servers-cli.sh register <server-name> [options]"
        return 1
    fi
    
    local register_script="$SCRIPT_DIR/commands/register-server.ts"
    if [[ -f "$register_script" ]]; then
        cd "$PROJECT_ROOT" && npx ts-node "$register_script" "$server_name" "${@:2}"
    else
        log_warn "register-server.ts not found"
        log_info "Server registration requested: $server_name"
        echo "Would register server with options: ${@:2}"
    fi
}

command_populate() {
    log_info "📝 Populating registry with all servers"
    
    local populate_script="$SCRIPT_DIR/commands/populate-registry.ts"
    if [[ -f "$populate_script" ]]; then
        cd "$PROJECT_ROOT" && npx ts-node "$populate_script"
    else
        log_warn "populate-registry.ts not found"
        log_info "Registry population would scan all apps/ directories"
    fi
}

command_update-port() {
    local server_name="$1"
    local port="$2"
    
    if [[ -z "$server_name" ]] || [[ -z "$port" ]]; then
        log_error "Server name and port required"
        echo "Usage: ./servers-cli.sh update-port <server-name> <port>"
        return 1
    fi
    
    local update_script="$SCRIPT_DIR/commands/update-port.ts"
    if [[ -f "$update_script" ]]; then
        cd "$PROJECT_ROOT" && npx ts-node "$update_script" "$server_name" "$port"
    else
        log_warn "update-port.ts not found"
        log_info "Would update $server_name to port $port"
    fi
}

command_logs() {
    local server_name="$1"
    
    local logs_script="$SCRIPT_DIR/commands/show-logs.ts"
    if [[ -f "$logs_script" ]]; then
        if [[ -n "$server_name" ]]; then
            log_info "📜 Logs for $server_name"
            cd "$PROJECT_ROOT" && npx ts-node "$logs_script" "$server_name"
        else
            log_info "📜 All server logs"
            cd "$PROJECT_ROOT" && npx ts-node "$logs_script"
        fi
    else
        log_warn "show-logs.ts not found"
        log_info "Fallback: Recent process activity"
        if [[ -n "$server_name" ]]; then
            echo "Logs for $server_name (fallback):"
            ps aux | grep "$server_name" | grep -v grep
        else
            echo "All server processes (fallback):"
            ps aux | grep -E "vite|ts-node.*server|node.*server" | grep -v grep
        fi
    fi
}

command_register-table() {
    log_info "📝 Registering sys_server_ports_registry in sys_table_definitions..."
    
    local register_table_script="$SCRIPT_DIR/commands/register-table-simple.ts"
    if [[ -f "$register_table_script" ]]; then
        cd "$PROJECT_ROOT" && npx ts-node "$register_table_script"
    else
        log_warn "register-table-simple.ts not found"
        log_info "Table registration would add sys_server_ports_registry to sys_table_definitions"
    fi
}

# Override help to add examples and shortcuts
show_help() {
    echo "$PIPELINE_DESCRIPTION"
    echo "====================="
    echo ""
    echo "COMMANDS:"
    echo "  start         Start all servers with dynamic ports"
    echo "  stop          Stop all running servers"
    echo "  kill          Force kill all server processes"
    echo "  restart       Restart all servers"
    echo "  status        Show server status and ports"
    echo "  health        Check health of all servers"
    echo "  list          List registered servers"
    echo "  register      Register a new server"
    echo "  populate      Populate registry with all known servers"
    echo "  register-table Register sys_server_ports_registry in sys_table_definitions"
    echo "  update-port   Update server port"
    echo "  logs          Show server logs"
    echo "  help          Show this help message"
    echo ""
    echo "EXAMPLES:"
    echo "  ./servers-cli.sh start"
    echo "  ./servers-cli.sh status"
    echo "  ./servers-cli.sh health"
    echo "  ./servers-cli.sh stop"
    echo ""
    echo "SHORTCUTS:"
    echo "  You can also use: pnpm servers"
}

# Main execution
route_command "$@"