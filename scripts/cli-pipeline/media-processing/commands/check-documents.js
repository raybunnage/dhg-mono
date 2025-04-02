const fs = require("fs");
const { SupabaseClientService } = require("./mock-supabase-client-hanscom.js");

async function checkExpertDocuments() {
  try {
    const clientService = SupabaseClientService.getInstance();
    const supabase = clientService.getClient();
    
    // Query for all expert documents related to our newly processed files
    const { data, error } = await supabase
      .from("expert_documents")
      .select("id, source_id, processing_status, raw_content, whisper_model_used")
      .in("id", ["d6a5fa1a-db80-46c1-9667-da1320f7ab86", "8a1f1ccb-dabe-435a-a56d-3fd701dfaa05"]);
    
    if (error) {
      console.error("Error querying database:", error);
      return;
    }
    
    console.log(JSON.stringify(data, null, 2));
    fs.writeFileSync("scripts/cli-pipeline/media-processing/commands/logs/documents-check.json", JSON.stringify(data, null, 2));
    
    // Also check for any transcripts
    const filesFound = [];
    const transcriptPath1 = "file_types/transcripts/2023-09-15 PVG Discussion video_transcript.txt";
    const transcriptPath2 = "file_types/transcripts/2024_04_04_Lederman_transcript.txt";
    
    if (fs.existsSync(transcriptPath1)) {
      filesFound.push(transcriptPath1);
    }
    
    if (fs.existsSync(transcriptPath2)) {
      filesFound.push(transcriptPath2);
    }
    
    console.log("Transcript files found:", filesFound);
    
  } catch (err) {
    console.error("Exception:", err);
  }
}

checkExpertDocuments();
