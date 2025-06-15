#!/usr/bin/env ts-node

/**
 * Scenario Dependency Checker
 * 
 * Analyzes what scenarios should be run based on the task description
 * and determines the correct order of execution.
 */

interface ScenarioDependency {
  scenario: string;
  dependsOn: string[];
  optionalDependencies: string[];
  triggers: string[];
  keywords: string[];
}

export const SCENARIO_DEPENDENCIES: ScenarioDependency[] = [
  {
    scenario: 'add-new-proxy-server',
    dependsOn: [],
    optionalDependencies: [
      'add-new-shared-service',
      'modify-database-tables'
    ],
    triggers: ['add-new-tests'],
    keywords: ['proxy', 'server', 'endpoint', 'api', 'port']
  },
  {
    scenario: 'add-new-app-page',
    dependsOn: [],
    optionalDependencies: [
      'modify-database-tables',
      'add-new-shared-service'
    ],
    triggers: ['add-new-tests'],
    keywords: ['page', 'ui', 'interface', 'screen', 'view', 'component']
  },
  {
    scenario: 'add-new-shared-service',
    dependsOn: [],
    optionalDependencies: ['modify-database-tables'],
    triggers: ['add-new-tests'],
    keywords: ['service', 'logic', 'process', 'business', 'shared', 'singleton']
  },
  {
    scenario: 'modify-database-tables',
    dependsOn: [],
    optionalDependencies: [],
    triggers: [
      'update-types',
      'update-services',
      'add-new-tests'
    ],
    keywords: ['database', 'table', 'store', 'save', 'persist', 'data', 'schema', 'migration']
  },
  {
    scenario: 'add-new-tests',
    dependsOn: [],
    optionalDependencies: [],
    triggers: [],
    keywords: ['test', 'testing', 'coverage', 'unit', 'integration', 'e2e']
  },
  {
    scenario: 'service-dependency-check',
    dependsOn: [],
    optionalDependencies: [],
    triggers: [],
    keywords: ['dependency', 'dependencies', 'check', 'analyze', 'suggest']
  }
];

export interface DependencyAnalysis {
  required: string[];
  optional: string[];
  willTrigger: string[];
  suggestedOrder: string[];
}

export function checkDependencies(scenario: string): DependencyAnalysis {
  const dep = SCENARIO_DEPENDENCIES.find(d => d.scenario === scenario);
  if (!dep) {
    return { 
      required: [], 
      optional: [], 
      willTrigger: [],
      suggestedOrder: [scenario]
    };
  }
  
  // Build execution order
  const order: string[] = [];
  
  // Add required dependencies first
  order.push(...dep.dependsOn);
  
  // Add the scenario itself
  order.push(scenario);
  
  // Add triggered scenarios
  order.push(...dep.triggers);
  
  return {
    required: dep.dependsOn,
    optional: dep.optionalDependencies,
    willTrigger: dep.triggers,
    suggestedOrder: order
  };
}

export function suggestScenariosFromDescription(description: string): string[] {
  const keywords = description.toLowerCase();
  const suggestedScenarios = new Set<string>();
  
  // Check each scenario's keywords
  for (const dep of SCENARIO_DEPENDENCIES) {
    const hasKeyword = dep.keywords.some(keyword => 
      keywords.includes(keyword)
    );
    
    if (hasKeyword) {
      suggestedScenarios.add(dep.scenario);
    }
  }
  
  // Always suggest dependency check for complex tasks
  if (suggestedScenarios.size > 2) {
    suggestedScenarios.add('service-dependency-check');
  }
  
  // Always add tests if we're building something
  if (suggestedScenarios.size > 0 && !suggestedScenarios.has('add-new-tests')) {
    suggestedScenarios.add('add-new-tests');
  }
  
  return Array.from(suggestedScenarios);
}

export function buildExecutionPlan(scenarios: string[]): {
  phases: Array<{
    phase: number;
    scenarios: string[];
    canRunParallel: boolean;
  }>;
  totalScenarios: number;
} {
  const executed = new Set<string>();
  const phases: Array<{ phase: number; scenarios: string[]; canRunParallel: boolean }> = [];
  let phase = 1;
  
  // Process scenarios that have no dependencies first
  const noDeps = scenarios.filter(s => {
    const dep = SCENARIO_DEPENDENCIES.find(d => d.scenario === s);
    return !dep || dep.dependsOn.length === 0;
  });
  
  if (noDeps.length > 0) {
    phases.push({
      phase: phase++,
      scenarios: noDeps,
      canRunParallel: true
    });
    noDeps.forEach(s => executed.add(s));
  }
  
  // Process remaining scenarios
  let remaining = scenarios.filter(s => !executed.has(s));
  while (remaining.length > 0) {
    const canRun = remaining.filter(s => {
      const dep = SCENARIO_DEPENDENCIES.find(d => d.scenario === s);
      return !dep || dep.dependsOn.every(d => executed.has(d));
    });
    
    if (canRun.length === 0) {
      // Circular dependency or missing scenario
      console.warn('Warning: Could not resolve dependencies for:', remaining);
      break;
    }
    
    phases.push({
      phase: phase++,
      scenarios: canRun,
      canRunParallel: canRun.length > 1
    });
    
    canRun.forEach(s => executed.add(s));
    remaining = remaining.filter(s => !executed.has(s));
  }
  
  return {
    phases,
    totalScenarios: executed.size
  };
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command) {
    console.log('Usage:');
    console.log('  check <scenario>         - Check dependencies for a scenario');
    console.log('  suggest <description>    - Suggest scenarios based on description');
    console.log('  plan <scenario1,scenario2,...> - Build execution plan');
    process.exit(1);
  }
  
  switch (command) {
    case 'check': {
      const scenario = args[1];
      if (!scenario) {
        console.error('Please provide a scenario name');
        process.exit(1);
      }
      
      const analysis = checkDependencies(scenario);
      console.log(`\nDependency Analysis for: ${scenario}`);
      console.log('========================');
      console.log('Required:', analysis.required.length ? analysis.required.join(', ') : 'None');
      console.log('Optional:', analysis.optional.length ? analysis.optional.join(', ') : 'None');
      console.log('Will Trigger:', analysis.willTrigger.length ? analysis.willTrigger.join(', ') : 'None');
      console.log('\nSuggested Execution Order:');
      analysis.suggestedOrder.forEach((s, i) => {
        console.log(`  ${i + 1}. ${s}`);
      });
      break;
    }
    
    case 'suggest': {
      const description = args.slice(1).join(' ');
      if (!description) {
        console.error('Please provide a task description');
        process.exit(1);
      }
      
      const scenarios = suggestScenariosFromDescription(description);
      console.log(`\nSuggested Scenarios for: "${description}"`);
      console.log('================================');
      
      if (scenarios.length === 0) {
        console.log('No specific scenarios detected. Consider running:');
        console.log('  - service-dependency-check');
      } else {
        scenarios.forEach((s, i) => {
          console.log(`  ${i + 1}. ${s}`);
        });
        
        console.log('\nTo build an execution plan:');
        console.log(`  ts-node scenario-dependencies.ts plan ${scenarios.join(',')}`);
      }
      break;
    }
    
    case 'plan': {
      const scenarioList = args[1];
      if (!scenarioList) {
        console.error('Please provide comma-separated scenario names');
        process.exit(1);
      }
      
      const scenarios = scenarioList.split(',').map(s => s.trim());
      const plan = buildExecutionPlan(scenarios);
      
      console.log('\nExecution Plan');
      console.log('==============');
      console.log(`Total Scenarios: ${plan.totalScenarios}`);
      console.log(`Phases: ${plan.phases.length}\n`);
      
      plan.phases.forEach(phase => {
        console.log(`Phase ${phase.phase}:`);
        phase.scenarios.forEach(s => {
          console.log(`  - ${s}`);
        });
        if (phase.canRunParallel && phase.scenarios.length > 1) {
          console.log(`  (Can run in parallel)`);
        }
        console.log('');
      });
      break;
    }
    
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}