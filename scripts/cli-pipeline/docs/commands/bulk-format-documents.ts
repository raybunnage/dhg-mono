#!/usr/bin/env ts-node

/**
 * Bulk format all continuously-updated documents
 * Applies the standardized template to all documents in docs/continuously-updated
 */

import fs from 'fs';
import path from 'path';
import { formatDocument } from './format-document.js';
import { DOCUMENT_CONFIGS } from './sync-to-database.js';

async function bulkFormatDocuments() {
  try {
    console.log('🔄 Starting bulk format of continuously-updated documents...');
    
    const docsDir = path.resolve('docs/continuously-updated');
    
    if (!fs.existsSync(docsDir)) {
      console.error(`❌ Directory not found: ${docsDir}`);
      process.exit(1);
    }
    
    let formatted = 0;
    let skipped = 0;
    let errors = 0;
    
    console.log(`📁 Processing documents in: ${docsDir}`);
    
    // Use the configured documents list for consistent processing
    for (const config of DOCUMENT_CONFIGS) {
      const fullPath = path.resolve(config.path);
      
      console.log(`\\n📝 Processing: ${config.title}`);
      console.log(`   📄 File: ${config.path}`);
      
      if (!fs.existsSync(fullPath)) {
        console.log(`   ⚠️  File not found, skipping`);
        skipped++;
        continue;
      }
      
      try {
        // Create backup before formatting
        const originalContent = fs.readFileSync(fullPath, 'utf-8');
        const backupPath = `${fullPath}.backup.${Date.now()}`;
        fs.writeFileSync(backupPath, originalContent);
        
        // Format the document
        await formatDocument(config.path);
        
        console.log(`   ✅ Formatted successfully`);
        console.log(`   💾 Backup: ${path.basename(backupPath)}`);
        formatted++;
        
      } catch (error) {
        console.error(`   ❌ Error formatting:`, error);
        errors++;
      }
    }
    
    console.log('\\n📊 Bulk Format Summary:');
    console.log(`   ✅ Formatted: ${formatted}`);
    console.log(`   ⚠️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📋 Total: ${DOCUMENT_CONFIGS.length}`);
    
    if (formatted > 0) {
      console.log('\\n🎉 Bulk formatting completed!');
      console.log('\\n📋 Next steps:');
      console.log('   1. Review the formatted documents');
      console.log('   2. Update content placeholders with actual information');
      console.log('   3. Use `./docs-cli.sh sync-db` to update database records');
      console.log('   4. Set up daily review reminders');
    }
    
  } catch (error) {
    console.error('❌ Error in bulk formatting:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  bulkFormatDocuments();
}

export { bulkFormatDocuments };