#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function main() {
  const supabase = SupabaseClientService.getInstance().getClient();

  // Query summary of archived packages
  const { data, error } = await supabase
    .from('sys_archived_package_files')
    .select('package_name, file_type, file_size')
    .order('package_name');

  if (error) {
    console.error('Error querying archived files:', error);
    return;
  }

  // Group by package
  const summary = data.reduce((acc: any, file: any) => {
    if (!acc[file.package_name]) {
      acc[file.package_name] = {
        files: 0,
        totalSize: 0,
        fileTypes: new Set()
      };
    }
    acc[file.package_name].files++;
    acc[file.package_name].totalSize += file.file_size || 0;
    acc[file.package_name].fileTypes.add(file.file_type);
    return acc;
  }, {});

  console.log('\n📊 Archived Package Summary');
  console.log('===========================');
  
  for (const [packageName, stats] of Object.entries(summary)) {
    const s = stats as any;
    console.log(`\n📦 ${packageName}`);
    console.log(`   Files: ${s.files}`);
    console.log(`   Total Size: ${(s.totalSize / 1024).toFixed(2)} KB`);
    console.log(`   File Types: ${Array.from(s.fileTypes).join(', ')}`);
  }

  // Total summary
  const totalFiles = Object.values(summary).reduce((sum: number, s: any) => sum + s.files, 0);
  const totalSize = Object.values(summary).reduce((sum: number, s: any) => sum + s.totalSize, 0);
  
  console.log('\n📈 Total Summary');
  console.log(`   Packages Archived: ${Object.keys(summary).length}`);
  console.log(`   Total Files: ${totalFiles}`);
  console.log(`   Total Size: ${(totalSize / 1024).toFixed(2)} KB`);
}

main().catch(console.error);