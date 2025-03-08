import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

// Use a unique name to avoid conflicts with any global definitions
const execPromiseForDocsSync = promisify(exec);

export async function POST() {
  try {
    console.log('Starting documentation database update from API route...');
    
    // Get the project root directory
    const projectRoot = path.resolve(process.cwd());
    
    // Path to the update script
    const scriptPath = path.join(projectRoot, 'scripts', 'update-docs-database.sh');
    
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
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Make the script executable
    try {
      await execPromiseForDocsSync(`chmod +x "${scriptPath}"`);
    } catch (chmodError) {
      console.warn(`Warning: Could not make script executable: ${chmodError.message}`);
      // Continue anyway, as the script might already be executable
    }
    
    // Execute the script with proper error handling
    console.log(`Executing script: ${scriptPath}`);
    try {
      const { stdout, stderr } = await execPromiseForDocsSync(`cd "${projectRoot}" && "${scriptPath}"`);
      
      console.log('Script output:', stdout);
      if (stderr) {
        console.warn('Script errors:', stderr);
      }
      
      const result = {
        success: !stderr || stderr.trim() === '',
        message: 'Documentation database update completed',
        output: stdout + (stderr ? `\nErrors:\n${stderr}` : '')
      };
      
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers: { 'Content-Type': 'application/json' }
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
        headers: { 'Content-Type': 'application/json' }
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