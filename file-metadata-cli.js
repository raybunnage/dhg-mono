#\!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

// Create a temporary directory for our output
const tmpDir = '/tmp/drive-metadata-' + Date.now();
execSync(`mkdir -p ${tmpDir}`);

// The file ID we want to examine
const fileId = '1_2vt2t954u8PeoYbTgIyVrNtxN-uZqMhjGFCI5auBvM';

try {
  // Use the CLI we know works to fetch file metadata
  console.log(`Fetching metadata for file: ${fileId}`);
  execSync(`./scripts/cli-pipeline/google_sync/google-drive-cli.sh sync-and-update-metadata --file-id ${fileId} > ${tmpDir}/cli-output.txt 2>&1`, { stdio: 'inherit', timeout: 20000 });
  
  // Parse our own output to extract the file metadata we care about
  console.log('Extracting the TEST FILE FOUND section from output');
  
  // Now, extract the minimal useful information
  const minScript = `
    const fs = require('fs');
    try {
      const content = fs.readFileSync('${tmpDir}/cli-output.txt', 'utf8');
      const match = content.match(/TEST FILE FOUND: ({[\\s\\S]*?})/);
      if (match && match[1]) {
        const cleanJson = match[1].replace(/\\n/g, ' ').replace(/\\s+/g, ' ');
        try {
          console.log(JSON.stringify(JSON.parse(cleanJson), null, 2));
        } catch (e) {
          console.log('Raw match:', cleanJson);
        }
      } else {
        console.log('Metadata section not found in output');
      }
    } catch (error) {
      console.error('Error:', error.message);
    }
  `;
  
  fs.writeFileSync(`${tmpDir}/extract.js`, minScript);
  execSync(`node ${tmpDir}/extract.js`, { stdio: 'inherit' });
  
  // Clean up
  execSync(`rm -rf ${tmpDir}`);
} catch (error) {
  console.error('Error:', error.message);
  // Still try to clean up
  try {
    execSync(`rm -rf ${tmpDir}`);
  } catch (e) {
    // Ignore cleanup errors
  }
}
