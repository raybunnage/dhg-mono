import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

export interface LivingDocMetadata {
  title: string;
  lastUpdated: string;
  nextReview: string;
  status: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  category: string;
  phase1Priority?: 'High' | 'Medium' | 'Low';
  phase1Summary?: string;
  phase1Value?: string;
  phase1Effort?: string;
  phase1Risks?: string[];
  filePath: string;
}

export interface PrioritizationReport {
  highPriority: LivingDocMetadata[];
  mediumPriority: LivingDocMetadata[];
  lowPriority: LivingDocMetadata[];
  needsUpdate: LivingDocMetadata[];
  duplicates: Array<{ doc1: string; doc2: string; reason: string }>;
  totalDocuments: number;
  lastAnalyzed: string;
}

export class LivingDocsPrioritizationService {
  private static instance: LivingDocsPrioritizationService;
  private docsPath: string;

  private constructor() {
    this.docsPath = join(process.cwd(), 'docs', 'living-docs');
  }

  public static getInstance(): LivingDocsPrioritizationService {
    if (!LivingDocsPrioritizationService.instance) {
      LivingDocsPrioritizationService.instance = new LivingDocsPrioritizationService();
    }
    return LivingDocsPrioritizationService.instance;
  }

  async analyzeLivingDocs(): Promise<PrioritizationReport> {
    const files = await readdir(this.docsPath);
    const mdFiles = files.filter(f => f.endsWith('.md') && !f.includes('TEMPLATE'));
    
    const documents: LivingDocMetadata[] = [];
    
    for (const file of mdFiles) {
      const content = await readFile(join(this.docsPath, file), 'utf-8');
      const metadata = this.extractMetadata(content, file);
      documents.push(metadata);
    }

    // Categorize by phase 1 priority
    const highPriority = documents.filter(d => d.phase1Priority === 'High');
    const mediumPriority = documents.filter(d => d.phase1Priority === 'Medium');
    const lowPriority = documents.filter(d => d.phase1Priority === 'Low' || !d.phase1Priority);

    // Find documents needing updates
    const needsUpdate = documents.filter(d => {
      const nextReview = new Date(d.nextReview);
      return nextReview <= new Date();
    });

    // Detect duplicates
    const duplicates = this.findDuplicates(documents);

    return {
      highPriority: this.sortByValueEffortRatio(highPriority),
      mediumPriority: this.sortByValueEffortRatio(mediumPriority),
      lowPriority: this.sortByValueEffortRatio(lowPriority),
      needsUpdate,
      duplicates,
      totalDocuments: documents.length,
      lastAnalyzed: new Date().toISOString()
    };
  }

  private extractMetadata(content: string, filename: string): LivingDocMetadata {
    // Extract metadata section
    const metadataMatch = content.match(/## Metadata([\s\S]*?)(?=##|$)/);
    const phase1Match = content.match(/## Phase 1:[\s\S]*?(?=## |$)/);
    
    const metadata: LivingDocMetadata = {
      title: this.extractTitle(content) || filename.replace('.md', ''),
      lastUpdated: '',
      nextReview: '',
      status: 'Unknown',
      priority: 'Medium',
      category: 'Unknown',
      filePath: filename
    };

    if (metadataMatch) {
      const metadataText = metadataMatch[1];
      metadata.lastUpdated = this.extractField(metadataText, 'Last Updated') || '';
      metadata.nextReview = this.extractField(metadataText, 'Next Review') || '';
      metadata.status = this.extractField(metadataText, 'Status') || 'Unknown';
      metadata.priority = (this.extractField(metadataText, 'Priority') || 'Medium') as any;
      metadata.category = this.extractField(metadataText, 'Category') || 'Unknown';
    }

    if (phase1Match) {
      const phase1Text = phase1Match[0];
      metadata.phase1Summary = this.extractPhase1Summary(phase1Text);
      metadata.phase1Priority = this.extractPhase1Priority(phase1Text);
      metadata.phase1Value = this.extractPhase1Value(phase1Text);
      metadata.phase1Effort = this.extractPhase1Effort(phase1Text);
      metadata.phase1Risks = this.extractPhase1Risks(phase1Text);
    }

    return metadata;
  }

  private extractTitle(content: string): string | null {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1] : null;
  }

  private extractField(text: string, fieldName: string): string | null {
    const regex = new RegExp(`${fieldName}\\s*:\\s*(.+)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : null;
  }

  private extractPhase1Summary(text: string): string {
    const summaryMatch = text.match(/### Summary\s*([\s\S]*?)(?=###|$)/);
    return summaryMatch ? summaryMatch[1].trim().split('\n')[0] : '';
  }

  private extractPhase1Priority(text: string): 'High' | 'Medium' | 'Low' {
    const priorityMatch = text.match(/### Priority Score:\s*\[?(High|Medium|Low)\]?/i);
    return priorityMatch ? priorityMatch[1] as any : 'Medium';
  }

  private extractPhase1Value(text: string): string {
    const valueMatch = text.match(/\*\*Potential Gains:\*\*([\s\S]*?)(?=\*\*|$)/);
    if (valueMatch) {
      const gains = valueMatch[1].trim().split('\n').filter(l => l.trim().startsWith('-'));
      return gains.slice(0, 2).join(' ');
    }
    return '';
  }

  private extractPhase1Effort(text: string): string {
    const effortMatch = text.match(/\*\*Estimated Time\*\*:\s*(.+)/);
    return effortMatch ? effortMatch[1].trim() : 'Unknown';
  }

  private extractPhase1Risks(text: string): string[] {
    const risksMatch = text.match(/\*\*Risks & Challenges:\*\*([\s\S]*?)(?=###|$)/);
    if (risksMatch) {
      return risksMatch[1].trim().split('\n')
        .filter(l => l.trim().startsWith('-'))
        .map(l => l.replace(/^-\s*/, ''));
    }
    return [];
  }

  private sortByValueEffortRatio(docs: LivingDocMetadata[]): LivingDocMetadata[] {
    return docs.sort((a, b) => {
      // Prioritize by review date first
      const aReview = new Date(a.nextReview || '2099-12-31');
      const bReview = new Date(b.nextReview || '2099-12-31');
      const now = new Date();
      
      const aDaysUntilReview = Math.floor((aReview.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const bDaysUntilReview = Math.floor((bReview.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      // Overdue items first
      if (aDaysUntilReview < 0 && bDaysUntilReview >= 0) return -1;
      if (bDaysUntilReview < 0 && aDaysUntilReview >= 0) return 1;
      
      // Then by priority
      const priorityOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  private findDuplicates(docs: LivingDocMetadata[]): Array<{ doc1: string; doc2: string; reason: string }> {
    const duplicates: Array<{ doc1: string; doc2: string; reason: string }> = [];
    
    for (let i = 0; i < docs.length; i++) {
      for (let j = i + 1; j < docs.length; j++) {
        const doc1 = docs[i];
        const doc2 = docs[j];
        
        // Check for similar titles
        if (this.areSimilar(doc1.title, doc2.title)) {
          duplicates.push({
            doc1: doc1.filePath,
            doc2: doc2.filePath,
            reason: 'Similar titles'
          });
        }
        
        // Check for versioned files
        if (doc1.filePath.includes(doc2.filePath.replace('.md', '')) || 
            doc2.filePath.includes(doc1.filePath.replace('.md', ''))) {
          duplicates.push({
            doc1: doc1.filePath,
            doc2: doc2.filePath,
            reason: 'Possibly different versions of same document'
          });
        }
      }
    }
    
    return duplicates;
  }

  private areSimilar(str1: string, str2: string): boolean {
    const normalize = (s: string) => s.toLowerCase().replace(/[-_\s]/g, '');
    const n1 = normalize(str1);
    const n2 = normalize(str2);
    
    // Check if one contains the other
    if (n1.includes(n2) || n2.includes(n1)) return true;
    
    // Check Levenshtein distance for similarity
    const distance = this.levenshteinDistance(n1, n2);
    const maxLength = Math.max(n1.length, n2.length);
    const similarity = 1 - (distance / maxLength);
    
    return similarity > 0.8;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  async generatePriorityDashboard(): Promise<string> {
    const report = await this.analyzeLivingDocs();
    
    let dashboard = `# Living Documents Priority Dashboard

**Last Updated**: ${new Date().toISOString().split('T')[0]}
**Total Documents**: ${report.totalDocuments}
**Needs Review**: ${report.needsUpdate.length}

## 🔥 High Priority Phase 1 Tasks (${report.highPriority.length})

`;

    for (const doc of report.highPriority) {
      dashboard += this.formatDocCard(doc);
    }

    dashboard += `\n## 🟡 Medium Priority Phase 1 Tasks (${report.mediumPriority.length})\n\n`;

    for (const doc of report.mediumPriority.slice(0, 5)) {
      dashboard += this.formatDocCard(doc);
    }

    dashboard += `\n## 🔵 Low Priority Phase 1 Tasks (${report.lowPriority.length})\n\n`;

    for (const doc of report.lowPriority.slice(0, 3)) {
      dashboard += this.formatDocCard(doc);
    }

    if (report.duplicates.length > 0) {
      dashboard += `\n## ⚠️ Potential Duplicates Found\n\n`;
      for (const dup of report.duplicates) {
        dashboard += `- **${dup.doc1}** ↔️ **${dup.doc2}**: ${dup.reason}\n`;
      }
    }

    if (report.needsUpdate.length > 0) {
      dashboard += `\n## 📅 Documents Needing Review\n\n`;
      for (const doc of report.needsUpdate) {
        dashboard += `- **${doc.title}** (Review: ${doc.nextReview})\n`;
      }
    }

    return dashboard;
  }

  private formatDocCard(doc: LivingDocMetadata): string {
    const overdue = new Date(doc.nextReview) < new Date();
    const overdueFlag = overdue ? ' 🚨' : '';
    
    return `### ${doc.title}${overdueFlag}
**File**: \`${doc.filePath}\`
**Category**: ${doc.category} | **Status**: ${doc.status}
**Phase 1 Summary**: ${doc.phase1Summary || 'No summary available'}
**Estimated Effort**: ${doc.phase1Effort || 'Unknown'}
**Value**: ${doc.phase1Value || 'Not specified'}
${doc.phase1Risks && doc.phase1Risks.length > 0 ? `**Key Risks**: ${doc.phase1Risks[0]}` : ''}
**Next Review**: ${doc.nextReview}

---

`;
  }
}