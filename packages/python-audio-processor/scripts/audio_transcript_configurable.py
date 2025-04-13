#!/usr/bin/env python3
"""
Configurable Audio Transcription with Modal using Base Whisper Model

This script transcribes audio using the base Whisper model with configurable input file.
Results are saved to a file matching the input filename in the results directory.
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
app = modal.App("configurable-transcript")

# Define a simple image
image = (
    modal.Image.debian_slim()
    .apt_install(["ffmpeg"])
    .pip_install("numpy", "torch", "torchaudio", "openai-whisper")
)

@app.function(gpu="T4", timeout=300, image=image)
def transcribe_base(audio_data: bytes) -> str:
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
    if len(sys.argv) < 2:
        print("Usage: python audio_transcript_configurable.py <audio_file>")
        sys.exit(1)
        
    audio_path = sys.argv[1]
    if not os.path.exists(audio_path):
        print(f"Error: File not found: {audio_path}")
        sys.exit(1)
        
    print(f"Processing: {audio_path}")
    start_time = time.time()
    
    # Read the audio file
    with open(audio_path, 'rb') as f:
        audio_data = f.read()
    
    print(f"Audio file size: {len(audio_data) / 1024:.2f} KB")
    
    # Run on Modal
    with app.run():
        print("Connected to Modal, starting transcription...")
        transcript = transcribe_base.remote(audio_data=audio_data)
    
    total_time = time.time() - start_time
    
    # Print results
    print("\n" + "="*80)
    print("TRANSCRIPTION RESULTS:")
    print("-"*80)
    print(transcript)
    print("-"*80)
    print(f"Total processing time: {total_time:.2f} seconds")
    
    # Save to file
    output_dir = os.path.join(os.path.dirname(os.path.realpath(__file__)), "results")
    os.makedirs(output_dir, exist_ok=True)
    
    # Get base filename without extension
    base_filename = os.path.splitext(os.path.basename(audio_path))[0]
    output_path = os.path.join(output_dir, f"{base_filename}.txt")
    
    with open(output_path, "w") as f:
        f.write(transcript)
    
    print(f"Transcript saved to: {output_path}")

if __name__ == "__main__":
    main()