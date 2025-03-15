import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

// Use a unique name to avoid conflicts with any global definitions
const execPromiseForDocsSync = promisify(exec);

// Add OPTIONS handler for CORS preflight requests
export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': request.headers.get('origin') || 'http://localhost:5173',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true'
    }
  });
}

export async function POST(request: Request) {
  try {
    console.log('Documentation API route called...', request.url);
    
    // Add CORS headers
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': request.headers.get('origin') || 'http://localhost:5173',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true'
    };
    
    // Handle OPTIONS request for CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers
      });
    }
    
    // Parse request body
    const body = await request.json();
    const action = body.action || 'update'; // Default to 'update' if no action specified
    
    console.log(`Processing documentation action: ${action}`);
    
    // Get the project root directory
    const projectRoot = path.resolve(process.cwd());
    
    // Determine which script to run based on the action
    let scriptPath = '';
    if (action === 'report' || action === 'markdown-report') {
      scriptPath = path.join(projectRoot, 'scripts', 'markdown-report.sh');
    } else {
      // Default to update-docs-database.sh for 'update' or any other action
      scriptPath = path.join(projectRoot, 'scripts', 'update-docs-database.sh');
    }
    
    console.log(`Selected script path: ${scriptPath}`);
    
    // Check if script exists
    try {
      await execPromiseForDocsSync(`test -f "${scriptPath}"`);
    } catch (error) {
      console.error(`Script not found at ${scriptPath}`);
      return new Response(JSON.stringify({
        success: false,
        message: `Script not found at ${scriptPath}`
      }), {
        status: 500,
        headers
      });
    }
    
    // Make the script executable
    try {
      await execPromiseForDocsSync(`chmod +x "${scriptPath}"`);
    } catch (chmodError) {
      console.warn(`Warning: Could not make script executable: ${chmodError.message}`);
      // Continue anyway, as the script might already be executable
    }
    
    // Ensure proper environment variables are available to the script
    const env = {
      ...process.env,
      // Add any additional environment variables the script might need
      SUPABASE_URL: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
      SUPABASE_KEY: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY
    };
    
    // Execute the script with proper error handling
    console.log(`Executing script: ${scriptPath}`);
    try {
      const { stdout, stderr } = await execPromiseForDocsSync(`cd "${projectRoot}" && "${scriptPath}"`, {
        env,
        maxBuffer: 1024 * 1024 * 10 // 10 MB
      });
      
      console.log('Script output:', stdout);
      if (stderr) {
        console.warn('Script errors:', stderr);
      }
      
      let message = '';
      if (action === 'report' || action === 'markdown-report') {
        message = 'Markdown report generation completed';
      } else {
        message = 'Documentation database update completed';
      }
      
      const result = {
        success: !stderr || stderr.trim() === '',
        message: message,
        output: stdout + (stderr ? `\nErrors:\n${stderr}` : '')
      };
      
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers
      });
    } catch (execError) {
      console.error(`Error executing script: ${execError.message}`);
      // Include both stderr and stdout in the response for debugging
      const stdout = execError.stdout || '';
      const stderr = execError.stderr || '';
      
      return new Response(JSON.stringify({
        success: false,
        message: `Error executing update script: ${execError.message}`,
        output: stdout + (stderr ? `\nErrors:\n${stderr}` : '')
      }), {
        status: 500,
        headers
      });
    }
  } catch (error) {
    console.error('Error running documentation update script:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: `Error running documentation update script: ${error.message || 'Unknown error'}`,
      output: error.message || 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}