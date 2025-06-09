#!/usr/bin/env ts-node
/**
 * Archive old markdown documents
 */

import { promises as fs } from 'fs';
import path from 'path';
import { differenceInDays, format } from 'date-fns';
import { glob } from 'glob';

const PROJECT_ROOT = path.join(__dirname, '../../..');

interface ArchiveOptions {
  dryRun?: boolean;
  days?: number;
  pattern?: string;
  directories?: string[];
}

const DEFAULT_DOC_DIRS = [
  'docs',
  'docs/script-reports',
  'docs/cli-pipeline',
  'docs/technical-specs',
  'docs/solution-guides'
];

const SKIP_FILES = [
  'README.md',
  'CLAUDE.md',
  'LICENSE.md',
  'MIGRATION.md',
  'index.md',
  'setup-instructions.md'
];

async function getFileAge(filePath: string): Promise<number> {
  const stats = await fs.stat(filePath);
  return differenceInDays(new Date(), stats.mtime);
}

async function archiveDocuments(options: ArchiveOptions = {}): Promise<void> {
  const { 
    dryRun = false, 
    days = 30, 
    pattern = '*.md',
    directories = DEFAULT_DOC_DIRS 
  } = options;
  
  console.log(`🗄️  Archiving markdown documents older than ${days} days...`);
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No files will be moved\n');
  }
  
  let totalArchived = 0;
  const archiveDate = format(new Date(), 'yyyyMMdd');
  
  for (const dir of directories) {
    const fullDir = path.join(PROJECT_ROOT, dir);
    
    // Check if directory exists
    try {
      await fs.access(fullDir);
    } catch {
      continue;
    }
    
    console.log(`\n📂 Processing ${dir}...`);
    
    // Get all matching files
    const files = await glob(pattern, { 
      cwd: fullDir, 
      absolute: true,
      ignore: ['**/.archive*/**', '**/node_modules/**']
    });
    
    let dirArchived = 0;
    
    for (const filePath of files) {
      const fileName = path.basename(filePath);
      
      // Skip important files
      if (SKIP_FILES.includes(fileName)) {
        continue;
      }
      
      const age = await getFileAge(filePath);
      
      if (age > days) {
        const fileDir = path.dirname(filePath);
        const baseName = path.parse(fileName).name;
        const ext = path.parse(fileName).ext;
        
        // Create archive directory
        const archiveDir = path.join(fileDir, '.archive_docs');
        const archiveFileName = `${baseName}.${archiveDate}${ext}`;
        const archivePath = path.join(archiveDir, archiveFileName);
        
        console.log(`  📄 ${fileName} (${age} days old)`);
        
        if (!dryRun) {
          // Create archive directory if needed
          await fs.mkdir(archiveDir, { recursive: true });
          
          // Check if archive already exists
          try {
            await fs.access(archivePath);
            // Add timestamp if file already exists
            const timestamp = format(new Date(), 'HHmmss');
            const uniquePath = path.join(archiveDir, `${baseName}.${archiveDate}.${timestamp}${ext}`);
            await fs.rename(filePath, uniquePath);
            console.log(`     → Archived with timestamp`);
          } catch {
            // Move file
            await fs.rename(filePath, archivePath);
            console.log(`     → Archived`);
          }
        }
        
        dirArchived++;
        totalArchived++;
      }
    }
    
    if (dirArchived === 0) {
      console.log(`  ✓ No files to archive`);
    } else {
      console.log(`  📦 Archived ${dirArchived} files`);
    }
  }
  
  console.log(`\n✅ Total archived: ${totalArchived} files`);
  
  if (!dryRun && totalArchived > 0) {
    console.log('\n💡 Tip: Run "archive-cli.sh cleanup-empty" to remove empty directories');
  }
}

// Parse command line arguments
function parseArgs(): ArchiveOptions {
  const args = process.argv.slice(2);
  const options: ArchiveOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--days':
        options.days = parseInt(args[++i]);
        if (isNaN(options.days)) {
          console.error('Error: --days must be a number');
          process.exit(1);
        }
        break;
      case '--pattern':
        options.pattern = args[++i];
        break;
      case '--dir':
        if (!options.directories) options.directories = [];
        options.directories.push(args[++i]);
        break;
    }
  }
  
  return options;
}

// Main execution
if (require.main === module) {
  const options = parseArgs();
  archiveDocuments(options).catch(console.error);
}

export { archiveDocuments };