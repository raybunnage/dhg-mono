#!/usr/bin/env ts-node
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { LivingDocsPrioritizationService } from '../../../packages/shared/services/living-docs-prioritization-service';

async function prioritizeLivingDocs() {
  console.log('🔍 Analyzing living documents...');
  
  const service = LivingDocsPrioritizationService.getInstance();
  
  try {
    // Generate the priority dashboard
    const dashboard = await service.generatePriorityDashboard();
    
    // Save to file
    const outputPath = join(process.cwd(), 'docs', 'living-docs', 'PRIORITY-DASHBOARD.md');
    await writeFile(outputPath, dashboard);
    
    console.log('✅ Priority dashboard generated at:', outputPath);
    
    // Also analyze for detailed report
    const report = await service.analyzeLivingDocs();
    
    console.log('\n📊 Summary:');
    console.log(`- Total documents: ${report.totalDocuments}`);
    console.log(`- High priority: ${report.highPriority.length}`);
    console.log(`- Medium priority: ${report.mediumPriority.length}`);
    console.log(`- Low priority: ${report.lowPriority.length}`);
    console.log(`- Needs review: ${report.needsUpdate.length}`);
    console.log(`- Potential duplicates: ${report.duplicates.length}`);
    
    if (report.needsUpdate.length > 0) {
      console.log('\n⚠️  Documents needing immediate review:');
      report.needsUpdate.forEach(doc => {
        console.log(`  - ${doc.title} (Due: ${doc.nextReview})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error prioritizing documents:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  prioritizeLivingDocs();
}