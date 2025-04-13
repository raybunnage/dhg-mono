#!/usr/bin/env python3
"""
Parallel Audio Transcription with Multiple T4 GPUs

This script demonstrates parallel processing using 3 T4 GPUs with the medium Whisper model.
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

# Create the Modal app
app = modal.App("parallel-transcript")

# Define a container image with Whisper and ffmpeg
image = (
    modal.Image.debian_slim()
    .apt_install(["ffmpeg"])
    .pip_install("numpy", "torch", "torchaudio", "openai-whisper")
)

# Create a volume to cache the model weights
volume = modal.Volume.from_name("whisper-models-vol", create_if_missing=True)

@app.function(
    gpu="T4", 
    timeout=120,  # 2 minutes max
    image=image,
    volumes={"/root/.cache/whisper": volume},
    max_containers=3  # Parallel processing with up to 3 containers
)
def transcribe_segment(audio_data: bytes, segment_id: int = 0) -> dict:
    """
    Transcribe an audio segment using the medium Whisper model
    """
    import tempfile
    import whisper
    import os
    import torch
    import time
    
    process_start = time.time()
    print(f"Starting transcription of segment {segment_id}")
    print(f"CUDA available: {torch.cuda.is_available()}")
    
    # Get GPU info if available
    if torch.cuda.is_available():
        device_info = {
            "name": torch.cuda.get_device_name(0),
            "memory": f"{torch.cuda.get_device_properties(0).total_memory / (1024**3):.2f} GB"
        }
        print(f"Using GPU: {device_info['name']} with {device_info['memory']} memory")
    
    # Save to a temporary file
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
        temp_file.write(audio_data)
        temp_path = temp_file.name
    
    try:
        # Load the model (medium for better quality)
        print(f"Loading Whisper medium model (segment {segment_id})...")
        model = whisper.load_model("medium")
        
        # Transcribe
        print(f"Transcribing segment {segment_id}...")
        result = model.transcribe(temp_path)
        
        processing_time = time.time() - process_start
        print(f"Segment {segment_id} completed in {processing_time:.2f} seconds")
        
        # Return the transcript and metadata
        return {
            "segment_id": segment_id,
            "text": result["text"],
            "processing_time": processing_time,
            "gpu": device_info if torch.cuda.is_available() else {"name": "CPU"}
        }
    finally:
        # Clean up
        if os.path.exists(temp_path):
            os.unlink(temp_path)

def split_audio_locally(audio_path: str, num_segments: int = 3):
    """
    Split an audio file into segments locally
    """
    import subprocess
    import tempfile
    import os
    
    print(f"Splitting audio file into {num_segments} segments...")
    
    # Create a temp directory for segments
    temp_dir = tempfile.mkdtemp()
    
    try:
        # Get duration using ffprobe
        duration_cmd = [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", audio_path
        ]
        duration = float(subprocess.check_output(duration_cmd).decode().strip())
        print(f"Audio duration: {duration:.2f} seconds")
        
        # Calculate segment length
        segment_length = duration / num_segments
        print(f"Each segment will be approximately {segment_length:.2f} seconds")
        
        # Create segments
        segments = []
        for i in range(num_segments):
            start_time = i * segment_length
            segment_path = os.path.join(temp_dir, f"segment_{i}.wav")
            
            # Use ffmpeg to extract segment
            cmd = [
                "ffmpeg", "-y", "-i", audio_path,
                "-ss", str(start_time),
                "-t", str(segment_length),
                "-c:a", "pcm_s16le",  # Use WAV format for compatibility
                segment_path
            ]
            subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            
            # Read the segment
            with open(segment_path, "rb") as f:
                segment_data = f.read()
            
            segments.append((segment_data, i))
            print(f"Segment {i}: {len(segment_data) / 1024:.2f} KB")
        
        return segments
    finally:
        # Clean up temp directory
        for file in os.listdir(temp_dir):
            os.unlink(os.path.join(temp_dir, file))
        os.rmdir(temp_dir)

def main():
    if len(sys.argv) < 2:
        print("Usage: python parallel_transcript.py <audio_file>")
        sys.exit(1)
        
    audio_path = sys.argv[1]
    if not os.path.exists(audio_path):
        print(f"Error: File not found: {audio_path}")
        sys.exit(1)
        
    print(f"Processing: {audio_path}")
    start_time = time.time()
    
    # Split the audio file locally into segments
    segments = split_audio_locally(audio_path, num_segments=3)
    print(f"Split into {len(segments)} segments")
    
    # Process segments in parallel on Modal
    with app.run():
        print("Connected to Modal, starting parallel processing with medium model...")
        
        # Launch transcription tasks in parallel
        futures = []
        for segment_data, segment_id in segments:
            print(f"Launching segment {segment_id} ({len(segment_data) / 1024:.2f} KB)")
            future = transcribe_segment.remote(audio_data=segment_data, segment_id=segment_id)
            futures.append((segment_id, future))
        
        # Collect and process results
        print("Processing segments in parallel...")
        results = []
        for segment_id, future in futures:
            print(f"Waiting for segment {segment_id}...")
            result = future
            results.append(result)
            print(f"Segment {segment_id} complete")
        
    # Sort results by segment_id
    results.sort(key=lambda x: x["segment_id"])
    
    # Combine transcriptions
    full_transcript = " ".join(result["text"] for result in results)
    
    # Calculate processing stats
    total_time = time.time() - start_time
    processing_times = [result["processing_time"] for result in results]
    
    # Print results
    print("\n" + "="*80)
    print("PARALLEL TRANSCRIPTION RESULTS (MEDIUM MODEL):")
    print("-"*80)
    print(full_transcript)
    print("-"*80)
    print(f"Processing stats:")
    print(f"  GPU: {results[0]['gpu']['name'] if 'gpu' in results[0] else 'Unknown'}")
    print(f"  Segments: {len(results)}")
    print(f"  Segment processing times: {', '.join(f'{t:.2f}s' for t in processing_times)}")
    print(f"  Average segment time: {sum(processing_times)/len(processing_times):.2f} seconds")
    print(f"  Max segment time: {max(processing_times):.2f} seconds")
    print(f"  Total round-trip time: {total_time:.2f} seconds")
    print("="*80)
    
    # Save transcript to file
    output_dir = "results"
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, os.path.splitext(os.path.basename(audio_path))[0] + "_parallel_medium.txt")
    
    with open(output_path, "w") as f:
        f.write(full_transcript)
    
    print(f"Transcript saved to: {output_path}")

if __name__ == "__main__":
    main()