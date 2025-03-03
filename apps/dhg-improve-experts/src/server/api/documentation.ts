import { markdownFileService } from '@/services/markdownFileService';
import { supabase } from '@/integrations/supabase/client';
import { 
  generateMarkdownReport, 
  syncDocumentationToDatabase,
  processNextDocumentationQueueItem
} from '@/api/markdown-report';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const path = url.searchParams.get('path');
    
    if (!path) {
      return new Response(JSON.stringify({ error: 'Path parameter is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get the file content
    const fileData = await markdownFileService.getFileContent(path);
    
    if (!fileData) {
      return new Response(JSON.stringify({ error: 'File not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify(fileData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in markdown file API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle POST requests for the markdown report and related endpoints
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const path = url.pathname;
    
    // Check which endpoint is being requested
    if (path.endsWith('/markdown-report')) {
      const result = await generateMarkdownReport();
      
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Endpoint to sync documentation to database
    if (path.endsWith('/docs-sync')) {
      const result = await syncDocumentationToDatabase();
      
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Endpoint to process the next documentation queue item
    if (path.endsWith('/docs-process-queue')) {
      const result = await processNextDocumentationQueueItem();
      
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Default response for unhandled POST routes
    return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}