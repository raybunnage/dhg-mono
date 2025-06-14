#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import * as fg from 'fast-glob';

async function main() {
  console.log('🔄 Migrating Registry Scripts to use SupabaseClientService');
  console.log('=========================================================\n');
  
  // Find all registry files that import from supabase-helper
  const registryFiles = fg.sync('scripts/cli-pipeline/registry/**/*.ts', {
    ignore: ['**/node_modules/**'],
    cwd: process.cwd()
  });
  
  let updatedCount = 0;
  
  for (const file of registryFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    
    if (content.includes("from './utils/supabase-helper'") || 
        content.includes('from "../utils/supabase-helper"')) {
      
      console.log(`📝 Updating ${path.relative(process.cwd(), file)}`);
      
      let newContent = content;
      
      // Replace the import
      newContent = newContent.replace(
        /import { getSupabaseClient[^}]*} from ['"]\.\.?\/utils\/supabase-helper['"];?/g,
        "import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';"
      );
      
      // Replace usage
      newContent = newContent.replace(
        /const supabase = getSupabaseClient\(\);/g,
        "const supabase = SupabaseClientService.getInstance().getClient();"
      );
      
      // Replace inline usage
      newContent = newContent.replace(
        /getSupabaseClient\(\)/g,
        "SupabaseClientService.getInstance().getClient()"
      );
      
      // Write the updated file
      fs.writeFileSync(file, newContent);
      updatedCount++;
    }
  }
  
  console.log(`\n✅ Updated ${updatedCount} files`);
  
  // Archive the supabase-helper.ts file
  const helperPath = 'scripts/cli-pipeline/registry/utils/supabase-helper.ts';
  if (fs.existsSync(helperPath)) {
    const archivePath = helperPath.replace('.ts', `.archived.${Date.now()}.ts`);
    fs.renameSync(helperPath, archivePath);
    console.log(`\n📦 Archived supabase-helper.ts to ${path.basename(archivePath)}`);
  }
  
  console.log('\n📋 Next steps:');
  console.log('1. Run TypeScript compilation to check for errors: pnpm tsc --noEmit');
  console.log('2. Test the registry commands to ensure they still work');
  console.log('3. Remove SupabaseClient from sys_shared_services database');
}

main().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});