#!/usr/bin/env ts-node

import { program } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getSupabaseClient } from './utils/supabase-helper';
import { getMonorepoRoot } from './utils/file-scanner';

interface ReportOptions {
  format?: 'markdown' | 'json' | 'html';
  service?: string;
  output?: string;
}

interface ServiceReport {
  overview: {
    totalServices: number;
    totalApps: number;
    totalPipelines: number;
    totalDependencies: number;
    unusedServices: number;
    criticalServices: number;
  };
  criticalServices: Array<{
    service_name: string;
    total_dependents: number;
    app_count: number;
    pipeline_count: number;
    critical_dependencies: number;
  }>;
  unusedServices: Array<{
    service_name: string;
    service_type: string;
    package_path: string;
  }>;
  pipelineCoverageGaps: Array<{
    service_name: string;
    app_usage_count: number;
    used_by_apps: string;
  }>;
  appDependencies: Array<{
    app_name: string;
    service_count: number;
    critical_services: number;
    services_used: string;
  }>;
}

async function generateServiceReport(serviceName: string): Promise<string> {
  const supabase = getSupabaseClient();
  
  // Get service details
  const { data: service } = await supabase
    .from('registry_services')
    .select('*')
    .eq('service_name', serviceName)
    .single();
  
  if (!service) {
    throw new Error(`Service '${serviceName}' not found`);
  }
  
  // Get usage summary
  const { data: usage } = await supabase
    .from('registry_service_usage_summary_view')
    .select('*')
    .eq('service_name', serviceName)
    .single();
  
  // Get all dependencies
  const { data: dependencies } = await supabase
    .from('service_dependencies')
    .select('*')
    .eq('service_name', serviceName)
    .order('dependent_type', { ascending: true })
    .order('dependent_name', { ascending: true });
  
  // Generate markdown report
  let report = `# Service Report: ${service.display_name}\n\n`;
  report += `**Service Name**: ${service.service_name}\n`;
  report += `**Type**: ${service.service_type}${service.is_singleton ? ' (Singleton)' : ''}\n`;
  report += `**Location**: ${service.package_path}/${service.service_file}\n`;
  report += `**Status**: ${service.status}\n\n`;
  
  report += `## Usage Summary\n\n`;
  if (usage) {
    report += `- **Total Dependents**: ${usage.total_dependents}\n`;
    report += `- **Used by Apps**: ${usage.app_count}\n`;
    report += `- **Used by Pipelines**: ${usage.pipeline_count}\n`;
    report += `- **Critical Dependencies**: ${usage.critical_dependencies}\n\n`;
  } else {
    report += `This service has no dependencies.\n\n`;
  }
  
  if (dependencies && dependencies.length > 0) {
    report += `## Dependencies\n\n`;
    
    // Group by type
    const apps = dependencies.filter(d => d.dependent_type === 'app');
    const pipelines = dependencies.filter(d => d.dependent_type === 'pipeline');
    
    if (apps.length > 0) {
      report += `### Applications (${apps.length})\n\n`;
      report += `| App | Dependency Type | Usage | Critical |\n`;
      report += `|-----|----------------|-------|----------|\n`;
      for (const dep of apps) {
        report += `| ${dep.dependent_name} | ${dep.dependency_type} | ${dep.usage_frequency} | ${dep.is_critical ? '⚠️ Yes' : 'No'} |\n`;
      }
      report += '\n';
    }
    
    if (pipelines.length > 0) {
      report += `### CLI Pipelines (${pipelines.length})\n\n`;
      report += `| Pipeline | Dependency Type | Usage | Critical |\n`;
      report += `|----------|----------------|-------|----------|\n`;
      for (const dep of pipelines) {
        report += `| ${dep.dependent_name} | ${dep.dependency_type} | ${dep.usage_frequency} | ${dep.is_critical ? '⚠️ Yes' : 'No'} |\n`;
      }
      report += '\n';
    }
  }
  
  report += `## Recommendations\n\n`;
  if (!usage || usage.total_dependents === 0) {
    report += `- ✅ This service is not used and can be safely archived\n`;
    report += `- Run \`./registry-cli.sh archive-service --service ${serviceName}\` to archive\n`;
  } else if (usage.critical_dependencies > 0) {
    report += `- ⚠️ This is a critical service with ${usage.critical_dependencies} critical dependencies\n`;
    report += `- Changes to this service may impact multiple applications and pipelines\n`;
    report += `- Consider creating comprehensive tests before modifying\n`;
  } else {
    report += `- This service is used by ${usage.total_dependents} components\n`;
    report += `- Review dependencies before making breaking changes\n`;
  }
  
  return report;
}

async function generateFullReport(options: ReportOptions): Promise<ServiceReport> {
  const supabase = getSupabaseClient();
  
  // Get overview statistics
  const [
    { count: totalServices },
    { count: totalApps },
    { count: totalPipelines },
    { count: totalDependencies }
  ] = await Promise.all([
    supabase.from('registry_services').select('*', { count: 'exact', head: true }),
    supabase.from('registry_apps').select('*', { count: 'exact', head: true }),
    supabase.from('registry_cli_pipelines').select('*', { count: 'exact', head: true }),
    supabase.from('service_dependencies').select('*', { count: 'exact', head: true })
  ]);
  
  // Get unused services count
  const { count: unusedServices } = await supabase
    .from('registry_unused_services_view')
    .select('*', { count: 'exact', head: true })
    .eq('is_unused', true);
  
  // Get critical services (top 10 by dependent count)
  const { data: criticalServices } = await supabase
    .from('registry_service_usage_summary_view')
    .select('service_name, total_dependents, app_count, pipeline_count, critical_dependencies')
    .gt('total_dependents', 0)
    .order('total_dependents', { ascending: false })
    .limit(10);
  
  // Get unused services (sample)
  const { data: unusedServicesList } = await supabase
    .from('registry_unused_services_view')
    .select('service_name, service_type, package_path')
    .eq('is_unused', true)
    .limit(10);
  
  // Get pipeline coverage gaps
  const { data: pipelineCoverageGaps } = await supabase
    .from('registry_pipeline_coverage_gaps_view')
    .select('service_name, app_usage_count, used_by_apps')
    .order('app_usage_count', { ascending: false })
    .limit(10);
  
  // Get app dependencies
  const { data: appDependencies } = await supabase
    .from('registry_app_dependencies_view')
    .select('app_name, service_count, critical_services, services_used')
    .order('service_count', { ascending: false });
  
  return {
    overview: {
      totalServices: totalServices || 0,
      totalApps: totalApps || 0,
      totalPipelines: totalPipelines || 0,
      totalDependencies: totalDependencies || 0,
      unusedServices: unusedServices || 0,
      criticalServices: criticalServices?.filter(s => s.critical_dependencies > 0).length || 0
    },
    criticalServices: criticalServices || [],
    unusedServices: unusedServicesList || [],
    pipelineCoverageGaps: pipelineCoverageGaps || [],
    appDependencies: appDependencies || []
  };
}

function formatReportAsMarkdown(report: ServiceReport): string {
  let markdown = '# Service Dependency Analysis Report\n\n';
  markdown += `*Generated: ${new Date().toISOString().split('T')[0]}*\n\n`;
  
  // Overview
  markdown += '## Overview\n\n';
  markdown += `| Metric | Count |\n`;
  markdown += `|--------|-------|\n`;
  markdown += `| Total Services | ${report.overview.totalServices} |\n`;
  markdown += `| Total Applications | ${report.overview.totalApps} |\n`;
  markdown += `| Total CLI Pipelines | ${report.overview.totalPipelines} |\n`;
  markdown += `| Total Dependencies | ${report.overview.totalDependencies} |\n`;
  markdown += `| Unused Services | ${report.overview.unusedServices} |\n`;
  markdown += `| Critical Services | ${report.overview.criticalServices} |\n\n`;
  
  // Critical Services
  if (report.criticalServices.length > 0) {
    markdown += '## Critical Services\n\n';
    markdown += 'Services with the most dependencies:\n\n';
    markdown += '| Service | Total Deps | Apps | Pipelines | Critical |\n';
    markdown += '|---------|------------|------|-----------|----------|\n';
    for (const service of report.criticalServices) {
      markdown += `| ${service.service_name} | ${service.total_dependents} | ${service.app_count} | ${service.pipeline_count} | ${service.critical_dependencies} |\n`;
    }
    markdown += '\n';
  }
  
  // Pipeline Coverage Gaps
  if (report.pipelineCoverageGaps.length > 0) {
    markdown += '## Pipeline Coverage Gaps\n\n';
    markdown += 'Services used in apps but not available via CLI:\n\n';
    markdown += '| Service | App Usage | Used By |\n';
    markdown += '|---------|-----------|----------|\n';
    for (const gap of report.pipelineCoverageGaps) {
      markdown += `| ${gap.service_name} | ${gap.app_usage_count} | ${gap.used_by_apps} |\n`;
    }
    markdown += '\n**Recommendation**: Consider creating CLI commands for these services.\n\n';
  }
  
  // App Dependencies
  markdown += '## Application Dependencies\n\n';
  markdown += '| Application | Services Used | Critical Services |\n';
  markdown += '|-------------|---------------|-------------------|\n';
  for (const app of report.appDependencies) {
    markdown += `| ${app.app_name} | ${app.service_count} | ${app.critical_services} |\n`;
  }
  markdown += '\n';
  
  // Unused Services
  if (report.unusedServices.length > 0) {
    markdown += '## Unused Services (Sample)\n\n';
    markdown += 'Services with no dependencies:\n\n';
    markdown += '| Service | Type | Location |\n';
    markdown += '|---------|------|----------|\n';
    for (const service of report.unusedServices) {
      markdown += `| ${service.service_name} | ${service.service_type} | ${service.package_path} |\n`;
    }
    markdown += `\n*Showing ${report.unusedServices.length} of ${report.overview.unusedServices} unused services*\n\n`;
  }
  
  // Recommendations
  markdown += '## Recommendations\n\n';
  markdown += '### Immediate Actions\n\n';
  if (report.overview.unusedServices > 0) {
    markdown += `1. **Archive Unused Services**: ${report.overview.unusedServices} services have no dependencies\n`;
    markdown += '   - Run `./registry-cli.sh find-unused` for detailed list\n';
    markdown += '   - Use `./registry-cli.sh archive-service` to archive\n\n';
  }
  
  if (report.pipelineCoverageGaps.length > 0) {
    markdown += `2. **Create CLI Commands**: ${report.pipelineCoverageGaps.length} services need CLI access\n`;
    markdown += '   - Prioritize by app usage count\n';
    markdown += '   - Add to appropriate CLI pipelines\n\n';
  }
  
  markdown += '### Ongoing Maintenance\n\n';
  markdown += '- Run dependency analysis weekly to track changes\n';
  markdown += '- Review critical services before major refactoring\n';
  markdown += '- Monitor unused services for archiving opportunities\n';
  
  return markdown;
}

async function generateReport(options: ReportOptions): Promise<void> {
  console.log('📊 Generating dependency report...\n');
  
  try {
    let output: string;
    
    // Generate service-specific report
    if (options.service) {
      output = await generateServiceReport(options.service);
    }
    // Generate full analysis report
    else {
      const report = await generateFullReport(options);
      
      switch (options.format) {
        case 'json':
          output = JSON.stringify(report, null, 2);
          break;
        case 'html':
          // Simple HTML format
          const markdown = formatReportAsMarkdown(report);
          output = `<!DOCTYPE html>
<html>
<head>
  <title>Service Dependency Report</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    h1, h2, h3 { color: #333; }
    code { background-color: #f4f4f4; padding: 2px 4px; }
  </style>
</head>
<body>
${markdown.replace(/\n/g, '<br>\n').replace(/#{3} (.*)/g, '<h3>$1</h3>').replace(/#{2} (.*)/g, '<h2>$1</h2>').replace(/# (.*)/g, '<h1>$1</h1>')}
</body>
</html>`;
          break;
        case 'markdown':
        default:
          output = formatReportAsMarkdown(report);
      }
    }
    
    // Output to file or console
    if (options.output) {
      const outputPath = path.isAbsolute(options.output) 
        ? options.output 
        : path.join(getMonorepoRoot(), options.output);
      
      await fs.writeFile(outputPath, output);
      console.log(`✅ Report saved to: ${outputPath}`);
    } else {
      console.log(output);
    }
    
  } catch (error) {
    console.error('❌ Error generating report:', error);
    process.exit(1);
  }
}

// CLI setup
program
  .name('generate-report')
  .description('Generate comprehensive dependency analysis reports')
  .option('-f, --format <type>', 'Output format (markdown, json, html)', 'markdown')
  .option('-s, --service <name>', 'Generate report for specific service')
  .option('-o, --output <file>', 'Output to file instead of console')
  .action(generateReport);

program.parse();