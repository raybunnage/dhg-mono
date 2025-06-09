#!/usr/bin/env ts-node

/**
 * Format a living document with the standardized template
 * Adds header, index, lessons learned, current status, etc.
 */

import fs from 'fs';
import path from 'path';
import { program } from 'commander';

interface DocumentSection {
  title: string;
  content: string;
  level: number;
}

interface ParsedDocument {
  title: string;
  sections: DocumentSection[];
  originalContent: string;
}

function parseExistingDocument(content: string): ParsedDocument {
  const lines = content.split('\\n');
  const sections: DocumentSection[] = [];
  let currentSection: DocumentSection | null = null;
  let title = '';
  
  for (const line of lines) {
    // Check for title (first # heading)
    if (line.startsWith('# ') && !title) {
      title = line.substring(2).trim();
      continue;
    }
    
    // Check for section headers
    const headerMatch = line.match(/^(#{1,6})\\s+(.+)$/);
    if (headerMatch) {
      // Save previous section
      if (currentSection) {
        sections.push(currentSection);
      }
      
      // Start new section
      currentSection = {
        title: headerMatch[2].trim(),
        content: '',
        level: headerMatch[1].length
      };
    } else if (currentSection) {
      currentSection.content += line + '\\n';
    }
  }
  
  // Add final section
  if (currentSection) {
    sections.push(currentSection);
  }
  
  return { title, sections, originalContent: content };
}

function generateFormattedDocument(parsed: ParsedDocument, filePath: string): string {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const fileName = path.basename(filePath, '.md');
  const area = determineDocumentArea(fileName, parsed.sections);
  
  // Generate table of contents
  const toc = generateTableOfContents(parsed.sections);
  
  // Extract or generate key sections
  const lessonsLearned = extractLessonsLearned(parsed.sections);
  const currentStatus = extractCurrentStatus(parsed.sections);
  const recentActivity = generateRecentActivity(parsed.sections);
  const nextPhase = extractNextPhase(parsed.sections);
  const otherPhases = extractOtherPhases(parsed.sections);
  const priorities = extractPriorities(parsed.sections);
  const vision = extractVision(parsed.sections);
  const remainingContent = extractRemainingContent(parsed.sections);
  
  return `# ${parsed.title}

**Last Updated**: ${currentDate}  
**Area**: ${area}  
**Review Frequency**: Every 14-30 days  
**Status**: Active

> ⚠️ **Important Notes**: This is a living document that is continuously monitored and updated. 
> If you notice outdated information or have updates to add, please use the docs CLI pipeline 
> to update this document and reset the review timer.

## 📋 Table of Contents

${toc}

---

## 🎯 Latest Lessons Learned & Current Status

**Last Review**: ${currentDate}

${lessonsLearned}

${currentStatus}

---

## 📰 What's Been Happening Lately

${recentActivity}

---

## 🚀 Next Phase to Tackle

${nextPhase}

---

## 📅 Implementation Phases

${otherPhases}

---

## ⚖️ Priorities & Trade-offs

${priorities}

---

## 🎨 Original Vision

${vision}

---

## 📚 Detailed Documentation

${remainingContent}

---

*This document is managed by the docs CLI pipeline. Use \`./scripts/cli-pipeline/docs/docs-cli.sh\` to update.*`;
}

function determineDocumentArea(fileName: string, sections: DocumentSection[]): string {
  if (fileName.includes('cli-pipeline')) return 'CLI Pipeline';
  if (fileName.includes('app')) return 'Applications';
  if (fileName.includes('mp4') || fileName.includes('media')) return 'Media Processing';
  if (fileName.includes('prompt') || fileName.includes('ai')) return 'AI & Prompts';
  if (fileName.includes('script')) return 'Script Management';
  return 'General';
}

function generateTableOfContents(sections: DocumentSection[]): string {
  const majorSections = [
    '🎯 Latest Lessons Learned & Current Status',
    '📰 What\'s Been Happening Lately',
    '🚀 Next Phase to Tackle',
    '📅 Implementation Phases',
    '⚖️ Priorities & Trade-offs',
    '🎨 Original Vision',
    '📚 Detailed Documentation'
  ];
  
  return majorSections.map(section => `- [${section}](#${section.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')})`).join('\\n');
}

function extractLessonsLearned(sections: DocumentSection[]): string {
  // Look for existing lessons learned section
  const lessonsSection = sections.find(s => 
    s.title.toLowerCase().includes('lesson') || 
    s.title.toLowerCase().includes('learned') ||
    s.title.toLowerCase().includes('insight')
  );
  
  if (lessonsSection) {
    return lessonsSection.content.trim();
  }
  
  return `### Key Insights
- *[Add recent lessons learned and insights]*
- *[What worked well in recent implementations]*
- *[What challenges were encountered and how they were resolved]*

### Recent Accomplishments
- *[List recent achievements and completed milestones]*
- *[Successful implementations or improvements]*`;
}

function extractCurrentStatus(sections: DocumentSection[]): string {
  const statusSection = sections.find(s => 
    s.title.toLowerCase().includes('status') || 
    s.title.toLowerCase().includes('current') ||
    s.title.toLowerCase().includes('progress')
  );
  
  if (statusSection) {
    return statusSection.content.trim();
  }
  
  return `### Current State
- *[Brief overview of current implementation status]*
- *[What's working well and what needs attention]*
- *[Any blockers or dependencies]*`;
}

function generateRecentActivity(sections: DocumentSection[]): string {
  return `*[Paragraph describing what's been happening lately with this area of the project. Include recent changes, implementations, discoveries, or shifts in approach. This should be updated each time the document is reviewed.]*

Recent highlights:
- *[Key recent developments]*
- *[Important changes or updates]*
- *[New insights or approaches]*`;
}

function extractNextPhase(sections: DocumentSection[]): string {
  const nextSection = sections.find(s => 
    s.title.toLowerCase().includes('next') || 
    s.title.toLowerCase().includes('upcoming') ||
    s.title.toLowerCase().includes('phase')
  );
  
  if (nextSection) {
    return nextSection.content.trim();
  }
  
  return `### Immediate Next Steps
- *[Most important items to tackle next]*
- *[Clear actionable items with priority]*
- *[Dependencies that need to be resolved]*

### Success Criteria
- *[How we'll know this phase is complete]*
- *[Measurable outcomes]*`;
}

function extractOtherPhases(sections: DocumentSection[]): string {
  const phasesSections = sections.filter(s => 
    s.title.toLowerCase().includes('phase') && 
    !s.title.toLowerCase().includes('next')
  );
  
  if (phasesSections.length > 0) {
    return phasesSections.map(s => `### ${s.title}\\n${s.content.trim()}`).join('\\n\\n');
  }
  
  return `### Phase 2: *[Future phase title]*
- *[Goals and objectives]*
- *[Key deliverables]*

### Phase 3: *[Future phase title]*
- *[Longer-term objectives]*
- *[Strategic improvements]*`;
}

function extractPriorities(sections: DocumentSection[]): string {
  const prioritiesSection = sections.find(s => 
    s.title.toLowerCase().includes('priorit') || 
    s.title.toLowerCase().includes('pros') ||
    s.title.toLowerCase().includes('trade')
  );
  
  if (prioritiesSection) {
    return prioritiesSection.content.trim();
  }
  
  return `### High Priority Items
- *[Most critical areas requiring attention]*
- *[Items with high impact or blocking other work]*

### Pros & Cons of Current Approach
**Pros:**
- *[Benefits of current implementation]*
- *[What's working well]*

**Cons:**
- *[Limitations or challenges]*
- *[Areas for improvement]*

### Trade-offs to Consider
- *[Key decisions and their implications]*
- *[Balance between competing priorities]*`;
}

function extractVision(sections: DocumentSection[]): string {
  const visionSection = sections.find(s => 
    s.title.toLowerCase().includes('vision') || 
    s.title.toLowerCase().includes('goal') ||
    s.title.toLowerCase().includes('overview')
  );
  
  if (visionSection) {
    return visionSection.content.trim();
  }
  
  return `*[Original vision and high-level goals for this area. This should remain relatively stable over time and provide context for all the tactical decisions and implementations.]*

### Core Objectives
- *[Primary goals this area aims to achieve]*
- *[Long-term vision for where this should be]*

### Success Metrics
- *[How success will be measured]*
- *[Key performance indicators]*`;
}

function extractRemainingContent(sections: DocumentSection[]): string {
  // Filter out sections we've already used
  const usedTitles = ['lesson', 'learned', 'status', 'current', 'progress', 'next', 'upcoming', 'phase', 'priorit', 'pros', 'trade', 'vision', 'goal', 'overview'];
  
  const remainingSections = sections.filter(s => 
    !usedTitles.some(keyword => s.title.toLowerCase().includes(keyword))
  );
  
  if (remainingSections.length > 0) {
    return remainingSections.map(s => `## ${s.title}\\n${s.content.trim()}`).join('\\n\\n');
  }
  
  return `## Implementation Details

*[Detailed technical information, procedures, and reference material that supports the above strategic content.]*`;
}

async function formatDocument(filePath: string) {
  try {
    const fullPath = path.resolve(filePath);
    
    if (!fs.existsSync(fullPath)) {
      console.error(`❌ File not found: ${filePath}`);
      process.exit(1);
    }
    
    console.log(`📝 Formatting document: ${filePath}`);
    
    // Read existing content
    const originalContent = fs.readFileSync(fullPath, 'utf-8');
    
    // Create backup
    const backupPath = `${fullPath}.backup.${Date.now()}`;
    fs.writeFileSync(backupPath, originalContent);
    console.log(`💾 Backup created: ${backupPath}`);
    
    // Parse and format
    const parsed = parseExistingDocument(originalContent);
    const formattedContent = generateFormattedDocument(parsed, filePath);
    
    // Write formatted content
    fs.writeFileSync(fullPath, formattedContent);
    
    console.log(`✅ Document formatted successfully`);
    console.log(`📄 Title: ${parsed.title}`);
    console.log(`📋 Sections processed: ${parsed.sections.length}`);
    
  } catch (error) {
    console.error('❌ Error formatting document:', error);
    process.exit(1);
  }
}

// CLI setup
program
  .name('format-document')
  .description('Format a living document with standardized template')
  .requiredOption('-p, --path <path>', 'Path to the document to format')
  .action(async (options) => {
    await formatDocument(options.path);
  });

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}

export { formatDocument };