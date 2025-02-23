import os
import whisper
import torch
from supabase import create_client
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import io
from dotenv import load_dotenv
import uuid
from datetime import datetime
import json
from tqdm import tqdm
import time

# Load environment variables with verbose output
env_path = "../../apps/dhg-improve-experts/.env.development"
if not os.path.exists(env_path):
    raise FileNotFoundError(f"Environment file not found: {env_path}")
print(f"📁 Loading environment from: {os.path.abspath(env_path)}")
load_dotenv(env_path)

def verify_env():
    """Verify all required environment variables are present"""
    # Try both VITE and non-VITE versions of keys
    supabase_url = os.getenv("VITE_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv(
        "VITE_SUPABASE_SERVICE_ROLE_KEY"
    )
    google_token = os.getenv("VITE_GOOGLE_ACCESS_TOKEN")

    # Print found credentials (safely)
    print("\n🔐 Found credentials:")
    print(f"Supabase URL: {'✅ Found' if supabase_url else '❌ Missing'}")
    print(f"Supabase Service Role Key: {'✅ Found' if supabase_key else '❌ Missing'}")
    print(f"Google Token: {'✅ Found' if google_token else '❌ Missing'}\n")

    missing = []
    if not supabase_url:
        missing.append("VITE_SUPABASE_URL")
    if not supabase_key:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")
    if not google_token:
        missing.append("VITE_GOOGLE_ACCESS_TOKEN")

    if missing:
        raise EnvironmentError(
            f"Missing required environment variables: {', '.join(missing)}"
        )

    print("✅ Environment variables verified")
    return {
        "VITE_SUPABASE_URL": supabase_url,
        "SUPABASE_SERVICE_ROLE_KEY": supabase_key,
        "VITE_GOOGLE_ACCESS_TOKEN": google_token,
    }

def init_supabase():
    """Initialize Supabase client"""
    env = verify_env()
    url = env["VITE_SUPABASE_URL"].rstrip("/")  # Remove any trailing slash

    # Get the service role key
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        print("❌ Error: SUPABASE_SERVICE_ROLE_KEY is required")
        print(
            "Please add it to .env.development from Project Settings > API > service_role key"
        )
        raise Exception("Missing service role key")

    print(f"🔑 Using Supabase URL: {url}")
    print(f"🔑 Key starts with: {key[:6]}...")

    try:
        client = create_client(url, key)
        # Test the connection with a simple query
        result = (
            client.from_("sources_google")
            .select("count", count="exact")
            .limit(1)
            .execute()
        )
        print("✅ Supabase connection verified")
        return client
    except Exception as e:
        print("❌ Supabase connection failed")
        print(f"Error details: {str(e)}")
        print("\nPlease verify:")
        print("1. URL format is correct (no trailing slash)")
        print("2. Service role key is correct (from Project Settings > API)")
        print("3. You can access the Supabase dashboard")
        raise

def get_google_drive_file(drive_id: str):
    """Get file from Google Drive using official API"""
    access_token = os.getenv("VITE_GOOGLE_ACCESS_TOKEN")

    creds = Credentials(
        token=access_token,
        token_uri="https://oauth2.googleapis.com/token",
    )

    service = build("drive", "v3", credentials=creds)

    # Get the file
    request = service.files().get_media(fileId=drive_id)
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request)

    print("📥 Downloading file...")
    done = False
    while done is False:
        status, done = downloader.next_chunk()
        print(f"Download {int(status.progress() * 100)}%")

    return fh

class ProgressTracker:
    def __init__(self):
        self.start_time = time.time()
        
    def log_step(self, message, complete=False):
        elapsed = time.time() - self.start_time
        if complete:
            print(f"✅ {message} (took {elapsed:.1f}s)")
        else:
            print(f"⏳ {message} ({elapsed:.1f}s elapsed...)")

def process_audio_with_whisper(audio_path):
    """Process audio using Whisper with Apple Silicon optimization"""
    progress = ProgressTracker()
    
    # Check for Apple Silicon but default to CPU due to sparse tensor issues
    if torch.backends.mps.is_available():
        print("⚠️ Apple Silicon GPU detected but using CPU for better compatibility")
        device = "cpu"  # Force CPU for now due to sparse tensor limitations
    else:
        print("⚠️ Using CPU")
        device = "cpu"
    
    progress.log_step("Loading Whisper model...")
    model = whisper.load_model("medium")  # Load model before moving to device
    
    # Transcribe with progress
    progress.log_step("Starting transcription...")
    result = model.transcribe(
        audio_path,
        language="en",
        verbose=True,  # Show detailed progress
        fp16=False,    # Better compatibility
        condition_on_previous_text=True,  # Better context handling
    )
    progress.log_step("Transcription complete", complete=True)
    
    return result

def process_valery_audio():
    """Process Valery Grinevich audio file with progress tracking"""
    progress = ProgressTracker()
    supabase = init_supabase()
    
    # Get file info from Supabase
    file_name = "Valery Grinevich 2-4-2024 audio.m4a"
    progress.log_step(f"Looking for file: {file_name}")
    
    result = (
        supabase.table("sources_google")
        .select("*")
        .eq("name", file_name)
        .execute()
    )
    
    if not result.data:
        print("❌ File not found in sources_google")
        return
    
    file_info = result.data[0]
    progress.log_step(f"Found file: {file_info['name']}", complete=True)
    print(f"📄 File details:")
    print(f"  - ID: {file_info['id']}")
    print(f"  - Drive ID: {file_info['drive_id']}")
    print(f"  - MIME Type: {file_info['mime_type']}")
    
    # Download from Google Drive
    progress.log_step("Downloading from Google Drive...")
    audio_file = get_google_drive_file(file_info["drive_id"])
    progress.log_step("Download complete", complete=True)
    
    # Save temporarily
    temp_path = "temp_audio.m4a"
    with open(temp_path, "wb") as f:
        f.write(audio_file.getvalue())
    
    try:
        # Process with Whisper
        result = process_audio_with_whisper(temp_path)
        
        # Save to video_summaries
        progress.log_step("Saving to video_summaries...")
        supabase.table("video_summaries").insert({
            "id": str(uuid.uuid4()),
            "source_id": file_info["drive_id"],
            "summary": result["text"],
            "status": "completed",
            "created_at": None,
            "updated_at": None
        }).execute()
        
        # Save local copy
        output_dir = "transcripts"
        os.makedirs(output_dir, exist_ok=True)
        base_name = os.path.splitext(file_name)[0]
        
        # Save detailed JSON
        json_path = os.path.join(output_dir, f"{base_name}.json")
        with open(json_path, 'w') as f:
            json.dump({
                "text": result["text"],
                "segments": result["segments"],
                "language": result["language"],
                "metadata": {
                    "file": file_name,
                    "date": datetime.now().isoformat(),
                    "processing_time": time.time() - progress.start_time
                }
            }, f, indent=2)
        
        # Save plain text
        txt_path = os.path.join(output_dir, f"{base_name}.txt")
        with open(txt_path, 'w') as f:
            f.write(result["text"])
        
        progress.log_step("Processing complete!", complete=True)
        print(f"\n📝 Saved transcripts to:")
        print(f"  - {json_path}")
        print(f"  - {txt_path}")
        
    finally:
        # Cleanup
        if os.path.exists(temp_path):
            os.remove(temp_path)

if __name__ == "__main__":
    process_valery_audio() 