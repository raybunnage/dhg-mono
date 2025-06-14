#!/usr/bin/env ts-node
import { LivingDocsPrioritizationService } from '../../../packages/shared/services/living-docs-prioritization-service';

async function analyzeLivingDocs() {
  console.log('🔍 Analyzing living documents for duplicates and issues...');
  
  const service = LivingDocsPrioritizationService.getInstance();
  
  try {
    const report = await service.analyzeLivingDocs();
    
    console.log('\n📊 Analysis Report:');
    console.log(`- Total documents: ${report.totalDocuments}`);
    console.log(`- High priority: ${report.highPriority.length}`);
    console.log(`- Medium priority: ${report.mediumPriority.length}`);
    console.log(`- Low priority: ${report.lowPriority.length}`);
    console.log(`- Needs review: ${report.needsUpdate.length}`);
    console.log(`- Potential duplicates: ${report.duplicates.length}`);
    
    if (report.duplicates.length > 0) {
      console.log('\n⚠️  Potential Duplicates Found:');
      report.duplicates.forEach(dup => {
        console.log(`  - ${dup.doc1} ↔️ ${dup.doc2}: ${dup.reason}`);
      });
    }
    
    if (report.needsUpdate.length > 0) {
      console.log('\n📅 Documents Needing Review:');
      report.needsUpdate.forEach(doc => {
        console.log(`  - ${doc.title} (Due: ${doc.nextReview})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error analyzing documents:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  analyzeLivingDocs();
}