#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface PackageToArchive {
  name: string;
  reason: string;
}

async function getFileStats(filePath: string) {
  try {
    const stats = await fs.promises.stat(filePath);
    return {
      size: stats.size,
      modified: stats.mtime
    };
  } catch (error) {
    return {
      size: 0,
      modified: new Date()
    };
  }
}

async function getFileType(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  const typeMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.json': 'json',
    '.md': 'markdown',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.sh': 'shell',
    '.sql': 'sql'
  };
  return typeMap[ext] || 'other';
}

async function getAllFiles(dir: string, fileList: string[] = []): Promise<string[]> {
  const files = await fs.promises.readdir(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = await fs.promises.stat(filePath);
    
    if (stat.isDirectory() && file !== 'node_modules' && file !== '.git') {
      await getAllFiles(filePath, fileList);
    } else if (stat.isFile()) {
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

async function archivePackage(packageName: string, reason: string) {
  const supabase = SupabaseClientService.getInstance().getClient();
  const sourceDir = path.join(process.cwd(), 'packages', packageName);
  const archiveDir = path.join(process.cwd(), 'packages', '.archived_packages');
  const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const targetDir = path.join(archiveDir, `${packageName}.${timestamp}`);

  console.log(`\n📦 Archiving package: ${packageName}`);
  console.log(`   Reason: ${reason}`);

  // Check if source exists
  if (!fs.existsSync(sourceDir)) {
    console.log(`   ❌ Package not found: ${sourceDir}`);
    return;
  }

  // Create archive directory if it doesn't exist
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }

  // Get all files in the package
  const files = await getAllFiles(sourceDir);
  console.log(`   Found ${files.length} files to archive`);

  // Track each file in the database
  const records = [];
  for (const file of files) {
    const relativePath = path.relative(process.cwd(), file);
    const archivedPath = relativePath.replace(`packages/${packageName}`, `packages/.archived_packages/${packageName}.${timestamp}`);
    const stats = await getFileStats(file);
    const fileType = await getFileType(file);

    records.push({
      package_name: packageName,
      original_path: relativePath,
      archived_path: archivedPath,
      file_type: fileType,
      file_size: stats.size,
      last_modified: stats.modified,
      archive_reason: reason,
      dependencies_count: 0 // This was already analyzed in the report
    });
  }

  // Insert records into database
  if (records.length > 0) {
    const { error } = await supabase
      .from('sys_archived_package_files')
      .insert(records);

    if (error) {
      console.error(`   ❌ Database error:`, error);
      return;
    }
    console.log(`   ✅ Tracked ${records.length} files in database`);
  }

  // Move the package directory
  try {
    execSync(`mv "${sourceDir}" "${targetDir}"`, { stdio: 'inherit' });
    console.log(`   ✅ Moved to: ${path.relative(process.cwd(), targetDir)}`);
  } catch (error) {
    console.error(`   ❌ Failed to move package:`, error);
  }
}

async function main() {
  console.log('🗑️  Starting Phase 1 Package Archival');
  console.log('=====================================');

  // Packages to archive in Phase 1
  const packagesToArchive: PackageToArchive[] = [
    { name: 'cli-pipeline', reason: 'Nearly empty, no active imports found' },
    { name: 'dal', reason: 'Deprecated Python utilities, no usage found' },
    { name: 'modal', reason: 'Single file, functionality exists elsewhere' }
  ];

  for (const pkg of packagesToArchive) {
    await archivePackage(pkg.name, pkg.reason);
  }

  console.log('\n✅ Phase 1 archival complete!');
  console.log('\nNext steps:');
  console.log('- Update .gitignore to exclude archived packages');
  console.log('- Remove archived packages from build configurations');
  console.log('- Proceed with Phase 2: Migrate packages/cli services to shared');
}

main().catch(console.error);