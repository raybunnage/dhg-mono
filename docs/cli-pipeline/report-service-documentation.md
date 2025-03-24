# Report Service Documentation

## 1. Service Overview
The Report Service is a TypeScript module that facilitates the creation and management of structured reports within the CLI application. It provides methods for building hierarchical reports with sections, generating formatted output, and writing reports to the filesystem, allowing for standardized documentation generation.

## 2. Dependencies
- `FileService`: From `../services/file-service` for reading templates and writing output files
- `Logger`: From `../utils/logger` for logging operations

## 3. Invocation Pattern
The service is instantiated (optionally with a template path) and its methods are called to build and output reports:

```typescript
import { ReportService } from '../services/report-service';

// Initialize with optional template
const reportService = new ReportService('/path/to/template.md');

// Add sections and generate report
reportService.addSection({
  title: 'Findings',
  content: 'Key findings from analysis...',
  level: 2
});

// Write to file
const result = reportService.writeReportToFile('/path/to/output.md');
```

## 4. Input/Output

### Inputs:
- **Template File** (optional): Path to a markdown template to use as the base for the report
- **Report Sections**: Title, content, and heading level for each section of the report

### Outputs:
- **Report String**: Generated markdown content
- **FileResult**: Result object from writing the report to the filesystem, containing:
  - `success`: Boolean indicating operation success
  - `path`: Absolute file path of the written report
  - `error`: Error message (if operation failed)

## 5. Key Functions

### 1. `constructor(templatePath?: string)`
Initializes the service, optionally with a base template path.

### 2. `addSection(section: ReportSection): void`
Adds a section to the report with title, content, and heading level.

### 3. `generateReport(): string`
Compiles all sections into a formatted report string, optionally using a template as base.

### 4. `writeReportToFile(path: string): FileResult`
Generates the report and writes it to the specified file path.

## 6. Error Handling
- Template reading failures are logged as warnings and the service continues operation without the template
- All file operations leverage FileService's error handling
- Section addition is logged for tracking purposes

## 7. Code Quality Assessment

### Strengths:
- Simple and focused API with clear separation of concerns
- Hierarchical report structure with flexible heading levels
- Effective template integration
- Good logging for operation tracking

### Areas for Improvement:
- Limited formatting options beyond Markdown headings
- No async operations support
- No methods for modifying or removing sections once added
- Limited metadata capabilities for reports

## 8. Improvement Opportunities

1. **Asynchronous Support**: Add Promise-based async versions of the operations
2. **Section Management**: Add methods to update, delete, or reorder sections
3. **Rich Formatting**: Support additional formatting elements like tables, lists, and code blocks
4. **Metadata Support**: Add report-level metadata like title, author, date, version
5. **Templating Engine**: Integrate a more powerful templating engine for complex reports
6. **Section Types**: Add specialized section types for common elements (tables, code snippets, etc.)

## 9. Usage Examples

### Example 1: Creating a Script Analysis Report
```typescript
import { ReportService } from '../services/report-service';
import { FileService } from '../services/file-service';

async function generateScriptAnalysisReport(scriptPath, outputPath) {
  const fileService = new FileService();
  const script = fileService.readFile(scriptPath);
  
  if (!script.success) {
    throw new Error(`Failed to read script: ${script.error}`);
  }
  
  // Create report service with template
  const reportService = new ReportService('./templates/script-report-template.md');
  
  // Add summary section
  reportService.addSection({
    title: 'Summary',
    content: `Analysis of ${scriptPath} performed on ${new Date().toISOString()}`,
    level: 1
  });
  
  // Add script details section
  reportService.addSection({
    title: 'Script Details',
    content: `
- **File Path**: ${scriptPath}
- **Size**: ${script.stats.size} bytes
- **Line Count**: ${script.stats.lines}
- **Last Modified**: ${script.stats.modified}
    `,
    level: 2
  });
  
  // Add code analysis section
  reportService.addSection({
    title: 'Code Analysis',
    content: 'The script appears to be a utility function with low complexity...',
    level: 2
  });
  
  // Generate and write report
  const result = reportService.writeReportToFile(outputPath);
  
  return result.success ? result.path : null;
}
```

### Example 2: Generating a Status Summary
```typescript
import { ReportService } from '../services/report-service';

function generateStatusReport(serviceName, metrics, issues) {
  const reportService = new ReportService();
  
  // Add header section
  reportService.addSection({
    title: `${serviceName} Status Report`,
    content: `Status report generated on ${new Date().toLocaleDateString()}`,
    level: 1
  });
  
  // Add metrics section
  reportService.addSection({
    title: 'Key Metrics',
    content: Object.entries(metrics)
      .map(([key, value]) => `- **${key}**: ${value}`)
      .join('\n'),
    level: 2
  });
  
  // Add issues section if there are any
  if (issues.length > 0) {
    reportService.addSection({
      title: 'Issues',
      content: issues
        .map(issue => `- **${issue.severity}**: ${issue.message}`)
        .join('\n'),
      level: 2
    });
  }
  
  return reportService.generateReport();
}
```

## 10. Integration Points
- Used by script analysis commands to generate analysis reports
- Integrated with workflow commands to document execution results
- Provides output formatting for document classification services
- Supports batch processing reporting needs
- Enables standardized report generation across the CLI pipeline

## Known Limitations
- Only supports Markdown format
- Limited templating capabilities (simple text replacement)
- No built-in support for charts or visualizations
- Reports are generated entirely in memory, which could be an issue for very large reports