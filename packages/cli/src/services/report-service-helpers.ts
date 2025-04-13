/**
 * Helper functions for the report service
 * These are temporary wrappers until the full migration to the shared package is complete
 */

import { 
  ReportService as SharedReportService, 
  ReportSection as SharedReportSection,
  reportService as sharedReportService,
  FileResult
} from '@dhg/shared/services';
import { LoggerUtils } from '../utils/logger-utils';

export interface ReportSection extends SharedReportSection {}

/**
 * ReportService wrapper that uses the shared implementation
 */
export class ReportService {
  private sharedService: SharedReportService;
  
  constructor(templatePath?: string) {
    this.sharedService = new SharedReportService(templatePath);
  }
  
  /**
   * Add a section to the report
   */
  addSection(section: ReportSection): void {
    LoggerUtils.debug(`Adding report section: ${section.title}`);
    this.sharedService.addSection(section);
  }
  
  /**
   * Add multiple sections to the report
   */
  addSections(sections: ReportSection[]): void {
    LoggerUtils.debug(`Adding ${sections.length} report sections`);
    this.sharedService.addSections(sections);
  }
  
  /**
   * Clear all sections from the report
   */
  clearSections(): void {
    LoggerUtils.debug('Clearing all report sections');
    this.sharedService.clearSections();
  }
  
  /**
   * Generate the report content
   */
  generateReport(): string {
    LoggerUtils.debug('Generating report');
    return this.sharedService.generateReport();
  }
  
  /**
   * Write the report to a file
   */
  writeReportToFile(path: string): FileResult {
    LoggerUtils.debug(`Writing report to file: ${path}`);
    return this.sharedService.writeReportToFile(path);
  }
  
  /**
   * Create a report with sections and write it to a file
   */
  static generateAndWriteReport(
    sections: ReportSection[], 
    outputPath: string, 
    title?: string
  ): FileResult {
    LoggerUtils.debug(`Generating and writing report to: ${outputPath}`);
    return SharedReportService.generateAndWriteReport(sections, outputPath, title);
  }
}

// Export types and singleton for backward compatibility
export { reportService } from '@dhg/shared/services';