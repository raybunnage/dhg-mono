#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

/**
 * Standardize work summary categories in ai_work_summaries table
 * This will clean up duplicate categories like bug_fix, bugfix, bug-fix -> bug
 */

// Same mapping as in the UI component
const categoryMapping: Record<string, string> = {
  // Feature variations -> feature
  'feature': 'feature',
  'feature-development': 'feature',
  
  // Bug fix variations -> bug
  'bug': 'bug',
  'bug_fix': 'bug',
  'bug-fix': 'bug', 
  'bugfix': 'bug',
  
  // Refactoring variations -> refactor
  'refactor': 'refactor',
  'refactoring': 'refactor',
  
  // Documentation variations -> documentation
  'documentation': 'documentation',
  'docs': 'documentation',
  
  // Infrastructure and maintenance -> maintenance
  'infrastructure': 'maintenance',
  'maintenance': 'maintenance',
  'merge': 'maintenance',
  
  // Keep question as is
  'question': 'question',
};

async function standardizeCategories() {
  console.log('🔧 Standardizing work summary categories...');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Get all current categories and their counts
    const { data: summaries, error: fetchError } = await supabase
      .from('ai_work_summaries')
      .select('id, category')
      .not('category', 'is', null);
      
    if (fetchError) {
      throw new Error(`Failed to fetch summaries: ${fetchError.message}`);
    }
    
    console.log(`📊 Found ${summaries.length} work summaries to analyze`);
    
    // Group by current categories and show counts
    const categoryCounts: Record<string, number> = {};
    summaries.forEach(s => {
      categoryCounts[s.category] = (categoryCounts[s.category] || 0) + 1;
    });
    
    console.log('\n📋 Current category distribution:');
    Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
      const standardized = categoryMapping[cat] || cat;
      const needsUpdate = standardized !== cat;
      console.log(`  ${cat}: ${count} ${needsUpdate ? `→ ${standardized}` : '✅'}`);
    });
    
    // Find items that need updating
    const updatesNeeded = summaries.filter(s => {
      const standardized = categoryMapping[s.category];
      return standardized && standardized !== s.category;
    });
    
    console.log(`\n🔧 ${updatesNeeded.length} records need category updates`);
    
    if (updatesNeeded.length === 0) {
      console.log('✅ All categories are already standardized!');
      return;
    }
    
    // Group updates by new category for efficiency
    const updateGroups: Record<string, number[]> = {};
    updatesNeeded.forEach(item => {
      const newCategory = categoryMapping[item.category];
      if (!updateGroups[newCategory]) {
        updateGroups[newCategory] = [];
      }
      updateGroups[newCategory].push(item.id);
    });
    
    console.log('\n📝 Planned updates:');
    Object.entries(updateGroups).forEach(([newCategory, ids]) => {
      console.log(`  → ${newCategory}: ${ids.length} records`);
    });
    
    console.log('\n🚀 Applying updates...');
    
    // Apply updates in batches by category
    let totalUpdated = 0;
    for (const [newCategory, ids] of Object.entries(updateGroups)) {
      const { error: updateError } = await supabase
        .from('ai_work_summaries')
        .update({ category: newCategory })
        .in('id', ids);
        
      if (updateError) {
        console.error(`❌ Error updating to ${newCategory}:`, updateError.message);
      } else {
        console.log(`✅ Updated ${ids.length} records to "${newCategory}"`);
        totalUpdated += ids.length;
      }
    }
    
    console.log(`\n🎉 Standardization complete!`);
    console.log(`📊 Updated ${totalUpdated} records`);
    
    // Show final category distribution
    const { data: finalSummaries, error: finalError } = await supabase
      .from('ai_work_summaries')
      .select('category')
      .not('category', 'is', null);
      
    if (!finalError && finalSummaries) {
      const finalCounts: Record<string, number> = {};
      finalSummaries.forEach(s => {
        finalCounts[s.category] = (finalCounts[s.category] || 0) + 1;
      });
      
      console.log('\n📋 Final category distribution:');
      Object.entries(finalCounts).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
        console.log(`  ${cat}: ${count}`);
      });
    }
    
  } catch (error) {
    console.error('\n❌ Standardization failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  standardizeCategories();
}

export { standardizeCategories };