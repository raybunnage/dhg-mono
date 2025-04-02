const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'scripts/cli-pipeline/media-processing/commands/batch-process-media.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Replace the findAndCopyMedia function with a new version that pipes through filter-transcribed.js
const newFunction = `/**
 * Run the find-missing-media command to generate copy commands
 * only for files that haven't been transcribed yet
 */
async function findAndCopyMedia(): Promise<boolean> {
  try {
    const scriptPath = path.join(process.cwd(), 'copy-files.sh');
    
    // Step 1: Generate copy script using find-missing-media and filter-transcribed
    Logger.info('🔍 Generating copy commands for untranscribed media files...');
    
    const tsNodePath = './node_modules/.bin/ts-node';
    const findCommand = \`\${tsNodePath} scripts/cli-pipeline/media-processing/index.ts find-missing-media --deep --limit \${options.limit} --source "\${options.source}" --format commands | node scripts/cli-pipeline/media-processing/commands/filter-transcribed.js\`;
    
    if (options.dryRun) {
      Logger.info(\`Would execute: \${findCommand}\`);
    } else {
      // Execute the find command and extract only the copy commands between the UNTRANSCRIBED FILES markers
      const findOutput = execSync(findCommand).toString();
      const untranscribedFilesSection = findOutput.split('=== UNTRANSCRIBED FILES ===')[1];
      
      if (\!untranscribedFilesSection) {
        Logger.warn('No UNTRANSCRIBED FILES section found in output');
        return false;
      }
      
      // Extract just the copy commands (skip the instructions at the end)
      const copyCommands = untranscribedFilesSection.split('\\nCopy and paste these commands')[0].trim();
      
      // Write to the script file
      fs.writeFileSync(scriptPath, '#\!/bin/bash\\n# Auto-generated copy commands\\n\\n' + copyCommands);
      
      // Make the script executable
      execSync(\`chmod +x \${scriptPath}\`);
      
      // Check if the script has copy commands
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      if (\!scriptContent.includes('cp "')) {
        Logger.info('ℹ️ No untranscribed files found to copy');
        return false;
      }
      
      // Execute the copy script
      Logger.info('📂 Copying untranscribed MP4 files from Google Drive...');
      execSync(\`\${scriptPath}\`, { stdio: 'inherit' });
    }
    
    return true;
  } catch (error: any) {
    Logger.error(\`❌ Error in find and copy step: \${error.message}\`);
    return false;
  }
}`;

// Replace the old function with the new one
content = content.replace(/\/\*\*\n[\s\S]*?Run the find-untranscribed-media[\s\S]*?}\n}/m, newFunction);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Updated batch-process-media.ts");
