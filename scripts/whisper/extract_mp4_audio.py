import os
import subprocess
import io
import base64
import tempfile
from tqdm import tqdm

def extract_audio_from_mp4(video_content):
    """Extract audio from mp4 content using ffmpeg in memory"""
    with tempfile.NamedTemporaryFile(suffix='.mp4') as temp_video:
        # Write video content to temp file
        temp_video.write(video_content)
        temp_video.flush()
        
        # Use ffmpeg to extract audio to memory
        command = [
            'ffmpeg',
            '-i', temp_video.name,
            '-vn',  # No video
            '-acodec', 'copy',  # Copy audio codec (faster than re-encoding)
            '-f', 'm4a',  # Force m4a format
            'pipe:1'  # Output to stdout
        ]
        
        # Run ffmpeg and capture output
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        audio_content, error = process.communicate()
        
        if process.returncode != 0:
            raise Exception(f"FFmpeg error: {error.decode()}")
            
        return audio_content

def process_mp4_files():
    """Process mp4 files that don't have corresponding audio"""
    supabase = init_supabase()
    
    # Get mp4 files without corresponding audio
    result = (
        supabase.table("sources_google")
        .select("*")
        .eq("mime_type", "video/mp4")
        .execute()
    )
    
    videos = result.data
    print(f"Found {len(videos)} mp4 files")
    
    for video in tqdm(videos, desc="Processing videos"):
        try:
            # Check if audio already exists
            audio_exists = (
                supabase.table("sources_google")
                .select("id")
                .eq("mime_type", "audio/x-m4a")
                .ilike("name", f"{os.path.splitext(video['name'])[0]}%")
                .execute()
            ).data
            
            if audio_exists:
                print(f"✅ Audio already exists for {video['name']}")
                continue
            
            # Download video content
            video_content = get_google_drive_file(video["drive_id"]).getvalue()
            
            # Extract audio
            audio_content = extract_audio_from_mp4(video_content)
            
            # Create new audio entry
            audio_name = f"{os.path.splitext(video['name'])[0]}.m4a"
            supabase.table("sources_google").insert({
                "name": audio_name,
                "mime_type": "audio/x-m4a",
                "drive_id": video["drive_id"],  # Reference same drive ID
                "content": base64.b64encode(audio_content).decode('utf-8'),
                "content_extracted": True,
                "expert_id": video["expert_id"],
                "parent_folder_id": video["parent_folder_id"]
            }).execute()
            
        except Exception as e:
            print(f"❌ Error processing {video['name']}: {str(e)}") 