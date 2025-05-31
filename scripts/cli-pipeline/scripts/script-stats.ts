#!/usr/bin/env ts-node
/**
 * Script: script-stats.ts
 * Purpose: Display comprehensive statistics about scripts in the registry
 * Pipeline: scripts
 * Tags: stats, analytics, reporting
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { formatDistanceToNow, format } from 'date-fns';

interface PipelineStats {
  name: string;
  count: number;
  languages: Record<string, number>;
  totalSize: number;
  lastModified: string;
  classified: number;
}

/**
 * Format bytes to human-readable size
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}

/**
 * Main stats function
 */
async function scriptStats() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('📊 Script Registry Statistics\n');
  
  // Fetch all scripts
  const { data: scripts, error } = await supabase
    .from('scripts_registry')
    .select('*')
    .order('last_modified_at', { ascending: false });
  
  if (error) {
    console.error('❌ Error fetching scripts:', error);
    return;
  }
  
  if (!scripts || scripts.length === 0) {
    console.log('No scripts found in registry.');
    return;
  }
  
  // Calculate overall statistics
  const totalScripts = scripts.length;
  const archivedScripts = scripts.filter(s => s.metadata?.is_archived).length;
  const activeScripts = totalScripts - archivedScripts;
  const classifiedScripts = scripts.filter(s => s.document_type_id).length;
  const taggedScripts = scripts.filter(s => 
    (s.ai_generated_tags && s.ai_generated_tags.length > 0) || 
    (s.manual_tags && s.manual_tags.length > 0)
  ).length;
  
  // Calculate size statistics
  let totalSize = 0;
  let minSize = Infinity;
  let maxSize = 0;
  let sizedScripts = 0;
  
  scripts.forEach(script => {
    if (script.metadata?.file_size) {
      const size = script.metadata.file_size;
      totalSize += size;
      minSize = Math.min(minSize, size);
      maxSize = Math.max(maxSize, size);
      sizedScripts++;
    }
  });
  
  const avgSize = sizedScripts > 0 ? totalSize / sizedScripts : 0;
  
  // Pipeline statistics
  const pipelineStats = new Map<string, PipelineStats>();
  
  scripts.forEach(script => {
    const pipeline = script.metadata?.cli_pipeline || 'root';
    
    if (!pipelineStats.has(pipeline)) {
      pipelineStats.set(pipeline, {
        name: pipeline,
        count: 0,
        languages: {},
        totalSize: 0,
        lastModified: '',
        classified: 0
      });
    }
    
    const stats = pipelineStats.get(pipeline)!;
    stats.count++;
    
    if (script.language) {
      stats.languages[script.language] = (stats.languages[script.language] || 0) + 1;
    }
    
    if (script.metadata?.file_size) {
      stats.totalSize += script.metadata.file_size;
    }
    
    if (script.document_type_id) {
      stats.classified++;
    }
    
    if (script.last_modified_at && (!stats.lastModified || script.last_modified_at > stats.lastModified)) {
      stats.lastModified = script.last_modified_at;
    }
  });
  
  // Language distribution
  const languageStats = new Map<string, number>();
  scripts.forEach(script => {
    if (script.language) {
      languageStats.set(script.language, (languageStats.get(script.language) || 0) + 1);
    }
  });
  
  // Document type distribution
  const typeStats = new Map<string, number>();
  scripts.forEach(script => {
    if (script.document_type_id) {
      typeStats.set(script.document_type_id, (typeStats.get(script.document_type_id) || 0) + 1);
    }
  });
  
  // Display overall statistics
  console.log('📈 Overall Statistics');
  console.log('─'.repeat(60));
  console.log(`Total Scripts: ${totalScripts}`);
  console.log(`Active Scripts: ${activeScripts}`);
  console.log(`Archived Scripts: ${archivedScripts} (${((archivedScripts / totalScripts) * 100).toFixed(1)}%)`);
  console.log(`Classified: ${classifiedScripts} (${((classifiedScripts / totalScripts) * 100).toFixed(1)}%)`);
  console.log(`Tagged: ${taggedScripts} (${((taggedScripts / totalScripts) * 100).toFixed(1)}%)`);
  console.log(`\nTotal Size: ${formatFileSize(totalSize)}`);
  console.log(`Average Size: ${formatFileSize(avgSize)}`);
  console.log(`Smallest: ${formatFileSize(minSize === Infinity ? 0 : minSize)}`);
  console.log(`Largest: ${formatFileSize(maxSize)}`);
  
  // Display language distribution
  console.log('\n📝 Language Distribution');
  console.log('─'.repeat(60));
  Array.from(languageStats.entries())
    .sort(([,a], [,b]) => b - a)
    .forEach(([lang, count]) => {
      const percentage = ((count / totalScripts) * 100).toFixed(1);
      const bar = '█'.repeat(Math.round(parseInt(percentage) / 2));
      console.log(`${lang.padEnd(12)} ${count.toString().padStart(4)} (${percentage.padStart(5)}%) ${bar}`);
    });
  
  // Display pipeline statistics
  console.log('\n📁 Pipeline Statistics');
  console.log('─'.repeat(60));
  Array.from(pipelineStats.values())
    .sort((a, b) => b.count - a.count)
    .forEach(stats => {
      console.log(`\n${stats.name}/ (${stats.count} scripts)`);
      console.log(`  Size: ${formatFileSize(stats.totalSize)}`);
      console.log(`  Classified: ${stats.classified} (${((stats.classified / stats.count) * 100).toFixed(1)}%)`);
      
      const langs = Object.entries(stats.languages)
        .sort(([,a], [,b]) => b - a)
        .map(([lang, count]) => `${lang}: ${count}`)
        .join(', ');
      console.log(`  Languages: ${langs}`);
      
      if (stats.lastModified) {
        console.log(`  Last modified: ${formatDistanceToNow(new Date(stats.lastModified), { addSuffix: true })}`);
      }
    });
  
  // Display document type distribution
  if (typeStats.size > 0) {
    console.log('\n📚 Document Type Distribution');
    console.log('─'.repeat(60));
    Array.from(typeStats.entries())
      .sort(([,a], [,b]) => b - a)
      .forEach(([type, count]) => {
        const percentage = ((count / classifiedScripts) * 100).toFixed(1);
        console.log(`${type.padEnd(30)} ${count.toString().padStart(4)} (${percentage.padStart(5)}%)`);
      });
  }
  
  // Recent activity
  console.log('\n🕐 Recent Activity');
  console.log('─'.repeat(60));
  const recentScripts = scripts
    .filter(s => s.last_modified_at)
    .sort((a, b) => new Date(b.last_modified_at!).getTime() - new Date(a.last_modified_at!).getTime())
    .slice(0, 10);
  
  recentScripts.forEach(script => {
    const modified = format(new Date(script.last_modified_at!), 'MMM dd, HH:mm');
    const pipeline = script.metadata?.cli_pipeline || 'root';
    console.log(`${modified} - ${pipeline}/${script.title} (${script.language})`);
  });
  
  // Classification quality
  const highConfidence = scripts.filter(s => 
    s.assessment_quality_score && s.assessment_quality_score >= 0.8
  ).length;
  const mediumConfidence = scripts.filter(s => 
    s.assessment_quality_score && s.assessment_quality_score >= 0.6 && s.assessment_quality_score < 0.8
  ).length;
  const lowConfidence = scripts.filter(s => 
    s.assessment_quality_score && s.assessment_quality_score < 0.6
  ).length;
  
  if (classifiedScripts > 0) {
    console.log('\n🎯 Classification Quality');
    console.log('─'.repeat(60));
    console.log(`High confidence (≥80%): ${highConfidence}`);
    console.log(`Medium confidence (60-79%): ${mediumConfidence}`);
    console.log(`Low confidence (<60%): ${lowConfidence}`);
  }
  
  // Recommendations
  console.log('\n💡 Recommendations');
  console.log('─'.repeat(60));
  
  if (classifiedScripts < totalScripts * 0.8) {
    console.log(`• ${totalScripts - classifiedScripts} scripts need classification. Run: ./scripts-cli.sh sync`);
  }
  
  if (archivedScripts > totalScripts * 0.3) {
    console.log(`• Consider cleaning up archived scripts (${archivedScripts} archived)`);
  }
  
  const untagged = totalScripts - taggedScripts;
  if (untagged > 10) {
    console.log(`• ${untagged} scripts could benefit from tags for better organization`);
  }
  
  console.log('\n✨ Use these commands to improve your script registry:');
  console.log('   ./scripts-cli.sh sync        - Sync and classify all scripts');
  console.log('   ./scripts-cli.sh list        - Browse scripts by pipeline');
  console.log('   ./scripts-cli.sh search      - Find scripts by content');
}

// Run if called directly
if (require.main === module) {
  scriptStats().catch(console.error);
}

export { scriptStats };