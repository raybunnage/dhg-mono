#\!/bin/bash
# Script to run PowerPoint classification in batch mode

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Configuration
FILES_PER_BATCH=${1:-1}  # Number of files to process per batch, default is 1
TOTAL_FILES=${2:-20}     # Total number of files to process, default is 20
VERBOSE=${3:-"false"}    # Whether to enable verbose mode

if [[ "$VERBOSE" == "true" ]]; then
  VERBOSE_ARG="--verbose"
else
  VERBOSE_ARG=""
fi

echo "============================================================"
echo "BATCH POWERPOINT CLASSIFICATION"
echo "============================================================"
echo "Will process $TOTAL_FILES files in batches of $FILES_PER_BATCH"
echo "Verbose mode: $VERBOSE"
echo "============================================================"
echo ""

# Create logs directory if it doesn't exist
mkdir -p "$PROJECT_ROOT/logs"

# Log file
LOG_FILE="$PROJECT_ROOT/logs/powerpoint-batch-$(date +%Y%m%d-%H%M%S).log"
echo "Logging to: $LOG_FILE"
echo ""

# Process in batches
REMAINING=$TOTAL_FILES
BATCH=1

while [ $REMAINING -gt 0 ]; do
  # Calculate files for this batch
  if [ $REMAINING -gt $FILES_PER_BATCH ]; then
    BATCH_SIZE=$FILES_PER_BATCH
  else
    BATCH_SIZE=$REMAINING
  fi
  
  echo "Processing batch #$BATCH: $BATCH_SIZE files"
  echo "$(date +'%Y-%m-%d %H:%M:%S') - Starting batch #$BATCH ($BATCH_SIZE files)" >> "$LOG_FILE"
  
  # Run the classification command
  "$SCRIPT_DIR/google-sync-cli.sh" classify-powerpoints --limit $BATCH_SIZE $VERBOSE_ARG 2>&1 | tee -a "$LOG_FILE"
  
  # Update counters
  REMAINING=$((REMAINING - BATCH_SIZE))
  BATCH=$((BATCH + 1))
  
  # If there are more batches to process, wait a bit to avoid rate limits
  if [ $REMAINING -gt 0 ]; then
    echo "Waiting 30 seconds before starting next batch..."
    echo "$(date +'%Y-%m-%d %H:%M:%S') - Waiting 30 seconds before next batch" >> "$LOG_FILE"
    sleep 30
  fi
done

echo ""
echo "============================================================"
echo "PROCESSING COMPLETE"
echo "============================================================"
echo "Processed $TOTAL_FILES files in $((BATCH-1)) batches"
echo "Log file: $LOG_FILE"
echo "============================================================"
echo ""

echo "You can see a summary of the results with:"
echo "grep 'Successfully processed' $LOG_FILE"
