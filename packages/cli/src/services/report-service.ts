import { FileService, FileResult } from './file-service';
import { Logger } from '../utils/logger';

export interface ReportSection {
  title: string;
  content: string;
  level: number;
}

export class ReportService {
  private sections: ReportSection[] = [];
  private fileService: FileService;
  private templatePath?: string;
  
  constructor(templatePath?: string) {
    this.fileService = new FileService();
    this.templatePath = templatePath;
  }
  
  /**
   * Add a section to the report
   */
  addSection(section: ReportSection): void {
    this.sections.push(section);
    Logger.debug(`Added report section: ${section.title}`);
  }
  
  /**
   * Generate the report content
   */
  generateReport(): string {
    Logger.debug('Generating report');
    
    // If template path is provided, use it as a base
    let report = '';
    if (this.templatePath) {
      const templateResult = this.fileService.readFile(this.templatePath);
      if (templateResult.success && templateResult.content) {
        report = templateResult.content;
      } else {
        Logger.warn(`Failed to read template: ${templateResult.error || 'Unknown error'}`);
      }
    }
    
    // Add each section to the report
    for (const section of this.sections) {
      const heading = '#'.repeat(section.level) + ' ' + section.title;
      report += `\n${heading}\n\n${section.content}\n\n`;
    }
    
    return report;
  }
  
  /**
   * Write the report to a file
   */
  writeReportToFile(path: string): FileResult {
    const content = this.generateReport();
    return this.fileService.writeFile(path, content);
  }
}