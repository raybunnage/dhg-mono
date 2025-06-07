#!/usr/bin/env ts-node

const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');
const fs = require('fs');
const path = require('path');

interface DependencyMapping {
  sourceId: string;
  targetId: string;
  importPath: string;
  features: string[];
}

class DependencyAnalyzer {
  private supabase = SupabaseClientService.getInstance().getClient();
  private rootPath = path.join(__dirname, '../../..');
  private serviceMap = new Map<string, string>(); // service_name -> id
  private appMap = new Map<string, string>(); // app_name -> id
  private pipelineMap = new Map<string, string>(); // pipeline_name -> id

  async analyze() {
    console.log('🔍 Analyzing service dependencies...\n');

    try {
      // Load existing registry data
      await this.loadRegistryData();

      // Analyze app dependencies
      console.log('📱 Analyzing application dependencies...');
      await this.analyzeAppDependencies();

      // Analyze pipeline dependencies
      console.log('🔧 Analyzing pipeline dependencies...');
      await this.analyzePipelineDependencies();

      // Analyze service-to-service dependencies
      console.log('🔗 Analyzing service-to-service dependencies...');
      await this.analyzeServiceDependencies();

      console.log('\n✅ Dependency analysis complete!');
    } catch (error) {
      console.error('❌ Error analyzing dependencies:', error);
      process.exit(1);
    }
  }

  private async loadRegistryData() {
    // Load services
    const { data: services } = await this.supabase
      .from('sys_shared_services')
      .select('id, service_name');
    
    services?.forEach((s: any) => this.serviceMap.set(s.service_name, s.id));

    // Load applications
    const { data: apps } = await this.supabase
      .from('sys_applications')
      .select('id, app_name');
    
    apps?.forEach((a: any) => this.appMap.set(a.app_name, a.id));

    // Load pipelines
    const { data: pipelines } = await this.supabase
      .from('sys_cli_pipelines')
      .select('id, pipeline_name');
    
    pipelines?.forEach((p: any) => this.pipelineMap.set(p.pipeline_name, p.id));

    console.log(`📊 Loaded: ${this.serviceMap.size} services, ${this.appMap.size} apps, ${this.pipelineMap.size} pipelines\n`);
  }

  private async analyzeAppDependencies() {
    const appsPath = path.join(this.rootPath, 'apps');
    const apps = fs.readdirSync(appsPath, { withFileTypes: true })
      .filter((d: any) => d.isDirectory() && d.name.startsWith('dhg-'));

    for (const app of apps) {
      const appId = this.appMap.get(app.name);
      if (!appId) continue;

      console.log(`  Analyzing ${app.name}...`);
      const dependencies = await this.scanDirectoryForImports(
        path.join(appsPath, app.name, 'src')
      );

      // Save dependencies
      for (const [serviceName, importData] of dependencies) {
        const serviceId = this.serviceMap.get(serviceName);
        if (!serviceId) continue;

        await this.saveDependency('app', appId, serviceId, importData);
      }
    }
  }

  private async analyzePipelineDependencies() {
    const pipelinesPath = path.join(this.rootPath, 'scripts/cli-pipeline');
    const pipelines = fs.readdirSync(pipelinesPath, { withFileTypes: true })
      .filter((d: any) => d.isDirectory() && !d.name.startsWith('.'));

    for (const pipeline of pipelines) {
      const pipelineId = this.pipelineMap.get(pipeline.name);
      if (!pipelineId) continue;

      console.log(`  Analyzing ${pipeline.name}...`);
      const dependencies = await this.scanDirectoryForImports(
        path.join(pipelinesPath, pipeline.name)
      );

      // Save dependencies
      for (const [serviceName, importData] of dependencies) {
        const serviceId = this.serviceMap.get(serviceName);
        if (!serviceId) continue;

        await this.saveDependency('pipeline', pipelineId, serviceId, importData);
      }
    }
  }

  private async analyzeServiceDependencies() {
    const servicesPath = path.join(this.rootPath, 'packages/shared/services');
    
    for (const [serviceName, serviceId] of this.serviceMap) {
      console.log(`  Analyzing ${serviceName}...`);
      
      // Find service directory
      const serviceDir = this.findServiceDirectory(servicesPath, serviceName);
      if (!serviceDir) continue;

      const dependencies = await this.scanDirectoryForImports(serviceDir);

      // Save service-to-service dependencies
      for (const [depServiceName, importData] of dependencies) {
        if (depServiceName === serviceName) continue; // Skip self-references
        
        const depServiceId = this.serviceMap.get(depServiceName);
        if (!depServiceId) continue;

        await this.saveServiceDependency(serviceId, depServiceId);
      }
    }
  }

  private async scanDirectoryForImports(dirPath: string): Promise<Map<string, any>> {
    const dependencies = new Map<string, any>();
    
    if (!fs.existsSync(dirPath)) return dependencies;

    const scanFiles = (dir: string) => {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        
        if (file.isDirectory() && !file.name.includes('node_modules')) {
          scanFiles(fullPath);
        } else if (file.name.endsWith('.ts') || file.name.endsWith('.tsx')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          this.extractImports(content, dependencies);
        }
      }
    };

    scanFiles(dirPath);
    return dependencies;
  }

  private extractImports(content: string, dependencies: Map<string, any>) {
    // Pattern to match imports from shared services
    const importPattern = /import\s+(?:{([^}]+)}|(\w+))\s+from\s+['"](?:.*\/)?(?:@shared\/services|packages\/shared\/services)\/([^'"\/]+)/g;
    
    let match;
    while ((match = importPattern.exec(content)) !== null) {
      const imports = match[1] || match[2];
      const servicePath = match[3];
      
      // Convert service path to service name
      const serviceName = this.pathToServiceName(servicePath);
      
      if (!dependencies.has(serviceName)) {
        dependencies.set(serviceName, {
          importPath: `@shared/services/${servicePath}`,
          features: []
        });
      }
      
      // Extract imported features
      if (match[1]) {
        const features = match[1].split(',').map((f: string) => f.trim());
        dependencies.get(serviceName).features.push(...features);
      }
    }

    // Also check for direct requires (CommonJS)
    const requirePattern = /require\(['"](?:.*\/)?(?:@shared\/services|packages\/shared\/services)\/([^'"\/]+)/g;
    
    while ((match = requirePattern.exec(content)) !== null) {
      const servicePath = match[1];
      const serviceName = this.pathToServiceName(servicePath);
      
      if (!dependencies.has(serviceName)) {
        dependencies.set(serviceName, {
          importPath: `@shared/services/${servicePath}`,
          features: []
        });
      }
    }
  }

  private pathToServiceName(servicePath: string): string {
    // Remove file extensions
    servicePath = servicePath.replace(/\.(ts|js|tsx|jsx)$/, '');
    
    // Convert path to PascalCase service name
    return servicePath
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }

  private findServiceDirectory(servicesPath: string, serviceName: string): string | null {
    // Convert service name to kebab-case
    const kebabName = serviceName
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase();

    const possiblePaths = [
      path.join(servicesPath, kebabName),
      path.join(servicesPath, kebabName + '-service'),
      servicesPath // For single-file services
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return null;
  }

  private async saveDependency(type: 'app' | 'pipeline', sourceId: string, serviceId: string, importData: any) {
    const table = type === 'app' ? 'sys_app_service_dependencies' : 'sys_pipeline_service_dependencies';
    
    const { error } = await this.supabase
      .from(table)
      .upsert({
        [type + '_id']: sourceId,
        service_id: serviceId,
        usage_type: 'direct',
        import_path: importData.importPath,
        features_used: [...new Set(importData.features)],
        notes: 'Auto-detected by dependency analyzer'
      }, {
        onConflict: type + '_id,service_id' + (type === 'pipeline' ? ',command_name' : '')
      });

    if (error && !error.message.includes('duplicate key')) {
      console.error(`    ❌ Error saving ${type} dependency:`, error);
    }
  }

  private async saveServiceDependency(serviceId: string, dependsOnServiceId: string) {
    const { error } = await this.supabase
      .from('sys_service_dependencies')
      .upsert({
        service_id: serviceId,
        depends_on_service_id: dependsOnServiceId,
        dependency_type: 'required',
        notes: 'Auto-detected by dependency analyzer'
      }, {
        onConflict: 'service_id,depends_on_service_id'
      });

    if (error && !error.message.includes('duplicate key')) {
      console.error(`    ❌ Error saving service dependency:`, error);
    }
  }
}

// Run the analyzer
const analyzer = new DependencyAnalyzer();
analyzer.analyze();