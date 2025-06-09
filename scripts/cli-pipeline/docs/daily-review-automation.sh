#!/bin/bash

# Daily Automation Script for Continuously Updated Documentation
# Run this via cron for automated daily reviews

set -e

# Script configuration
SCRIPT_DIR=$(dirname "$(readlink -f "$0")")
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs/continuous-docs"
LOG_FILE="$LOG_DIR/daily-review-$(date +%Y%m%d).log"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Start daily review
log "====== Starting Daily Documentation Review ======"

# Change to project root
cd "$PROJECT_ROOT" || exit 1

# Load environment
source "$PROJECT_ROOT/.env.development" 2>/dev/null || true

# Run daily check
log "Running daily review check..."
./scripts/cli-pipeline/docs/docs-cli.sh daily-check 2>&1 | tee -a "$LOG_FILE"

# Check if any documents need review
if grep -q "documents need review" "$LOG_FILE"; then
    log "⚠️ Documents need attention!"
    
    # Could add email notification here
    # echo "Documents need review" | mail -s "DHG Docs Daily Review Alert" admin@example.com
    
    # Or create a dev_task
    # ./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh create --type maintenance --title "Review overdue documentation" --priority high
else
    log "✅ All documents are up to date"
fi

# Run sync to ensure database is current
log "Syncing documentation to database..."
./scripts/cli-pipeline/docs/docs-cli.sh sync-db 2>&1 | tee -a "$LOG_FILE"

# Generate daily report
log "Generating documentation health report..."
./scripts/cli-pipeline/docs/docs-cli.sh report --format summary 2>&1 | tee -a "$LOG_FILE"

log "====== Daily Documentation Review Complete ======"

# Clean up old logs (keep last 30 days)
find "$LOG_DIR" -name "daily-review-*.log" -mtime +30 -delete

# Exit with appropriate code
if grep -q "❌" "$LOG_FILE"; then
    exit 1
else
    exit 0
fi