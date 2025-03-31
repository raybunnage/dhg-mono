#!/usr/bin/env python3
"""
Advanced Audio Transcription with Modal using Whisper with Summary

This script transcribes audio using Whisper and generates a summary.
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

# Create a Modal app
app = modal.App("advanced-transcript")

# Define a container image with all dependencies
image = (
    modal.Image.debian_slim()
    .apt_install(["ffmpeg"])
    .pip_install([
        "numpy", 
        "torch", 
        "torchaudio", 
        "openai-whisper", 
        "transformers",
        "sentencepiece"
    ])
)

@app.function(gpu="T4", timeout=500, image=image)
def transcribe_and_summarize(audio_data: bytes, model_size: str = "base") -> dict:
    """Transcribe audio and generate a summary"""
    import tempfile
    import whisper
    import torch
    import os
    from transformers import pipeline
    
    print("Starting advanced transcription and summarization")
    print(f"CUDA available: {torch.cuda.is_available()}")
    print(f"Audio data size: {len(audio_data) / 1024:.2f} KB")
    print(f"Using Whisper model: {model_size}")
    
    start_time = time.time()
    
    # Save to a temporary file
    with tempfile.NamedTemporaryFile(suffix=".m4a", delete=False) as temp_file:
        temp_file.write(audio_data)
        temp_path = temp_file.name
    
    try:
        print(f"Saved to temporary file: {temp_path}")
        
        # Load the whisper model
        print(f"Loading Whisper {model_size} model...")
        model = whisper.load_model(model_size)
        
        # Transcribe
        transcription_start = time.time()
        print("Starting transcription...")
        result = model.transcribe(temp_path)
        transcription_time = time.time() - transcription_start
        print(f"Transcription complete in {transcription_time:.2f} seconds")
        
        transcript = result["text"]
        
        # Generate summary if transcript is long enough
        summary = ""
        summary_time = 0
        
        word_count = len(transcript.split())
        if word_count > 100:
            # Load summarization model
            print("Loading summarization model...")
            summary_start = time.time()
            
            try:
                summarizer = pipeline(
                    "summarization", 
                    model="facebook/bart-large-cnn",
                    device=0 if torch.cuda.is_available() else -1
                )
                
                # Generate summary (handle long texts by chunking)
                print("Generating summary...")
                max_length = 1024
                chunks = [transcript[i:i + max_length] for i in range(0, len(transcript), max_length)]
                
                summaries = []
                for chunk in chunks:
                    if len(chunk.split()) > 50:  # Only summarize substantial chunks
                        chunk_summary = summarizer(chunk, max_length=150, min_length=30, do_sample=False)
                        summaries.append(chunk_summary[0]['summary_text'])
                
                summary = " ".join(summaries)
                print("Summary generation complete!")
            except Exception as e:
                print(f"Error generating summary: {str(e)}")
                summary = "Error generating summary"
            
            summary_time = time.time() - summary_start
        else:
            print(f"Text too short ({word_count} words) for summarization, skipping")
            summary = "Text too short for summarization"
        
        total_time = time.time() - start_time
        
        # Prepare result
        return {
            "transcript": transcript,
            "summary": summary,
            "stats": {
                "word_count": word_count,
                "transcription_time": transcription_time,
                "summary_time": summary_time,
                "total_time": total_time,
                "model_used": model_size
            }
        }
    finally:
        # Clean up
        if os.path.exists(temp_path):
            os.unlink(temp_path)

def main():
    # Get audio file path from command line argument
    if len(sys.argv) < 2:
        print("Usage: python advanced_audio_transcript.py <audio_file_path> [output_path] [model_size]")
        print("Model size options: tiny, base, small, medium, large (default: base)")
        sys.exit(1)
    
    audio_path = sys.argv[1]
    if not os.path.exists(audio_path):
        print(f"Error: File not found: {audio_path}")
        sys.exit(1)
    
    # Get optional output path
    output_path = None
    if len(sys.argv) >= 3 and not sys.argv[2] in ["tiny", "base", "small", "medium", "large"]:
        output_path = sys.argv[2]
    
    # Get optional model size
    model_size = "base"  # Default
    for arg in sys.argv[2:]:
        if arg in ["tiny", "base", "small", "medium", "large"]:
            model_size = arg
            break
        
    print(f"Processing: {audio_path}")
    print(f"Using model: {model_size}")
    start_time = time.time()
    
    # Read the audio file
    with open(audio_path, 'rb') as f:
        audio_data = f.read()
    
    print(f"Audio file size: {len(audio_data) / 1024:.2f} KB")
    
    # Run on Modal
    with app.run():
        print(f"Connected to Modal, starting transcription with {model_size} model...")
        result = transcribe_and_summarize.remote(audio_data=audio_data, model_size=model_size)
    
    total_time = time.time() - start_time
    
    # Print results
    print("\n" + "="*80)
    print("TRANSCRIPTION RESULTS:")
    print("-"*80)
    print(result["transcript"])
    print("-"*80)
    print("\nSUMMARY:")
    print("-"*80)
    print(result["summary"])
    print("-"*80)
    print(f"Total processing time: {total_time:.2f} seconds")
    
    # Print statistics
    print("\nSTATISTICS:")
    for key, value in result["stats"].items():
        if isinstance(value, float):
            print(f"  {key}: {value:.2f}")
        else:
            print(f"  {key}: {value}")
    
    # Save to file
    if output_path:
        # Use provided output path
        output_file = output_path
    else:
        # Create default output path
        output_dir = "results"
        os.makedirs(output_dir, exist_ok=True)
        base_name = os.path.basename(audio_path).rsplit(".", 1)[0]
        output_file = os.path.join(output_dir, f"{base_name}_transcript.json")
    
    # Create output directory if it doesn't exist
    os.makedirs(os.path.dirname(os.path.abspath(output_file)), exist_ok=True)
    
    # Write full result to JSON file
    with open(output_file, "w") as f:
        json.dump(result, f, indent=2)
    
    # Also write text file for transcript
    transcript_file = output_file.replace('.json', '.txt')
    with open(transcript_file, "w") as f:
        f.write(result["transcript"])
    
    # Write summary to separate file
    summary_file = output_file.replace('.json', '_summary.txt')
    with open(summary_file, "w") as f:
        f.write(result["summary"])
    
    print(f"\nFiles saved:")
    print(f"  - Full results: {output_file}")
    print(f"  - Transcript: {transcript_file}")
    print(f"  - Summary: {summary_file}")
    
    # Also print marked output for capturing by caller scripts
    print("\nJSON_RESULT_BEGIN")
    print(json.dumps(result))
    print("JSON_RESULT_END")

if __name__ == "__main__":
    main()