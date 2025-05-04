import { NextRequest } from 'next/server';
import { supabase } from '@/integrations/supabase/client';
import { markdownFileService } from '@/services/markdownFileService';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const documentId = params.id;
    
    if (!documentId) {
      return new Response(JSON.stringify({ error: 'Document ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get document data from Supabase
    const { data: doc, error } = await supabase
      .from('documentation_files')
      .select('file_path, title')
      .eq('id', documentId)
      .single();
    
    if (error || !doc) {
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get file content
    const fileData = await markdownFileService.getFileContent(doc.file_path);
    
    if (!fileData || !fileData.content) {
      return new Response(JSON.stringify({ error: 'Could not read file content' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Return content as JSON
    return new Response(JSON.stringify({
      id: documentId,
      title: doc.title || doc.file_path.split('/').pop(),
      file_path: doc.file_path,
      content: fileData.content
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in markdown API route:', error);
    return new Response(JSON.stringify({ error: 'Failed to process request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}