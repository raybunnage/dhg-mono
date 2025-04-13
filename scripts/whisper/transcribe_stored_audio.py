import os
import base64
import uuid
from datetime import datetime

def process_stored_audio(source_id, supabase):
    """Process audio from sources_google content"""
    progress = ProgressTracker()
    
    # Get source info and content
    result = (
        supabase.table("sources_google")
        .select("*")
        .eq("id", source_id)
        .execute()
    )
    
    if not result.data:
        raise Exception(f"Source not found: {source_id}")
    
    source = result.data[0]
    
    # Create or get expert_document
    doc_result = (
        supabase.table("expert_documents")
        .select("*")
        .eq("source_id", source_id)
        .execute()
    )
    
    if doc_result.data:
        doc_id = doc_result.data[0]["id"]
    else:
        # Create new expert_document
        doc_result = supabase.table("expert_documents").insert({
            "id": str(uuid.uuid4()),
            "source_id": source_id,
            "content_type": "audio/transcription",
            "processing_status": "processing",
            "processing_started_at": datetime.now().isoformat(),
            "created_at": None  # Let Supabase set this
        }).execute()
        doc_id = doc_result.data[0]["id"]
    
    # Process with Whisper
    try:
        # Save content to temp file
        content = base64.b64decode(source["content"])
        temp_path = f"temp_{source_id}.m4a"
        with open(temp_path, "wb") as f:
            f.write(content)
        
        # Transcribe
        result = process_audio_with_whisper(temp_path)
        
        # Update expert_document with success
        supabase.table("expert_documents").update({
            "raw_content": result["text"],
            "processed_content": {
                "segments": result["segments"],
                "language": result["language"],
                "metadata": {
                    "duration": result["segments"][-1]["end"] if result["segments"] else 0,
                    "segments_count": len(result["segments"]),
                }
            },
            "processing_status": "completed",
            "processing_completed_at": datetime.now().isoformat(),
            "word_count": len(result["text"].split())
        }).eq("id", doc_id).execute()
        
    except Exception as e:
        # Update with error status
        supabase.table("expert_documents").update({
            "processing_status": "failed",
            "processing_error": str(e),
            "processing_completed_at": datetime.now().isoformat()
        }).eq("id", doc_id).execute()
        raise
        
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path) 