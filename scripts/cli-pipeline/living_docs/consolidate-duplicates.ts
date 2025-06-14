#!/usr/bin/env ts-node
import { LivingDocsPrioritizationService } from '../../../packages/shared/services/living-docs-prioritization-service';

async function consolidateDuplicates() {
  console.log('🔄 Consolidating duplicate documents...');
  
  const service = LivingDocsPrioritizationService.getInstance();
  
  try {
    const report = await service.analyzeLivingDocs();
    
    if (report.duplicates.length === 0) {
      console.log('✅ No duplicates found!');
      return;
    }
    
    console.log(`\n⚠️  Found ${report.duplicates.length} potential duplicates:`);
    
    report.duplicates.forEach((dup, index) => {
      console.log(`\n${index + 1}. Potential Duplicate:`);
      console.log(`   📄 Document 1: ${dup.doc1}`);
      console.log(`   📄 Document 2: ${dup.doc2}`);
      console.log(`   🔍 Reason: ${dup.reason}`);
      console.log(`   💡 Action: Manual review required`);
    });
    
    console.log(`\n📋 Consolidation Steps:`);
    console.log(`1. Review each pair manually`);
    console.log(`2. Merge content from the less comprehensive document`);
    console.log(`3. Update metadata and references`);
    console.log(`4. Archive or delete the redundant document`);
    console.log(`5. Update any cross-references`);
    
    console.log(`\n⚠️  This is a manual process - automatic consolidation could lose important content.`);
    
  } catch (error) {
    console.error('❌ Error consolidating duplicates:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  consolidateDuplicates();
}