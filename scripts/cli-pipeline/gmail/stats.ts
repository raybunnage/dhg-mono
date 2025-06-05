#!/usr/bin/env ts-node

import { createSupabaseAdapter } from '../../../../packages/shared/adapters/supabase-adapter';

async function showStats() {
  console.log('Gmail Pipeline Statistics\n');

  try {
    const supabase = createSupabaseAdapter();
    
    // Overall message count
    const { count: totalMessages } = await supabase
      .from('email_messages')
      .select('*', { count: 'exact', head: true });

    console.log('📊 Message Statistics:');
    console.log('=' .repeat(50));
    console.log(`Total messages: ${totalMessages || 0}`);

    // Messages by importance
    const { data: importanceStats } = await supabase
      .from('email_messages')
      .select('from_important_address')
      .not('from_important_address', 'is', null);

    if (importanceStats) {
      const importantCount = importanceStats.filter(m => m.from_important_address).length;
      const regularCount = (totalMessages || 0) - importantCount;
      console.log(`From important addresses: ${importantCount}`);
      console.log(`From other addresses: ${regularCount}`);
    }

    // Date range
    const { data: dateRange } = await supabase
      .from('email_messages')
      .select('date')
      .order('date', { ascending: true })
      .limit(1);

    const { data: latestDate } = await supabase
      .from('email_messages')
      .select('date')
      .order('date', { ascending: false })
      .limit(1);

    if (dateRange?.[0] && latestDate?.[0]) {
      console.log(`\nDate range: ${new Date(dateRange[0].date).toLocaleDateString()} to ${new Date(latestDate[0].date).toLocaleDateString()}`);
    }

    // Processed content stats
    console.log('\n📝 Processing Statistics:');
    console.log('=' .repeat(50));
    
    const { count: processedCount } = await supabase
      .from('email_processed_contents')
      .select('*', { count: 'exact', head: true });
    
    console.log(`Processed emails: ${processedCount || 0}`);

    // URL extraction stats
    const { count: urlCount } = await supabase
      .from('email_extracted_urls')
      .select('*', { count: 'exact', head: true });
    
    console.log(`Extracted URLs: ${urlCount || 0}`);

    // Concept extraction stats
    const { count: conceptCount } = await supabase
      .from('email_extracted_concepts')
      .select('*', { count: 'exact', head: true });
    
    console.log(`Extracted concepts: ${conceptCount || 0}`);

    // Attachment stats
    const { count: attachmentCount } = await supabase
      .from('email_attachments')
      .select('*', { count: 'exact', head: true });
    
    console.log(`Attachments found: ${attachmentCount || 0}`);

    // Top senders
    console.log('\n📧 Top Senders:');
    console.log('=' .repeat(50));
    
    const { data: senders } = await supabase
      .from('email_messages')
      .select('from_email');

    if (senders && senders.length > 0) {
      const senderCounts = senders.reduce((acc: Record<string, number>, msg) => {
        if (msg.from_email) {
          acc[msg.from_email] = (acc[msg.from_email] || 0) + 1;
        }
        return acc;
      }, {});

      const topSenders = Object.entries(senderCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

      topSenders.forEach(([email, count], index) => {
        console.log(`${index + 1}. ${email} (${count} messages)`);
      });
    } else {
      console.log('No senders found');
    }

    // Recent activity
    console.log('\n🕐 Recent Activity:');
    console.log('=' .repeat(50));
    
    const { data: recentMessages } = await supabase
      .from('email_messages')
      .select('subject, from_email, date')
      .order('date', { ascending: false })
      .limit(5);

    if (recentMessages && recentMessages.length > 0) {
      recentMessages.forEach(msg => {
        const date = new Date(msg.date).toLocaleDateString();
        console.log(`${date}: "${msg.subject}" from ${msg.from_email}`);
      });
    } else {
      console.log('No recent messages');
    }

    console.log('\n✅ Statistics generated successfully!');
    
  } catch (error) {
    console.error('❌ Failed to generate statistics:', error);
    process.exit(1);
  }
}

// Run stats
showStats().catch(console.error);