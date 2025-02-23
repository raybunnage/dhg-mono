from faster_whisper import WhisperModel
import json
import sys
import os
from datetime import datetime
from tqdm import tqdm

def process_audio(audio_path, output_dir="transcripts"):
    print(f"🎯 Processing: {audio_path}")
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Initialize model with GPU support if available
    model_size = "medium"
    print(f"🔄 Loading {model_size} model...")
    model = WhisperModel(model_size, device="auto", compute_type="float16")
    print("✅ Model loaded")
    
    # Transcribe with progress
    print("🎬 Starting transcription...")
    segments, info = model.transcribe(
        audio_path,
        beam_size=5,
        language="en",
        vad_filter=True,
        initial_prompt="This is a discussion about software development and technology."
    )
    
    # Convert segments to list and show progress
    transcript_data = {
        "segments": [],
        "metadata": {
            "file": os.path.basename(audio_path),
            "date": datetime.now().isoformat(),
            "model": model_size,
            "language": info.language,
            "duration": info.duration
        }
    }
    
    # Process segments with progress bar
    segments_list = list(segments)  # Convert generator to list
    print(f"📝 Processing {len(segments_list)} segments...")
    
    full_text = []
    for segment in tqdm(segments_list, desc="Processing segments"):
        transcript_data["segments"].append({
            "start": segment.start,
            "end": segment.end,
            "text": segment.text,
            "confidence": float(segment.avg_logprob)
        })
        full_text.append(segment.text)
    
    # Create output filenames
    base_name = os.path.splitext(os.path.basename(audio_path))[0]
    json_path = os.path.join(output_dir, f"{base_name}.json")
    txt_path = os.path.join(output_dir, f"{base_name}.txt")
    
    # Save outputs
    print("💾 Saving outputs...")
    with open(json_path, 'w') as f:
        json.dump(transcript_data, f, indent=2)
    
    with open(txt_path, 'w') as f:
        f.write('\n'.join(full_text))
    
    print(f"✅ Processing complete!")
    print(f"📄 Outputs saved to:")
    print(f"  - JSON: {json_path}")
    print(f"  - Text: {txt_path}")
    
    return json_path, txt_path

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python process_audio.py <path_to_audio_file>")
        sys.exit(1)
        
    audio_path = sys.argv[1]
    process_audio(audio_path) 