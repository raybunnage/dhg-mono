#!/bin/bash

# Script to generate a summary of the first 10 minutes of an audio file using Modal and Whisper
# Usage: ./modal_audio_summarize.sh <path_to_audio_file> [output_directory] [--clip]
#
# The --clip option will automatically clip the audio file to 10 minutes before processing
# This can significantly reduce upload time for large files

set -e

# Store original directory and script directory
ORIGINAL_DIR="$(pwd)"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Parse arguments
AUDIO_FILE=""
OUTPUT_DIR="/Users/raybunnage/Documents/github/dhg-mono/file_types/summaries"
CLIP_AUDIO=false
CLIP_MINUTES=10
USE_LOCAL=false

# Process arguments
for arg in "$@"; do
    if [[ "$arg" == "--clip" ]]; then
        CLIP_AUDIO=true
    elif [[ "$arg" == "--local" ]]; then
        USE_LOCAL=true
    elif [[ "$arg" == "--minutes="* ]]; then
        CLIP_MINUTES="${arg#*=}"
    elif [[ -z "$AUDIO_FILE" && "$arg" != --* ]]; then
        AUDIO_FILE="$arg"
    elif [[ "$arg" != --* ]]; then
        OUTPUT_DIR="$arg"
    fi
done

# If no audio file provided, use default
if [[ -z "$AUDIO_FILE" ]]; then
    AUDIO_FILE="/Users/raybunnage/Documents/github/dhg-mono/file_types/m4a/INGESTED_2024_04_17_Navaux_10m.m4a"
fi

# Check if an audio file was provided or if we're using the default
if [ -z "$AUDIO_FILE" ]; then
    echo "❌ Error: No audio file provided."
    echo "Usage: ./modal_audio_summarize.sh input_file.m4a output_directory --clip --minutes=X"
    echo ""
    echo "Arguments:"
    echo "  input_file.m4a    Path to audio file to process"
    echo "  output_directory  (Optional) Directory to save results"
    echo ""
    echo "Options:"
    echo "  --clip            (Optional) Clip audio before processing"
    echo "                    This can significantly reduce upload time for large files"
    echo "  --minutes=X       (Optional) Number of minutes to clip (default: 10)"
    echo "                    Only used with --clip option"
    echo "  --local           (Optional) Skip Modal and process locally"
    echo "                    This is faster but produces only placeholder output"
    exit 1
fi

# Convert relative path to absolute path
if [[ "$AUDIO_FILE" != /* ]]; then
    AUDIO_FILE="$(pwd)/$AUDIO_FILE"
fi

# Verify input file exists
if [ ! -f "$AUDIO_FILE" ]; then
    echo "Error: Input file not found: $AUDIO_FILE"
    exit 1
fi

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

# Get the base name of the audio file for output naming
BASENAME=$(basename -- "$AUDIO_FILE")
BASENAME="${BASENAME%.*}"
# Create a unique output name with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_BASENAME="${BASENAME}_modal_${TIMESTAMP}"

echo "🎧 Processing audio file: $AUDIO_FILE"
echo "📝 Output will be saved to: $OUTPUT_DIR/$OUTPUT_BASENAME.txt"

# Optionally clip the audio if requested
if [ "$CLIP_AUDIO" = true ]; then
    echo "✂️ Clipping audio to first $CLIP_MINUTES minutes to reduce upload size..."
    
    # Define clipped file path with new naming convention
    CLIPPED_FILE=$(dirname "$AUDIO_FILE")/$(basename "${AUDIO_FILE%.*}")_${CLIP_MINUTES}m.${AUDIO_FILE##*.}
    
    # Run the clip_audio script
    "$(dirname "$0")/clip_audio.sh" "$AUDIO_FILE" "$CLIPPED_FILE" "$CLIP_MINUTES"
    
    # Use the clipped file for further processing
    AUDIO_FILE="$CLIPPED_FILE"
    echo "🔄 Using clipped file for processing: $AUDIO_FILE"
fi

# Go to the python audio processor directory
cd /Users/raybunnage/Documents/github/dhg-mono/packages/python-audio-processor

# Check for virtual environment and activate if exists
if [ -d ".venv" ]; then
    echo "🐍 Activating virtual environment..."
    source .venv/bin/activate
fi

# Check if Modal is installed
if ! pip show modal &>/dev/null; then
    echo "⚙️ Installing Modal..."
    pip install modal
fi

# Check if Modal token is already set up
if ! modal status &>/dev/null; then
    echo "⚙️ Setting up Modal token (this will open a browser)..."
    modal token new
fi

# Run the summary command using Modal remote processing
echo "🚀 Sending to Modal for processing with T4 GPU ($0.80/hr - most cost-effective)..."

# Set an environment variable to indicate fallback method if needed
export MODAL_ALLOW_FALLBACK=1

# Check for existing Modal GPU instances
echo "🔍 Checking for existing Modal GPU instances..."
EXISTING_INSTANCES=$(modal apps list 2>/dev/null | grep -i "whisperx-summary-app" | grep -i "T4" | wc -l)
if [ "$EXISTING_INSTANCES" -gt 0 ]; then
    echo "⚠️ WARNING: There appears to be $EXISTING_INSTANCES existing Modal GPU instance(s) running!"
    echo "   This could result in unexpected charges. You may want to check your Modal dashboard."
    echo "   Press CTRL+C now if you want to cancel, or wait 5 seconds to continue..."
    sleep 5
    echo "▶️ Continuing with processing..."
fi

# Try to get a fresh Modal token if not already done
if [ "$MODAL_TOKEN_REFRESHED" != "true" ]; then
    echo "🔄 Using existing Modal token"
    export MODAL_TOKEN_REFRESHED=true
fi

# Check if we should use local processing instead of Modal
if [ "$USE_LOCAL" = true ]; then
    echo "🏠 Using local processing (skipping Modal)"
    echo "Note: This will not generate a high-quality transcription, just a placeholder"
    
    # Use the local processing script
    python "$SCRIPT_DIR/process_local.py" "$AUDIO_FILE" --output-dir "$OUTPUT_DIR"
    
    # Update the summary file path
    BASENAME=$(basename -- "$AUDIO_FILE" | sed 's/\.[^.]*$//')
    SUMMARY_FILE="$OUTPUT_DIR/${BASENAME}.txt"
    
    # Skip the rest of Modal processing
    if [ -f "$SUMMARY_FILE" ]; then
        echo "✅ Local processing complete"
        OUTPUT_FILE="$SUMMARY_FILE"
    else
        echo "❌ Local processing failed"
        exit 1
    fi
else
    # Set a maximum processing time to avoid excessive charges (3 minutes total)
    MAX_PROCESSING_TIME=180
    
    # Use the python script directly for better Modal compatibility
    cd /Users/raybunnage/Documents/github/dhg-mono/packages/python-audio-processor
    
    # Run the Python script with a timeout
    echo "⏱️ Setting maximum processing time to $MAX_PROCESSING_TIME seconds to avoid excessive charges"
    
    # Start the process and keep track of its PID
    python scripts/process_m4a_summary.py "$AUDIO_FILE" --output-dir "$OUTPUT_DIR" --model small &
    PROC_PID=$!
fi

if [ "$USE_LOCAL" != true ]; then
    # Create a temporary control file for kill switch
    CONTROL_FILE=$(mktemp)
    echo "running" > "$CONTROL_FILE"
    
    # Display instructions for the kill switch
    echo "💡 KILL SWITCH: Type Ctrl+C at any time to stop processing and avoid charges"
    
    # Handle SIGINT (Ctrl+C)
    trap "echo 'kill' > \"$CONTROL_FILE\"; echo ''; echo '⛔ User requested stop. Terminating process...'; kill -9 $PROC_PID 2>/dev/null; echo '⛔ Process terminated.'; rm \"$CONTROL_FILE\"; exit 1" INT
    
    # Monitor the process with a timeout
    SECONDS=0
    while kill -0 $PROC_PID 2>/dev/null; do
        # Check if the kill switch was activated
        if [ "$(cat "$CONTROL_FILE")" = "kill" ]; then
            echo ""
            echo "⛔ Kill switch activated. Cancelling processing."
            kill -9 $PROC_PID >/dev/null 2>&1
            sleep 1
            echo "⛔ Process terminated."
            rm "$CONTROL_FILE"
            exit 1
        fi
        
        # Check if we've exceeded the timeout
        if [ $SECONDS -gt $MAX_PROCESSING_TIME ]; then
            echo ""
            echo "⛔ Processing has exceeded the maximum time limit of $MAX_PROCESSING_TIME seconds!"
            echo "⛔ Cancelling to avoid excessive charges."
            kill -9 $PROC_PID >/dev/null 2>&1
            sleep 1
            echo "⛔ Process terminated to prevent excessive billing."
            rm "$CONTROL_FILE"
            exit 1
        fi
        
        # Wait a bit before checking again
        sleep 1
    done
    
    # Remove the control file
    rm "$CONTROL_FILE"
    # Reset the trap
    trap - INT
    
    # If we get here, the process completed normally
    wait $PROC_PID
    PROC_EXIT_CODE=$?
    
    # Check if the process exited with an error
    if [ $PROC_EXIT_CODE -ne 0 ]; then
        echo "⚠️ Modal processing encountered an error (exit code $PROC_EXIT_CODE)"
        echo ""
        echo "🔄 Falling back to local processing..."
        echo "This will not generate a high-quality transcription, but will create a placeholder file."
        
        # Fall back to local processing
        python "$SCRIPT_DIR/process_local.py" "$AUDIO_FILE" --output-dir "$OUTPUT_DIR"
        
        # Update the summary file path to what process_local.py would have created
        BASENAME=$(basename -- "$AUDIO_FILE" | sed 's/\.[^.]*$//')
        SUMMARY_FILE="$OUTPUT_DIR/${BASENAME}.txt"
    fi
fi

# Look for the summary file
SUMMARY_FILE="$OUTPUT_DIR/${BASENAME}.txt"

# Check for and clean up any zombie GPU instances
echo "🧹 Checking for zombie Modal instances to clean up..."
ZOMBIE_INSTANCES=$(modal apps list 2>/dev/null | grep -i "whisperx-summary-app" | grep -i "T4")
if [ -n "$ZOMBIE_INSTANCES" ]; then
    echo "🚨 Found the following Modal instances that might be using GPUs:"
    echo "$ZOMBIE_INSTANCES"
    echo "📊 These instances might incur charges. Do you want to stop them? (y/n)"
    read -t 10 CLEAN_ZOMBIES || CLEAN_ZOMBIES="n"
    
    if [ "$CLEAN_ZOMBIES" = "y" ]; then
        echo "🧹 Cleaning up zombie instances..."
        modal apps stop whisperx-summary-app
        echo "✅ Cleanup complete."
    else
        echo "⚠️ Not cleaning up instances. Be aware that they may continue to incur charges."
    fi
fi

if [ -f "$SUMMARY_FILE" ]; then
    echo "✅ Summary created successfully!"
    
    # Use the file we found rather than creating a new one
    OUTPUT_FILE="$SUMMARY_FILE"
    
    # Format the summary for better readability
    echo "🔄 Formatting summary..."
    TEMP_FILE="$OUTPUT_DIR/${OUTPUT_BASENAME}_temp.txt"
    
    # Read the summary file
    SUMMARY_TEXT=$(cat "$OUTPUT_FILE")
    
    # Use Python to format the text into readable paragraphs
    python -c "
import textwrap
import sys

# Read the summary text
summary = '''$SUMMARY_TEXT'''

# Format with nice text wrapping
formatted_text = textwrap.fill(summary, width=80)

# Output the formatted text
print(formatted_text)
" > "$TEMP_FILE"

    # Replace the summary with the formatted one
    mv "$TEMP_FILE" "$OUTPUT_FILE"
    
    echo "✨ Summary formatted and saved to: $OUTPUT_FILE"
    echo "📊 Summary content:"
    echo "========================================"
    head -n 20 "$OUTPUT_FILE"
    echo "... (truncated for display)"
    echo "========================================"
else
    echo "❌ Error: Summary file was not created!"
    exit 1
fi

# If we activated a virtual environment, deactivate it
if [ -n "$VIRTUAL_ENV" ]; then
    deactivate
fi

echo "✅ Process complete!"