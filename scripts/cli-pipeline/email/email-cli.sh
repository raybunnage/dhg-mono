#!/bin/bash

# Email Pipeline CLI
# Manages email data and processing

source "$(dirname "$0")/../all_pipelines/track_command.sh" 2>/dev/null || echo "Command tracking not available"

# Define script directory
SCRIPT_DIR="$(dirname "$0")"

# Display help
show_help() {
    echo "Email Pipeline CLI"
    echo "=================="
    echo ""
    echo "COMMANDS:"
    echo "  import-dhg-emails     Import DHG emails from source data"
    echo "  verify-sources        Verify email source tracking configuration"
    echo "  add-email-address-id  Add email_address_id field to email_messages and populate"
    echo "  populate-address-ids  Populate email_address_id field based on sender lookup"
    echo "  check-tables          Check email table structure and data"
    echo "  verify-implementation Final verification of email_address_id implementation"
    echo ""
    echo "EXAMPLES:"
    echo "  # Import emails from DHG source"
    echo "  ./email-cli.sh import-dhg-emails"
    echo ""
    echo "  # Verify email source configuration"
    echo "  ./email-cli.sh verify-sources"
    echo ""
    echo "  # Add and populate email_address_id field"
    echo "  ./email-cli.sh add-email-address-id"
    echo ""
    echo "  # Check table structure and data"
    echo "  ./email-cli.sh check-tables"
}

# Track command usage (if available)
if command -v track_command &> /dev/null; then
    track_command "email" "$1"
fi

case "$1" in
    import-dhg-emails)
        echo "📧 Importing DHG emails..."
        cd "$SCRIPT_DIR/../../.."
        ts-node "$SCRIPT_DIR/import-dhg-emails.ts"
        ;;
    
    verify-sources)
        echo "🔍 Verifying email sources..."
        cd "$SCRIPT_DIR/../../.."
        ts-node "$SCRIPT_DIR/verify-email-sources.ts"
        ;;
    
    add-email-address-id)
        echo "🔗 Adding email_address_id field..."
        cd "$SCRIPT_DIR/../../.."
        ts-node "$SCRIPT_DIR/add-email-address-id-simple.ts"
        ;;
    
    populate-address-ids)
        echo "📊 Populating email_address_id field..."
        cd "$SCRIPT_DIR/../../.."
        ts-node "$SCRIPT_DIR/populate-email-address-id.ts"
        ;;
    
    check-tables)
        echo "📋 Checking email tables..."
        cd "$SCRIPT_DIR/../../.."
        ts-node "$SCRIPT_DIR/check-email-tables.ts"
        ;;
    
    verify-implementation)
        echo "🎯 Verifying email_address_id implementation..."
        cd "$SCRIPT_DIR/../../.."
        ts-node "$SCRIPT_DIR/final-verification.ts"
        ;;
    
    --help|-h|help|"")
        show_help
        ;;
    
    *)
        echo "❌ Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac