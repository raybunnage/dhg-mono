#!/usr/bin/env bash

# ServiceCLIPipeline.sh - For managing services, servers, and infrastructure
# Extends CLIPipelineBase with service management utilities

# Source the base class
source "$(dirname "${BASH_SOURCE[0]}")/CLIPipelineBase.sh"

# Service management specific variables
MANAGED_SERVICES=()
SERVICE_REGISTRY_PATH=""
DEFAULT_HEALTH_CHECK_TIMEOUT=30

# Initialize service pipeline with service discovery
init_service_pipeline() {
    local pipeline_name="$1"
    local pipeline_description="$2"
    shift 2
    
    # Initialize base class
    init_cli_pipeline "$pipeline_name" "$pipeline_description" "$@"
    
    # Setup service management
    setup_service_management
    
    # Auto-discover managed services
    discover_managed_services
}

# Setup service management infrastructure
setup_service_management() {
    # Check for server registry service
    if check_service_available "server-registry-service"; then
        SERVICE_REGISTRY_PATH=$(load_service "server-registry-service")
        log_debug "Server registry service available: $SERVICE_REGISTRY_PATH"
    else
        log_warn "Server registry service not available - using fallback service discovery"
    fi
}

# Discover services managed by this pipeline
discover_managed_services() {
    log_debug "Discovering managed services for $PIPELINE_NAME"
    
    # Pipeline-specific service discovery
    case "$PIPELINE_NAME" in
        "proxy")
            MANAGED_SERVICES=("vite-fix" "monitoring" "manager" "git-operations" "file-browser" "audio-streaming")
            ;;
        "servers")
            MANAGED_SERVICES=("dhg-admin-code" "dhg-hub" "dhg-audio" "dhg-research")
            ;;
        *)
            log_debug "No predefined services for $PIPELINE_NAME - will discover dynamically"
            ;;
    esac
    
    log_debug "Managed services: ${MANAGED_SERVICES[*]}"
}

# Start a service with full monitoring
start_service() {
    local service_name="$1"
    local service_command="$2"
    local port="${3:-auto}"
    
    log_info "Starting service: $service_name"
    
    # Check if service is already running
    if is_service_running "$service_name"; then
        log_warn "Service $service_name is already running"
        return 0
    fi
    
    # Start the service
    track_and_execute "start_$service_name" "Start service $service_name" \
        start_service_with_monitoring "$service_name" "$service_command" "$port"
}

# Stop a service gracefully
stop_service() {
    local service_name="$1"
    local timeout="${2:-30}"
    
    log_info "Stopping service: $service_name"
    
    if ! is_service_running "$service_name"; then
        log_warn "Service $service_name is not running"
        return 0
    fi
    
    track_and_execute "stop_$service_name" "Stop service $service_name" \
        stop_service_gracefully "$service_name" "$timeout"
}

# Check if a service is running
is_service_running() {
    local service_name="$1"
    
    # Try multiple methods to check service status
    
    # Method 1: Check via server registry
    if [[ -n "$SERVICE_REGISTRY_PATH" ]]; then
        local status
        status=$(npx ts-node -e "
            import { ServerRegistryService } from '$SERVICE_REGISTRY_PATH';
            const registry = ServerRegistryService.getInstance();
            registry.getServerStatus('$service_name').then(status => 
                console.log(status === 'running' ? 'true' : 'false')
            ).catch(() => console.log('false'));
        " 2>/dev/null)
        
        if [[ "$status" == "true" ]]; then
            return 0
        fi
    fi
    
    # Method 2: Check by process name
    if pgrep -f "$service_name" > /dev/null; then
        return 0
    fi
    
    # Method 3: Check by port (if service has known port)
    local port
    port=$(get_service_port "$service_name")
    if [[ -n "$port" ]] && netstat -ln | grep -q ":$port "; then
        return 0
    fi
    
    return 1
}

# Get service port from registry or configuration
get_service_port() {
    local service_name="$1"
    
    if [[ -n "$SERVICE_REGISTRY_PATH" ]]; then
        npx ts-node -e "
            import { ServerRegistryService } from '$SERVICE_REGISTRY_PATH';
            const registry = ServerRegistryService.getInstance();
            registry.getServerPort('$service_name').then(port => 
                console.log(port || '')
            ).catch(() => console.log(''));
        " 2>/dev/null
    fi
}

# Health check for a specific service
health_check_service() {
    local service_name="$1"
    local timeout="${2:-$DEFAULT_HEALTH_CHECK_TIMEOUT}"
    
    log_info "Health checking service: $service_name"
    
    if ! is_service_running "$service_name"; then
        log_error "Service $service_name is not running"
        return 1
    fi
    
    # Get service health endpoint
    local health_url
    health_url=$(get_service_health_url "$service_name")
    
    if [[ -n "$health_url" ]]; then
        log_debug "Checking health endpoint: $health_url"
        
        # Check health endpoint with timeout
        if curl -sf --max-time "$timeout" "$health_url" > /dev/null 2>&1; then
            log_success "Service $service_name is healthy"
            return 0
        else
            log_error "Service $service_name health check failed"
            return 1
        fi
    else
        log_warn "No health endpoint configured for $service_name - assuming healthy if running"
        return 0
    fi
}

# Get service health URL
get_service_health_url() {
    local service_name="$1"
    local port
    port=$(get_service_port "$service_name")
    
    if [[ -n "$port" ]]; then
        echo "http://localhost:$port/health"
    fi
}

# Health check all managed services
health_check_all() {
    log_info "Health checking all managed services"
    
    local failed_services=()
    local healthy_services=()
    
    for service in "${MANAGED_SERVICES[@]}"; do
        if health_check_service "$service"; then
            healthy_services+=("$service")
        else
            failed_services+=("$service")
        fi
    done
    
    # Summary
    log_info "Health check summary:"
    log_success "  Healthy services (${#healthy_services[@]}): ${healthy_services[*]}"
    
    if [[ ${#failed_services[@]} -gt 0 ]]; then
        log_error "  Failed services (${#failed_services[@]}): ${failed_services[*]}"
        return 1
    else
        log_success "All services are healthy"
        return 0
    fi
}

# Start all managed services
start_all_services() {
    log_info "Starting all managed services"
    
    for service in "${MANAGED_SERVICES[@]}"; do
        if ! is_service_running "$service"; then
            start_service "$service" "auto" "auto"
        else
            log_info "Service $service already running - skipping"
        fi
    done
    
    # Wait a moment then health check all
    sleep 5
    health_check_all
}

# Stop all managed services
stop_all_services() {
    log_info "Stopping all managed services"
    
    for service in "${MANAGED_SERVICES[@]}"; do
        if is_service_running "$service"; then
            stop_service "$service"
        else
            log_info "Service $service not running - skipping"
        fi
    done
}

# Update service registry (sync with database)
update_service_registry() {
    log_info "Updating service registry"
    
    if [[ -z "$SERVICE_REGISTRY_PATH" ]]; then
        log_error "Service registry not available"
        return 1
    fi
    
    track_and_execute "update_registry" "Update service registry database" \
        npx ts-node -e "
            import { ServerRegistryService } from '$SERVICE_REGISTRY_PATH';
            const registry = ServerRegistryService.getInstance();
            registry.updateRegistry().then(() => 
                console.log('Registry updated successfully')
            ).catch(err => {
                console.error('Registry update failed:', err);
                process.exit(1);
            });
        "
}

# List all available services
list_services() {
    log_info "Available services for $PIPELINE_NAME:"
    
    for service in "${MANAGED_SERVICES[@]}"; do
        local status="stopped"
        local port=""
        
        if is_service_running "$service"; then
            status="running"
            port=$(get_service_port "$service")
        fi
        
        printf "  %-20s %-10s %s\n" "$service" "$status" "${port:+:$port}"
    done
}

# Service-specific help message
show_service_help() {
    echo -e "${BLUE}$PIPELINE_DESCRIPTION${NC}"
    echo -e "${CYAN}(Service Management CLI Pipeline)${NC}"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Service Management Commands:"
    echo "  start <service>            Start a specific service"
    echo "  stop <service>             Stop a specific service"
    echo "  restart <service>          Restart a specific service"
    echo "  status <service>           Check status of a specific service"
    echo "  health-check [service]     Health check service(s)"
    echo "  start-all                  Start all managed services"
    echo "  stop-all                   Stop all managed services"
    echo "  list                       List all available services"
    echo "  update-registry            Update service registry database"
    echo ""
    
    # Show pipeline-specific commands
    local commands
    commands=$(discover_commands)
    if [[ -n "$commands" ]]; then
        echo "Pipeline-Specific Commands:"
        while IFS= read -r cmd; do
            if [[ ! "$cmd" =~ ^(start|stop|restart|status|health-check|list)$ ]]; then
                echo "  $(printf "%-20s" "$cmd") Pipeline-specific command"
            fi
        done <<< "$commands"
        echo ""
    fi
    
    echo "Managed Services (${#MANAGED_SERVICES[@]}):"
    for service in "${MANAGED_SERVICES[@]}"; do
        echo "  $service"
    done
    
    echo ""
    echo "Global Options:"
    echo "  --debug                Enable debug mode"
    echo "  --verbose              Enable verbose output"
    echo "  --help, -h             Show this help message"
    echo ""
    echo "Framework Info:"
    echo "  Type: Service Management CLI Pipeline"
    echo "  Pipeline: $PIPELINE_NAME v$PIPELINE_VERSION"
    echo "  Registry: ${SERVICE_REGISTRY_PATH:-'Not available'}"
}

# Override base show_help
show_help() {
    show_service_help
}

# Internal service management functions (to be implemented by specific pipelines)
start_service_with_monitoring() {
    local service_name="$1"
    local service_command="$2"
    local port="$3"
    
    log_debug "Starting $service_name with monitoring"
    # Implementation depends on specific service type
    # This is meant to be overridden by specific service pipelines
}

stop_service_gracefully() {
    local service_name="$1"
    local timeout="$2"
    
    log_debug "Stopping $service_name gracefully (timeout: ${timeout}s)"
    # Implementation depends on specific service type
    # This is meant to be overridden by specific service pipelines
}

# Export service pipeline functions
export -f init_service_pipeline
export -f start_service stop_service
export -f is_service_running
export -f health_check_service health_check_all
export -f start_all_services stop_all_services
export -f update_service_registry
export -f list_services
export -f get_service_port get_service_health_url