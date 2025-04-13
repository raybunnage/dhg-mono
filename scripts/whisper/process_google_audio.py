import os
from supabase import create_client
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import io
from dotenv import load_dotenv
from process_audio import process_audio
import uuid

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


def process_valery_audio():
    """Process Valery Grinevich audio file"""
    supabase = init_supabase()

    # Get file info from Supabase with exact name
    file_name = "Valery Grinevich 2-4-2024 audio.m4a"
    print(f"🔍 Looking for file: {file_name}")
    result = (
        supabase.table("sources_google")
        .select("*")
        .eq("name", file_name)  # Use exact match instead of ilike
        .execute()
    )

    if not result.data:
        print("❌ File not found in sources_google")
        print("Checking if file exists with different case...")
        # Try case-insensitive search as fallback
        result = (
            supabase.table("sources_google")
            .select("*")
            .ilike("name", file_name)
            .execute()
        )
        if not result.data:
            print("❌ File not found with any case matching")
            return

    file_info = result.data[0]
    print(f"✅ Found file: {file_info['name']}")
    print(f"📄 File details:")
    print(f"  - ID: {file_info['id']}")
    print(f"  - Drive ID: {file_info['drive_id']}")
    print(f"  - MIME Type: {file_info['mime_type']}")

    # Download from Google Drive
    print(f"📥 Downloading from Drive ID: {file_info['drive_id']}")
    audio_file = get_google_drive_file(file_info["drive_id"])

    # Save temporarily
    temp_path = "temp_audio.m4a"
    with open(temp_path, "wb") as f:
        f.write(audio_file.getvalue())

    try:
        # Process with Whisper
        print("🎯 Processing with Whisper...")
        result = process_audio(temp_path)

        # Save result to video_summaries
        print("💾 Saving to video_summaries...")
        supabase.table("video_summaries").insert(
            {
                "id": str(uuid.uuid4()),
                "source_id": file_info["drive_id"],
                "summary": result["text"],
                "status": "completed",
                "created_at": None,  # Let Supabase set this
                "updated_at": None,  # Let Supabase set this
            }
        ).execute()

        print("✅ Processing complete!")

    finally:
        # Cleanup
        if os.path.exists(temp_path):
            os.remove(temp_path)


if __name__ == "__main__":
    process_valery_audio()
