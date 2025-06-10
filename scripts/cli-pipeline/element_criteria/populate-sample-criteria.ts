#!/usr/bin/env ts-node

import { program } from 'commander';
import { ElementCriteriaService } from '../../../packages/shared/services/element-criteria-service';
import { ElementCatalogService } from '../../../packages/shared/services/element-catalog-service';

async function populateSampleCriteria(options: { app?: string; limit?: number }) {
  console.log('🚀 Populating sample criteria and gates...\n');
  
  const criteriaService = ElementCriteriaService.getInstance();
  const catalogService = ElementCatalogService.getInstance();
  
  try {
    // Get some app features to add criteria to
    const appName = options.app || 'dhg-admin-code';
    const features = await catalogService.getAppFeatures(appName);
    
    if (features.length === 0) {
      console.log(`❌ No features found for app: ${appName}`);
      console.log('💡 Run: ./scripts/cli-pipeline/registry/registry-cli.sh scan-app-features --app ' + appName);
      return;
    }
    
    const limit = options.limit || 5;
    const featuresToProcess = features.slice(0, limit);
    
    console.log(`📦 Found ${features.length} features in ${appName}`);
    console.log(`🎯 Adding criteria to first ${featuresToProcess.length} features\n`);
    
    for (const feature of featuresToProcess) {
      console.log(`\n🔧 Processing: ${feature.feature_name} (${feature.feature_type})`);
      
      // Get templates for this feature type
      const templates = await criteriaService.getTemplates('app_feature');
      const matchingTemplate = templates.find(t => t.feature_type === feature.feature_type);
      
      if (matchingTemplate) {
        console.log(`  📋 Applying template: ${matchingTemplate.template_name}`);
        const result = await criteriaService.applyTemplate(
          matchingTemplate.id,
          'app_feature',
          feature.id
        );
        console.log(`  ✅ Added ${result.criteriaCount} criteria and ${result.gatesCount} gates`);
      } else {
        // Add some generic criteria
        console.log(`  📝 Adding generic criteria for ${feature.feature_type}`);
        
        // Add functional criteria
        await criteriaService.addCriteria({
          element_type: 'app_feature',
          element_id: feature.id,
          title: `${feature.feature_name} loads without errors`,
          description: `Ensure ${feature.feature_name} component/page loads successfully`,
          success_condition: 'No console errors or exceptions during load',
          criteria_type: 'functional',
          priority: 'high',
          is_required: true,
          validation_method: 'automated'
        });
        
        // Add UX criteria
        await criteriaService.addCriteria({
          element_type: 'app_feature',
          element_id: feature.id,
          title: `${feature.feature_name} is responsive`,
          description: 'Works well on different screen sizes',
          success_condition: 'Layout adapts properly to mobile and desktop viewports',
          criteria_type: 'ux',
          priority: 'medium',
          is_required: false,
          validation_method: 'manual'
        });
        
        // Add a quality gate
        await criteriaService.addGate({
          element_type: 'app_feature',
          element_id: feature.id,
          gate_name: 'TypeScript compilation',
          gate_type: 'pre-commit',
          description: 'Code must compile without TypeScript errors',
          is_blocking: true,
          order_sequence: 1
        });
        
        console.log(`  ✅ Added 2 criteria and 1 gate`);
      }
    }
    
    // Also add some criteria to CLI commands
    console.log('\n\n📋 Adding criteria to CLI commands...');
    const commands = await catalogService.getCLICommands('registry');
    
    if (commands.length > 0) {
      const command = commands[0];
      console.log(`\n🔧 Processing command: ${command.command_name}`);
      
      await criteriaService.addCriteria({
        element_type: 'cli_command',
        element_id: command.id,
        title: 'Command executes without errors',
        description: 'Basic functional test',
        success_condition: 'Command returns exit code 0 for valid inputs',
        criteria_type: 'functional',
        priority: 'high',
        is_required: true,
        validation_method: 'automated'
      });
      
      await criteriaService.addGate({
        element_type: 'cli_command',
        element_id: command.id,
        gate_name: 'Help text validation',
        gate_type: 'pre-merge',
        description: 'Command must have proper help documentation',
        is_blocking: false,
        order_sequence: 1
      });
      
      console.log('  ✅ Added 1 criterion and 1 gate');
    }
    
    console.log('\n\n🎉 Sample criteria population complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

program
  .name('populate-sample-criteria')
  .description('Populate sample success criteria and gates for testing')
  .option('-a, --app <name>', 'App to populate criteria for', 'dhg-admin-code')
  .option('-l, --limit <number>', 'Number of features to process', '5')
  .action(populateSampleCriteria);

program.parse();