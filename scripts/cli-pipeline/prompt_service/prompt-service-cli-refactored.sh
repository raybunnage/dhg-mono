#!/bin/bash

# Prompt Service CLI - Refactored
# Manages prompt content and templates across the application

# Define the script and project paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Pipeline metadata
PIPELINE_NAME="prompt_service"
PIPELINE_DESCRIPTION="Prompt and template management service"
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

# Execute TypeScript CLI
execute_ts_cli() {
    local command_name="$1"
    shift
    
    local ts_file="$SCRIPT_DIR/prompt-service-cli.ts"
    if [[ ! -f "$ts_file" ]]; then
        log_error "TypeScript CLI not found: $ts_file"
        return 1
    fi
    
    local cmd="NODE_PATH=\"$SCRIPT_DIR/node_modules:$PROJECT_ROOT/node_modules\" npx ts-node -P \"$PROJECT_ROOT/tsconfig.json\" \"$ts_file\" $command_name $@"
    track_command "$command_name" "$cmd"
}

# Execute template command
execute_template_command() {
    local template_cmd="$1"
    shift
    
    local ts_file="$SCRIPT_DIR/commands/manage-output-templates.ts"
    if [[ ! -f "$ts_file" ]]; then
        log_error "Template management script not found: $ts_file"
        return 1
    fi
    
    track_command "$template_cmd" "npx ts-node '$ts_file' $template_cmd $@"
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
    echo "PROMPT MANAGEMENT:"
    echo "    load <file-path>           Load a prompt file into the database"
    echo "  * update <n> <file-path>     Update an existing prompt (16 uses)"
    echo "    view <prompt-number>       View the content of a prompt"
    echo "  * view-metadata <number>     View metadata of a prompt (9 uses)"
    echo ""
    echo "OUTPUT TEMPLATE MANAGEMENT:"
    echo "    template <subcommand>      Access template management commands"
    echo "      list-templates           List all available templates"
    echo "      view-template NAME       View details of a template"
    echo "      create-template NAME     Create a new template"
    echo "      update-template NAME     Update an existing template"
    echo "      delete-template NAME     Delete a template"
    echo "      list-associations NAME   List associations for a prompt"
    echo "      associate-template P T   Associate template T with prompt P"
    echo "      dissociate-template P T  Remove association"
    echo "      generate-schema NAME     Generate JSON schema"
    echo ""
    echo "DATABASE OPERATIONS:"
    echo "  * add-query <n> <query>      Add/update database query (14 uses)"
    echo "    clean-metadata             Clean metadata fields"
    echo ""
    echo "REPORTING & UTILITIES:"
    echo "  * summarize-metadata         Summarize metadata fields (9 uses)"
    echo "    verify-claude-temperature  Verify temperature=0 setting"
    echo "    list                       List all prompts"
    echo ""
    echo "SYSTEM:"
    echo "  * health-check               Check service health (59 uses)"
    echo "    fix-database-queries       Fix document classification queries"
    echo "    help                       Show this help message"
    echo ""
    echo "EXAMPLES:"
    echo "  # Load a prompt file"
    echo "  $(basename "$0") load ./prompts/document-classification-prompt.md"
    echo ""
    echo "  # Update an existing prompt"
    echo "  $(basename "$0") update document-classification-prompt ./prompts/updated.md"
    echo ""
    echo "  # Add a database query"
    echo "  $(basename "$0") add-query \"document-classification-prompt\" \"select * from document_types\""
    echo ""
    echo "  # List templates"
    echo "  $(basename "$0") template list-templates"
}

# Command: template (subcommand handler)
cmd_template() {
    local template_cmd="${1:-help}"
    shift || true
    
    case "$template_cmd" in
        list-templates)
            execute_template_command "list-templates" "$@"
            ;;
        view-template)
            if [[ -z "$1" ]]; then
                log_error "Template name is required"
                echo "Usage: $(basename "$0") template view-template <template-name>"
                return 1
            fi
            execute_template_command "view-template" "$@"
            ;;
        create-template)
            if [[ -z "$1" ]]; then
                log_error "Template name is required"
                echo "Usage: $(basename "$0") template create-template <template-name> [options]"
                return 1
            fi
            execute_template_command "create-template" "$@"
            ;;
        update-template)
            if [[ -z "$1" ]]; then
                log_error "Template name is required"
                echo "Usage: $(basename "$0") template update-template <template-name> [options]"
                return 1
            fi
            execute_template_command "update-template" "$@"
            ;;
        delete-template)
            if [[ -z "$1" ]]; then
                log_error "Template name is required"
                echo "Usage: $(basename "$0") template delete-template <template-name>"
                return 1
            fi
            execute_template_command "delete-template" "$@"
            ;;
        list-associations)
            if [[ -z "$1" ]]; then
                log_error "Prompt name is required"
                echo "Usage: $(basename "$0") template list-associations <prompt-name>"
                return 1
            fi
            execute_template_command "list-associations" "$@"
            ;;
        associate-template)
            if [[ -z "$1" ]] || [[ -z "$2" ]]; then
                log_error "Prompt name and template name are required"
                echo "Usage: $(basename "$0") template associate-template <prompt-name> <template-name>"
                return 1
            fi
            execute_template_command "associate-template" "$@"
            ;;
        dissociate-template)
            if [[ -z "$1" ]] || [[ -z "$2" ]]; then
                log_error "Prompt name and template name are required"
                echo "Usage: $(basename "$0") template dissociate-template <prompt-name> <template-name>"
                return 1
            fi
            execute_template_command "dissociate-template" "$@"
            ;;
        generate-schema)
            if [[ -z "$1" ]]; then
                log_error "Template name is required"
                echo "Usage: $(basename "$0") template generate-schema <template-name>"
                return 1
            fi
            execute_template_command "generate-schema" "$@"
            ;;
        help|--help|-h|*)
            echo "Template Management Commands:"
            echo "  list-templates           List all available prompt output templates"
            echo "  view-template            View details of a specific output template"
            echo "  create-template          Create a new output template"
            echo "  update-template          Update an existing output template"
            echo "  delete-template          Delete an output template"
            echo "  list-associations        List template associations for a prompt"
            echo "  associate-template       Associate a template with a prompt"
            echo "  dissociate-template      Remove a template association from a prompt"
            echo "  generate-schema          Generate a JSON schema for a prompt output template"
            ;;
    esac
}

# Command: fix-database-queries
cmd_fix_database_queries() {
    log_info "Fixing database queries for document classification prompts..."
    
    echo "Updating document-classification-prompt-new..."
    execute_ts_cli "add-query" "\"document-classification-prompt-new\" \"select id, category, document_type, description, mime_type, file_extension from document_types where classifier = 'docx';\""
    
    echo "Updating scientific-document-analysis-prompt..."
    execute_ts_cli "add-query" "\"scientific-document-analysis-prompt\" \"select id, category, document_type, description, mime_type, file_extension from document_types where classifier = 'pdf';\""
    
    echo "Updating scientific-powerpoint..."
    execute_ts_cli "add-query" "\"scientific-powerpoint\" \"select id, category, document_type, description, mime_type, file_extension from document_types where classifier = 'powerpoint';\""
    
    log_success "Database queries fixed successfully."
}

# Command: health-check
cmd_health_check() {
    log_info "Running health check for $PIPELINE_NAME pipeline..."
    
    # Check environment variables
    if [[ -z "$SUPABASE_URL" ]] || [[ -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
        log_error "Missing required environment variables"
        return 1
    fi
    
    # Check TypeScript CLI
    if [[ ! -f "$SCRIPT_DIR/prompt-service-cli.ts" ]]; then
        log_error "TypeScript CLI not found"
        return 1
    fi
    
    # Try to execute health check via CLI
    execute_ts_cli "health-check" || {
        # Fallback
        log_success "$PIPELINE_NAME pipeline is healthy"
    }
}

# Main command handler
main() {
    # Change to project root
    cd "$PROJECT_ROOT" || {
        log_error "Could not change to project root directory"
        exit 1
    }
    
    case "${1:-help}" in
        # Prompt management
        load|update|view|view-metadata)
            execute_ts_cli "$@"
            ;;
            
        # Template management
        template)
            shift
            cmd_template "$@"
            ;;
            
        # Database operations
        add-query|clean-metadata)
            execute_ts_cli "$@"
            ;;
            
        # Reporting & utilities
        summarize-metadata|verify-claude-temperature|list)
            execute_ts_cli "$@"
            ;;
            
        # System
        health-check)
            shift
            cmd_health_check "$@"
            ;;
        fix-database-queries)
            shift
            cmd_fix_database_queries "$@"
            ;;
            
        # Help
        help|--help|-h)
            cmd_help
            ;;
            
        # Default to TypeScript CLI
        *)
            execute_ts_cli "$@"
            ;;
    esac
}

# Execute main function with all arguments
main "$@"