#!/usr/bin/env ts-node

/**
 * Continuous Improvement Scenario: Add New Proxy Server
 * 
 * This script automates the process of adding a new proxy server to the infrastructure
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { SupabaseClientService } from '@shared/services/supabase-client';
import { ScenarioExecutionTracker } from '../track-scenario-execution';

interface ProxyServerConfig {
  name: string;
  displayName: string;
  port: number;
  description: string;
  category: 'infrastructure' | 'viewer' | 'utility' | 'management';
  features: string[];
  endpoints: Record<string, string>;
}

class AddNewProxyServerScenario {
  private projectRoot: string;
  private tracker: ScenarioExecutionTracker;
  
  constructor() {
    this.projectRoot = path.resolve(__dirname, '../../../../');
    this.tracker = new ScenarioExecutionTracker();
  }

  async execute(config: ProxyServerConfig): Promise<void> {
    console.log('🚀 Starting Add New Proxy Server scenario...');
    console.log(`📦 Adding proxy: ${config.displayName} on port ${config.port}`);
    
    // Start execution tracking
    await this.tracker.startExecution('add-new-proxy-server', {
      name: config.name,
      port: config.port,
      displayName: config.displayName,
      category: config.category
    });
    
    const changedFiles: string[] = [];
    
    try {
      // Step 1: Update CLAUDE.md
      await this.updateClaudeMd(config);
      changedFiles.push('CLAUDE.md');
      await this.tracker.trackStepCompletion(1, true, 'Updated CLAUDE.md port registry');
      
      // Step 2: Create proxy server script
      await this.createProxyScript(config);
      changedFiles.push(`scripts/cli-pipeline/proxy/start-${config.name}.ts`);
      await this.tracker.trackStepCompletion(2, true, 'Created proxy server script');
      
      // Step 3: Update package.json
      await this.updatePackageJson(config);
      changedFiles.push('package.json');
      await this.tracker.trackStepCompletion(3, true, 'Updated package.json');
      
      // Step 4: Add to all proxy servers
      await this.updateAllProxyServers(config);
      changedFiles.push('scripts/cli-pipeline/proxy/start-all-proxy-servers.ts');
      await this.tracker.trackStepCompletion(4, true, 'Added to proxy startup list');
      
      // Step 5: Create database migration
      const migrationFile = await this.createDatabaseMigration(config);
      changedFiles.push(migrationFile);
      await this.tracker.trackStepCompletion(5, true, 'Created database migration');
      
      // Step 6: Update proxy tests
      await this.updateProxyTests(config);
      changedFiles.push('packages/shared/services/proxy-server/__tests__/proxy-server-health.test.ts');
      await this.tracker.trackStepCompletion(6, true, 'Updated proxy health tests');
      
      // Step 7: Run migration
      await this.runMigration(config);
      await this.tracker.trackStepCompletion(7, true, 'Ran database migration');
      
      // Complete tracking with success
      await this.tracker.completeExecution(
        true,
        `Successfully added proxy server '${config.displayName}' on port ${config.port}`,
        {
          files_modified: changedFiles.length,
          files: changedFiles,
          proxy_name: config.name,
          proxy_port: config.port
        }
      );
      
      console.log('✅ Successfully added new proxy server!');
      console.log('\nNext steps:');
      console.log(`1. Test the proxy: pnpm proxy:${config.name.replace('-proxy', '')}`);
      console.log(`2. Run all tests: pnpm test packages/proxy-servers`);
      console.log(`3. Start all proxies: pnpm servers`);
      
    } catch (error) {
      // Track failure
      await this.tracker.completeExecution(
        false,
        undefined,
        { files_modified: changedFiles.length, files: changedFiles },
        error instanceof Error ? error.message : String(error)
      );
      
      console.error('❌ Error adding proxy server:', error);
      throw error;
    }
  }

  private async updateClaudeMd(config: ProxyServerConfig): Promise<void> {
    console.log('📝 Updating CLAUDE.md...');
    
    const claudeMdPath = path.join(this.projectRoot, 'CLAUDE.md');
    let content = fs.readFileSync(claudeMdPath, 'utf-8');
    
    // Find the proxy servers section
    const proxyMatch = content.match(/(.*Proxy Servers:.*?)(.*?)(\[Reserved:.*?\])/s);
    if (!proxyMatch) {
      throw new Error('Could not find Proxy Servers section in CLAUDE.md');
    }
    
    // Extract the reserved range
    const reservedMatch = proxyMatch[3].match(/\[Reserved: .*?(\d+)-(\d+).*?\]/);
    if (!reservedMatch) {
      throw new Error('Could not find reserved port range');
    }
    
    const nextReservedStart = config.port + 1;
    const reservedEnd = parseInt(reservedMatch[2]);
    
    // Add new proxy entry
    const newEntry = `   - ${config.name}: ${config.port} (${config.description})\n`;
    const newReserved = `   - [Reserved: ${nextReservedStart}-${reservedEnd} for future proxy servers]`;
    
    // Replace content
    const newContent = content.replace(
      proxyMatch[0],
      proxyMatch[1] + proxyMatch[2] + newEntry + newReserved
    );
    
    fs.writeFileSync(claudeMdPath, newContent);
    console.log('✅ Updated CLAUDE.md');
  }

  private async createProxyScript(config: ProxyServerConfig): Promise<void> {
    console.log('📄 Creating proxy server script...');
    
    const scriptPath = path.join(
      this.projectRoot,
      'scripts/cli-pipeline/proxy',
      `start-${config.name}.ts`
    );
    
    const endpointHandlers = Object.entries(config.endpoints)
      .filter(([name]) => name !== 'health')
      .map(([name, spec]) => {
        const [method, path] = spec.split(' ');
        return `
// ${name} endpoint
app.${method.toLowerCase()}('${path}', async (req, res) => {
  try {
    // TODO: Implement ${name} logic
    res.json({ 
      message: '${name} endpoint not yet implemented',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in ${name}:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});`;
      }).join('\n');
    
    const scriptContent = `#!/usr/bin/env ts-node

/**
 * ${config.displayName}
 * ${config.description}
 */

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = ${config.port};

// Enable CORS for UI apps
app.use(cors());
app.use(express.json());

// Health check endpoint (REQUIRED)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    service: '${config.name}',
    port: PORT
  });
});
${endpointHandlers}

// Start server
app.listen(PORT, () => {
  console.log(\`🚀 ${config.displayName} running on http://localhost:\${PORT}\`);
  console.log(\`📍 Endpoints:\`);
  console.log(\`   GET    /health                 - Health check\`);
${Object.entries(config.endpoints)
  .filter(([name]) => name !== 'health')
  .map(([name, spec]) => `  console.log(\`   ${spec.padEnd(30)} - ${name}\`);`)
  .join('\n')}
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\\nShutting down ${config.displayName}...');
  process.exit(0);
});`;
    
    fs.writeFileSync(scriptPath, scriptContent);
    execSync(`chmod +x ${scriptPath}`);
    console.log('✅ Created proxy script');
  }

  private async updatePackageJson(config: ProxyServerConfig): Promise<void> {
    console.log('📦 Updating package.json...');
    
    const packagePath = path.join(this.projectRoot, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
    
    const proxyKey = `proxy:${config.name.replace('-proxy', '')}`;
    packageJson.scripts[proxyKey] = `ts-node scripts/cli-pipeline/proxy/start-${config.name}.ts`;
    
    // Sort scripts to maintain order
    const scripts = Object.entries(packageJson.scripts);
    const proxyScripts = scripts.filter(([key]) => key.startsWith('proxy:'));
    const otherScripts = scripts.filter(([key]) => !key.startsWith('proxy:'));
    
    // Insert new proxy script in alphabetical order
    proxyScripts.push([proxyKey, packageJson.scripts[proxyKey]]);
    proxyScripts.sort((a, b) => a[0].localeCompare(b[0]));
    
    // Rebuild scripts object
    const newScripts: Record<string, string> = {};
    for (const [key, value] of otherScripts) {
      newScripts[key] = value as string;
      // Insert proxy scripts after proxy:html-browser
      if (key === 'proxy:html-browser') {
        for (const [pKey, pValue] of proxyScripts) {
          if (pKey !== 'proxy:html-browser') {
            newScripts[pKey] = pValue as string;
          }
        }
      }
    }
    
    packageJson.scripts = newScripts;
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log('✅ Updated package.json');
  }

  private async updateAllProxyServers(config: ProxyServerConfig): Promise<void> {
    console.log('🔧 Updating start-all-proxy-servers.ts...');
    
    const filePath = path.join(
      this.projectRoot,
      'scripts/cli-pipeline/proxy/start-all-proxy-servers.ts'
    );
    
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Find the PROXY_SERVERS array
    const arrayMatch = content.match(/const PROXY_SERVERS: ProxyServer\[\] = \[([\s\S]*?)\];/);
    if (!arrayMatch) {
      throw new Error('Could not find PROXY_SERVERS array');
    }
    
    // Create new server entry
    const newEntry = `  {
    name: '${config.displayName}',
    port: ${config.port},
    scriptPath: 'start-${config.name}.ts',
    status: 'stopped',
    healthEndpoint: '/health'
  }`;
    
    // Insert before the last closing bracket
    const arrayContent = arrayMatch[1].trim();
    const newArrayContent = arrayContent + ',\n' + newEntry;
    
    content = content.replace(arrayMatch[0], `const PROXY_SERVERS: ProxyServer[] = [\n${newArrayContent}\n];`);
    
    fs.writeFileSync(filePath, content);
    console.log('✅ Updated start-all-proxy-servers.ts');
  }

  private async createDatabaseMigration(config: ProxyServerConfig): Promise<string> {
    console.log('🗄️ Creating database migration...');
    
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const migrationName = `${date}_add_${config.name.replace(/-/g, '_')}.sql`;
    const migrationPath = path.join(
      this.projectRoot,
      'supabase/migrations',
      migrationName
    );
    
    const migrationContent = `-- Add ${config.name} to sys_server_ports_registry
INSERT INTO sys_server_ports_registry (
  service_name,
  display_name,
  port,
  description,
  status,
  environment,
  metadata
) VALUES (
  '${config.name}',
  '${config.displayName}',
  ${config.port},
  '${config.description}',
  'active',
  'development',
  jsonb_build_object(
    'server_type', 'proxy',
    'proxy_category', '${config.category}',
    'script_path', 'scripts/cli-pipeline/proxy/start-${config.name}.ts',
    'base_class', 'ProxyServerBase',
    'features', jsonb_build_array(
${config.features.map(f => `      '${f}'`).join(',\n')}
    ),
    'endpoints', jsonb_build_object(
${Object.entries(config.endpoints).map(([name, spec]) => `      '${name}', '${spec}'`).join(',\n')}
    )
  )
) ON CONFLICT (service_name) DO UPDATE SET
  port = EXCLUDED.port,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;`;
    
    fs.writeFileSync(migrationPath, migrationContent);
    console.log('✅ Created database migration');
    return migrationPath;
  }

  private async updateProxyTests(config: ProxyServerConfig): Promise<void> {
    console.log('🧪 Updating proxy tests...');
    
    const testPath = path.join(
      this.projectRoot,
      'packages/proxy-servers/tests/proxy-server-health.test.ts'
    );
    
    let content = fs.readFileSync(testPath, 'utf-8');
    
    // Find the PROXY_SERVERS array in the test
    const arrayMatch = content.match(/const PROXY_SERVERS = \[([\s\S]*?)\];/);
    if (!arrayMatch) {
      throw new Error('Could not find PROXY_SERVERS array in test file');
    }
    
    // Create new test entry
    const newEntry = `  { name: '${config.name}', port: ${config.port}, script: 'start-${config.name}.ts' }`;
    
    // Insert before the last closing bracket
    const arrayContent = arrayMatch[1].trim();
    const newArrayContent = arrayContent + ',\n' + newEntry;
    
    content = content.replace(arrayMatch[0], `const PROXY_SERVERS = [\n${newArrayContent}\n];`);
    
    fs.writeFileSync(testPath, content);
    console.log('✅ Updated proxy tests');
  }

  private async runMigration(config: ProxyServerConfig): Promise<void> {
    console.log('🚀 Running database migration...');
    
    try {
      const supabase = SupabaseClientService.getInstance().getClient();
      
      const { error } = await supabase
        .from('sys_server_ports_registry')
        .upsert({
          service_name: config.name,
          display_name: config.displayName,
          port: config.port,
          description: config.description,
          status: 'active',
          environment: 'development',
          metadata: {
            server_type: 'proxy',
            proxy_category: config.category,
            script_path: `scripts/cli-pipeline/proxy/start-${config.name}.ts`,
            base_class: 'ProxyServerBase',
            features: config.features,
            endpoints: config.endpoints
          }
        }, {
          onConflict: 'service_name'
        })
        .select();
      
      if (error) {
        throw error;
      }
      
      console.log('✅ Migration completed successfully');
    } catch (error) {
      console.warn('⚠️ Could not run migration automatically:', error);
      console.log('Please run the migration manually with:');
      console.log(`./scripts/cli-pipeline/database/database-cli.sh migration run-staged supabase/migrations/*_add_${config.name.replace(/-/g, '_')}.sql`);
    }
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 5) {
    console.log('Usage: ts-node add-new-proxy-server.ts <name> <port> <displayName> <description> <category> [features...] [endpoints...]');
    console.log('Example: ts-node add-new-proxy-server.ts my-proxy 9892 "My Proxy" "Does something cool" utility feature1,feature2 "endpoint1:GET /api/test"');
    process.exit(1);
  }
  
  const [name, portStr, displayName, description, category, featuresStr = '', ...endpointStrs] = args;
  const port = parseInt(portStr);
  
  if (isNaN(port)) {
    console.error('Port must be a number');
    process.exit(1);
  }
  
  const features = featuresStr ? featuresStr.split(',') : [];
  const endpoints: Record<string, string> = { health: 'GET /health' };
  
  endpointStrs.forEach(str => {
    const [name, spec] = str.split(':');
    if (name && spec) {
      endpoints[name] = spec;
    }
  });
  
  const config: ProxyServerConfig = {
    name: name.endsWith('-proxy') ? name : `${name}-proxy`,
    displayName,
    port,
    description,
    category: category as any,
    features,
    endpoints
  };
  
  const scenario = new AddNewProxyServerScenario();
  scenario.execute(config).catch(error => {
    console.error('Failed:', error);
    process.exit(1);
  });
}