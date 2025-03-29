import { fileService, FileResult } from '../file-service/file-service';
import { Logger } from '../../utils/logger';

export interface ReportSection {
  title: string;
  content: string;
  level: number;
}

export class ReportService {
  private sections: ReportSection[] = [];
  private templatePath?: string;
  
  constructor(templatePath?: string) {
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
   * Add multiple sections to the report
   */
  addSections(sections: ReportSection[]): void {
    this.sections.push(...sections);
    Logger.debug(`Added ${sections.length} report sections`);
  }
  
  /**
   * Clear all sections from the report
   */
  clearSections(): void {
    this.sections = [];
    Logger.debug('Cleared all report sections');
  }
  
  /**
   * Get the number of sections in the report
   */
  getSectionCount(): number {
    return this.sections.length;
  }
  
  /**
   * Generate the report content
   */
  generateReport(): string {
    Logger.debug('Generating report');
    
    // If template path is provided, use it as a base
    let report = '';
    if (this.templatePath) {
      const templateResult = fileService.readFile(this.templatePath);
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
    return fileService.writeFile(path, content);
  }
  
  /**
   * Create a report with sections and write it to a file
   * @param sections The sections to include in the report
   * @param outputPath The path to write the report to
   * @param title Optional title for the report
   */
  static generateAndWriteReport(
    sections: ReportSection[], 
    outputPath: string, 
    title?: string
  ): FileResult {
    const reportService = new ReportService();
    
    // Add title if provided
    if (title) {
      reportService.addSection({
        title,
        content: `Generated: ${new Date().toISOString()}`,
        level: 1
      });
    }
    
    // Add sections
    reportService.addSections(sections);
    
    // Write report
    return reportService.writeReportToFile(outputPath);
  }
}

// Export a singleton instance
export const reportService = new ReportService();