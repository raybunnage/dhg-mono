#!/bin/bash

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Path to the presentations CLI
CLI_PATH="$SCRIPT_DIR/presentations-cli.sh"

echo "Dynamic Healing Discussion Group - Update AI Summary Status"
echo "==========================================================="
echo ""
echo "This script will update expert documents in the DHG folder to have a 'pending' AI summary status"
echo "so they can be processed by the generate-summary command."
echo ""
echo "Running scan-for-ai-summaries with --update-dhg option..."

# Run the command
$CLI_PATH scan-for-ai-summaries --update-dhg

echo ""
echo "Now you can generate summaries for these documents with:"
echo "$CLI_PATH generate-summary --status pending --limit 10"
echo ""
echo "Done!"