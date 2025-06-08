#!/usr/bin/env ts-node

const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');
const fs = require('fs');
const path = require('path');

interface ServiceInfo {
  service_name: string;
  service_path: string;
  description?: string;
  category?: string;
  is_singleton: boolean;
  has_browser_variant: boolean;
  exports: string[];
  dependencies: string[];
}

interface AppInfo {
  app_name: string;
  app_path: string;
  description?: string;
  app_type: 'vite' | 'node' | 'hybrid';
  port_dev?: number;
  port_preview?: number;
}

interface PipelineInfo {
  pipeline_name: string;
  pipeline_path: string;
  description?: string;
  shell_script?: string;
  commands: string[];
}

class ServiceRegistryPopulator {
  private supabase = SupabaseClientService.getInstance().getClient();
  private servicesPath = path.join(__dirname, '../../../packages/shared/services');
  private appsPath = path.join(__dirname, '../../../apps');
  private pipelinesPath = path.join(__dirname, '..');

  async populate() {
    console.log('🔍 Scanning for services, applications, and pipelines...\n');

    try {
      // 1. Scan and populate services
      const services = await this.scanServices();
      await this.populateServices(services);

      // 2. Scan and populate applications
      const apps = await this.scanApplications();
      await this.populateApplications(apps);

      // 3. Scan and populate CLI pipelines
      const pipelines = await this.scanPipelines();
      await this.populatePipelines(pipelines);

      console.log('\n✅ Service registry population complete!');
    } catch (error) {
      console.error('❌ Error populating registry:', error);
      process.exit(1);
    }
  }

  private async scanServices(): Promise<ServiceInfo[]> {
    const services: ServiceInfo[] = [];
    const entries = fs.readdirSync(this.servicesPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const servicePath = path.join(this.servicesPath, entry.name);
        const serviceInfo = this.analyzeService(entry.name, servicePath);
        if (serviceInfo) {
          services.push(serviceInfo);
        }
      } else if (entry.name.endsWith('.ts') && !entry.name.includes('.test.')) {
        // Single file services
        const serviceInfo = this.analyzeServiceFile(entry.name);
        if (serviceInfo) {
          services.push(serviceInfo);
        }
      }
    }

    return services;
  }

  private analyzeService(dirName: string, servicePath: string): ServiceInfo | null {
    const indexPath = path.join(servicePath, 'index.ts');
    const mainServiceFile = fs.readdirSync(servicePath).find((f: string) => 
      f.endsWith('-service.ts') && !f.includes('.test.')
    );

    if (!fs.existsSync(indexPath) && !mainServiceFile) {
      return null;
    }

    const serviceName = this.extractServiceName(dirName);
    const category = this.categorizeService(dirName);
    const hasBrowserVariant = fs.existsSync(path.join(servicePath, 'browser.ts')) ||
                              fs.existsSync(path.join(servicePath, 'browser-index.ts'));

    // Read the main service file to check for singleton pattern
    const serviceContent = mainServiceFile ? 
      fs.readFileSync(path.join(servicePath, mainServiceFile), 'utf-8') : '';
    const isSingleton = serviceContent.includes('getInstance()') || 
                       serviceContent.includes('singleton');

    // Extract exports and dependencies
    const exports = this.extractExports(servicePath);
    const dependencies = this.extractDependencies(servicePath);

    return {
      service_name: serviceName,
      service_path: dirName + '/',
      description: this.generateDescription(serviceName, category),
      category,
      is_singleton: isSingleton,
      has_browser_variant: hasBrowserVariant,
      exports,
      dependencies
    };
  }

  private analyzeServiceFile(fileName: string): ServiceInfo | null {
    const serviceName = this.extractServiceName(fileName.replace('.ts', ''));
    const category = this.categorizeService(fileName);
    const filePath = path.join(this.servicesPath, fileName);
    const content = fs.readFileSync(filePath, 'utf-8');

    const isSingleton = content.includes('getInstance()') || 
                       content.includes('singleton');

    return {
      service_name: serviceName,
      service_path: fileName,
      description: this.generateDescription(serviceName, category),
      category,
      is_singleton: isSingleton,
      has_browser_variant: false,
      exports: this.extractExportsFromContent(content),
      dependencies: this.extractDependenciesFromContent(content)
    };
  }

  private extractServiceName(fileName: string): string {
    // Convert kebab-case to PascalCase
    return fileName
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }

  private categorizeService(name: string): string {
    if (name.includes('auth')) return 'auth';
    if (name.includes('supabase') || name.includes('database')) return 'database';
    if (name.includes('ai') || name.includes('claude') || name.includes('prompt')) return 'ai';
    if (name.includes('google') || name.includes('drive')) return 'google';
    if (name.includes('document') || name.includes('classify')) return 'document';
    if (name.includes('media') || name.includes('audio') || name.includes('video')) return 'media';
    return 'utility';
  }

  private generateDescription(serviceName: string, category: string): string {
    const descriptions: Record<string, string> = {
      'SupabaseClient': 'Singleton service for Supabase database operations',
      'ClaudeService': 'Claude AI API integration service',
      'GoogleDrive': 'Google Drive API integration and file management',
      'AuthService': 'Authentication and authorization service',
      'DocumentType': 'Document type classification and management',
      'PromptService': 'AI prompt management and template service',
      'FileService': 'File system operations and management',
      'GitService': 'Git repository operations service',
      'CommandTracking': 'CLI command usage tracking and analytics',
      'FilterService': 'User filter profiles and preferences management'
    };

    for (const [key, desc] of Object.entries(descriptions)) {
      if (serviceName.includes(key)) {
        return desc;
      }
    }

    return `${category.charAt(0).toUpperCase() + category.slice(1)} service`;
  }

  private extractExports(servicePath: string): string[] {
    const exports: string[] = [];
    const indexPath = path.join(servicePath, 'index.ts');
    
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, 'utf-8');
      const exportMatches = content.matchAll(/export\s*{\s*([^}]+)\s*}/g);
      for (const match of exportMatches) {
        const items = match[1].split(',').map((item: string) => item.trim());
        exports.push(...items);
      }
    }

    return exports;
  }

  private extractExportsFromContent(content: string): string[] {
    const exports: string[] = [];
    const exportMatches = content.matchAll(/export\s+(class|function|const|interface|type)\s+(\w+)/g);
    for (const match of exportMatches) {
      exports.push(match[2]);
    }
    return exports;
  }

  private extractDependencies(servicePath: string): string[] {
    const dependencies: string[] = [];
    const files = fs.readdirSync(servicePath).filter((f: string) => f.endsWith('.ts'));
    
    for (const file of files) {
      const content = fs.readFileSync(path.join(servicePath, file), 'utf-8');
      dependencies.push(...this.extractDependenciesFromContent(content));
    }

    return [...new Set(dependencies)]; // Remove duplicates
  }

  private extractDependenciesFromContent(content: string): string[] {
    const dependencies: string[] = [];
    const importMatches = content.matchAll(/from\s+['"].*\/services\/([^'"\/]+)/g);
    
    for (const match of importMatches) {
      const serviceName = this.extractServiceName(match[1]);
      dependencies.push(serviceName);
    }

    return dependencies;
  }

  private async scanApplications(): Promise<AppInfo[]> {
    const apps: AppInfo[] = [];
    const entries = fs.readdirSync(this.appsPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('dhg-')) {
        const appPath = path.join(this.appsPath, entry.name);
        const appInfo = this.analyzeApplication(entry.name, appPath);
        if (appInfo) {
          apps.push(appInfo);
        }
      }
    }

    return apps;
  }

  private analyzeApplication(appName: string, appPath: string): AppInfo | null {
    const packageJsonPath = path.join(appPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      return null;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const hasViteConfig = fs.existsSync(path.join(appPath, 'vite.config.ts')) ||
                         fs.existsSync(path.join(appPath, 'vite.config.js'));

    // Extract ports from vite config or package.json scripts
    let portDev: number | undefined;
    let portPreview: number | undefined;

    if (hasViteConfig) {
      const viteConfigPath = fs.existsSync(path.join(appPath, 'vite.config.ts')) ?
        path.join(appPath, 'vite.config.ts') : path.join(appPath, 'vite.config.js');
      const viteContent = fs.readFileSync(viteConfigPath, 'utf-8');
      
      const portMatch = viteContent.match(/port:\s*(\d+)/);
      if (portMatch) {
        portDev = parseInt(portMatch[1]);
      }
    }

    return {
      app_name: appName,
      app_path: appName + '/',
      description: packageJson.description || this.generateAppDescription(appName),
      app_type: hasViteConfig ? 'vite' : 'node',
      port_dev: portDev,
      port_preview: portPreview
    };
  }

  private generateAppDescription(appName: string): string {
    const descriptions: Record<string, string> = {
      'dhg-hub': 'Main hub application for the DHG platform',
      'dhg-admin-code': 'Admin dashboard for code and development management',
      'dhg-audio': 'Audio processing and playback application',
      'dhg-improve-experts': 'Expert management and improvement tools',
      'dhg-research': 'Research and documentation application',
      'dhg-admin-suite': 'Comprehensive admin tools suite',
      'dhg-admin-google': 'Google Drive administration interface'
    };

    return descriptions[appName] || 'DHG application';
  }

  private async scanPipelines(): Promise<PipelineInfo[]> {
    const pipelines: PipelineInfo[] = [];
    const entries = fs.readdirSync(this.pipelinesPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const pipelinePath = path.join(this.pipelinesPath, entry.name);
        const pipelineInfo = this.analyzePipeline(entry.name, pipelinePath);
        if (pipelineInfo) {
          pipelines.push(pipelineInfo);
        }
      }
    }

    return pipelines;
  }

  private analyzePipeline(pipelineName: string, pipelinePath: string): PipelineInfo | null {
    // Look for shell script
    const shellScript = fs.readdirSync(pipelinePath).find((f: string) => f.endsWith('-cli.sh'));
    if (!shellScript) {
      return null;
    }

    // Extract commands from shell script
    const scriptContent = fs.readFileSync(path.join(pipelinePath, shellScript), 'utf-8');
    const commands = this.extractCommandsFromScript(scriptContent);

    return {
      pipeline_name: pipelineName,
      pipeline_path: pipelineName + '/',
      description: this.generatePipelineDescription(pipelineName),
      shell_script: shellScript,
      commands
    };
  }

  private extractCommandsFromScript(scriptContent: string): string[] {
    const commands: string[] = [];
    
    // Look for case statements (common pattern in CLI scripts)
    const caseMatches = scriptContent.matchAll(/["']([a-z-]+)["']\s*\)/g);
    for (const match of caseMatches) {
      if (!match[1].startsWith('-')) {
        commands.push(match[1]);
      }
    }

    return [...new Set(commands)].sort();
  }

  private generatePipelineDescription(pipelineName: string): string {
    const descriptions: Record<string, string> = {
      'google_sync': 'Google Drive synchronization and management pipeline',
      'document': 'Document processing and classification pipeline',
      'document_types': 'Document type management pipeline',
      'media-processing': 'Media file processing and transcription pipeline',
      'presentations': 'Presentation management and processing pipeline',
      'prompt_service': 'AI prompt management pipeline',
      'database': 'Database operations and migrations pipeline',
      'dev_tasks': 'Development task management pipeline',
      'system': 'System utilities and maintenance pipeline',
      'all_pipelines': 'Master pipeline orchestrator',
      'viewers': 'File viewing and serving utilities'
    };

    return descriptions[pipelineName] || `${pipelineName} operations pipeline`;
  }

  private async populateServices(services: ServiceInfo[]) {
    console.log(`📦 Found ${services.length} services to register\n`);

    for (const service of services) {
      try {
        const { error } = await this.supabase
          .from('sys_shared_services')
          .upsert({
            service_name: service.service_name,
            service_path: service.service_path,
            description: service.description,
            category: service.category,
            is_singleton: service.is_singleton,
            has_browser_variant: service.has_browser_variant,
            exports: service.exports,
            dependencies: service.dependencies,
            status: 'active'
          }, {
            onConflict: 'service_name'
          });

        if (error) {
          console.error(`❌ Error registering ${service.service_name}:`, error);
        } else {
          console.log(`✅ Registered service: ${service.service_name}`);
        }
      } catch (err) {
        console.error(`❌ Error processing ${service.service_name}:`, err);
      }
    }
  }

  private async populateApplications(apps: AppInfo[]) {
    console.log(`\n🎯 Found ${apps.length} applications to register\n`);

    for (const app of apps) {
      try {
        const { error } = await this.supabase
          .from('sys_applications')
          .upsert({
            app_name: app.app_name,
            app_path: app.app_path,
            description: app.description,
            app_type: app.app_type,
            port_dev: app.port_dev,
            port_preview: app.port_preview,
            status: 'active'
          }, {
            onConflict: 'app_name'
          });

        if (error) {
          console.error(`❌ Error registering ${app.app_name}:`, error);
        } else {
          console.log(`✅ Registered application: ${app.app_name}`);
        }
      } catch (err) {
        console.error(`❌ Error processing ${app.app_name}:`, err);
      }
    }
  }

  private async populatePipelines(pipelines: PipelineInfo[]) {
    console.log(`\n🔧 Found ${pipelines.length} CLI pipelines to register\n`);

    for (const pipeline of pipelines) {
      try {
        const { error } = await this.supabase
          .from('sys_cli_pipelines')
          .upsert({
            pipeline_name: pipeline.pipeline_name,
            pipeline_path: pipeline.pipeline_path,
            description: pipeline.description,
            shell_script: pipeline.shell_script,
            commands: pipeline.commands,
            status: 'active'
          }, {
            onConflict: 'pipeline_name'
          });

        if (error) {
          console.error(`❌ Error registering ${pipeline.pipeline_name}:`, error);
        } else {
          console.log(`✅ Registered pipeline: ${pipeline.pipeline_name} (${pipeline.commands.length} commands)`);
        }
      } catch (err) {
        console.error(`❌ Error processing ${pipeline.pipeline_name}:`, err);
      }
    }
  }
}

// Run the populator
const populator = new ServiceRegistryPopulator();
populator.populate();