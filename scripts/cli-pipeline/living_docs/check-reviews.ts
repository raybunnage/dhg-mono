#!/usr/bin/env ts-node
import { LivingDocsPrioritizationService } from '../../../packages/shared/services/living-docs-prioritization-service';

async function checkReviews() {
  console.log('📅 Checking documents needing review...');
  
  const service = LivingDocsPrioritizationService.getInstance();
  
  try {
    const report = await service.analyzeLivingDocs();
    
    if (report.needsUpdate.length === 0) {
      console.log('✅ All documents are up to date!');
      return;
    }
    
    console.log(`\n⚠️  ${report.needsUpdate.length} documents need review:`);
    
    report.needsUpdate.forEach((doc, index) => {
      const overdue = new Date(doc.nextReview) < new Date();
      const status = overdue ? '🚨 OVERDUE' : '⏰ Due Soon';
      
      console.log(`\n${index + 1}. ${doc.title}`);
      console.log(`   File: ${doc.filePath}`);
      console.log(`   Review Date: ${doc.nextReview} ${status}`);
      console.log(`   Priority: ${doc.priority}`);
      console.log(`   Category: ${doc.category}`);
    });
    
    console.log(`\n📊 Summary: ${report.needsUpdate.length} documents need attention`);
    
  } catch (error) {
    console.error('❌ Error checking reviews:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  checkReviews();
}