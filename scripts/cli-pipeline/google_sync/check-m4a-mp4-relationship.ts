#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function checkM4aToMp4Relationship() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('🔍 Investigating m4a to mp4 file relationships...\n');
  
  // First, get a sample of m4a files
  const { data: m4aFiles, error: m4aError } = await supabase
    .from('google_sources')
    .select('id, name, path, parent_folder_id, mime_type')
    .or('mime_type.eq.audio/x-m4a,mime_type.eq.audio/mp4a,mime_type.like.%m4a%')
    .is('is_deleted', false)
    .limit(10);
    
  if (m4aError) {
    console.error('Error fetching m4a files:', m4aError);
    return;
  }
  
  console.log(`Found ${m4aFiles?.length || 0} m4a files\n`);
  
  // For each m4a file, try to find corresponding mp4
  for (const m4aFile of m4aFiles || []) {
    console.log(`\n📎 M4A File: ${m4aFile.name}`);
    console.log(`   Path: ${m4aFile.path}`);
    
    // Strategy 1: Look for mp4 with similar name in same folder
    const baseName = m4aFile.name.replace(/\.m4a$/i, '');
    const { data: mp4InSameFolder } = await supabase
      .from('google_sources')
      .select('id, name, path, mime_type')
      .eq('parent_folder_id', m4aFile.parent_folder_id)
      .ilike('name', `${baseName}%`)
      .or('mime_type.eq.video/mp4,mime_type.like.%mp4%')
      .is('is_deleted', false);
      
    if (mp4InSameFolder && mp4InSameFolder.length > 0) {
      console.log(`   ✅ Found potential MP4 matches in same folder:`);
      for (const mp4 of mp4InSameFolder) {
        console.log(`      - ${mp4.name}`);
        
        // Check if this mp4 has an expert_document with title
        const { data: expertDoc } = await supabase
          .from('expert_documents')
          .select('id, title, source_id')
          .eq('source_id', mp4.id)
          .single();
          
        if (expertDoc?.title) {
          console.log(`        🏷️  Title: "${expertDoc.title}"`);
        } else {
          console.log(`        ❌ No expert_document found`);
        }
      }
    } else {
      console.log(`   ❌ No MP4 found in same folder`);
    }
    
    // Check if the m4a itself has an expert_document
    const { data: m4aExpertDoc } = await supabase
      .from('expert_documents')
      .select('id, title')
      .eq('source_id', m4aFile.id)
      .single();
      
    if (m4aExpertDoc?.title) {
      console.log(`   📄 M4A has its own expert_document with title: "${m4aExpertDoc.title}"`);
    } else {
      console.log(`   📄 M4A has no expert_document`);
    }
  }
}

checkM4aToMp4Relationship()
  .then(() => {
    console.log('\n✅ Analysis complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });