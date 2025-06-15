#!/usr/bin/env ts-node

/**
 * Continuous Improvement Scenario Runner
 * 
 * This script runs predefined scenarios for common development tasks
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

interface Scenario {
  id: string;
  name: string;
  description: string;
  category: string;
  script?: string;
  documentation: string;
}

class ScenarioRunner {
  private scenariosDir: string;
  private docsDir: string;
  
  constructor() {
    this.scenariosDir = path.join(__dirname, 'scenarios');
    this.docsDir = path.join(__dirname, '../../../docs/continuous-improvement/scenarios');
  }

  async listScenarios(): Promise<Scenario[]> {
    const scenarios: Scenario[] = [];
    
    // Load scenarios from documentation
    if (fs.existsSync(this.docsDir)) {
      const files = fs.readdirSync(this.docsDir);
      for (const file of files) {
        if (file.endsWith('.md')) {
          const content = fs.readFileSync(path.join(this.docsDir, file), 'utf-8');
          const idMatch = content.match(/## Scenario ID: `(.+?)`/);
          const categoryMatch = content.match(/\*\*Category\*\*: (.+)/);
          const descMatch = content.match(/## Overview\n(.+)/);
          
          if (idMatch) {
            const id = idMatch[1];
            const scriptPath = path.join(this.scenariosDir, `${id}.ts`);
            
            scenarios.push({
              id,
              name: id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
              description: descMatch ? descMatch[1].trim() : 'No description available',
              category: categoryMatch ? categoryMatch[1] : 'General',
              script: fs.existsSync(scriptPath) ? scriptPath : undefined,
              documentation: path.join(this.docsDir, file)
            });
          }
        }
      }
    }
    
    return scenarios;
  }

  async runScenario(scenarioId: string, args: string[]): Promise<void> {
    const scenarios = await this.listScenarios();
    const scenario = scenarios.find(s => s.id === scenarioId);
    
    if (!scenario) {
      throw new Error(`Scenario '${scenarioId}' not found`);
    }
    
    console.log(`🚀 Running scenario: ${scenario.name}`);
    console.log(`📋 Category: ${scenario.category}`);
    console.log(`📝 ${scenario.description}\n`);
    
    if (!scenario.script) {
      console.log('⚠️  This scenario does not have an automation script yet.');
      console.log(`📖 Please refer to the documentation: ${scenario.documentation}`);
      return;
    }
    
    // Run the scenario script
    return new Promise((resolve, reject) => {
      const proc = spawn('ts-node', [scenario.script!, ...args], {
        stdio: 'inherit',
        env: process.env
      });
      
      proc.on('close', (code: number | null) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Scenario failed with exit code ${code}`));
        }
      });
      
      proc.on('error', reject);
    });
  }

  async showScenarioHelp(scenarioId: string): Promise<void> {
    const scenarios = await this.listScenarios();
    const scenario = scenarios.find(s => s.id === scenarioId);
    
    if (!scenario) {
      throw new Error(`Scenario '${scenarioId}' not found`);
    }
    
    console.log(`📋 Scenario: ${scenario.name}`);
    console.log(`🆔 ID: ${scenario.id}`);
    console.log(`📁 Category: ${scenario.category}`);
    console.log(`📝 ${scenario.description}\n`);
    
    if (scenario.script) {
      console.log('✅ This scenario has automation available.');
      console.log(`🤖 Script: ${scenario.script}`);
    } else {
      console.log('⚠️  This scenario requires manual execution.');
    }
    
    console.log(`\n📖 Full documentation: ${scenario.documentation}`);
    
    // Show first few sections of documentation
    const docContent = fs.readFileSync(scenario.documentation, 'utf-8');
    const lines = docContent.split('\n');
    const previewLines = lines.slice(0, 30).join('\n');
    console.log('\n--- Documentation Preview ---');
    console.log(previewLines);
    console.log('\n... (see full documentation for complete details)');
  }
}

// CLI Interface
async function main() {
  const runner = new ScenarioRunner();
  const [command, ...args] = process.argv.slice(2);
  
  try {
    switch (command) {
      case 'list':
        const scenarios = await runner.listScenarios();
        console.log('📋 Available Continuous Improvement Scenarios:\n');
        
        // Group by category
        const grouped = scenarios.reduce((acc, s) => {
          if (!acc[s.category]) acc[s.category] = [];
          acc[s.category].push(s);
          return acc;
        }, {} as Record<string, Scenario[]>);
        
        for (const [category, items] of Object.entries(grouped)) {
          console.log(`${category}:`);
          for (const scenario of items) {
            const automation = scenario.script ? '✅' : '📝';
            console.log(`  ${automation} ${scenario.id.padEnd(30)} - ${scenario.description}`);
          }
          console.log();
        }
        
        console.log('Legend: ✅ = Automated, 📝 = Manual');
        break;
        
      case 'run':
        if (!args[0]) {
          console.error('Usage: run-scenario.ts run <scenario-id> [args...]');
          process.exit(1);
        }
        await runner.runScenario(args[0], args.slice(1));
        break;
        
      case 'help':
        if (!args[0]) {
          console.error('Usage: run-scenario.ts help <scenario-id>');
          process.exit(1);
        }
        await runner.showScenarioHelp(args[0]);
        break;
        
      default:
        console.log('Continuous Improvement Scenario Runner\n');
        console.log('Usage:');
        console.log('  run-scenario.ts list                    - List all available scenarios');
        console.log('  run-scenario.ts run <scenario> [args]   - Run a specific scenario');
        console.log('  run-scenario.ts help <scenario>         - Show detailed help for a scenario');
        console.log('\nExamples:');
        console.log('  run-scenario.ts list');
        console.log('  run-scenario.ts run add-new-proxy-server my-proxy 9892 "My Proxy" "Does cool stuff" utility');
        console.log('  run-scenario.ts help add-new-proxy-server');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}