import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get unprocessed documents
    const { data: documents, error: fetchError } = await supabaseClient
      .from('google_sources')
      .select('*')
      .eq('content_extracted', false)
      .is('extraction_error', null)
      .in('mime_type', [
        'application/pdf',
        'application/vnd.google-apps.document'  // Google Docs
      ])
      .limit(10)  // Process in batches

    if (fetchError) throw fetchError

    if (!documents?.length) {
      return new Response(
        JSON.stringify({ message: 'No documents to process' }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Process each document
    for (const doc of documents) {
      try {
        // TODO: Add actual content extraction logic here
        // For PDFs: Use your existing analyze-pdf function
        // For Google Docs: Use Google Drive API to export as text

        // For now, just mark as processed
        const { error: updateError } = await supabaseClient
          .from('google_sources')
          .update({
            content_extracted: true,
            extracted_content: { text: 'TODO: Add actual content' },
            updated_at: new Date().toISOString()
          })
          .eq('id', doc.id)

        if (updateError) throw updateError

      } catch (error) {
        // Log error but continue processing other documents
        await supabaseClient
          .from('google_sources')
          .update({
            extraction_error: error.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', doc.id)
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Processed ${documents.length} documents`,
        processed: documents.length
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }
})