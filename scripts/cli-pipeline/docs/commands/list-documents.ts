#!/usr/bin/env ts-node

/**
 * List all monitored living documents
 * Shows status, review dates, and basic information
 */

import { program } from 'commander';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client.js';

async function listDocuments(options: any = {}) {
  try {
    console.log('📋 Listing monitored living documents...');
    const supabase = SupabaseClientService.getInstance().getClient();
    
    let query = supabase
      .from('doc_continuous_monitoring')
      .select('*')
      .order('priority', { ascending: false })
      .order('area')
      .order('title');
    
    // Apply filters
    if (options.status) {
      query = query.eq('status', options.status);
    }
    
    if (options.area) {
      query = query.eq('area', options.area);
    }
    
    if (options.priority) {
      query = query.eq('priority', options.priority);
    }
    
    const { data: documents, error } = await query;
    
    if (error) throw error;
    
    if (!documents || documents.length === 0) {
      console.log('📄 No documents found matching the criteria.');
      return;
    }
    
    console.log(`\\n📚 Found ${documents.length} document(s):\\n`);
    
    // Group by area for better organization
    const byArea = documents.reduce((acc: any, doc: any) => {
      if (!acc[doc.area]) acc[doc.area] = [];
      acc[doc.area].push(doc);
      return acc;
    }, {});
    
    Object.entries(byArea).forEach(([area, docs]: [string, any[]]) => {
      console.log(`🏷️  **${area.toUpperCase()}** (${docs.length} documents)`);
      
      docs.forEach((doc: any) => {
        const lastUpdated = new Date(doc.last_updated).toLocaleDateString();
        const nextReview = new Date(doc.next_review_date).toLocaleDateString();
        const isOverdue = new Date(doc.next_review_date) < new Date();
        
        const statusEmoji = doc.status === 'active' ? '✅' : 
                           doc.status === 'needs-review' ? '⏰' :
                           doc.status === 'updating' ? '🔄' : '⚠️';
        
        const priorityEmoji = doc.priority === 'high' ? '🔴' : 
                             doc.priority === 'medium' ? '🟡' : '🟢';
        
        const overdueEmoji = isOverdue ? '⚠️ ' : '';
        
        console.log(`   ${statusEmoji} ${priorityEmoji} **${doc.title}**`);
        console.log(`      📁 ${doc.file_path}`);
        console.log(`      📝 ${doc.description || 'No description'}`);
        console.log(`      ⏰ Last updated: ${lastUpdated} | Next review: ${overdueEmoji}${nextReview}`);
        console.log(`      🔄 Review every ${doc.review_frequency_days} days`);
        console.log(`      🆔 ID: ${doc.id}`);
        console.log('');
      });
    });
    
    // Summary statistics
    console.log('📊 Summary:');
    const stats = documents.reduce((acc: any, doc: any) => {
      // Count by status
      acc.status[doc.status] = (acc.status[doc.status] || 0) + 1;
      
      // Count by priority
      acc.priority[doc.priority] = (acc.priority[doc.priority] || 0) + 1;
      
      // Count overdue
      if (new Date(doc.next_review_date) < new Date()) {
        acc.overdue++;
      }
      
      return acc;
    }, { status: {}, priority: {}, overdue: 0 });
    
    console.log(`   📋 Total: ${documents.length}`);
    console.log(`   ⚠️  Overdue: ${stats.overdue}`);
    console.log(`   📊 By Status: ${Object.entries(stats.status).map(([k, v]) => `${k}(${v})`).join(', ')}`);
    console.log(`   🎯 By Priority: ${Object.entries(stats.priority).map(([k, v]) => `${k}(${v})`).join(', ')}`);
    
    if (stats.overdue > 0) {
      console.log(`\\n⏰ Use './docs-cli.sh check-reviews' to see which documents need attention.`);
    }
    
  } catch (error) {
    console.error('❌ Error listing documents:', error);
    process.exit(1);
  }
}

// CLI setup
program
  .name('list-documents')
  .description('List all monitored living documents')
  .option('-s, --status <status>', 'Filter by status (active, needs-review, updating, deprecated)')
  .option('-a, --area <area>', 'Filter by area')
  .option('-p, --priority <priority>', 'Filter by priority (high, medium, low)')
  .action(async (options) => {
    await listDocuments(options);
  });

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}

export { listDocuments };