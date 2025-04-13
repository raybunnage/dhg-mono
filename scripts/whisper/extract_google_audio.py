import os
from supabase import create_client
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import io
from dotenv import load_dotenv
import uuid
import base64

def extract_audio_content(file_info, supabase):
    """Extract audio content and store in sources_google"""
    progress = ProgressTracker()
    
    # Skip if already has content
    if file_info.get('content'):
        print(f"✅ File already has content extracted: {file_info['name']}")
        return file_info['id']
    
    progress.log_step(f"Downloading file: {file_info['name']}")
    
    # Get file from Google Drive
    audio_file = get_google_drive_file(file_info["drive_id"])
    
    # Convert to base64 for storage
    content_b64 = base64.b64encode(audio_file.getvalue()).decode('utf-8')
    
    # Update sources_google with content
    progress.log_step("Saving content to database...")
    result = supabase.table("sources_google").update({
        "content": content_b64,
        "content_type": "audio/m4a",
        "extraction_status": "complete",
        "updated_at": None  # Let Supabase set this
    }).eq("id", file_info["id"]).execute()
    
    progress.log_step("Content extraction complete!", complete=True)
    return file_info["id"]

def process_audio_files():
    """Extract all pending audio files"""
    supabase = init_supabase()
    
    # Get all audio files that need extraction
    result = (
        supabase.table("sources_google")
        .select("*")
        .eq("mime_type", "audio/x-m4a")
        .is_("content", "null")
        .execute()
    )
    
    if not result.data:
        print("✅ No pending audio files to extract")
        return
    
    print(f"🎯 Found {len(result.data)} audio files to extract")
    
    for file_info in result.data:
        try:
            extract_audio_content(file_info, supabase)
        except Exception as e:
            print(f"❌ Failed to extract {file_info['name']}: {str(e)}")
            # Update status to failed
            supabase.table("sources_google").update({
                "extraction_status": "failed",
                "error_message": str(e)
            }).eq("id", file_info["id"]).execute() 