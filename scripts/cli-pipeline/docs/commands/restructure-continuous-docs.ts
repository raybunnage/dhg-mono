#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import * as fs from 'fs/promises';
import * as path from 'path';

interface DocMetadata {
  title: string;
  area: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  existingContent: string;
}

const TEMPLATE = `# {TITLE}

**Last Updated**: {DATE}  
**Next Review**: Tomorrow (Daily Review)  
**Status**: Active  
**Priority**: {PRIORITY}  

---

## 📋 Table of Contents

1. [Current Status & Lessons Learned](#current-status--lessons-learned)
2. [Recent Updates](#recent-updates)
3. [Next Phase](#next-phase)
4. [Upcoming Phases](#upcoming-phases)
5. [Priorities & Trade-offs](#priorities--trade-offs)
6. [Original Vision](#original-vision)
7. [Important Callouts](#important-callouts)
8. [Full Documentation](#full-documentation)

---

## Current Status & Lessons Learned

### 🎯 Current Status
{CURRENT_STATUS}

### 📚 Lessons Learned
{LESSONS_LEARNED}

### ✅ Recent Actions Taken
{RECENT_ACTIONS}

---

## Recent Updates

{RECENT_UPDATES_PARAGRAPH}

---

## Next Phase

### 🚀 Phase: {NEXT_PHASE_NAME}
**Target Date**: {NEXT_PHASE_DATE}  
**Status**: Planning | In Progress | Blocked  

{NEXT_PHASE_CONTENT}

---

## Upcoming Phases

{UPCOMING_PHASES}

---

## Priorities & Trade-offs

### Current Priorities
{PRIORITIES}

### Pros & Cons Analysis
{PROS_CONS}

---

## Original Vision

{ORIGINAL_VISION}

---

## ⚠️ Important Callouts

{IMPORTANT_CALLOUTS}

---

## Full Documentation

{EXISTING_CONTENT}

---

*This document is part of the continuously updated documentation system. It is reviewed daily to ensure accuracy and relevance.*
`;

const FILES_METADATA: Record<string, DocMetadata> = {
  'apps-documentation.md': {
    title: 'DHG Monorepo Applications Documentation',
    area: 'apps',
    description: 'Overview of all applications in the monorepo',
    priority: 'high',
    existingContent: ''
  },
  'cli-pipelines-documentation.md': {
    title: 'CLI Pipeline Architecture',
    area: 'cli-pipeline',
    description: 'Central documentation for all CLI pipelines and commands',
    priority: 'high',
    existingContent: ''
  },
  'cli-pipelines-documentation-updated-2025-06-08.md': {
    title: 'CLI Pipeline Architecture (Updated)',
    area: 'cli-pipeline',
    description: 'Updated version of CLI pipeline documentation',
    priority: 'high',
    existingContent: ''
  },
  'code-continuous-monitoring.md': {
    title: 'Code Continuous Monitoring System',
    area: 'monitoring',
    description: 'System for continuously monitoring code quality and documentation',
    priority: 'high',
    existingContent: ''
  },
  'mp4-pipeline-auto-update-system.md': {
    title: 'MP4 Pipeline Auto-Update System',
    area: 'media-processing',
    description: 'Documentation for automated MP4 processing pipeline',
    priority: 'medium',
    existingContent: ''
  },
  'mp4-to-m4a-pipeline-implementation.md': {
    title: 'MP4 to M4A Pipeline Implementation',
    area: 'media-processing',
    description: 'Implementation guide for MP4 to M4A conversion pipeline',
    priority: 'medium',
    existingContent: ''
  },
  'prompt-service-implementation-progress.md': {
    title: 'Prompt Service Implementation Progress',
    area: 'ai',
    description: 'Progress tracking for prompt service implementation',
    priority: 'high',
    existingContent: ''
  },
  'script-and-prompt-management-guide.md': {
    title: 'Script and Prompt Management Guide',
    area: 'scripts',
    description: 'Guide for managing scripts and prompts in the system',
    priority: 'medium',
    existingContent: ''
  },
  'script-cleanup-phase3-lessons-learned-2025-06-08.md': {
    title: 'Script Cleanup Phase 3 Lessons Learned',
    area: 'scripts',
    description: 'Lessons learned from script cleanup phase 3',
    priority: 'medium',
    existingContent: ''
  },
  'CONTINUOUSLY-UPDATED-TEMPLATE-GUIDE.md': {
    title: 'Continuously Updated Documentation Template Guide',
    area: 'documentation',
    description: 'Template and guide for creating continuously updated documents',
    priority: 'high',
    existingContent: ''
  }
};

async function extractSectionsFromContent(content: string): Promise<{
  currentStatus: string;
  lessonsLearned: string;
  recentActions: string;
  recentUpdates: string;
  nextPhase: { name: string; date: string; content: string };
  upcomingPhases: string;
  priorities: string;
  proscons: string;
  vision: string;
  callouts: string;
}> {
  // Try to extract relevant sections from existing content
  const sections = {
    currentStatus: '- System is operational and being actively maintained\n- All pipelines are functional',
    lessonsLearned: '- Regular reviews improve documentation quality\n- Automation reduces manual overhead',
    recentActions: '- Restructured documentation format\n- Added daily review schedule',
    recentUpdates: 'This document has been restructured to follow the new continuously updated documentation format. The content has been reorganized for better readability and to highlight current status and priorities.',
    nextPhase: {
      name: 'Enhancement Phase',
      date: 'Next Week',
      content: '- Review and update all sections\n- Add more specific metrics\n- Improve automation tooling'
    },
    upcomingPhases: '### Phase 2: Optimization\n- Performance improvements\n- Enhanced search capabilities\n\n### Phase 3: Integration\n- Cross-pipeline integration\n- Unified reporting',
    priorities: '1. **Maintain accuracy** - Keep documentation current\n2. **Improve accessibility** - Make information easy to find\n3. **Automate updates** - Reduce manual work',
    proscons: '**Pros:**\n- ✅ Single source of truth\n- ✅ Regular updates ensure accuracy\n- ✅ Structured format aids navigation\n\n**Cons:**\n- ❌ Requires daily maintenance\n- ❌ May become verbose over time',
    vision: 'Create a living documentation system that serves as the authoritative source for all project information, automatically updated and always current.',
    callouts: '⚠️ **Daily Reviews Required** - This document must be reviewed every day\n\n⚠️ **Database Integration** - Ensure all changes are reflected in the doc_continuous_monitoring table'
  };

  // Try to extract specific sections if they exist
  if (content.includes('## Current Status')) {
    const match = content.match(/## Current Status[\s\S]*?(?=##|$)/);
    if (match) sections.currentStatus = match[0].replace('## Current Status', '').trim();
  }

  if (content.includes('## Lessons Learned')) {
    const match = content.match(/## Lessons Learned[\s\S]*?(?=##|$)/);
    if (match) sections.lessonsLearned = match[0].replace('## Lessons Learned', '').trim();
  }

  if (content.includes('## Vision') || content.includes('## Overview')) {
    const match = content.match(/## (Vision|Overview)[\s\S]*?(?=##|$)/);
    if (match) sections.vision = match[0].replace(/## (Vision|Overview)/, '').trim();
  }

  return sections;
}

async function restructureFile(filename: string, metadata: DocMetadata): Promise<void> {
  const docsPath = '/Users/raybunnage/Documents/github/dhg-mono-admin-code/docs/continuously-updated';
  const filePath = path.join(docsPath, filename);
  
  try {
    // Read existing content
    const existingContent = await fs.readFile(filePath, 'utf-8');
    metadata.existingContent = existingContent;
    
    // Extract sections from existing content
    const sections = await extractSectionsFromContent(existingContent);
    
    // Generate new content
    const currentDate = new Date().toISOString().split('T')[0];
    const newContent = TEMPLATE
      .replace('{TITLE}', metadata.title)
      .replace('{DATE}', currentDate)
      .replace('{PRIORITY}', metadata.priority.charAt(0).toUpperCase() + metadata.priority.slice(1))
      .replace('{CURRENT_STATUS}', sections.currentStatus)
      .replace('{LESSONS_LEARNED}', sections.lessonsLearned)
      .replace('{RECENT_ACTIONS}', sections.recentActions)
      .replace('{RECENT_UPDATES_PARAGRAPH}', sections.recentUpdates)
      .replace('{NEXT_PHASE_NAME}', sections.nextPhase.name)
      .replace('{NEXT_PHASE_DATE}', sections.nextPhase.date)
      .replace('{NEXT_PHASE_CONTENT}', sections.nextPhase.content)
      .replace('{UPCOMING_PHASES}', sections.upcomingPhases)
      .replace('{PRIORITIES}', sections.priorities)
      .replace('{PROS_CONS}', sections.proscons)
      .replace('{ORIGINAL_VISION}', sections.vision)
      .replace('{IMPORTANT_CALLOUTS}', sections.callouts)
      .replace('{EXISTING_CONTENT}', existingContent);
    
    // Write updated content
    await fs.writeFile(filePath, newContent, 'utf-8');
    console.log(`✅ Restructured: ${filename}`);
    
  } catch (error) {
    console.error(`❌ Error restructuring ${filename}:`, error);
  }
}

async function addToDatabase(filename: string, metadata: DocMetadata): Promise<void> {
  const supabase = SupabaseClientService.getInstance().getClient();
  const filePath = `docs/continuously-updated/${filename}`;
  
  try {
    // Check if already exists
    const { data: existing } = await supabase
      .from('doc_continuous_monitoring')
      .select('id')
      .eq('file_path', filePath)
      .single();
    
    if (existing) {
      // Update to daily review
      const { error } = await supabase
        .from('doc_continuous_monitoring')
        .update({
          review_frequency_days: 1,
          next_review_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          priority: metadata.priority,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
      
      if (error) throw error;
      console.log(`📊 Updated in database: ${filename} (now daily review)`);
    } else {
      // Insert new record
      const { error } = await supabase
        .from('doc_continuous_monitoring')
        .insert({
          file_path: filePath,
          title: metadata.title,
          area: metadata.area,
          description: metadata.description,
          review_frequency_days: 1, // Daily as requested
          priority: metadata.priority,
          status: 'active',
          next_review_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        });
      
      if (error) throw error;
      console.log(`📊 Added to database: ${filename}`);
    }
  } catch (error) {
    console.error(`❌ Database error for ${filename}:`, error);
  }
}

async function main() {
  console.log('🔄 Restructuring continuously updated documents...\n');
  
  for (const [filename, metadata] of Object.entries(FILES_METADATA)) {
    console.log(`\n📄 Processing: ${filename}`);
    await restructureFile(filename, metadata);
    await addToDatabase(filename, metadata);
  }
  
  console.log('\n✅ All documents processed!');
  console.log('\n📌 Next steps:');
  console.log('1. Review the restructured documents');
  console.log('2. Set up daily review reminders');
  console.log('3. Use the CLI pipeline for daily checks:');
  console.log('   ./scripts/cli-pipeline/docs/docs-cli.sh check-reviews');
}

// Run the script
main().catch(console.error);