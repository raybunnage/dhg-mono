"""
Audio summarization functionality for WhisperX using both local and Modal processing.
"""

import os
import time
from typing import Dict, Any, Optional

from .transcribe import transcribe, transcribe_remote
from .utils import save_transcript

def summarize(
    audio_path: str,
    model_name: str = "tiny",
    output_dir: str = "summaries",
    max_length: int = 250,
    save_output: bool = True
) -> str:
    """
    Generate a quick summary of an audio file using a small Whisper model.
    
    Args:
        audio_path: Path to the audio file
        model_name: Whisper model size (default "tiny" for speed)
        output_dir: Directory to save the summary
        max_length: Maximum length of summary in words
        save_output: Whether to save the output to disk
        
    Returns:
        A text summary of the audio
    """
    print(f"🎯 Generating summary for: {audio_path}")
    start_time = time.time()
    
    # Use tiny model for quick processing
    transcript_data = transcribe(
        audio_path=audio_path,
        model_name=model_name,
        output_dir=output_dir,
        save_output=False  # We'll save our own summary format
    )
    
    # Extract the full text
    full_text = transcript_data.get("text", "")
    
    # Create a simple summary (first N words)
    words = full_text.split()
    if len(words) > max_length:
        summary = " ".join(words[:max_length]) + "..."
    else:
        summary = full_text
    
    # Save summary if requested
    if save_output:
        os.makedirs(output_dir, exist_ok=True)
        base_name = os.path.splitext(os.path.basename(audio_path))[0]
        summary_path = os.path.join(output_dir, f"{base_name}_summary.txt")
        
        with open(summary_path, 'w') as f:
            f.write(summary)
        print(f"✅ Summary saved to: {summary_path}")
    
    print(f"✅ Summarization complete! Took {time.time() - start_time:.2f}s")
    return summary


def summarize_remote(
    audio_path: str,
    model_name: str = "tiny",
    output_dir: str = "summaries",
    max_length: int = 250,
    save_output: bool = True
) -> str:
    """
    Generate a quick summary of an audio file using Modal for processing.
    
    Args:
        audio_path: Path to the audio file
        model_name: Whisper model size (default "tiny" for speed)
        output_dir: Directory to save the summary
        max_length: Maximum length of summary in words
        save_output: Whether to save the output to disk
        
    Returns:
        A text summary of the audio
    """
    try:
        import modal
    except ImportError:
        print("Modal not installed. Falling back to local processing...")
        return summarize(audio_path, model_name, output_dir, max_length, save_output)
    
    print(f"🚀 Generating summary with Modal: {audio_path}")
    start_time = time.time()
    
    # Create Modal resources at module level
    # These must be defined at the global scope
    modal_image = (
        modal.Image.debian_slim()
        .apt_install(["ffmpeg", "libsm6", "libxext6"])  # System dependencies for audio
        .pip_install(
            "faster-whisper==0.10.0",
            "tqdm>=4.65.0",
            "torch",
            "numpy",
            "av",  # PyAV for audio processing
            "ffmpeg-python"  # For ffmpeg support
        )
    )
    modal_app = modal.App("whisperx-summarize", image=modal_image)
    
    # Define the remote function at module level with serialize=True to work in non-global scope
    @modal_app.function(gpu="T4", timeout=600, serialize=True)
    def _remote_summarize_fn(audio_path: str, model_name: str, max_length: int) -> Dict[str, Any]:
        """Remote function to run on Modal"""
        import os
        import time
        import torch
        from datetime import datetime
        from faster_whisper import WhisperModel
        
        start_time = time.time()
        
        # Get optimal device settings (should be CUDA on Modal)
        device = "cuda" if torch.cuda.is_available() else "cpu"
        compute_type = "float16" if device == "cuda" else "float32"
        
        # Initialize model - use tiny/base for quick summaries
        model = WhisperModel(
            model_name,
            device=device,
            compute_type=compute_type,
            download_root=".models",
            num_workers=4
        )
        
        # Transcribe audio
        segments, info = model.transcribe(
            audio_path,
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
                "file": os.path.basename(audio_path),
                "date": datetime.now().isoformat(),
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
    
    try:
        # Read the file first to make sure we're not sending empty or corrupted files
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")
            
        # Get file size
        file_size = os.path.getsize(audio_path)
        print(f"📊 Audio file size: {file_size / (1024*1024):.2f} MB")
        
        if file_size < 1000:  # Less than 1KB
            raise ValueError(f"Audio file is too small ({file_size} bytes), might be corrupted")
            
        # Read the first few bytes to check if it's a valid file
        with open(audio_path, 'rb') as f:
            header = f.read(16)
            # Simple check for common audio formats
            if not any(magic in header for magic in [b'RIFF', b'ID3', b'ftyp', b'OggS']):
                print("⚠️ Warning: File doesn't appear to be a common audio format")
        
        print(f"🔄 Uploading and processing file to Modal (this may take a minute)...")
        
        # Use the function declared at global scope
        result = _remote_summarize_fn.remote(audio_path, model_name, max_length)
        
        # Extract the summary
        summary = result.get("summary", "")
        
        # Save summary if requested
        if save_output:
            os.makedirs(output_dir, exist_ok=True)
            base_name = os.path.splitext(os.path.basename(audio_path))[0]
            summary_path = os.path.join(output_dir, f"{base_name}_summary.txt")
            
            with open(summary_path, 'w') as f:
                f.write(summary)
            print(f"✅ Summary saved to: {summary_path}")
        
        # Calculate speedup
        total_time = time.time() - start_time
        audio_duration = result.get("metadata", {}).get("duration", 0)
        processing_time = result.get("metadata", {}).get("processing_time", 0)
        speedup = audio_duration / total_time if total_time > 0 else 0
        
        print(f"✅ Remote summarization complete! Took {total_time:.2f}s")
        print(f"📊 Performance:")
        print(f"   - Audio duration: {audio_duration:.2f}s")
        print(f"   - Total time (including transfer): {total_time:.2f}s")
        print(f"   - Actual processing time: {processing_time:.2f}s")
        print(f"   - Speed improvement: {speedup:.2f}x realtime")
        
        return summary
    
    except Exception as e:
        print(f"❌ Error with Modal processing: {str(e)}")
        print("Falling back to local processing...")
        return summarize(audio_path, model_name, output_dir, max_length, save_output)