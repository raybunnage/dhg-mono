const { execSync } = require('child_process');
const fs = require('fs');

const fileId = '1_2vt2t954u8PeoYbTgIyVrNtxN-uZqMhjGFCI5auBvM';
const tmpFile = '/tmp/drive-output.txt';

try {
  // Run the command and capture output
  execSync(`./scripts/cli-pipeline/google_sync/google-drive-cli.sh sync-and-update-metadata --file-id ${fileId} --verbose > ${tmpFile} 2>&1`, 
    { timeout: 20000 });
  
  // Read the output file
  const output = fs.readFileSync(tmpFile, 'utf8');
  
  // Extract the TEST FILE FOUND section
  const regex = /TEST FILE FOUND: ({[\s\S]*?})/;
  const match = output.match(regex);
  
  if (match && match[1]) {
    console.log("Raw metadata:");
    console.log(match[1]);
  } else {
    console.log("Metadata section not found in output");
  }
  
  // Clean up
  fs.unlinkSync(tmpFile);
} catch (error) {
  console.error('Error executing command:', error.message);
  // Try to clean up anyway
  try { fs.unlinkSync(tmpFile); } catch (e) { /* ignore */ }
}
