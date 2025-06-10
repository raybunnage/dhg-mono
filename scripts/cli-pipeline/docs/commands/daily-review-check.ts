#!/usr/bin/env ts-node

/**
 * Daily review check for living documents
 * Shows which documents need review and sends notifications
 */

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client.js';

async function dailyReviewCheck() {
  try {
    console.log('🗓️  Running daily review check...');
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Get documents needing review
    const { data: needingReview, error } = await supabase
      .rpc('get_docs_needing_review');
    
    if (error) throw error;
    
    const currentDate = new Date().toLocaleDateString();
    console.log(`📅 Daily Review Check - ${currentDate}`);
    
    if (!needingReview || needingReview.length === 0) {
      console.log('✅ All documents are up to date!');
      console.log('🎉 No action needed today.');
      return;
    }
    
    console.log(`⚠️  ATTENTION: ${needingReview.length} documents need review\\n`);
    
    // Group by urgency
    const urgent = needingReview.filter((doc: any) => doc.days_overdue >= 7 || doc.priority === 'high');
    const normal = needingReview.filter((doc: any) => doc.days_overdue < 7 && doc.priority !== 'high');
    
    if (urgent.length > 0) {
      console.log('🚨 URGENT - Needs immediate attention:');
      urgent.forEach((doc: any) => {
        console.log(`   📄 ${doc.title} (${doc.days_overdue} days overdue)`);
        console.log(`      📁 ${doc.file_path}`);
      });
      console.log('');
    }
    
    if (normal.length > 0) {
      console.log('⏰ Standard Review:');
      normal.forEach((doc: any) => {
        console.log(`   📄 ${doc.title}`);
        console.log(`      📁 ${doc.file_path}`);
      });
      console.log('');
    }
    
    // Show daily commands
    console.log('📋 Daily Commands:');
    console.log('   ./docs-cli.sh check-reviews    # Detailed review status');
    console.log('   ./docs-cli.sh list --priority high  # High priority docs');
    console.log('   ./docs-cli.sh format --path <file>  # Update document format');
    console.log('');
    
    // Summary
    console.log('📊 Daily Summary:');
    console.log(`   🔴 Urgent: ${urgent.length}`);
    console.log(`   🟡 Normal: ${normal.length}`);
    console.log(`   📋 Total: ${needingReview.length}`);
    
  } catch (error) {
    console.error('❌ Error in daily review check:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  dailyReviewCheck();
}

export { dailyReviewCheck };