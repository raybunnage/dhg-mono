#!/usr/bin/env ts-node

import { analyzeAudioGaps } from './analyze-audio-gaps';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

interface BatchConfig {
  batchId: string;
  createdAt: string;
  totalFiles: number;
  localGoogleDrivePath?: string;
  outputDirectory: string;
  commands: ProcessingCommand[];
}

interface ProcessingCommand {
  index: number;
  mp4DriveId: string;
  mp4Name: string;
  m4aName: string;
  folderDriveId: string;
  folderName: string;
  inputPath?: string;
  outputPath?: string;
  ffmpegCommand?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export async function generateAudioBatch(options: {
  limit?: number;
  googleDrivePath?: string;
  outputDir?: string;
} = {}) {
  console.log('Generating audio processing batch...\n');
  
  try {
    // Get the gaps analysis
    const gaps = await analyzeAudioGaps({ limit: options.limit });
    
    if (!gaps || gaps.length === 0) {
      console.log('No audio gaps found to process');
      return;
    }
    
    // Generate batch ID
    const batchId = `audio-batch-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    
    // Default output directory
    const outputDir = options.outputDir || path.join(os.homedir(), 'Documents', 'dhg-audio-processing', batchId);
    
    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });
    
    // Prepare batch configuration
    const batchConfig: BatchConfig = {
      batchId,
      createdAt: new Date().toISOString(),
      totalFiles: gaps.length,
      localGoogleDrivePath: options.googleDrivePath,
      outputDirectory: outputDir,
      commands: []
    };
    
    // Generate commands for each file
    gaps.forEach((gap, index) => {
      const command: ProcessingCommand = {
        index: index + 1,
        mp4DriveId: gap.mp4_file.drive_id,
        mp4Name: gap.mp4_file.name,
        m4aName: gap.expected_m4a_name,
        folderDriveId: gap.folder_drive_id,
        folderName: gap.folder_name,
        status: 'pending'
      };
      
      // If Google Drive path is provided, try to map local paths
      if (options.googleDrivePath) {
        // This assumes a structure like: /path/to/Google Drive/My Drive/folder/file.mp4
        // You may need to adjust based on your actual Google Drive structure
        const relativePath = `${gap.folder_name}/${gap.mp4_file.name}`;
        command.inputPath = path.join(options.googleDrivePath, relativePath);
        command.outputPath = path.join(outputDir, gap.expected_m4a_name);
        
        // Generate ffmpeg command
        command.ffmpegCommand = `ffmpeg -i "${command.inputPath}" -vn -acodec copy "${command.outputPath}"`;
      }
      
      batchConfig.commands.push(command);
    });
    
    // Save batch configuration
    const configPath = path.join(outputDir, 'batch-config.json');
    await fs.writeFile(configPath, JSON.stringify(batchConfig, null, 2));
    
    // Generate shell script for processing
    const scriptPath = path.join(outputDir, 'process-batch.sh');
    const scriptContent = generateBatchScript(batchConfig);
    await fs.writeFile(scriptPath, scriptContent);
    await fs.chmod(scriptPath, '755'); // Make executable
    
    // Generate status tracking file
    const statusPath = path.join(outputDir, 'batch-status.json');
    await fs.writeFile(statusPath, JSON.stringify({
      batchId,
      totalFiles: gaps.length,
      processed: 0,
      failed: 0,
      startTime: null,
      endTime: null,
      files: batchConfig.commands.map(cmd => ({
        index: cmd.index,
        name: cmd.mp4Name,
        status: cmd.status
      }))
    }, null, 2));
    
    // Display summary
    console.log('\n=== Batch Generation Summary ===');
    console.log(`Batch ID: ${batchId}`);
    console.log(`Total files to process: ${gaps.length}`);
    console.log(`Output directory: ${outputDir}`);
    console.log('\nGenerated files:');
    console.log(`  - Configuration: ${configPath}`);
    console.log(`  - Processing script: ${scriptPath}`);
    console.log(`  - Status tracking: ${statusPath}`);
    
    if (options.googleDrivePath) {
      console.log('\n⚠️  Important: Before running the batch script:');
      console.log('1. Verify that Google Drive Desktop is running and synced');
      console.log('2. Check that the local paths in batch-config.json are correct');
      console.log('3. Ensure you have ffmpeg installed (brew install ffmpeg)');
      console.log('\nTo process the batch:');
      console.log(`  cd "${outputDir}"`);
      console.log('  ./process-batch.sh');
    } else {
      console.log('\n⚠️  Note: No Google Drive path provided');
      console.log('You will need to:');
      console.log('1. Edit batch-config.json to add local file paths');
      console.log('2. Or download files manually before processing');
    }
    
    return batchConfig;
    
  } catch (error) {
    console.error('Error generating batch:', error);
    throw error;
  }
}

function generateBatchScript(config: BatchConfig): string {
  const script = `#!/bin/bash
# Audio Processing Batch Script
# Generated: ${config.createdAt}
# Batch ID: ${config.batchId}

echo "Starting audio processing batch: ${config.batchId}"
echo "Total files to process: ${config.totalFiles}"
echo ""

# Check for ffmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "Error: ffmpeg is not installed"
    echo "Please install ffmpeg: brew install ffmpeg"
    exit 1
fi

# Create output directory if it doesn't exist
mkdir -p "${config.outputDirectory}"

# Initialize counters
PROCESSED=0
FAILED=0

# Process each file
${config.commands.map(cmd => {
  if (!cmd.ffmpegCommand) {
    return `# Skipping ${cmd.mp4Name} - no local path mapped`;
  }
  
  return `
# File ${cmd.index}/${config.totalFiles}: ${cmd.mp4Name}
echo "Processing [${cmd.index}/${config.totalFiles}]: ${cmd.mp4Name}"
if [ -f "${cmd.inputPath}" ]; then
    ${cmd.ffmpegCommand}
    if [ $? -eq 0 ]; then
        echo "  ✓ Success: Created ${cmd.m4aName}"
        ((PROCESSED++))
    else
        echo "  ✗ Failed: ffmpeg error"
        ((FAILED++))
    fi
else
    echo "  ✗ Failed: Input file not found at ${cmd.inputPath}"
    ((FAILED++))
fi
echo ""`;
}).join('\n')}

# Summary
echo "================================"
echo "Batch processing complete!"
echo "Processed: $PROCESSED files"
echo "Failed: $FAILED files"
echo "Output directory: ${config.outputDirectory}"
echo ""
echo "Next steps:"
echo "1. Review the generated M4A files"
echo "2. Run 'google-sync-cli.sh upload-audio-files --batch-id=${config.batchId}'"
`;
  
  return script;
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const limit = args.find(arg => arg.startsWith('--limit='))?.split('=')[1];
  const googleDrivePath = args.find(arg => arg.startsWith('--google-drive-path='))?.split('=')[1];
  const outputDir = args.find(arg => arg.startsWith('--output-dir='))?.split('=')[1];
  
  generateAudioBatch({
    limit: limit ? parseInt(limit, 10) : undefined,
    googleDrivePath,
    outputDir
  })
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}