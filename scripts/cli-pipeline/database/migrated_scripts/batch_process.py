from faster_whisper import WhisperModel
import json
import sys
import os
import glob
from datetime import datetime
from tqdm import tqdm
import uuid
import argparse
from typing import List, Dict
import time
from supabase import create_client, Client

def init_supabase() -> Client:
    """Initialize Supabase client"""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    return create_client(url, key)

def create_batch(supabase: Client, total_files: int) -> str:
    """Create a new processing batch record"""
    batch_id = str(uuid.uuid4())
    supabase.table('processing_batches').insert({
        'id': batch_id,
        'status': 'processing',
        'total_files': total_files,
        'processed_files': 0,
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat()
    }).execute()
    return batch_id

def update_batch_progress(supabase: Client, batch_id: str, processed: int, error_msg: str = None):
    """Update batch processing progress"""
    data = {
        'processed_files': processed,
        'updated_at': datetime.now().isoformat()
    }
    if error_msg:
        data['error_message'] = error_msg
    
    supabase.table('processing_batches').update(data).eq('id', batch_id).execute()

def save_video_summary(supabase: Client, source_id: str, summary: str, error: str = None):
    """Save video summary to database"""
    supabase.table('video_summaries').insert({
        'id': str(uuid.uuid4()),
        'source_id': source_id,
        'summary': summary,
        'error': error,
        'status': 'completed' if not error else 'failed',
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat()
    }).execute()

def process_audio_file(file_path: str, model: WhisperModel) -> Dict:
    """Process a single audio file and return its results"""
    try:
        print(f"\n🎯 Processing: {os.path.basename(file_path)}")
        
        # Transcribe
        segments, info = model.transcribe(
            file_path,
            beam_size=5,
            language="en",
            vad_filter=True
        )
        
        # Process segments
        segments_list = list(segments)
        full_text = []
        
        for segment in segments_list:
            full_text.append(segment.text)
        
        return {
            "status": "success",
            "text": ' '.join(full_text),
            "duration": info.duration
        }
    
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }

def batch_process(input_dir: str, model_size: str = "medium"):
    """Process all audio files in a directory"""
    try:
        # Initialize
        supabase = init_supabase()
        model = WhisperModel(model_size, device="auto", compute_type="float16")
        
        # Get all audio files
        audio_files = glob.glob(os.path.join(input_dir, "*.m4a"))
        print(f"Found {len(audio_files)} audio files")
        
        # Create batch record
        batch_id = create_batch(supabase, len(audio_files))
        
        # Process files
        for i, file_path in enumerate(audio_files, 1):
            try:
                # Get source_id from filename
                base_name = os.path.basename(file_path)
                source_id = base_name.split('_')[0]  # Assuming filename format: {source_id}_audio.m4a
                
                # Process audio
                result = process_audio_file(file_path, model)
                
                if result["status"] == "success":
                    # Save summary
                    save_video_summary(supabase, source_id, result["text"])
                else:
                    save_video_summary(supabase, source_id, None, result["error"])
                
                # Update batch progress
                update_batch_progress(supabase, batch_id, i)
                
            except Exception as e:
                print(f"❌ Error processing {file_path}: {str(e)}")
                update_batch_progress(supabase, batch_id, i, str(e))
        
        # Mark batch as completed
        supabase.table('processing_batches').update({
            'status': 'completed',
            'completed_at': datetime.now().isoformat()
        }).eq('id', batch_id).execute()
        
    except Exception as e:
        print(f"❌ Batch processing error: {str(e)}")
        if batch_id:
            update_batch_progress(supabase, batch_id, i, str(e))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Batch process audio files with Whisper')
    parser.add_argument('input_dir', help='Directory containing audio files')
    parser.add_argument('--model', default='medium', help='Whisper model size (tiny, base, small, medium, large)')
    args = parser.parse_args()
    
    batch_process(args.input_dir, args.model) 