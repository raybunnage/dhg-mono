import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execPromise = promisify(exec);

export async function POST() {
  try {
    console.log('Starting documentation database update from API route...');
    
    // Get the project root directory
    const projectRoot = path.resolve(process.cwd());
    
    // Path to the update script
    const scriptPath = path.join(projectRoot, 'scripts', 'update-docs-database.sh');
    
    // Make the script executable
    await execPromise(`chmod +x ${scriptPath}`);
    
    // Execute the script
    console.log(`Executing script: ${scriptPath}`);
    const { stdout, stderr } = await execPromise(`cd ${projectRoot} && ${scriptPath}`);
    
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