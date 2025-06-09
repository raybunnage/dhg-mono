#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

async function queryTables() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('\n=== DOC_CONTINUOUS_MONITORING ===');
  const { data: monitoring, error: monError } = await supabase
    .from('doc_continuous_monitoring')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (monError) {
    console.error('Error querying doc_continuous_monitoring:', monError);
  } else {
    console.log(`Found ${monitoring?.length || 0} records:`);
    monitoring?.forEach((record, i) => {
      console.log(`${i + 1}. ${record.title} (${record.area})`);
      console.log(`   Path: ${record.file_path}`);
      console.log(`   Status: ${record.status}, Priority: ${record.priority}`);
      console.log(`   Next Review: ${record.next_review_date}`);
      console.log(`   Description: ${record.description || 'N/A'}`);
      console.log('');
    });
  }
  
  console.log('\n=== DOC_CONTINUOUS_TRACKING ===');
  const { data: tracking, error: trackError } = await supabase
    .from('doc_continuous_tracking')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (trackError) {
    console.error('Error querying doc_continuous_tracking:', trackError);
  } else {
    console.log(`Found ${tracking?.length || 0} records:`);
    tracking?.forEach((record, i) => {
      console.log(`${i + 1}. ${record.document_name} (${record.category})`);
      console.log(`   Path: ${record.file_path}`);
      console.log(`   Frequency: ${record.update_frequency}`);
      console.log(`   Enabled: ${record.enabled}`);
      console.log(`   Last Updated: ${record.last_updated_at || 'Never'}`);
      console.log(`   Next Update: ${record.next_update_at || 'Not scheduled'}`);
      console.log(`   Source Paths: ${record.source_paths?.join(', ') || 'None'}`);
      console.log('');
    });
  }
  
  console.log('\n=== DOC_CONTINUOUS_UPDATES ===');
  const { data: updates, error: updateError } = await supabase
    .from('doc_continuous_updates')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (updateError) {
    console.error('Error querying doc_continuous_updates:', updateError);
  } else {
    console.log(`Found ${updates?.length || 0} records:`);
    updates?.forEach((record, i) => {
      console.log(`${i + 1}. ${record.update_type} - ${record.update_status}`);
      console.log(`   Changes: ${record.changes_detected ? 'Yes' : 'No'}`);
      console.log(`   Summary: ${record.changes_summary || 'N/A'}`);
      console.log(`   Started: ${record.started_at || 'N/A'}`);
      console.log(`   Completed: ${record.completed_at || 'N/A'}`);
      console.log(`   Error: ${record.error_message || 'None'}`);
      console.log('');
    });
  }
}

// Check if the continuous docs server file exists
import * as fs from 'fs';
import * as path from 'path';

async function checkContinuousDocsFiles() {
  console.log('\n=== CONTINUOUS DOCS FILES ===');
  
  const serverPath = path.join(__dirname, '../../../../apps/dhg-admin-code/continuous-docs-server.cjs');
  const trackingPath = path.join(__dirname, '../../../../.tracking.json');
  
  if (fs.existsSync(serverPath)) {
    console.log('✅ continuous-docs-server.cjs exists');
  } else {
    console.log('❌ continuous-docs-server.cjs NOT found');
  }
  
  if (fs.existsSync(trackingPath)) {
    console.log('✅ .tracking.json exists');
    try {
      const content = fs.readFileSync(trackingPath, 'utf8');
      const data = JSON.parse(content);
      console.log(`   Contains ${Object.keys(data).length} tracked documents`);
      Object.entries(data).forEach(([filename, info]: [string, any]) => {
        console.log(`   - ${filename}: ${info.frequency} (${info.enabled ? 'enabled' : 'disabled'})`);
      });
    } catch (err) {
      console.log('   Error reading .tracking.json:', err);
    }
  } else {
    console.log('❌ .tracking.json NOT found');
  }
}

async function main() {
  await queryTables();
  await checkContinuousDocsFiles();
}

main().catch(console.error);