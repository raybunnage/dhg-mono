#!/usr/bin/env ts-node

/**
 * Scenario Dependencies Analyzer
 * 
 * This utility analyzes what scenarios might need to be run based on
 * the type of change being made. It suggests related scenarios that
 * should be considered.
 */

interface ScenarioDependency {
  scenario: string;
  triggers: string[];
  suggests: string[];
  reason: string;
}

interface ChangeContext {
  type: 'proxy' | 'service' | 'database' | 'ui' | 'test' | 'unknown';
  action: 'create' | 'modify' | 'delete';
  details: Record<string, any>;
}

class ScenarioDependencyAnalyzer {
  private dependencies: ScenarioDependency[] = [
    {
      scenario: 'add-new-proxy-server',
      triggers: ['proxy server', 'http endpoint', 'backend api'],
      suggests: ['add-new-shared-service', 'add-new-tests'],
      reason: 'Proxy servers often need new services and should have tests'
    },
    {
      scenario: 'add-new-shared-service',
      triggers: ['shared service', 'reusable code', 'common functionality'],
      suggests: ['add-new-tests', 'modify-database-tables'],
      reason: 'Services need tests and may require database changes'
    },
    {
      scenario: 'modify-database-tables',
      triggers: ['database', 'table', 'schema', 'migration'],
      suggests: ['add-new-shared-service', 'add-new-app-page'],
      reason: 'Database changes often need service updates and UI'
    },
    {
      scenario: 'add-new-app-page',
      triggers: ['new page', 'ui feature', 'user interface'],
      suggests: ['add-new-shared-service', 'add-new-tests', 'add-new-proxy-server'],
      reason: 'UI pages need services, tests, and possibly backend APIs'
    },
    {
      scenario: 'add-new-tests',
      triggers: ['test coverage', 'unit test', 'integration test'],
      suggests: [],
      reason: 'Tests are usually the final step'
    }
  ];

  analyzeChange(description: string): ChangeContext {
    const lower = description.toLowerCase();
    
    // Detect type
    let type: ChangeContext['type'] = 'unknown';
    if (lower.includes('proxy') || lower.includes('server') || lower.includes('endpoint')) {
      type = 'proxy';
    } else if (lower.includes('service') || lower.includes('shared')) {
      type = 'service';
    } else if (lower.includes('database') || lower.includes('table') || lower.includes('schema')) {
      type = 'database';
    } else if (lower.includes('page') || lower.includes('ui') || lower.includes('component')) {
      type = 'ui';
    } else if (lower.includes('test') || lower.includes('spec')) {
      type = 'test';
    }
    
    // Detect action
    let action: ChangeContext['action'] = 'create';
    if (lower.includes('modify') || lower.includes('update') || lower.includes('change')) {
      action = 'modify';
    } else if (lower.includes('delete') || lower.includes('remove')) {
      action = 'delete';
    }
    
    return { type, action, details: {} };
  }

  suggestScenarios(description: string): string[] {
    const suggestions = new Set<string>();
    const lower = description.toLowerCase();
    
    // Check each dependency
    for (const dep of this.dependencies) {
      // Check if any trigger matches
      const triggered = dep.triggers.some(trigger => 
        lower.includes(trigger.toLowerCase())
      );
      
      if (triggered) {
        // Add the main scenario
        suggestions.add(dep.scenario);
        
        // Add suggested related scenarios
        dep.suggests.forEach(s => suggestions.add(s));
      }
    }
    
    return Array.from(suggestions);
  }

  getDependencyChain(scenario: string): string[] {
    const chain: string[] = [scenario];
    const visited = new Set<string>([scenario]);
    
    const addDependencies = (scenarioId: string) => {
      const dep = this.dependencies.find(d => d.scenario === scenarioId);
      if (dep) {
        for (const suggested of dep.suggests) {
          if (!visited.has(suggested)) {
            visited.add(suggested);
            chain.push(suggested);
            addDependencies(suggested);
          }
        }
      }
    };
    
    addDependencies(scenario);
    return chain;
  }

  explainDependencies(scenario: string): void {
    const dep = this.dependencies.find(d => d.scenario === scenario);
    if (!dep) {
      console.log(`No dependency information for scenario: ${scenario}`);
      return;
    }
    
    console.log(`\n📋 Scenario: ${scenario}`);
    console.log(`📝 Reason: ${dep.reason}`);
    
    if (dep.suggests.length > 0) {
      console.log(`\n🔗 Related scenarios to consider:`);
      dep.suggests.forEach(s => {
        const related = this.dependencies.find(d => d.scenario === s);
        if (related) {
          console.log(`  - ${s}: ${related.reason}`);
        }
      });
    }
    
    console.log(`\n🎯 Triggered by keywords: ${dep.triggers.join(', ')}`);
  }
}

// CLI Interface
async function main() {
  const analyzer = new ScenarioDependencyAnalyzer();
  const [command, ...args] = process.argv.slice(2);
  
  switch (command) {
    case 'suggest':
      const description = args.join(' ');
      if (!description) {
        console.error('Usage: scenario-dependencies.ts suggest <description>');
        process.exit(1);
      }
      
      console.log('🔍 Analyzing your change description...\n');
      
      const context = analyzer.analyzeChange(description);
      console.log(`Type detected: ${context.type}`);
      console.log(`Action: ${context.action}\n`);
      
      const suggestions = analyzer.suggestScenarios(description);
      if (suggestions.length > 0) {
        console.log('📋 Suggested scenarios:');
        suggestions.forEach(s => {
          console.log(`  - ${s}`);
        });
        
        console.log('\n💡 Run a scenario with:');
        console.log(`  ./continuous-cli.sh run-scenario ${suggestions[0]}`);
      } else {
        console.log('No specific scenarios suggested. Consider browsing all scenarios:');
        console.log('  ./continuous-cli.sh scenarios');
      }
      break;
      
    case 'explain':
      const scenario = args[0];
      if (!scenario) {
        console.error('Usage: scenario-dependencies.ts explain <scenario-id>');
        process.exit(1);
      }
      
      analyzer.explainDependencies(scenario);
      break;
      
    case 'chain':
      const rootScenario = args[0];
      if (!rootScenario) {
        console.error('Usage: scenario-dependencies.ts chain <scenario-id>');
        process.exit(1);
      }
      
      const chain = analyzer.getDependencyChain(rootScenario);
      console.log(`\n🔗 Dependency chain for ${rootScenario}:`);
      chain.forEach((s, i) => {
        console.log(`${' '.repeat(i * 2)}${i > 0 ? '└─ ' : ''}${s}`);
      });
      break;
      
    default:
      console.log('Scenario Dependency Analyzer\n');
      console.log('Usage:');
      console.log('  scenario-dependencies.ts suggest <description>  - Suggest scenarios based on description');
      console.log('  scenario-dependencies.ts explain <scenario-id>  - Explain scenario dependencies');
      console.log('  scenario-dependencies.ts chain <scenario-id>    - Show full dependency chain');
      console.log('\nExamples:');
      console.log('  scenario-dependencies.ts suggest "I need to add a new proxy server for testing"');
      console.log('  scenario-dependencies.ts explain add-new-proxy-server');
      console.log('  scenario-dependencies.ts chain add-new-app-page');
  }
}

export { ScenarioDependencyAnalyzer };

if (require.main === module) {
  main();
}