import os
from supabase import create_client
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import io
import base64
from tqdm import tqdm

def find_audio_pairs():
    """Find mp4 files and their corresponding m4a files"""
    supabase = init_supabase()
    
    # Get all mp4 files
    video_files = (
        supabase.table("sources_google")
        .select("*")
        .eq("mime_type", "video/mp4")
        .execute()
    ).data
    
    print(f"Found {len(video_files)} mp4 files")
    
    # Get all m4a files
    audio_files = (
        supabase.table("sources_google")
        .select("*")
        .eq("mime_type", "audio/x-m4a")
        .execute()
    ).data
    
    # Match by name (removing extensions)
    pairs = []
    for video in video_files:
        video_name = os.path.splitext(video["name"])[0]
        matching_audio = next(
            (a for a in audio_files if os.path.splitext(a["name"])[0] == video_name),
            None
        )
        if matching_audio:
            pairs.append({
                "video": video,
                "audio": matching_audio
            })
    
    print(f"Found {len(pairs)} video/audio pairs")
    return pairs

def extract_audio_content(audio_file, supabase):
    """Extract audio content to sources_google"""
    print(f"Processing: {audio_file['name']}")
    
    # Skip if already has content
    if audio_file.get('content'):
        print("✅ Already has content")
        return
    
    # Download from Google Drive
    audio_content = get_google_drive_file(audio_file["drive_id"])
    
    # Store in Supabase
    supabase.table("sources_google").update({
        "content": base64.b64encode(audio_content.getvalue()).decode('utf-8'),
        "content_extracted": True,
        "extraction_error": None,
        "updated_at": None  # Let Supabase set this
    }).eq("id", audio_file["id"]).execute()

def process_existing_audio():
    """Main function to process all existing audio files"""
    supabase = init_supabase()
    pairs = find_audio_pairs()
    
    print("\nProcessing audio files...")
    for pair in tqdm(pairs):
        try:
            extract_audio_content(pair["audio"], supabase)
        except Exception as e:
            print(f"❌ Error processing {pair['audio']['name']}: {str(e)}")
            supabase.table("sources_google").update({
                "extraction_error": str(e)
            }).eq("id", pair["audio"]["id"]).execute()

if __name__ == "__main__":
    process_existing_audio() 