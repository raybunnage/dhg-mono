#!/bin/bash

# Experts CLI Pipeline - Refactored
# Manage experts and their associations

# Define the script and project paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Pipeline metadata
PIPELINE_NAME="experts"
PIPELINE_DESCRIPTION="Expert profile and folder association management"
PIPELINE_VERSION="1.0.0"

# Load environment variables
ENV_DEV_FILE="${PROJECT_ROOT}/.env.development"
if [[ -f "$ENV_DEV_FILE" ]]; then
    echo "ℹ️  INFO [$PIPELINE_NAME] Loading environment variables from .env.development..."
    export $(grep -E "SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|CLAUDE_API_KEY" "$ENV_DEV_FILE" | grep -v '^#' | xargs)
fi

# Logging functions
log_info() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ℹ️  INFO [$PIPELINE_NAME] $*"
}

log_error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ❌ ERROR [$PIPELINE_NAME] $*" >&2
}

log_success() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ✅ SUCCESS [$PIPELINE_NAME] $*"
}

# Command tracking wrapper
track_command() {
    local command_name="$1"
    shift
    local full_command="$@"
    
    # Log command execution
    log_info "Executing: $command_name"
    
    # Try to use tracking service if available
    local TRACKER_TS="$PROJECT_ROOT/packages/shared/services/tracking-service/shell-command-tracker.ts"
    if [[ -f "$TRACKER_TS" ]]; then
        npx ts-node --project "$PROJECT_ROOT/tsconfig.node.json" "$TRACKER_TS" "$PIPELINE_NAME" "$command_name" "$full_command" 2>&1
    else
        eval "$full_command"
    fi
}

# Execute TypeScript command
execute_ts_command() {
    local command_name="$1"
    shift
    
    local ts_file="$SCRIPT_DIR/experts-cli.ts"
    if [[ ! -f "$ts_file" ]]; then
        log_error "TypeScript implementation not found: $ts_file"
        return 1
    fi
    
    track_command "$command_name" "cd '$PROJECT_ROOT' && npx ts-node '$ts_file' $command_name $@"
}

# Execute specific TypeScript file
execute_ts_file() {
    local command_name="$1"
    local ts_file="$2"
    shift 2
    
    if [[ ! -f "$ts_file" ]]; then
        log_error "TypeScript file not found: $ts_file"
        return 1
    fi
    
    track_command "$command_name" "cd '$PROJECT_ROOT' && npx ts-node '$ts_file' $@"
}

# Help command
cmd_help() {
    echo "$PIPELINE_DESCRIPTION"
    echo "Version: $PIPELINE_VERSION"
    echo ""
    echo "Usage: $(basename "$0") COMMAND [OPTIONS]"
    echo ""
    echo "COMMANDS:"
    echo "  (* = frequently used commands based on usage statistics)"
    echo ""
    echo "EXPERTS MANAGEMENT:"
    echo "  * add-expert              Add a new expert to the database (15 uses)"
    echo "  * list-experts            List all experts with their mnemonics"
    echo ""
    echo "FOLDER ASSIGNMENTS:"
    echo "  * assign-folder-experts   Interactively assign experts to folders (7 uses)"
    echo "    assign-expert           Assign an expert to a folder (-i for interactive)"
    echo "    assign-multiple-experts Assign multiple experts to folders (with DELETE)"
    echo "    link-top-level-folders  List folders with videos for assignment"
    echo "  * propagate-expert-ids    Recursively assign expert_id to child files (5 uses)"
    echo "    transfer-expert-metadata Transfer processed_content to metadata field"
    echo ""
    echo "SYSTEM:"
    echo "  * health-check            Check service health (25 uses)"
    echo "    help                    Show this help message"
    echo ""
    echo "OPTIONS:"
    echo "  --expert-name NAME        Expert name (required for add-expert)"
    echo "  --full-name NAME          Full name of expert"
    echo "  --mnemonic CODE           Short mnemonic code"
    echo "  --metadata JSON           JSON metadata"
    echo "  --core-group              Flag as core group member"
    echo "  --dry-run, -d             Preview changes without making them"
    echo "  --verbose, -v             Show detailed output"
    echo "  --limit N                 Limit number of items to process"
    echo "  -i                        Interactive mode"
    echo ""
    echo "EXAMPLES:"
    echo "  # Add a basic expert"
    echo "  $(basename "$0") add-expert --expert-name \"Wager\""
    echo ""
    echo "  # Add expert with full details"
    echo "  $(basename "$0") add-expert --expert-name \"Wager\" --full-name \"Tor Wager\" --core-group"
    echo ""
    echo "  # Interactive bulk assignment"
    echo "  $(basename "$0") assign-expert -i"
    echo ""
    echo "  # Check service health"
    echo "  $(basename "$0") health-check"
}

# Command: add-expert (special handling)
cmd_add_expert() {
    # Extract parameters from command line arguments
    local EXPERT_NAME=""
    local FULL_NAME=""
    local MNEMONIC=""
    local METADATA=""
    local CORE_GROUP=false
    local DRY_RUN=false
    local VERBOSE=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --expert-name)
                EXPERT_NAME="$2"
                shift 2
                ;;
            --full-name)
                FULL_NAME="$2"
                shift 2
                ;;
            --mnemonic)
                MNEMONIC="$2"
                shift 2
                ;;
            --metadata)
                METADATA="$2"
                shift 2
                ;;
            --core-group)
                CORE_GROUP=true
                shift
                ;;
            --dry-run|-d)
                DRY_RUN=true
                shift
                ;;
            --verbose|-v)
                VERBOSE=true
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                shift
                ;;
        esac
    done
    
    # Validate required parameters
    if [[ -z "$EXPERT_NAME" ]]; then
        log_error "--expert-name is required"
        echo "Usage: $(basename "$0") add-expert --expert-name NAME [OPTIONS]"
        return 1
    fi
    
    # Build parameters
    local PARAMS="--expert-name \"$EXPERT_NAME\""
    
    [[ -n "$FULL_NAME" ]] && PARAMS="$PARAMS --full-name \"$FULL_NAME\""
    [[ -n "$MNEMONIC" ]] && PARAMS="$PARAMS --mnemonic \"$MNEMONIC\""
    [[ -n "$METADATA" ]] && PARAMS="$PARAMS --metadata '$METADATA'"
    [[ "$CORE_GROUP" == "true" ]] && PARAMS="$PARAMS --core-group"
    [[ "$DRY_RUN" == "true" ]] && PARAMS="$PARAMS --dry-run"
    [[ "$VERBOSE" == "true" ]] && PARAMS="$PARAMS --verbose"
    
    # Execute with special TypeScript file
    execute_ts_file "add-expert" "$SCRIPT_DIR/add-expert-direct.ts" $PARAMS
}

# Command: health-check (special handling)
cmd_health_check() {
    log_info "Running health check for $PIPELINE_NAME pipeline..."
    
    # Use Node.js inline script for health check
    track_command "health-check" "cd '$PROJECT_ROOT' && node -e \"
        const { createClient } = require('@supabase/supabase-js');
        
        async function testExpertsHealth() {
            try {
                // Get credentials
                const supabaseUrl = process.env.SUPABASE_URL;
                const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
                
                if (!supabaseUrl || !supabaseKey) {
                    throw new Error('Missing required Supabase credentials');
                }
                
                // Create client
                const supabase = createClient(supabaseUrl, supabaseKey);
                
                console.log('🏥 Running experts pipeline health checks...');
                console.log('\\n🔍 Checking Supabase database connection...');
                
                // Test expert_profiles table
                const { data: experts, error: expertsError } = await supabase
                    .from('expert_profiles')
                    .select('id')
                    .limit(1);
                    
                if (expertsError) {
                    console.error('❌ Expert profiles table connection failed:', expertsError.message);
                    process.exit(1);
                } else {
                    console.log('✅ Expert profiles table accessible');
                }
                
                // Test folder_expert_relationships table
                const { data: relations, error: relationsError } = await supabase
                    .from('folder_expert_relationships')
                    .select('id')
                    .limit(1);
                
                if (relationsError) {
                    console.warn('⚠️  Could not verify folder_expert_relationships table:', relationsError.message);
                } else {
                    console.log('✅ Folder-expert relationships table verified');
                }
                
                // Success
                console.log('\\n📋 Overall Status:');
                console.log('✅ Experts service infrastructure appears healthy');
                process.exit(0);
            } catch (error) {
                console.error('❌ Error in experts health check:', error);
                console.error('\\n📋 Overall Status:');
                console.error('❌ Experts service infrastructure has issues');
                process.exit(1);
            }
        }
        
        testExpertsHealth();
    \""
}

# Main command handler
main() {
    # Change to project root
    cd "$PROJECT_ROOT" || {
        log_error "Could not change to project root directory"
        exit 1
    }
    
    case "${1:-help}" in
        # Experts management
        add-expert)
            shift
            cmd_add_expert "$@"
            ;;
        list-experts)
            shift
            execute_ts_command "list-experts" "$@"
            ;;
            
        # Folder assignments
        assign-folder-experts)
            shift
            execute_ts_command "assign-folder-experts" "$@"
            ;;
        assign-expert)
            shift
            execute_ts_command "assign-expert" "$@"
            ;;
        assign-multiple-experts)
            shift
            execute_ts_command "assign-multiple-experts" "$@"
            ;;
        link-top-level-folders)
            shift
            execute_ts_command "link-top-level-folders" "$@"
            ;;
        propagate-expert-ids)
            shift
            execute_ts_command "propagate-expert-ids" "$@"
            ;;
        transfer-expert-metadata)
            shift
            execute_ts_command "transfer-expert-metadata" "$@"
            ;;
            
        # System
        health-check)
            shift
            cmd_health_check "$@"
            ;;
            
        # Help
        help|--help|-h)
            cmd_help
            ;;
            
        # Pass through to main TypeScript CLI
        main)
            shift
            execute_ts_command "" "$@"
            ;;
            
        # Unknown command
        *)
            # Try to pass through to TypeScript CLI
            execute_ts_command "$@"
            ;;
    esac
}

# Execute main function with all arguments
main "$@"