#!/usr/bin/env python3
"""
Audio Text Extraction - Quick Audio Transcription with Modal

This script extracts text from an audio file using Modal and Whisper.
It uploads a file to Modal, processes it with a T4 GPU, and returns 
the transcription within 90 seconds.

Uses Modal API v0.73+
"""

import os
import sys
import time
import json
import logging
import argparse
from pathlib import Path
from typing import Dict, Any, List, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("modal-transcribe")

# Try to import Modal
try:
    import modal
    logger.info(f"Modal version: {modal.__version__}")
    logger.info(f"Modal path: {modal.__file__}")
except ImportError:
    logger.error("Modal not installed. Please install with: pip install modal")
    print("❌ Error: Modal not installed. Please install with: pip install modal")
    sys.exit(1)

# Define the Modal app
app = modal.App("audio-transcription")

# Define a container image with all required dependencies
image = (
    modal.Image.debian_slim()
    .apt_install(["ffmpeg"])
    .pip_install(
        "numpy",
        "torch",
        "torchaudio",
        "faster-whisper==0.10.0"
    )
)

@app.function(gpu="T4", timeout=90, image=image)
def transcribe_audio(audio_data: bytes) -> Dict[str, Any]:
    """
    Transcribe audio using Whisper.
    This function will run on a T4 GPU in the cloud.
    """
    import tempfile
    import time
    import json
    import numpy as np
    import torch
    import torchaudio
    from faster_whisper import WhisperModel
    
    print("Starting audio transcription on Modal...")
    start_time = time.time()
    
    # Create a temporary file to store the audio data
    with tempfile.NamedTemporaryFile(suffix=".m4a", delete=False) as temp_file:
        temp_file.write(audio_data)
        temp_path = temp_file.name
    
    try:
        print(f"Audio data received ({len(audio_data) / 1024:.2f} KB)")
        
        # Print environment info
        print(f"Python version: {sys.version}")
        print(f"PyTorch version: {torch.__version__}")
        
        # Check for GPU
        if torch.cuda.is_available():
            print(f"CUDA available: {torch.cuda.is_available()}")
            print(f"CUDA device: {torch.cuda.get_device_name(0)}")
            print(f"CUDA version: {torch.version.cuda}")
        else:
            print("CUDA not available")
        
        # Load the audio file with torchaudio to get basic info
        print("Loading audio file...")
        waveform, sample_rate = torchaudio.load(temp_path)
        
        duration = waveform.shape[1] / sample_rate
        print(f"Audio duration: {duration:.2f} seconds")
        
        # Initialize Whisper model
        print("Initializing Whisper model...")
        # Get optimal device settings
        device = "cuda" if torch.cuda.is_available() else "cpu"
        compute_type = "float16" if device == "cuda" else "float32"
        
        # Use tiny model for fastest processing
        model_size = "tiny"
        model = WhisperModel(
            model_size,
            device=device,
            compute_type=compute_type,
            download_root=".models"
        )
        
        # Transcribe audio
        print(f"Transcribing audio with Whisper {model_size} model...")
        segments, info = model.transcribe(
            temp_path,
            beam_size=5,
            language="en",
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500)
        )
        
        # Process segments
        segments_list = list(segments)
        print(f"Found {len(segments_list)} segments")
        
        # Extract text from segments
        transcript_text = ""
        segments_data = []
        
        for segment in segments_list:
            segments_data.append({
                "start": segment.start,
                "end": segment.end,
                "text": segment.text
            })
            transcript_text += segment.text + " "
        
        # Get GPU information
        gpu_info = {}
        if torch.cuda.is_available():
            gpu_info = {
                "device_name": torch.cuda.get_device_name(0),
                "device_capability": ".".join(map(str, torch.cuda.get_device_capability(0))),
                "total_memory": f"{torch.cuda.get_device_properties(0).total_memory / (1024**3):.2f} GB"
            }
        else:
            gpu_info = {"status": "No GPU detected"}
        
        # Prepare the result
        result = {
            "metadata": {
                "processing_time": time.time() - start_time,
                "gpu_used": torch.cuda.is_available(),
                "gpu_info": gpu_info,
                "model": model_size,
                "language": info.language,
                "language_probability": info.language_probability
            },
            "audio_properties": {
                "duration": duration,
                "sample_rate": sample_rate,
                "channels": waveform.shape[0],
            },
            "transcript": {
                "text": transcript_text.strip(),
                "segments": segments_data
            }
        }
        
        print(f"Transcription completed in {time.time() - start_time:.2f} seconds")
        return result
    
    finally:
        # Clean up the temporary file
        if os.path.exists(temp_path):
            os.unlink(temp_path)

def check_modal_connection():
    """Verify that we can connect to Modal"""
    print("🔍 Checking Modal connection...")
    
    try:
        # Simple connection test
        with modal.App().run():
            print("✅ Successfully connected to Modal!")
            return True
    except Exception as e:
        print(f"❌ Could not connect to Modal: {str(e)}")
        print("\nTroubleshooting steps:")
        print("1. Run 'modal token new' to refresh your token")
        print("2. Check your internet connection")
        print("3. Visit https://status.modal.com to check for service issues")
        return False

def main():
    parser = argparse.ArgumentParser(
        description="Extract text from audio file using Modal and Whisper"
    )
    parser.add_argument(
        "audio_path", 
        help="Path to the audio file (M4A format recommended)",
        nargs="?",  # Make audio_path optional
        default=None
    )
    parser.add_argument(
        "--verbose", "-v", 
        action="store_true",
        help="Enable verbose logging"
    )
    parser.add_argument(
        "--check", 
        action="store_true",
        help="Check Modal connection only"
    )
    parser.add_argument(
        "--output", "-o",
        help="Output path for the transcript (default: [input_filename]_transcript.txt)",
        default=None
    )
    
    args = parser.parse_args()
    
    # Make sure audio_path is required unless --check is specified
    if args.audio_path is None and not args.check:
        parser.error("audio_path is required unless --check is specified")
    
    # Set verbose logging if requested
    if args.verbose:
        logger.setLevel(logging.DEBUG)
        logger.debug("Verbose logging enabled")
        
        # Enable Modal debug logs
        modal_logger = logging.getLogger("modal")
        modal_logger.setLevel(logging.DEBUG)
        
        # Add a handler if none exists
        if not modal_logger.handlers:
            handler = logging.StreamHandler()
            handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
            modal_logger.addHandler(handler)
        
    if args.check:
        check_modal_connection()
        return
    
    audio_path = args.audio_path
    if not os.path.exists(audio_path):
        print(f"❌ Error: Audio file not found: {audio_path}")
        sys.exit(1)
    
    # First check Modal connection
    if not check_modal_connection():
        print("⚠️ Modal connection check failed. Proceeding anyway, but this may fail.")
    
    print(f"🎯 Processing {audio_path} with Modal...")
    logger.debug(f"Audio path: {os.path.abspath(audio_path)}")
    
    try:
        # Read the audio file as bytes
        with open(audio_path, 'rb') as f:
            audio_data = f.read()
        
        file_size_mb = len(audio_data) / (1024*1024)
        print(f"📤 Uploading audio file ({file_size_mb:.2f} MB) to Modal...")
        logger.debug(f"Audio file size: {len(audio_data)} bytes")
        
        # Start timing
        start_time = time.time()
        
        # Connect to Modal and run the function
        print("🚀 Connecting to Modal cloud service...")
        logger.debug("Initializing Modal app run")
        
        try:
            # Call the remote function
            with app.run():
                print("\n🔄 Connected to Modal, transcribing audio with Whisper...")
                logger.debug("Modal connection established, starting transcription")
                
                # Set a timeout to make sure we don't exceed 90 seconds
                print("⏳ Starting transcription (max time: 90 seconds)...")
                result = transcribe_audio.remote(audio_data=audio_data)
                logger.debug("Transcription completed")
        except KeyboardInterrupt:
            print("\n⚠️ Process interrupted by user. Exiting...")
            sys.exit(1)
        except Exception as e:
            logger.exception("Error during Modal execution")
            print(f"\n❌ Error connecting to Modal: {str(e)}")
            print("Try running 'modal token new' to refresh your token")
            sys.exit(1)
        
        # Processing complete
        print("✅ Transcription complete, retrieving results...")
        
        # Calculate total time
        total_time = time.time() - start_time
        
        # Extract results
        processing_time = result.get("metadata", {}).get("processing_time", 0)
        transcript_text = result.get("transcript", {}).get("text", "")
        language = result.get("metadata", {}).get("language", "unknown")
        language_prob = result.get("metadata", {}).get("language_probability", 0)
        
        # Determine output path
        if args.output:
            output_path = args.output
        else:
            # Create a results directory if it doesn't exist
            output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "results")
            os.makedirs(output_dir, exist_ok=True)
            
            # Save to results directory
            base_name = os.path.splitext(os.path.basename(audio_path))[0]
            output_path = os.path.join(output_dir, f"{base_name}_transcript.txt")
            
            # Also save full JSON result
            json_path = os.path.join(output_dir, f"{base_name}_transcript.json") 
            with open(json_path, 'w') as f:
                json.dump(result, f, indent=2)
            
            print(f"📊 Full results saved to: {json_path}")
        
        # Save transcript to file
        with open(output_path, 'w') as f:
            f.write(transcript_text)
        
        # Print a nicely formatted result
        print("\n" + "="*80)
        print("Audio Transcription Results:")
        print("-"*80)
        print(f"Duration: {result.get('audio_properties', {}).get('duration', 0):.2f} seconds")
        print(f"Detected Language: {language} (confidence: {language_prob:.2f})")
        print("-"*80)
        print("Transcript Preview:")
        print("-"*80)
        preview_length = min(500, len(transcript_text))
        print(transcript_text[:preview_length] + ("..." if len(transcript_text) > preview_length else ""))
        print("-"*80)
        print("Performance:")
        print(f"Processing Time: {processing_time:.2f} seconds")
        print(f"Total Round Trip: {total_time:.2f} seconds")
        print(f"Speed: {result.get('audio_properties', {}).get('duration', 0)/processing_time:.2f}x realtime")
        print("="*80 + "\n")
        
        print(f"✅ Transcript saved to: {output_path}")
        
    except Exception as e:
        logger.exception("Unexpected error")
        print(f"\n❌ Error processing audio: {str(e)}")
        import traceback
        traceback.print_exc()
        
        print("\nTroubleshooting steps:")
        print("1. Check your internet connection")
        print("2. Try running 'modal token new' to refresh your token")
        print("3. Check if Modal is experiencing issues: https://status.modal.com")
        sys.exit(1)

if __name__ == "__main__":
    main()