#!/usr/bin/env python3
"""
Audio Transcription Test with Modal using Base Whisper Model

This script transcribes audio using the base Whisper model for better quality.
"""

import os
import sys
import time
import json
from pathlib import Path

# Try to import Modal
try:
    import modal
    print(f"Modal version: {modal.__version__}")
except ImportError:
    print("Modal not installed. Please install with: pip install modal")
    sys.exit(1)

# Create a simple app
app = modal.App("base-transcript")

# Define a simple image
image = (
    modal.Image.debian_slim()
    .apt_install(["ffmpeg"])
    .pip_install("numpy", "torch", "torchaudio", "openai-whisper")
)

# Define global transcribe functions for different accelerators
@app.function(timeout=600, image=image)
def transcribe_cpu(audio_data: bytes) -> str:
    return transcribe_implementation(audio_data)

@app.function(gpu="T4", timeout=300, image=image)
def transcribe_t4(audio_data: bytes) -> str:
    return transcribe_implementation(audio_data)

@app.function(gpu="A10G", timeout=300, image=image)
def transcribe_a10g(audio_data: bytes) -> str:
    return transcribe_implementation(audio_data)

@app.function(gpu="A100", timeout=300, image=image)
def transcribe_a100(audio_data: bytes) -> str:
    return transcribe_implementation(audio_data)

def get_transcribe_function(accelerator: str = "T4"):
    """Return the appropriate transcribe function based on accelerator"""
    if accelerator == "CPU":
        return transcribe_cpu
    elif accelerator == "A10G":
        return transcribe_a10g
    elif accelerator == "A100":
        return transcribe_a100
    else:  # Default to T4
        return transcribe_t4

def transcribe_implementation(audio_data: bytes) -> str:
    """A transcription function that uses the base model for better quality"""
    import tempfile
    import whisper
    import os
    import torch
    
    print("Starting transcription")
    print(f"CUDA available: {torch.cuda.is_available()}")
    print(f"Audio data size: {len(audio_data) / 1024:.2f} KB")
    
    # Save to a temporary file
    with tempfile.NamedTemporaryFile(suffix=".m4a", delete=False) as temp_file:
        temp_file.write(audio_data)
        temp_path = temp_file.name
    
    try:
        print(f"Saved to temporary file: {temp_path}")
        
        # Load the base model for better quality
        print("Loading Whisper base model...")
        model = whisper.load_model("base")
        
        # Transcribe
        print("Starting transcription...")
        result = model.transcribe(temp_path)
        print("Transcription complete!")
        
        # Return just the text
        return result["text"]
    finally:
        # Clean up
        if os.path.exists(temp_path):
            os.unlink(temp_path)

def main():
    import argparse
    
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Transcribe audio using Whisper")
    parser.add_argument("audio_path", help="Path to the audio file")
    parser.add_argument("output_path", nargs="?", help="Path to save the transcript")
    parser.add_argument("--accelerator", default="T4", choices=["T4", "A10G", "A100", "CPU"],
                       help="GPU accelerator to use (default: T4)")
    
    args = parser.parse_args()
    
    audio_path = args.audio_path
    if not os.path.exists(audio_path):
        print(f"Error: File not found: {audio_path}")
        sys.exit(1)
    
    # Get optional output path
    output_path = args.output_path
        
    print(f"Processing: {audio_path}")
    start_time = time.time()
    
    # Read the audio file
    with open(audio_path, 'rb') as f:
        audio_data = f.read()
    
    print(f"Audio file size: {len(audio_data) / 1024:.2f} KB")
    
    # Get selected accelerator
    accelerator = args.accelerator
    print(f"Using accelerator: {accelerator}")
    
    # Run on Modal
    with app.run():
        print(f"Connected to Modal, starting transcription with {accelerator} accelerator...")
        transcribe_func = get_transcribe_function(accelerator)
        transcript = transcribe_func.remote(audio_data=audio_data)
    
    total_time = time.time() - start_time
    
    # Print results
    print("\n" + "="*80)
    print("TRANSCRIPTION RESULTS:")
    print("-"*80)
    print(transcript)
    print("-"*80)
    print(f"Total processing time: {total_time:.2f} seconds")
    
    # Save to file
    if output_path:
        # Use provided output path
        output_file = output_path
    else:
        # Create default output path
        output_dir = "results"
        os.makedirs(output_dir, exist_ok=True)
        base_name = os.path.basename(audio_path).rsplit(".", 1)[0]
        output_file = os.path.join(output_dir, f"{base_name}_base_transcript.txt")
    
    # Create output directory if it doesn't exist
    os.makedirs(os.path.dirname(os.path.abspath(output_file)), exist_ok=True)
    
    with open(output_file, "w") as f:
        f.write(transcript)
    
    print(f"Transcript saved to: {output_file}")
    
    # Also print the transcript to stdout for capturing by caller
    print("\nTRANSCRIPT_BEGIN")
    print(transcript)
    print("TRANSCRIPT_END")

if __name__ == "__main__":
    main()