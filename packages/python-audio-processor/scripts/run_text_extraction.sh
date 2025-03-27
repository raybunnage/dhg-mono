#!/bin/bash
# Script to extract text from an audio file using Modal with parallel A10G GPUs
# This version specifically targets the 10-minute audio file with the medium Whisper model

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"
AUDIO_FILE="$REPO_ROOT/file_types/m4a/INGESTED_2024_04_17_Navaux_10m.m4a"
RESULTS_DIR="$SCRIPT_DIR/../results"

# Create the results directory if it doesn't exist
mkdir -p "$RESULTS_DIR"

# Process command line arguments
VERBOSE=""
CHECK_ONLY=""
OUTPUT_PATH=""
SEGMENTS="6"  # Default to 6 smaller segments to prevent timeouts

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    --check)
      CHECK_ONLY="--check"
      shift
      ;;
    --verbose|-v)
      VERBOSE="--verbose"
      shift
      ;;
    --output=*|-o=*)
      OUTPUT_PATH="--output=${key#*=}"
      shift
      ;;
    --output|-o)
      OUTPUT_PATH="--output=$2"
      shift
      shift
      ;;
    --segments=*|-s=*)
      SEGMENTS="--segments=${key#*=}"
      shift
      ;;
    --segments|-s)
      SEGMENTS="--segments=$2"
      shift
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "This script processes the 10-minute audio file (INGESTED_2024_04_17_Navaux_10m.m4a)"
      echo "using the Whisper medium model and 3 A10G GPUs in parallel."
      echo ""
      echo "Options:"
      echo "  --verbose, -v            Enable verbose logging"
      echo "  --check                  Only check Modal connection"
      echo "  --output PATH, -o PATH   Specify output path for transcript"
      echo "  --segments N, -s N       Number of segments to split audio into (default: 6)"
      echo "  --help, -h               Show this help message"
      echo ""
      exit 0
      ;;
    *)
      # Unknown option
      echo "Unknown option: $key"
      echo "Run '$0 --help' for usage information"
      exit 1
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

# Check if Modal is installed
check_modal_installation() {
    # Detect Python path
    which_python=$(which python)
    
    # Check if modal is installed
    if $which_python -m pip list | grep -q "modal"; then
        echo "✅ Modal is installed"
    else
        echo "❌ Modal is not installed"
        read -p "Would you like to install Modal now? (y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "📦 Installing Modal..."
            $which_python -m pip install modal
            
            # Verify the installation was successful
            if $which_python -m pip list | grep -q "modal"; then
                echo "✅ Modal installed successfully!"
            else
                echo "❌ Failed to install Modal. Please install it manually and try again."
                exit 1
            fi
        else
            echo "❌ Modal is required to run this script. Exiting."
            exit 1
        fi
    fi
}

# Check Modal installation
check_modal_installation

# Check if the audio file exists
if [ ! -f "$AUDIO_FILE" ]; then
    echo "❌ Error: Audio file not found at $AUDIO_FILE"
    exit 1
fi

echo "🎛️ A10G GPU Audio Processing with Medium Model"
echo "🎵 Audio file: $AUDIO_FILE"
echo "📂 Results will be saved to: $RESULTS_DIR"

# Run the extraction script
which_python=$(which python)
echo "Using Python: $which_python"
echo "⏱️ Starting parallel transcription with 6 A10G GPUs and medium model..."

# Determine the output path if not specified
if [ -z "$OUTPUT_PATH" ]; then
    OUTPUT_PATH="--output=$RESULTS_DIR/INGESTED_2024_04_17_Navaux_10m_medium_parallel.txt"
fi

# Make sure the segments parameter is properly formatted
if [[ "$SEGMENTS" != "--segments="* ]]; then
    SEGMENTS="--segments=6"  # Default to 6 segments for better processing
fi

# Print the command for debugging
echo "DEBUG: Running command: $which_python $SCRIPT_DIR/extract_audio_text.py $VERBOSE $OUTPUT_PATH $SEGMENTS \"$AUDIO_FILE\""

# Run the command with properly formatted arguments
$which_python "$SCRIPT_DIR/extract_audio_text.py" $VERBOSE $OUTPUT_PATH $SEGMENTS "$AUDIO_FILE"

# Check if the extraction was successful
if [ $? -eq 0 ]; then
    echo "✅ Text extraction completed successfully!"
    echo "📝 Results saved to the results directory"
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
    echo "3. Check your Modal version:"
    echo "   pip show modal"
    echo ""
    echo "4. Refresh your Modal token:"
    echo "   modal token new"
    echo ""
    echo "5. Make sure Modal service is up:"
    echo "   Visit https://status.modal.com"
fi