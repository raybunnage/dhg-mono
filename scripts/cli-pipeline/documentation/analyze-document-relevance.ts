#!/usr/bin/env ts-node
import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';
import { differenceInDays } from 'date-fns';
import { claudeService } from '../../../packages/shared/services/claude-service/claude-service';

const PROJECT_ROOT = path.join(__dirname, '../../..');
const DOCS_DIR = path.join(PROJECT_ROOT, 'docs');

interface RelevanceAnalysis {
  filePath: string;
  category: string;
  age: number;
  relevanceScore: number;
  recommendation: 'keep' | 'archive' | 'delete';
  reason: string;
  supersededBy?: string;
}

async function analyzeDocumentRelevance(options: {
  category?: string;
  useAI?: boolean;
  outputFile?: string;
} = {}): Promise<void> {
  const { category, useAI = false, outputFile } = options;
  
  console.log('Analyzing document relevance...');
  
  const categories = category ? [category] : ['script-reports', 'technical-specs', 'solution-guides'];
  const analyses: RelevanceAnalysis[] = [];
  
  for (const cat of categories) {
    const categoryDir = path.join(DOCS_DIR, cat);
    
    try {
      const files = await glob('**/*.md', { 
        cwd: categoryDir, 
        absolute: true,
        ignore: ['**/.archive_docs/**', '**/README.md']
      });
      
      console.log(`\nAnalyzing ${files.length} files in ${cat}...`);
      
      for (const filePath of files) {
        const analysis = await analyzeFile(filePath, cat, useAI);
        analyses.push(analysis);
      }
    } catch (error) {
      console.error(`Error analyzing ${cat}:`, error.message);
    }
  }
  
  // Sort by relevance score
  analyses.sort((a, b) => a.relevanceScore - b.relevanceScore);
  
  // Generate report
  const report = generateRelevanceReport(analyses);
  
  if (outputFile) {
    await fs.writeFile(outputFile, report);
    console.log(`\nRelevance report saved to: ${outputFile}`);
  } else {
    console.log('\n' + report);
  }
}

async function analyzeFile(filePath: string, category: string, useAI: boolean): Promise<RelevanceAnalysis> {
  const stats = await fs.stat(filePath);
  const age = differenceInDays(new Date(), stats.mtime);
  const fileName = path.basename(filePath);
  const content = await fs.readFile(filePath, 'utf-8');
  
  let relevanceScore = 100;
  let recommendation: 'keep' | 'archive' | 'delete' = 'keep';
  let reason = 'Recently updated';
  let supersededBy: string | undefined;
  
  // Age-based scoring
  if (age > 90) {
    relevanceScore -= 40;
    reason = 'Very old document';
  } else if (age > 60) {
    relevanceScore -= 25;
    reason = 'Old document';
  } else if (age > 30) {
    relevanceScore -= 10;
    reason = 'Moderately old';
  }
  
  // Category-specific rules
  switch (category) {
    case 'script-reports':
      if (fileName.includes('process-new-files-report')) {
        relevanceScore -= 30;
        reason += ', superseded by admin pages';
        supersededBy = 'dhg-admin-suite pages';
      }
      if (fileName.includes('sync-report')) {
        relevanceScore -= 20;
        reason += ', replaced by real-time monitoring';
      }
      break;
      
    case 'technical-specs':
      if (content.includes('[IMPLEMENTED]') || content.includes('[COMPLETED]')) {
        relevanceScore -= 50;
        reason += ', already implemented';
        recommendation = 'archive';
      }
      break;
      
    case 'solution-guides':
      if (content.includes('CLAUDE.md') && content.includes('added to')) {
        relevanceScore -= 40;
        reason += ', already added to CLAUDE.md';
        recommendation = 'archive';
      }
      break;
  }
  
  // Content-based analysis
  if (content.length < 500) {
    relevanceScore -= 20;
    reason += ', very short document';
  }
  
  if (content.includes('[DEPRECATED]') || content.includes('[OBSOLETE]')) {
    relevanceScore -= 60;
    reason += ', marked as deprecated';
    recommendation = 'delete';
  }
  
  // AI analysis if requested
  if (useAI && relevanceScore < 70) {
    try {
      const aiPrompt = `Analyze this document for relevance in the current project state:
        
Category: ${category}
File: ${fileName}
Age: ${age} days
Content preview: ${content.substring(0, 1000)}...

Is this document still relevant? Should it be kept, archived, or deleted?
Provide a brief reason.`;

      const aiResponse = await claudeService.sendPrompt(aiPrompt);
      // Parse AI response to adjust scoring
      if (aiResponse.toLowerCase().includes('archive')) {
        relevanceScore -= 20;
        recommendation = 'archive';
      }
    } catch (error) {
      console.warn('AI analysis failed:', error.message);
    }
  }
  
  // Final recommendation
  if (relevanceScore < 30) {
    recommendation = 'delete';
  } else if (relevanceScore < 60) {
    recommendation = 'archive';
  }
  
  return {
    filePath: path.relative(PROJECT_ROOT, filePath),
    category,
    age,
    relevanceScore,
    recommendation,
    reason,
    supersededBy
  };
}

function generateRelevanceReport(analyses: RelevanceAnalysis[]): string {
  const byRecommendation = {
    keep: analyses.filter(a => a.recommendation === 'keep'),
    archive: analyses.filter(a => a.recommendation === 'archive'),
    delete: analyses.filter(a => a.recommendation === 'delete')
  };
  
  let report = '# Document Relevance Analysis Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += `## Summary\n`;
  report += `- Total documents analyzed: ${analyses.length}\n`;
  report += `- Recommended to keep: ${byRecommendation.keep.length}\n`;
  report += `- Recommended to archive: ${byRecommendation.archive.length}\n`;
  report += `- Recommended to delete: ${byRecommendation.delete.length}\n\n`;
  
  report += '## Documents to Archive\n\n';
  for (const doc of byRecommendation.archive) {
    report += `### ${doc.filePath}\n`;
    report += `- Age: ${doc.age} days\n`;
    report += `- Score: ${doc.relevanceScore}/100\n`;
    report += `- Reason: ${doc.reason}\n`;
    if (doc.supersededBy) {
      report += `- Superseded by: ${doc.supersededBy}\n`;
    }
    report += '\n';
  }
  
  report += '## Documents to Delete\n\n';
  for (const doc of byRecommendation.delete) {
    report += `### ${doc.filePath}\n`;
    report += `- Age: ${doc.age} days\n`;
    report += `- Score: ${doc.relevanceScore}/100\n`;
    report += `- Reason: ${doc.reason}\n`;
    report += '\n';
  }
  
  report += '## Archive Commands\n\n';
  report += '```bash\n';
  report += '# Archive old script reports\n';
  report += './scripts/cli-pipeline/documentation/documentation-cli.sh archive-reports --days 30\n\n';
  report += '# Archive implemented specs\n';
  report += './scripts/cli-pipeline/documentation/documentation-cli.sh archive-specs\n\n';
  report += '# Archive resolved solutions\n';
  report += './scripts/cli-pipeline/documentation/documentation-cli.sh archive-solutions\n';
  report += '```\n';
  
  return report;
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const options: any = {};
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--category':
        options.category = args[++i];
        break;
      case '--use-ai':
        options.useAI = true;
        break;
      case '--output':
        options.outputFile = args[++i];
        break;
    }
  }
  
  analyzeDocumentRelevance(options).catch(console.error);
}

export { analyzeDocumentRelevance };