#!/bin/bash
# Script to extract text from an audio file using Modal

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"
AUDIO_FILE="$REPO_ROOT/file_types/m4a/INGESTED_2024_04_17_Navaux_1m.m4a"

# Create the results directory if it doesn't exist
mkdir -p "$SCRIPT_DIR/../results"

# Process command line arguments
VERBOSE=""
CHECK_ONLY=""
OUTPUT_PATH=""

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
    --output=*|-o=*)
      OUTPUT_PATH="--output=${arg#*=}"
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --verbose, -v       Enable verbose logging"
      echo "  --check             Only check Modal connection"
      echo "  --output=PATH, -o=PATH  Specify output path for transcript"
      echo "  --help, -h          Show this help message"
      echo ""
      exit 0
      ;;
  esac
done

# Make the script executable
chmod +x "$SCRIPT_DIR/extract_audio_text.py"

# If only checking connection
if [ -n "$CHECK_ONLY" ]; then
    echo "🔍 Checking Modal connection..."
    which_python=$(which python)
    echo "Using Python: $which_python"
    $which_python "$SCRIPT_DIR/extract_audio_text.py" --check $VERBOSE
    exit $?
fi

# Check if the audio file exists
if [ ! -f "$AUDIO_FILE" ]; then
    echo "❌ Error: Audio file not found at $AUDIO_FILE"
    exit 1
fi

echo "🎙️ Extracting text from audio file"
echo "🎵 Audio file: $AUDIO_FILE"

# Run the extraction script
which_python=$(which python)
echo "Using Python: $which_python"
echo "⏱️ Starting transcription (will timeout after 90 seconds on Modal's side)..."
$which_python "$SCRIPT_DIR/extract_audio_text.py" $VERBOSE $OUTPUT_PATH "$AUDIO_FILE"

# Check if the extraction was successful
if [ $? -eq 0 ]; then
    echo "✅ Text extraction completed successfully!"
    echo "📝 Results can be found in the results directory"
else
    echo "❌ Text extraction failed. See error messages above."
    
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