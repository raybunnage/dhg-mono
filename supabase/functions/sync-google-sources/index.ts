import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    console.log('Starting Google Drive sync');
    console.log('Using folder ID:', GOOGLE_DRIVE_FOLDER_ID);

    // Your sync logic here
    
    const handleDriveFiles = async (files: any[]) => {
      for (const file of files) {
        // Check for existing record first
        const { data: existing } = await supabaseAdmin
          .from('sources_google')
          .select('id, drive_id')
          .eq('drive_id', file.id)
          .single();

        if (existing) {
          console.log(`Skipping duplicate file: ${file.name} (${file.id})`);
          continue;
        }

        // Insert new record if no duplicate found
        const { error: insertError } = await supabaseAdmin
          .from('sources_google')
          .insert({
            drive_id: file.id,
            name: file.name,
            mime_type: file.mimeType,
            web_view_link: file.webViewLink,
            content_extracted: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (insertError) {
          console.error(`Error inserting file ${file.name}:`, insertError);
        } else {
          console.log(`Added new file: ${file.name}`);
        }
      }
    };

    const cleanupOrphanedRecords = async (validDriveIds: string[]) => {
      const { error } = await supabaseAdmin
        .from('sources_google')
        .delete()
        .not('drive_id', 'in', validDriveIds)
        .is('content_extracted', false); // Only delete unprocessed records

      if (error) {
        console.error('Error cleaning up orphaned records:', error);
      }
    };

    const files = await listFiles();
    const validDriveIds = files.map(f => f.id);
    
    console.log(`Found ${files.length} files in folder`);
    
    await handleDriveFiles(files);
    await cleanupOrphanedRecords(validDriveIds);
    
    return { success: true, message: `Synced ${files.length} files` };
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }
}) 