#!/bin/bash
# Simple script to run the Modal test with the 1-minute audio sample

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"
# Default to the 1-minute file unless another file is specified
if [ "$1" != "" ] && [ -f "$1" ]; then
    AUDIO_FILE="$1"
else
    AUDIO_FILE="$REPO_ROOT/file_types/m4a/INGESTED_2024_04_17_Navaux_1m.m4a"
fi

# Create the results directory if it doesn't exist
mkdir -p "$SCRIPT_DIR/../results"

# Process command line arguments
VERBOSE=""
CHECK_ONLY=""

# Parse command line arguments
for arg in "$@"; do
  case $arg in
    --check)
      CHECK_ONLY="--check"
      shift
      ;;
    --verbose|-v)
      VERBOSE="--verbose"
      shift
      ;;
    --setup)
      # Just pass the setup flag to the Python script
      python3 "$SCRIPT_DIR/test_modal_roundtrip.py" --setup
      exit 0
      ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --verbose, -v    Enable verbose logging"
      echo "  --check          Only check Modal connection"
      echo "  --setup          Run Modal setup (token creation)"
      echo "  --help, -h       Show this help message"
      echo ""
      exit 0
      ;;
  esac
done

# If only checking connection
if [ -n "$CHECK_ONLY" ]; then
    echo "🔍 Checking Modal connection..."
    which_python=$(which python)
    echo "Using Python: $which_python"
    $which_python "$SCRIPT_DIR/test_modal_roundtrip.py" --check $VERBOSE
    exit $?
fi

# Check if the audio file exists
if [ ! -f "$AUDIO_FILE" ]; then
    echo "❌ Error: Audio file not found at $AUDIO_FILE"
    exit 1
fi

echo "🚀 Running Modal audio processing test"
echo "🎵 Audio file: $AUDIO_FILE"

# Run the test script using the same Python that has Modal installed
which_python=$(which python)
echo "Using Python: $which_python"
$which_python "$SCRIPT_DIR/test_modal_roundtrip.py" $VERBOSE "$AUDIO_FILE"

# Check if the test was successful
if [ $? -eq 0 ]; then
    echo "✅ Test completed successfully!"
    echo "📊 Results can be found in the results directory"
else
    echo "❌ Test failed. See error messages above."
    
    # Offer helpful suggestions
    echo ""
    echo "Troubleshooting suggestions:"
    echo "1. Try running with --verbose for more detailed logs:"
    echo "   $0 --verbose"
    echo ""
    echo "2. Check your Modal connection:"
    echo "   $0 --check"
    echo ""
    echo "3. Refresh your Modal token:"
    echo "   modal token new"
    echo ""
    echo "4. Make sure Modal service is up:"
    echo "   Visit https://status.modal.com"
fi