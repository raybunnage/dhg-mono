#\!/bin/bash
# Script to run multiple PowerPoint classification jobs in parallel

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Default settings
JOBS=3  # Number of parallel jobs
FILES_PER_JOB=1  # Number of files to process per job
WAIT_SECONDS=10  # Seconds to wait between starting jobs (increased to avoid rate limits)

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --jobs=*)
      JOBS="${1#*=}"
      shift
      ;;
    --jobs|-j)
      JOBS="$2"
      shift 2
      ;;
    --files-per-job=*)
      FILES_PER_JOB="${1#*=}"
      shift
      ;;
    --files-per-job|-f)
      FILES_PER_JOB="$2"
      shift 2
      ;;
    --wait=*)
      WAIT_SECONDS="${1#*=}"
      shift
      ;;
    --wait|-w)
      WAIT_SECONDS="$2"
      shift 2
      ;;
    --verbose|-v)
      VERBOSE=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo "Run multiple PowerPoint classification jobs in parallel"
      echo ""
      echo "Options:"
      echo "  --jobs=N, -j N           Number of parallel jobs to run (default: 3)"
      echo "  --files-per-job=N, -f N  Number of files to process per job (default: 1)"
      echo "  --wait=N, -w N           Seconds to wait between starting jobs (default: 10)"
      echo "  --verbose, -v            Enable verbose output"
      echo "  --dry-run                Simulate classification without updating the database"
      echo "  --help, -h               Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0 --jobs=3 --files-per-job=2"
      echo "  $0 -j 4 -f 1 --verbose"
      echo "  $0 -j 3 -f 1 -w 15       # Wait 15 seconds between job starts to avoid rate limits"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

echo "============================================================"
echo "PARALLEL POWERPOINT CLASSIFICATION"
echo "============================================================"
echo "Starting $JOBS parallel PowerPoint classification jobs"
echo "Each job will process $FILES_PER_JOB files"
echo "Waiting $WAIT_SECONDS seconds between job starts"
echo "Total files to be processed: $((JOBS * FILES_PER_JOB))"
echo "============================================================"
echo ""

# Create logs directory if it doesn't exist
mkdir -p "$PROJECT_ROOT/logs"

# Function to run a single classification job
run_job() {
  local job_number=$1
  local output_file="$PROJECT_ROOT/logs/powerpoint-job-$job_number.log"
  
  # Build command arguments
  local args="--limit $FILES_PER_JOB"
  if [ "$VERBOSE" = true ]; then
    args="$args --verbose"
  fi
  if [ "$DRY_RUN" = true ]; then
    args="$args --dry-run"
  fi
  
  echo "Starting job #$job_number with arguments: $args"
  echo "Logging to: $output_file"
  
  # Run the command and redirect output to log file
  "$SCRIPT_DIR/google-sync-cli.sh" classify-powerpoints $args > "$output_file" 2>&1 &
  
  # Store the process ID
  echo $\!
}

# Start each job
job_pids=()
for ((i=1; i<=$JOBS; i++)); do
  pid=$(run_job $i)
  job_pids+=($pid)
  
  echo "Job #$i started with PID $pid"
  echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
  
  # Wait between starting jobs to avoid rate limiting
  if [ $i -lt $JOBS ]; then
    echo "Waiting $WAIT_SECONDS seconds before starting next job..."
    sleep $WAIT_SECONDS
  fi
done

echo ""
echo "All jobs started. Waiting for completion..."
echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Wait for all jobs to complete
job_statuses=()
for pid in "${job_pids[@]}"; do
  wait $pid
  status=$?
  job_statuses+=($status)
  
  if [ $status -eq 0 ]; then
    echo "✅ Job with PID $pid completed successfully"
  else
    echo "❌ Job with PID $pid failed with status $status"
  fi
  
  echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
done

# Count successes and failures
success_count=0
for status in "${job_statuses[@]}"; do
  if [ $status -eq 0 ]; then
    ((success_count++))
  fi
done

echo ""
echo "============================================================"
echo "COMPLETION SUMMARY"
echo "============================================================"
echo "Total jobs: $JOBS"
echo "Successful: $success_count"
echo "Failed: $((JOBS - success_count))"
echo "Time completed: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"
echo ""

# Display a summary of results from log files
echo "Processed files from successful jobs:"
grep -h "POWERPOINT CLASSIFICATION SUMMARY" -A 4 "$PROJECT_ROOT/logs/powerpoint-job-"*.log | grep -E "Successfully processed|Total extracted content|Average content per file"

echo ""
echo "Log files are available at:"
echo "$PROJECT_ROOT/logs/powerpoint-job-*.log"
echo ""
echo "You can view a specific log file with:"
echo "cat $PROJECT_ROOT/logs/powerpoint-job-1.log"
