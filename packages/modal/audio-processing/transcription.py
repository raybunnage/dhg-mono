#!/usr/bin/env python3
"""
Audio Transcription with Modal using Whisper models

This module provides transcription capabilities using various Whisper models.
"""

import os
import sys
import time
import json
from pathlib import Path
from typing import Dict, Any, Optional

import modal

# Create a Modal app
app = modal.App("audio-transcription")

# Define the image with necessary dependencies
image = (
    modal.Image.debian_slim()
    .apt_install(["ffmpeg"])
    .pip_install("numpy", "torch", "torchaudio", "openai-whisper")
)

@app.function(gpu="T4", timeout=600, image=image)
def transcribe_audio(
    audio_data: bytes, 
    model_name: str = "base",
    language: Optional[str] = None
) -> Dict[str, Any]:
    """Transcribe audio using Whisper model
    
    Args:
        audio_data: Raw audio bytes
        model_name: Whisper model size ("tiny", "base", "small", "medium", "large")
        language: Optional language code for better results with non-English audio
        
    Returns:
        Dictionary with transcription results
    """
    import tempfile
    import whisper
    import torch
    import os
    
    print(f"Starting transcription with {model_name} model")
    print(f"CUDA available: {torch.cuda.is_available()}")
    print(f"Audio data size: {len(audio_data) / (1024 * 1024):.2f} MB")
    
    # Save to a temporary file
    with tempfile.NamedTemporaryFile(suffix=".m4a", delete=False) as temp_file:
        temp_file.write(audio_data)
        temp_path = temp_file.name
    
    try:
        print(f"Saved to temporary file: {temp_path}")
        
        # Load the specified model
        print(f"Loading Whisper {model_name} model...")
        model = whisper.load_model(model_name)
        
        # Set up transcription options
        options = {}
        if language:
            options["language"] = language
        
        # Transcribe
        print("Starting transcription...")
        start_time = time.time()
        result = model.transcribe(temp_path, **options)
        transcription_time = time.time() - start_time
        print(f"Transcription complete in {transcription_time:.2f} seconds!")
        
        # Add metadata to result
        result["processing_metadata"] = {
            "model": model_name,
            "processing_time": transcription_time,
            "processing_timestamp": time.time(),
            "cuda_available": torch.cuda.is_available()
        }
        
        return result
    finally:
        # Clean up
        if os.path.exists(temp_path):
            os.unlink(temp_path)

def main():
    """Simple CLI for testing transcription"""
    if len(sys.argv) < 2:
        print("Usage: python transcription.py <audio_file_path> [model_name]")
        sys.exit(1)
        
    audio_path = sys.argv[1]
    model_name = sys.argv[2] if len(sys.argv) > 2 else "base"
    
    if not os.path.exists(audio_path):
        print(f"Error: File not found: {audio_path}")
        sys.exit(1)
        
    print(f"Processing: {audio_path} with {model_name} model")
    start_time = time.time()
    
    # Read the audio file
    with open(audio_path, 'rb') as f:
        audio_data = f.read()
    
    print(f"Audio file size: {len(audio_data) / (1024 * 1024):.2f} MB")
    
    # Run on Modal
    with app.run():
        print("Connected to Modal, starting transcription...")
        result = transcribe_audio.remote(audio_data=audio_data, model_name=model_name)
    
    total_time = time.time() - start_time
    
    # Print results
    print("\n" + "="*80)
    print("TRANSCRIPTION RESULTS:")
    print("-"*80)
    print(result["text"])
    print("-"*80)
    print(f"Total processing time: {total_time:.2f} seconds")
    
    # Save to file
    output_dir = "results"
    os.makedirs(output_dir, exist_ok=True)
    
    base_name = os.path.basename(audio_path).rsplit(".", 1)[0]
    output_path = os.path.join(output_dir, f"{base_name}_{model_name}_transcript.txt")
    json_path = os.path.join(output_dir, f"{base_name}_{model_name}_transcript.json")
    
    with open(output_path, "w") as f:
        f.write(result["text"])
    
    with open(json_path, "w") as f:
        json.dump(result, f, indent=2)
    
    print(f"Transcript saved to: {output_path}")
    print(f"Full results saved to: {json_path}")

if __name__ == "__main__":
    main()