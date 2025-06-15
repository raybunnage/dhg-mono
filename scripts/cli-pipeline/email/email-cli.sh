#!/bin/bash

# Email Pipeline CLI
# Manages email data and processing

set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"

# Source the ProcessingCLIPipeline base class
source "$SCRIPT_DIR/../base-classes/ProcessingCLIPipeline.sh"

# Define pipeline-specific variables
PIPELINE_NAME="email"
PIPELINE_DESCRIPTION="Email Pipeline CLI - Manages email data and processing"
PIPELINE_VERSION="2.0.0"

# Email-specific commands array
declare -a EMAIL_COMMANDS=(
    "import-dhg-emails:Import DHG emails from source data"
    "verify-sources:Verify email source tracking configuration"
    "add-email-address-id:Add email_address_id field to email_messages and populate"
    "populate-address-ids:Populate email_address_id field based on sender lookup"
    "merge-important:Merge import_important_email_addresses data with email_addresses"
    "check-tables:Check email table structure and data"
    "verify-implementation:Final verification of email_address_id implementation"
    "verify-merge:Verify important emails merge results"
    "health-check:Check pipeline health"
)

# Initialize the pipeline with processing configuration
init_processing_pipeline "$PIPELINE_NAME" "$PIPELINE_DESCRIPTION" \
    --batch-size 1000 \
    --parallel-jobs 4 \
    --checkpoint-interval 100

# Command implementations
command_import_dhg_emails() {
    start_batch_processing "import-dhg-emails" "Importing DHG emails"
    
    if [ -f "$SCRIPT_DIR/import-dhg-emails.ts" ]; then
        cd "$PROJECT_ROOT"
        npx ts-node "$SCRIPT_DIR/import-dhg-emails.ts"
        complete_batch_processing "import-dhg-emails"
    else
        print_error "import-dhg-emails.ts not found"
        return 1
    fi
}

command_verify_sources() {
    print_info "Verifying email sources..."
    
    if [ -f "$SCRIPT_DIR/verify-email-sources.ts" ]; then
        cd "$PROJECT_ROOT"
        npx ts-node "$SCRIPT_DIR/verify-email-sources.ts"
    else
        print_error "verify-email-sources.ts not found"
        return 1
    fi
}

command_add_email_address_id() {
    start_batch_processing "add-email-address-id" "Adding email_address_id field"
    
    if [ -f "$SCRIPT_DIR/add-email-address-id-simple.ts" ]; then
        cd "$PROJECT_ROOT"
        npx ts-node "$SCRIPT_DIR/add-email-address-id-simple.ts"
        complete_batch_processing "add-email-address-id"
    else
        print_error "add-email-address-id-simple.ts not found"
        return 1
    fi
}

command_populate_address_ids() {
    start_batch_processing "populate-address-ids" "Populating email_address_id field"
    
    if [ -f "$SCRIPT_DIR/populate-email-address-id.ts" ]; then
        cd "$PROJECT_ROOT"
        npx ts-node "$SCRIPT_DIR/populate-email-address-id.ts"
        complete_batch_processing "populate-address-ids"
    else
        print_error "populate-email-address-id.ts not found"
        return 1
    fi
}

command_check_tables() {
    print_info "Checking email tables..."
    
    if [ -f "$SCRIPT_DIR/check-email-tables.ts" ]; then
        cd "$PROJECT_ROOT"
        npx ts-node "$SCRIPT_DIR/check-email-tables.ts"
    else
        print_error "check-email-tables.ts not found"
        return 1
    fi
}

command_merge_important() {
    start_batch_processing "merge-important" "Merging important email addresses"
    
    if [ -f "$SCRIPT_DIR/merge-important-emails.ts" ]; then
        cd "$PROJECT_ROOT"
        npx ts-node "$SCRIPT_DIR/merge-important-emails.ts"
        complete_batch_processing "merge-important"
    else
        print_error "merge-important-emails.ts not found"
        return 1
    fi
}

command_verify_implementation() {
    print_info "Verifying email_address_id implementation..."
    
    if [ -f "$SCRIPT_DIR/final-verification.ts" ]; then
        cd "$PROJECT_ROOT"
        npx ts-node "$SCRIPT_DIR/final-verification.ts"
    else
        print_error "final-verification.ts not found"
        return 1
    fi
}

command_verify_merge() {
    print_info "Verifying important emails merge..."
    
    if [ -f "$SCRIPT_DIR/verify-merge.ts" ]; then
        cd "$PROJECT_ROOT"
        npx ts-node "$SCRIPT_DIR/verify-merge.ts"
    else
        print_error "verify-merge.ts not found"
        return 1
    fi
}

command_health_check() {
    print_info "Running health check for email pipeline..."
    
    # Check environment variables
    if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
        print_error "Missing required environment variables"
        return 1
    fi
    
    # Check if email scripts exist
    local required_scripts=(
        "import-dhg-emails.ts"
        "verify-email-sources.ts"
        "check-email-tables.ts"
    )
    
    for script in "${required_scripts[@]}"; do
        if [ ! -f "$SCRIPT_DIR/$script" ]; then
            print_warning "Missing script: $script"
        fi
    done
    
    # Run base health check
    health_check
    
    print_success "email pipeline is healthy"
}

# Override show_help to add email-specific information
show_help() {
    echo "$PIPELINE_DESCRIPTION"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    for cmd_desc in "${EMAIL_COMMANDS[@]}"; do
        IFS=':' read -r cmd desc <<< "$cmd_desc"
        printf "  %-24s %s\n" "$cmd" "$desc"
    done
    
    echo ""
    echo "Processing Commands:"
    printf "  %-24s %s\n" "show-progress" "Show current processing progress"
    printf "  %-24s %s\n" "reset-checkpoint" "Reset processing checkpoint"
    
    echo ""
    echo "Examples:"
    echo "  # Import emails from DHG source"
    echo "  $0 import-dhg-emails"
    echo ""
    echo "  # Verify email source configuration"
    echo "  $0 verify-sources"
    echo ""
    echo "  # Add and populate email_address_id field"
    echo "  $0 add-email-address-id"
    echo ""
    echo "  # Check table structure and data"
    echo "  $0 check-tables"
    echo ""
    echo "  # Merge important email addresses data"
    echo "  $0 merge-important"
}

# Main command routing
case "${1:-help}" in
    import-dhg-emails)
        shift
        track_and_execute "import-dhg-emails" command_import_dhg_emails "$@"
        ;;
    verify-sources)
        shift
        track_and_execute "verify-sources" command_verify_sources "$@"
        ;;
    add-email-address-id)
        shift
        track_and_execute "add-email-address-id" command_add_email_address_id "$@"
        ;;
    populate-address-ids)
        shift
        track_and_execute "populate-address-ids" command_populate_address_ids "$@"
        ;;
    check-tables)
        shift
        track_and_execute "check-tables" command_check_tables "$@"
        ;;
    merge-important)
        shift
        track_and_execute "merge-important" command_merge_important "$@"
        ;;
    verify-implementation)
        shift
        track_and_execute "verify-implementation" command_verify_implementation "$@"
        ;;
    verify-merge)
        shift
        track_and_execute "verify-merge" command_verify_merge "$@"
        ;;
    health-check)
        shift
        track_and_execute "health-check" command_health_check "$@"
        ;;
    # Processing pipeline commands
    show-progress)
        shift
        show_processing_progress "$@"
        ;;
    reset-checkpoint)
        shift
        reset_checkpoint "$@"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac