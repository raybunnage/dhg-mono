from faster_whisper import WhisperModel
import json
import sys
import os
from datetime import datetime
from tqdm import tqdm
import torch

def get_optimal_device():
    """Determine the best available device and compute type"""
    if torch.cuda.is_available():
        print("🚀 CUDA GPU available!")
        device = "cuda"
        compute_type = "float16"  # Modern NVIDIA GPUs handle this well
    else:
        print("⚠️ Using CPU (faster-whisper doesn't support Apple Silicon GPU yet)")
        device = "cpu"
        compute_type = "float32"
    
    print(f"📊 Using device: {device}, compute_type: {compute_type}")
    return device, compute_type

def process_audio(audio_path, output_dir="transcripts"):
    """Process a single audio file with Whisper."""
    print(f"🎯 Processing: {audio_path}")
    
    os.makedirs(output_dir, exist_ok=True)
    
    # Create models directory if it doesn't exist
    models_dir = ".models"
    os.makedirs(models_dir, exist_ok=True)
    
    # Get optimal device settings
    device, compute_type = get_optimal_device()
    
    # Initialize model with optimal settings
    print("⌛ Loading model (this may take a minute)...")
    model = WhisperModel(
        "medium",
        device=device,
        compute_type=compute_type,
        download_root=models_dir,
        num_workers=4  # Increased for better CPU performance
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
            "duration": info.duration
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
    
    # Save outputs
    base_name = os.path.splitext(os.path.basename(audio_path))[0]
    json_path = os.path.join(output_dir, f"{base_name}.json")
    txt_path = os.path.join(output_dir, f"{base_name}.txt")
    
    with open(json_path, 'w') as f:
        json.dump(transcript_data, f, indent=2)
    
    with open(txt_path, 'w') as f:
        f.write('\n'.join(full_text))
    
    print(f"✅ Saved to: {json_path} and {txt_path}")
    return json_path, txt_path

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python process_audio.py <path_to_audio_file>")
        sys.exit(1)
    
    process_audio(sys.argv[1]) 