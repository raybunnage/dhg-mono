import { markdownFileService } from '@/services/markdownFileService';
import { supabase } from '@/integrations/supabase/client';
import path from 'path';
import { readFile } from 'fs/promises';
import { getSafePath, getProjectRoot } from '@/utils/file-utils';
import { 
  generateMarkdownReport, 
  processNextDocumentationQueueItem
} from '@/api/markdown-report';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const pathParam = url.searchParams.get('path');
    const id = url.searchParams.get('id');
    
    // Handle markdown file API request by ID (new endpoint)
    if (url.pathname.includes('/api/markdown/') || id) {
      const documentId = id || url.pathname.split('/api/markdown/')[1];
      
      if (!documentId) {
        return new Response(JSON.stringify({ error: 'Document ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      console.log(`Fetching document by ID: ${documentId}`);
      
      try {
        // Get file path from database
        const { data: doc, error } = await supabase
          .from('documentation_files')
          .select('file_path, title')
          .eq('id', documentId)
          .single();
        
        if (error) {
          console.error('Supabase error fetching document:', error);
          return new Response(JSON.stringify({ error: 'Document not found in database' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        if (!doc) {
          return new Response(JSON.stringify({ error: 'Document not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        console.log(`Found document in database: ${doc.file_path}`);
        
        // Read file content using the existing service
        const fileData = await markdownFileService.getFileContent(doc.file_path);
        
        if (!fileData || !fileData.content) {
          console.error(`Could not read file content for ${doc.file_path}`);
          return new Response(JSON.stringify({ error: 'Could not read file content' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Success - return the content
        return new Response(JSON.stringify({ 
          id: documentId,
          title: doc.title || doc.file_path.split('/').pop(),
          file_path: doc.file_path,
          content: fileData.content 
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        console.error('Error reading markdown by ID:', e);
        return new Response(JSON.stringify({ error: 'Failed to read markdown file' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Original path-based file content endpoint
    if (pathParam) {
      // Get the file content
      const fileData = await markdownFileService.getFileContent(pathParam);
      
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
    }
    
    return new Response(JSON.stringify({ error: 'Path or ID parameter is required' }), {
      status: 400,
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
      try {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const path = require('path');
        const execPromise = promisify(exec);
        
        // Get the project root directory
        const projectRoot = process.cwd();
        
        // Path to the update script
        const scriptPath = path.join(projectRoot, 'scripts', 'cli-pipeline', 'update-docs-database.sh');
        
        // Check if script exists
        try {
          await execPromise(`test -f "${scriptPath}"`);
        } catch (error) {
          console.error(`Script not found at ${scriptPath}`);
          return new Response(JSON.stringify({
            success: false,
            message: `Script not found at ${scriptPath}`
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Make script executable
        await execPromise(`chmod +x "${scriptPath}"`);
        
        // Execute the script
        console.log(`Executing script: ${scriptPath}`);
        const { stdout, stderr } = await execPromise(`cd "${projectRoot}" && "${scriptPath}"`);
        
        const result = {
          success: !stderr || stderr.trim() === '',
          message: 'Documentation database update completed',
          output: stdout + (stderr ? `\nErrors:\n${stderr}` : '')
        };
        
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 500,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error executing documentation update script:', error);
        return new Response(JSON.stringify({
          success: false,
          message: `Error: ${error.message || 'Unknown error'}`
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
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