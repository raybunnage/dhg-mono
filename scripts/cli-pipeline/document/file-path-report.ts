/**
 * file-path-report.ts
 * 
 * Script to analyze file paths in documentation_files table and report on:
 * - What directories contain files
 * - How many files are in each directory
 * - What types of files are being indexed
 */
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as path from 'path';

async function generateFilePathReport() {
  console.log('Generating report on file paths in documentation_files table...');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // First get a count of all records
  const { count, error: countError } = await supabase
    .from('documentation_files')
    .select('*', { count: 'exact', head: true });
  
  if (countError) {
    console.error('Error getting count:', countError);
    return;
  }
  
  console.log(`Total records in documentation_files: ${count}`);
  
  // Get all file paths
  const { data: allData, error: allError } = await supabase
    .from('documentation_files')
    .select('id, file_path');
  
  if (allError) {
    console.error('Error fetching file paths:', allError);
    return;
  }
  
  // Analyze directories
  const dirCount: Record<string, number> = {};
  const extensionCount: Record<string, number> = {};
  
  // Process each file path
  allData?.forEach(item => {
    // Get directory path
    const filePath = item.file_path;
    const dirPath = path.dirname(filePath);
    
    // Get file extension
    const ext = path.extname(filePath).toLowerCase();
    
    // Count occurrences
    dirCount[dirPath] = (dirCount[dirPath] || 0) + 1;
    extensionCount[ext] = (extensionCount[ext] || 0) + 1;
  });
  
  // Sort directories by count (descending)
  const sortedDirs = Object.entries(dirCount)
    .sort(([_, countA], [__, countB]) => countB - countA);
  
  // Sort extensions by count (descending)
  const sortedExts = Object.entries(extensionCount)
    .sort(([_, countA], [__, countB]) => countB - countA);
  
  // Report on top directories
  console.log('\n🔍 Top directories with most files:');
  console.log('==========================================');
  sortedDirs.slice(0, 20).forEach(([dir, count], index) => {
    console.log(`${index + 1}. ${dir}: ${count} files`);
  });
  
  // Report on file extensions
  console.log('\n📄 File extensions breakdown:');
  console.log('==========================================');
  sortedExts.forEach(([ext, count]) => {
    const percentage = ((count / (allData?.length || 1)) * 100).toFixed(1);
    console.log(`${ext || '(no extension)'}: ${count} files (${percentage}%)`);
  });
  
  // Identify directories that should be excluded
  console.log('\n⚠️ Directories that might need exclusion:');
  console.log('==========================================');
  
  // Look for directories with patterns that suggest they should be excluded
  const suspiciousPatterns = [
    'node_modules', 'dist', '.git', 'temp', 'tmp',
    'logs', 'debug', 'backup', 'archive', '_archive',
    'transcripts', 'script-analysis-results'
  ];
  
  const suspiciousDirs = sortedDirs.filter(([dir]) => 
    suspiciousPatterns.some(pattern => dir.toLowerCase().includes(pattern))
  );
  
  if (suspiciousDirs.length > 0) {
    suspiciousDirs.forEach(([dir, count]) => {
      console.log(`- ${dir}: ${count} files (possible exclusion candidate)`);
    });
    
    // Calculate impact of excluding these directories
    const totalSuspiciousFiles = suspiciousDirs.reduce((total, [_, count]) => total + count, 0);
    const percentage = ((totalSuspiciousFiles / (allData?.length || 1)) * 100).toFixed(1);
    
    console.log(`\nExcluding these directories would remove ${totalSuspiciousFiles} files (${percentage}% of total)`);
  } else {
    console.log('No suspicious directories found.');
  }
  
  // Check for possibly large/binary files
  console.log('\n🔎 Checking for transcript files that could be excluded:');
  console.log('==========================================');
  
  const transcriptFiles = allData?.filter(item => 
    item.file_path.includes('transcript') || 
    item.file_path.includes('Transcript') ||
    item.file_path.includes('.txt') && (
      item.file_path.includes('debug') || 
      item.file_path.includes('log') ||
      item.file_path.includes('temp')
    )
  );
  
  if (transcriptFiles && transcriptFiles.length > 0) {
    console.log(`Found ${transcriptFiles.length} possible transcript or log files`);
    
    // Show sample of transcript files
    console.log('\nSample transcript/log files:');
    transcriptFiles.slice(0, 10).forEach(item => {
      console.log(`- ${item.file_path}`);
    });
    
    // Calculate percentage
    const percentage = ((transcriptFiles.length / (allData?.length || 1)) * 100).toFixed(1);
    console.log(`\nExcluding transcript/log files would remove ${transcriptFiles.length} files (${percentage}% of total)`);
  } else {
    console.log('No transcript or log files found.');
  }
  
  // Recommend walkDir exclusions
  console.log('\n🛠️ Recommended walkDir exclusion patterns:');
  console.log('==========================================');
  
  // Start with base exclusions
  const recommendedExclusions = [
    'node_modules', 'dist', 'build', '.git',
    'file_types', 'backup', 'archive', '_archive',
    'script-analysis-results', 'reports', 'results_backup',
    'debug-logs', 'document-analysis-results', 'logs', 'transcripts'
  ];
  
  // Add additional exclusions based on findings
  const additionalExclusions = suspiciousDirs
    .map(([dir]) => {
      const baseName = path.basename(dir);
      return baseName;
    })
    .filter(name => !recommendedExclusions.includes(name));
  
  // Combined unique list
  const finalExclusions = [...new Set([...recommendedExclusions, ...additionalExclusions])];
  
  console.log('Recommended excludeDirs array for walkDir method:');
  console.log(`[\n  '${finalExclusions.join("',\n  '")}}'\n]`);
}

// Run the function
generateFilePathReport()
  .catch(console.error)
  .finally(() => console.log('\nReport generation complete.'));