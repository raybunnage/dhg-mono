from enum import Enum
from datetime import datetime
import uuid

class BatchType(Enum):
    GOOGLE_EXTRACTION = 'google_extraction'
    AUDIO_EXTRACTION = 'audio_extraction'
    TRANSCRIPTION = 'transcription'
    DIARIZATION = 'diarization'
    SUMMARIZATION = 'summarization'

class ProcessingStage(Enum):
    QUEUED = 'queued'
    DOWNLOADING = 'downloading'
    EXTRACTING = 'extracting'
    PROCESSING = 'processing'
    SAVING = 'saving'
    COMPLETED = 'completed'
    FAILED = 'failed'
    RETRYING = 'retrying'

def create_batch(
    supabase,
    batch_type: BatchType,
    items: list,
    description: str = None,
    priority: int = 0
):
    """Create a new processing batch"""
    batch_id = str(uuid.uuid4())
    
    # Create batch record
    supabase.table("processing_batches").insert({
        "id": batch_id,
        "name": f"{batch_type.value} - {datetime.now().isoformat()}",
        "description": description,
        "batch_type": batch_type.value,
        "status": ProcessingStage.QUEUED.value,
        "priority": priority,
        "total_count": len(items),
        "metadata": {
            "created_by": "batch_operations.py",
            "item_types": list(set(item.get("type") for item in items))
        }
    }).execute()
    
    # Create status entries for each item
    for order, item in enumerate(items):
        supabase.table("batch_processing_status").insert({
            "id": str(uuid.uuid4()),
            "batch_id": batch_id,
            "item_id": item["id"],
            "status": ProcessingStage.QUEUED.value,
            "processing_order": order,
            "source_type": item.get("source_type"),
            "target_type": item.get("target_type"),
            "metadata": {
                "original_filename": item.get("name"),
                "size": item.get("size"),
                "mime_type": item.get("mime_type")
            }
        }).execute()
    
    return batch_id

# Example usage for different batch types:

def create_google_extraction_batch(supabase, file_ids: list):
    """Create batch for extracting files from Google Drive"""
    # Get file info from sources_google
    files = supabase.table("sources_google")
        .select("*")
        .in_("id", file_ids)
        .execute()
    
    items = [{
        "id": f["id"],
        "type": "google_file",
        "source_type": "google_drive",
        "target_type": "supabase",
        "name": f["name"],
        "mime_type": f["mime_type"]
    } for f in files.data]
    
    return create_batch(
        supabase,
        BatchType.GOOGLE_EXTRACTION,
        items,
        "Extract files from Google Drive"
    )

def create_audio_extraction_batch(supabase, video_ids: list):
    """Create batch for extracting audio from videos"""
    videos = supabase.table("sources_google")
        .select("*")
        .in_("id", video_ids)
        .eq("mime_type", "video/mp4")
        .execute()
    
    items = [{
        "id": v["id"],
        "type": "video",
        "source_type": "mp4",
        "target_type": "m4a",
        "name": v["name"]
    } for v in videos.data]
    
    return create_batch(
        supabase,
        BatchType.AUDIO_EXTRACTION,
        items,
        "Extract audio from videos"
    )

def create_transcription_batch(supabase, audio_ids: list):
    """Create batch for transcribing audio files"""
    audio_files = supabase.table("sources_google")
        .select("*")
        .in_("id", audio_ids)
        .eq("mime_type", "audio/x-m4a")
        .execute()
    
    items = [{
        "id": a["id"],
        "type": "audio",
        "source_type": "m4a",
        "target_type": "transcript",
        "name": a["name"]
    } for a in audio_files.data]
    
    return create_batch(
        supabase,
        BatchType.TRANSCRIPTION,
        items,
        "Transcribe audio files"
    ) 