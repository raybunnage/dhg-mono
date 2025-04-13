"""
Transcription functionality for WhisperX using both local and Modal processing.
"""

import os
import time
import json
from datetime import datetime
from typing import Dict, Any, List, Optional

from .utils import get_optimal_device, save_transcript

def transcribe(
    audio_path: str, 
    model_name: str = "medium", 
    output_dir: str = "transcripts",
    save_output: bool = True
) -> Dict[str, Any]:
    """
    Transcribe audio using Whisper (local processing).
    
    Args:
        audio_path: Path to the audio file
        model_name: Whisper model size ("tiny", "base", "small", "medium", "large")
        output_dir: Directory to save the transcript
        save_output: Whether to save the output to disk
        
    Returns:
        Dictionary with transcription results
    """
    from faster_whisper import WhisperModel
    from tqdm import tqdm
    import torch
    
    start_time = time.time()
    print(f"🎯 Processing: {audio_path}")
    
    # Create models directory if it doesn't exist
    models_dir = ".models"
    os.makedirs(models_dir, exist_ok=True)
    
    # Get optimal device settings
    device, compute_type = get_optimal_device()
    
    # Initialize model with optimal settings
    print(f"⌛ Loading model {model_name} (this may take a minute)...")
    model = WhisperModel(
        model_name,
        device=device,
        compute_type=compute_type,
        download_root=models_dir,
        num_workers=4
    )
    
    print("✅ Model loaded, starting transcription...")
    segments, info = model.transcribe(
        audio_path,
        beam_size=5,
        language="en",
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=500)
    )
    
    segments_list = list(segments)
    print(f"📝 Processing {len(segments_list)} segments...")
    
    # Process segments
    transcript_data = {
        "segments": [],
        "metadata": {
            "file": os.path.basename(audio_path),
            "date": datetime.now().isoformat(),
            "duration": info.duration,
            "model": model_name,
            "processing_time": time.time() - start_time
        }
    }
    
    full_text = []
    for segment in tqdm(segments_list):
        transcript_data["segments"].append({
            "start": segment.start,
            "end": segment.end,
            "text": segment.text
        })
        full_text.append(segment.text)
    
    # Add full text to the result
    transcript_data["text"] = " ".join(full_text)
    
    if save_output:
        save_transcript(transcript_data, audio_path, output_dir)
    
    print(f"✅ Transcription complete! Took {time.time() - start_time:.2f}s")
    return transcript_data


def transcribe_remote(
    audio_path: str,
    model_name: str = "medium",
    output_dir: str = "transcripts",
    save_output: bool = True
) -> Dict[str, Any]:
    """
    Transcribe audio using Whisper on Modal (remote GPU processing).
    
    Args:
        audio_path: Path to the audio file
        model_name: Whisper model size ("tiny", "base", "small", "medium", "large")
        output_dir: Directory to save the transcript
        save_output: Whether to save the output to disk
        
    Returns:
        Dictionary with transcription results
    """
    try:
        import modal
    except ImportError:
        print("Modal not installed. Falling back to local processing...")
        return transcribe(audio_path, model_name, output_dir, save_output)
    
    print(f"🚀 Processing with Modal: {audio_path}")
    start_time = time.time()
    
    # Define the Modal image with GPU support and all required dependencies
    image = modal.Image.debian_slim().pip_install(
        "faster-whisper==0.10.0",
        "tqdm>=4.65.0",
        "torch",
        "numpy",
        "ffmpeg-python",
    )
    
    # Create a stub for this specific run
    stub = modal.Stub("whisperx-transcribe", image=image)
    
    @stub.function(gpu="T4", timeout=600)
    def _remote_transcribe(audio_path: str, model_name: str = "medium") -> Dict[str, Any]:
        """
        The actual function that runs on Modal.
        """
        import os
        import torch
        import time
        from datetime import datetime
        from faster_whisper import WhisperModel
        
        start_time = time.time()
        
        # Check if audio_path is a URL or a local path
        # If it's a local path, we'll need to upload it to Modal
        if os.path.exists(audio_path):
            # This is a local path - Modal will automatically upload it
            pass
        
        # Get optimal device settings (should be CUDA on Modal's T4)
        device = "cuda" if torch.cuda.is_available() else "cpu"
        compute_type = "float16" if device == "cuda" else "float32"
        
        print(f"📊 Using device: {device}, compute_type: {compute_type}")
        
        # Initialize model
        model = WhisperModel(
            model_name,
            device=device,
            compute_type=compute_type,
            download_root=".models",
            num_workers=4
        )
        
        # Perform transcription
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
        
        return transcript_data
    
    try:
        # Run the remote transcription
        transcript_data = _remote_transcribe.remote(audio_path, model_name)
        
        # Save output if requested
        if save_output:
            save_transcript(transcript_data, audio_path, output_dir)
            
        total_time = time.time() - start_time
        print(f"✅ Remote transcription complete! Took {total_time:.2f}s")
        
        # Calculate speedup
        audio_duration = transcript_data.get("metadata", {}).get("duration", 0)
        speedup = audio_duration / total_time if total_time > 0 else 0
        processing_time = transcript_data.get("metadata", {}).get("processing_time", 0)
        
        print(f"📊 Performance:")
        print(f"   - Audio duration: {audio_duration:.2f}s")
        print(f"   - Total time (including transfer): {total_time:.2f}s")
        print(f"   - Actual processing time: {processing_time:.2f}s")
        print(f"   - Speed improvement: {speedup:.2f}x realtime")
        
        return transcript_data
    
    except Exception as e:
        print(f"❌ Error with Modal processing: {str(e)}")
        print("Falling back to local processing...")
        return transcribe(audio_path, model_name, output_dir, save_output)