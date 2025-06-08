#!/usr/bin/env ts-node
/**
 * Generate archive status report
 */

import { promises as fs } from 'fs';
import path from 'path';
import { format } from 'date-fns';
import { glob } from 'glob';

const PROJECT_ROOT = path.join(__dirname, '../../..');

interface ArchiveStats {
  directory: string;
  activeFiles: number;
  archivedFiles: number;
  totalSize: number;
  oldestArchive?: Date;
  newestArchive?: Date;
}

async function getDirectorySize(dir: string): Promise<number> {
  let totalSize = 0;
  
  try {
    const files = await glob('**/*', { 
      cwd: dir, 
      absolute: true,
      nodir: true
    });
    
    for (const file of files) {
      try {
        const stats = await fs.stat(file);
        totalSize += stats.size;
      } catch {
        // Ignore inaccessible files
      }
    }
  } catch {
    // Directory doesn't exist
  }
  
  return totalSize;
}

async function analyzeDirectory(baseDir: string): Promise<ArchiveStats> {
  const stats: ArchiveStats = {
    directory: baseDir,
    activeFiles: 0,
    archivedFiles: 0,
    totalSize: 0
  };
  
  const fullPath = path.join(PROJECT_ROOT, baseDir);
  
  try {
    // Count active markdown files
    const activeFiles = await glob('*.md', {
      cwd: fullPath,
      ignore: ['.archive*/**']
    });
    stats.activeFiles = activeFiles.length;
    
    // Find all archive directories
    const archiveDirs = await glob('.archive*', {
      cwd: fullPath,
      onlyDirectories: true
    });
    
    // Count archived files and get dates
    let oldestDate: Date | undefined;
    let newestDate: Date | undefined;
    
    for (const archiveDir of archiveDirs) {
      const archivePath = path.join(fullPath, archiveDir);
      const archivedFiles = await glob('*', {
        cwd: archivePath,
        nodir: true
      });
      
      stats.archivedFiles += archivedFiles.length;
      
      // Get file dates
      for (const file of archivedFiles) {
        const filePath = path.join(archivePath, file);
        const fileStat = await fs.stat(filePath);
        
        if (!oldestDate || fileStat.mtime < oldestDate) {
          oldestDate = fileStat.mtime;
        }
        if (!newestDate || fileStat.mtime > newestDate) {
          newestDate = fileStat.mtime;
        }
      }
    }
    
    stats.oldestArchive = oldestDate;
    stats.newestArchive = newestDate;
    
    // Calculate total size of archives
    for (const archiveDir of archiveDirs) {
      const archivePath = path.join(fullPath, archiveDir);
      stats.totalSize += await getDirectorySize(archivePath);
    }
    
  } catch (error) {
    // Directory doesn't exist or other error
  }
  
  return stats;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function generateReport(): Promise<void> {
  console.log('📊 Archive Status Report');
  console.log('=' .repeat(60));
  console.log(`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}\n`);
  
  const directories = [
    'docs',
    'docs/script-reports',
    'docs/cli-pipeline',
    'docs/technical-specs',
    'docs/solution-guides',
    'docs/code-documentation',
    'docs/code-implementation',
    'scripts/cli-pipeline'
  ];
  
  let totalActive = 0;
  let totalArchived = 0;
  let totalSize = 0;
  
  for (const dir of directories) {
    const stats = await analyzeDirectory(dir);
    
    if (stats.activeFiles > 0 || stats.archivedFiles > 0) {
      console.log(`📁 ${dir}`);
      console.log(`   Active files:    ${stats.activeFiles}`);
      console.log(`   Archived files:  ${stats.archivedFiles}`);
      
      if (stats.archivedFiles > 0) {
        console.log(`   Archive size:    ${formatBytes(stats.totalSize)}`);
        
        if (stats.oldestArchive) {
          console.log(`   Oldest archive:  ${format(stats.oldestArchive, 'yyyy-MM-dd')}`);
        }
        if (stats.newestArchive) {
          console.log(`   Newest archive:  ${format(stats.newestArchive, 'yyyy-MM-dd')}`);
        }
      }
      
      console.log();
      
      totalActive += stats.activeFiles;
      totalArchived += stats.archivedFiles;
      totalSize += stats.totalSize;
    }
  }
  
  console.log('─'.repeat(60));
  console.log('📈 Summary');
  console.log(`   Total active files:    ${totalActive}`);
  console.log(`   Total archived files:  ${totalArchived}`);
  console.log(`   Total archive size:    ${formatBytes(totalSize)}`);
  console.log(`   Archive efficiency:    ${totalArchived > 0 ? Math.round((totalArchived / (totalActive + totalArchived)) * 100) : 0}%`);
  
  // Find all .archive* directories
  console.log('\n📍 Archive Locations:');
  const allArchiveDirs = await glob('**/.archive*', {
    cwd: PROJECT_ROOT,
    ignore: ['**/node_modules/**'],
    onlyDirectories: true
  });
  
  for (const archiveDir of allArchiveDirs.slice(0, 20)) {
    console.log(`   ${archiveDir}`);
  }
  
  if (allArchiveDirs.length > 20) {
    console.log(`   ... and ${allArchiveDirs.length - 20} more`);
  }
  
  console.log('\n💡 Tips:');
  console.log('   - Use "archive-cli.sh archive-docs --dry-run" to preview what would be archived');
  console.log('   - Use "archive-cli.sh search <term>" to search in archived files');
  console.log('   - Use "archive-cli.sh cleanup-empty" to remove empty directories');
}

// Main execution
if (require.main === module) {
  generateReport().catch(console.error);
}

export { generateReport };