#!/usr/bin/env ts-node
import { promises as fs } from 'fs';
import path from 'path';
import { differenceInDays, format } from 'date-fns';
import { glob } from 'glob';

const PROJECT_ROOT = path.join(__dirname, '../../..');
const SCRIPT_REPORTS_DIR = path.join(PROJECT_ROOT, 'docs/script-reports');
const ARCHIVE_DIR = path.join(SCRIPT_REPORTS_DIR, '.archive_docs');

interface ArchiveOptions {
  dryRun?: boolean;
  days?: number;
  pattern?: string;
}

async function getFileAge(filePath: string): Promise<number> {
  const stats = await fs.stat(filePath);
  return differenceInDays(new Date(), stats.mtime);
}

async function archiveScriptReports(options: ArchiveOptions = {}): Promise<void> {
  const { dryRun = false, days = 30, pattern = '*.md' } = options;
  
  console.log(`Archiving script reports older than ${days} days...`);
  if (dryRun) {
    console.log('DRY RUN MODE - No files will be moved');
  }
  
  // Get all script report files
  const files = await glob(pattern, { cwd: SCRIPT_REPORTS_DIR, absolute: true });
  console.log(`Found ${files.length} script report files`);
  
  let archivedCount = 0;
  const archiveDate = format(new Date(), 'yyyyMMdd');
  
  for (const filePath of files) {
    // Skip if already in archive
    if (filePath.includes('.archive_docs')) continue;
    
    const age = await getFileAge(filePath);
    
    if (age > days) {
      const fileName = path.basename(filePath);
      const baseName = path.parse(fileName).name;
      const ext = path.parse(fileName).ext;
      
      // Skip certain important files
      const skipFiles = ['README.md', 'cli-usage-report.md', 'command-history-tracking.md'];
      if (skipFiles.includes(fileName)) {
        console.log(`Skipping important file: ${fileName}`);
        continue;
      }
      
      // Create archive filename with date
      const archiveFileName = `${baseName}.${archiveDate}${ext}`;
      const archivePath = path.join(ARCHIVE_DIR, archiveFileName);
      
      console.log(`Archiving: ${fileName} (${age} days old)`);
      
      if (!dryRun) {
        // Create archive directory if needed
        await fs.mkdir(ARCHIVE_DIR, { recursive: true });
        
        // Move file to archive
        await fs.rename(filePath, archivePath);
        console.log(`  → Moved to: ${path.relative(PROJECT_ROOT, archivePath)}`);
        
        // Create a reference file in original location
        const referenceContent = `# ${baseName}\n\n` +
          `This document has been archived on ${format(new Date(), 'yyyy-MM-dd')}.\n\n` +
          `Archive location: \`.archive_docs/${archiveFileName}\`\n\n` +
          `Reason: Document was ${age} days old and likely superseded by newer admin pages or reports.\n`;
        
        await fs.writeFile(filePath.replace(ext, '-archived.md'), referenceContent);
      }
      
      archivedCount++;
    }
  }
  
  console.log(`\nArchived ${archivedCount} files`);
  
  // Clean up empty subdirectories
  if (!dryRun && archivedCount > 0) {
    await cleanEmptyDirectories(SCRIPT_REPORTS_DIR);
  }
}

async function cleanEmptyDirectories(dir: string): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      const subDir = path.join(dir, entry.name);
      const subEntries = await fs.readdir(subDir);
      
      if (subEntries.length === 0) {
        console.log(`Removing empty directory: ${entry.name}`);
        await fs.rmdir(subDir);
      }
    }
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const options: ArchiveOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--days':
        options.days = parseInt(args[++i]);
        break;
      case '--pattern':
        options.pattern = args[++i];
        break;
    }
  }
  
  archiveScriptReports(options).catch(console.error);
}

export { archiveScriptReports };