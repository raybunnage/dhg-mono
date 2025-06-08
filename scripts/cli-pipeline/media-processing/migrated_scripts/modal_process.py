#!/usr/bin/env python3
"""
Process audio with Modal at global scope.
This script avoids the issue with Modal decorators in local scope.
"""

import os
import sys
import argparse
import time
from pathlib import Path

import modal

# Define Modal resources at global scope
modal_image = (
    modal.Image.debian_slim()
    .apt_install(["ffmpeg", "libsm6", "libxext6"])
    .pip_install(
        "faster-whisper==0.10.0",
        "tqdm>=4.65.0",
        "torch",
        "numpy",
        "av",
        "ffmpeg-python",
    )
)

# Create a Modal app at global scope
app = modal.App("whisper-process-app", image=modal_image)

# Define global processing function
@app.function(gpu="T4", timeout=300)
def process_audio(audio_file_data: bytes, model_name: str = "small", max_length: int = 500) -> dict:
    """Process audio data with WhisperX"""
    import os
    import time
    import tempfile
    import torch
    from datetime import datetime
    from faster_whisper import WhisperModel
    
    start_time = time.time()
    
    # Save audio data to a temporary file
    with tempfile.NamedTemporaryFile(suffix=".m4a", delete=False) as temp_file:
        temp_file.write(audio_file_data)
        temp_path = temp_file.name
    
    try:
        # Get optimal device settings (should be CUDA on Modal)
        device = "cuda" if torch.cuda.is_available() else "cpu"
        compute_type = "float16" if device == "cuda" else "float32"
        
        print(f"Using device: {device}, compute type: {compute_type}")
        
        # Initialize model
        model = WhisperModel(
            model_name,
            device=device,
            compute_type=compute_type,
            download_root=".models",
            num_workers=4
        )
        
        # Transcribe audio
        segments, info = model.transcribe(
            temp_path,
            beam_size=5,
            language="en",
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500)
        )
        
        # Process segments
        segments_list = list(segments)
        
        # Format result
        transcript_data = {
            "segments": [],
            "metadata": {
                "duration": info.duration,
                "processing_time": time.time() - start_time,
                "model": model_name,
                "device": device
            }
        }
        
        full_text = []
        for segment in segments_list:
            transcript_data["segments"].append({
                "start": segment.start,
                "end": segment.end,
                "text": segment.text
            })
            full_text.append(segment.text)
        
        # Add the full text to the result
        transcript_data["text"] = " ".join(full_text)
        
        # Create a simple summary (first N words)
        words = transcript_data["text"].split()
        if len(words) > max_length:
            summary = " ".join(words[:max_length]) + "..."
        else:
            summary = transcript_data["text"]
        
        # Add summary to the result
        transcript_data["summary"] = summary
        
        return transcript_data
        
    finally:
        # Clean up the temporary file
        if os.path.exists(temp_path):
            os.unlink(temp_path)


def main():
    parser = argparse.ArgumentParser(
        description="Process audio with Whisper using Modal"
    )
    parser.add_argument(
        "audio_path", 
        help="Path to the audio file"
    )
    parser.add_argument(
        "--output-dir", 
        default="summaries",
        help="Directory to save the summary"
    )
    parser.add_argument(
        "--model",
        default="small",
        choices=["tiny", "base", "small", "medium", "large"],
        help="Whisper model size (default: small)"
    )
    parser.add_argument(
        "--length",
        type=int,
        default=500,
        help="Maximum summary length in words"
    )
    
    args = parser.parse_args()
    
    # Create output directory if it doesn't exist
    os.makedirs(args.output_dir, exist_ok=True)
    
    # Validate input file
    audio_path = args.audio_path
    if not os.path.exists(audio_path):
        print(f"❌ Error: Audio file not found: {audio_path}")
        sys.exit(1)
    
    print(f"🎧 Processing audio file: {audio_path}")
    print(f"📝 Output will be saved to: {args.output_dir}")
    print(f"🔍 Using model: {args.model}")
    
    try:
        # Start timing
        start_time = time.time()
        
        # Read the audio file as bytes
        with open(audio_path, 'rb') as f:
            audio_data = f.read()
            
        # Get file size
        file_size = len(audio_data)
        print(f"📊 Audio file size: {file_size / (1024*1024):.2f} MB")
        
        if file_size < 1000:  # Less than 1KB
            print(f"⚠️ Warning: Audio file is suspiciously small ({file_size} bytes)")
        
        print(f"🔄 Uploading and processing file to Modal (this may take a minute)...")
        
        # Run the Modal function
        with app.run():
            result = process_audio.remote(
                audio_data,
                model_name=args.model,
                max_length=args.length
            )
        
        # Extract summary
        summary = result.get("summary", "")
        
        # Create output file
        base_name = os.path.splitext(os.path.basename(audio_path))[0]
        summary_path = os.path.join(args.output_dir, f"{base_name}_summary.txt")
        
        with open(summary_path, 'w') as f:
            f.write(summary)
        
        # Print a preview
        print("\n" + "="*80)
        print("Summary Preview:")
        print("-"*80)
        print(summary[:500] + ("..." if len(summary) > 500 else ""))
        print("-"*80)
        
        # Print metrics
        total_time = time.time() - start_time
        audio_duration = result.get("metadata", {}).get("duration", 0)
        processing_time = result.get("metadata", {}).get("processing_time", 0)
        speedup = audio_duration / total_time if total_time > 0 else 0
        
        print(f"📊 Performance:")
        print(f"   - Audio duration: {audio_duration:.2f}s")
        print(f"   - Total time: {total_time:.2f}s")
        print(f"   - Processing time: {processing_time:.2f}s")
        print(f"   - Speed improvement: {speedup:.2f}x realtime")
        print(f"✅ Summary saved to: {summary_path}")
        
    except Exception as e:
        print(f"❌ Error processing audio: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()