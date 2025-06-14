#!/usr/bin/env ts-node

/**
 * Check which living documents need review
 * Shows documents that are overdue for their scheduled review
 */

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

async function checkReviews() {
  try {
    console.log('🔍 Checking for documents needing review...');
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Get documents needing review
    const { data: needingReview, error } = await supabase
      .rpc('get_docs_needing_review');
    
    if (error) throw error;
    
    if (!needingReview || needingReview.length === 0) {
      console.log('✅ All documents are up to date!');
      return;
    }
    
    console.log(`⏰ ${needingReview.length} documents need review:\\n`);
    
    // Group by priority
    const byPriority = needingReview.reduce((acc: any, doc: any) => {
      if (!acc[doc.priority]) acc[doc.priority] = [];
      acc[doc.priority].push(doc);
      return acc;
    }, {});
    
    // Display high priority first
    const priorities = ['high', 'medium', 'low'];
    
    for (const priority of priorities) {
      const docs = byPriority[priority];
      if (!docs || docs.length === 0) continue;
      
      const emoji = priority === 'high' ? '🔴' : priority === 'medium' ? '🟡' : '🟢';
      console.log(`${emoji} **${priority.toUpperCase()} PRIORITY** (${docs.length} documents)`);
      
      docs.forEach((doc: any) => {
        const daysOverdue = doc.days_overdue;
        const overdueText = daysOverdue > 0 ? `${daysOverdue} days overdue` : 'due today';
        
        console.log(`   📄 ${doc.title}`);
        console.log(`      📁 ${doc.file_path}`);
        console.log(`      ⏰ ${overdueText} (last updated: ${new Date(doc.last_updated).toLocaleDateString()})`);
        console.log(`      🏷️  Area: ${doc.area}`);
        console.log('');
      });
    }
    
    // Show command to update documents
    console.log('📋 To update a document:');
    console.log('   ./docs-cli.sh update --id <document-id> --notes "Updated with new information"');
    console.log('\\n📝 To format documents with new template:');
    console.log('   ./docs-cli.sh format --path <file-path>');
    console.log('\\n🔄 To format all documents:');
    console.log('   ./docs-cli.sh bulk-format');
    
    // Summary by area
    console.log('\\n📊 Review Summary by Area:');
    const byArea = needingReview.reduce((acc: any, doc: any) => {
      if (!acc[doc.area]) acc[doc.area] = 0;
      acc[doc.area]++;
      return acc;
    }, {});
    
    Object.entries(byArea).forEach(([area, count]) => {
      console.log(`   ${area}: ${count} document(s)`);
    });
    
  } catch (error) {
    console.error('❌ Error checking reviews:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  checkReviews();
}

export { checkReviews };