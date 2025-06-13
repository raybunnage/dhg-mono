#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

async function quickValidateUnused() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('🔍 Quick validation of high-risk unused services...\n');
  
  // Get unused services
  const { data: unusedServices, error } = await supabase
    .from('registry_unused_services_view')
    .select('service_name, package_path')
    .eq('is_unused', true)
    .order('service_name');
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  // High-confidence safe-to-archive patterns
  const safePatterns = [
    /^index$/,           // Generic index files
    /^types$/,           // Type definition files  
    /config$/,           // Config files
    /setup$/,            // Setup files
    /test/,              // Test-related
    /-utils?$/,          // Utility files
    /-helper$/,          // Helper files
    /template/,          // Template files
  ];
  
  // Definitely-used patterns (environment-specific)
  const usedPatterns = [
    /browser/,           // Browser-specific
    /^auth/,             // Authentication
    /google-drive/,      // Google Drive services
    /claude/,            // Claude AI services
    /supabase/,          // Supabase services
    /media/,             // Media services
    /tracking/,          // Tracking services
  ];
  
  const safeToArchive: string[] = [];
  const likelyUsed: string[] = [];
  const needsReview: string[] = [];
  
  for (const service of unusedServices) {
    const name = service.service_name;
    
    if (safePatterns.some(pattern => pattern.test(name))) {
      safeToArchive.push(name);
    } else if (usedPatterns.some(pattern => pattern.test(name))) {
      likelyUsed.push(name);
    } else {
      needsReview.push(name);
    }
  }
  
  console.log('🗑️  HIGH-CONFIDENCE SAFE TO ARCHIVE:', safeToArchive.length);
  safeToArchive.forEach(name => console.log(`   📦 ${name}`));
  
  console.log('\n⚠️  LIKELY ACTUALLY USED (registry issue):', likelyUsed.length);
  likelyUsed.forEach(name => console.log(`   📦 ${name}`));
  
  console.log('\n🔍 NEEDS MANUAL REVIEW:', needsReview.length);
  needsReview.forEach(name => console.log(`   📦 ${name}`));
  
  console.log('\n📊 Summary:');
  console.log(`   Safe to archive: ${safeToArchive.length}`);
  console.log(`   Likely used: ${likelyUsed.length}`);  
  console.log(`   Needs review: ${needsReview.length}`);
  console.log(`   Total: ${unusedServices.length}`);
  
  return { safeToArchive, likelyUsed, needsReview };
}

if (require.main === module) {
  quickValidateUnused().catch(console.error);
}