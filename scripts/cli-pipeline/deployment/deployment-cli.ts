#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { deploymentService } from '../../../packages/shared/services/deployment-service';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const program = new Command();
const supabase = SupabaseClientService.getInstance().getClient();

program
  .name('deployment-cli')
  .description('Deployment management CLI for dhg-mono')
  .version('1.0.0');

// Validate all command
program
  .command('validate-all')
  .description('Run all pre-deployment validations')
  .option('--skip <validations...>', 'Skip specific validations (typescript, dependencies, env, build, tests)')
  .action(async (options) => {
    const spinner = ora('Running pre-deployment validations...').start();
    
    try {
      const result = await deploymentService.createDeployment({
        deploymentType: 'production',
        skipValidations: options.skip,
        dryRun: true
      });
      
      spinner.stop();
      
      // Display validation results
      console.log(chalk.bold('\nValidation Results:'));
      result.validations.forEach(validation => {
        const icon = validation.status === 'passed' ? '✅' : 
                     validation.status === 'failed' ? '❌' : '⏭️';
        const color = validation.status === 'passed' ? 'green' : 
                      validation.status === 'failed' ? 'red' : 'yellow';
        
        console.log(chalk[color](`${icon} ${validation.type}: ${validation.status}`));
        if (validation.errorMessage) {
          console.log(chalk.red(`   Error: ${validation.errorMessage}`));
        }
      });
      
      const failed = result.validations.filter(v => v.status === 'failed').length;
      if (failed > 0) {
        console.log(chalk.red(`\n❌ ${failed} validation(s) failed`));
        process.exit(1);
      } else {
        console.log(chalk.green('\n✅ All validations passed!'));
      }
    } catch (error: any) {
      spinner.fail('Validation failed');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// Validate TypeScript command
program
  .command('validate-typescript')
  .description('Run TypeScript validation')
  .action(async () => {
    const spinner = ora('Checking TypeScript...').start();
    
    try {
      const result = await deploymentService.createDeployment({
        deploymentType: 'production',
        skipValidations: ['dependencies', 'env', 'build', 'tests'],
        dryRun: true
      });
      
      spinner.stop();
      
      const tsValidation = result.validations.find(v => v.type === 'typescript');
      if (tsValidation?.status === 'passed') {
        console.log(chalk.green('✅ TypeScript validation passed'));
      } else {
        console.log(chalk.red('❌ TypeScript validation failed'));
        if (tsValidation?.errorMessage) {
          console.log(chalk.red(tsValidation.errorMessage));
        }
        process.exit(1);
      }
    } catch (error: any) {
      spinner.fail('TypeScript validation failed');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// Validate dependencies command
program
  .command('validate-dependencies')
  .description('Check dependency consistency')
  .action(async () => {
    const spinner = ora('Checking dependencies...').start();
    
    try {
      const result = await deploymentService.createDeployment({
        deploymentType: 'production',
        skipValidations: ['typescript', 'env', 'build', 'tests'],
        dryRun: true
      });
      
      spinner.stop();
      
      const depValidation = result.validations.find(v => v.type === 'dependencies');
      if (depValidation?.status === 'passed') {
        console.log(chalk.green('✅ Dependencies are in sync'));
      } else {
        console.log(chalk.red('❌ Dependencies validation failed'));
        if (depValidation?.errorMessage) {
          console.log(chalk.red(depValidation.errorMessage));
        }
        process.exit(1);
      }
    } catch (error: any) {
      spinner.fail('Dependencies validation failed');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// Validate environment command
program
  .command('validate-env')
  .description('Verify environment configuration')
  .action(async () => {
    const spinner = ora('Checking environment variables...').start();
    
    try {
      const result = await deploymentService.createDeployment({
        deploymentType: 'production',
        skipValidations: ['typescript', 'dependencies', 'build', 'tests'],
        dryRun: true
      });
      
      spinner.stop();
      
      const envValidation = result.validations.find(v => v.type === 'env');
      if (envValidation?.status === 'passed') {
        console.log(chalk.green('✅ Environment variables configured'));
      } else {
        console.log(chalk.red('❌ Environment validation failed'));
        if (envValidation?.errorMessage) {
          console.log(chalk.red(envValidation.errorMessage));
        }
        process.exit(1);
      }
    } catch (error: any) {
      spinner.fail('Environment validation failed');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// Verify build command
program
  .command('verify-build')
  .description('Test production build locally')
  .action(async () => {
    const spinner = ora('Running production build...').start();
    
    try {
      const result = await deploymentService.createDeployment({
        deploymentType: 'production',
        skipValidations: ['typescript', 'dependencies', 'env', 'tests'],
        dryRun: true
      });
      
      spinner.stop();
      
      const buildValidation = result.validations.find(v => v.type === 'build');
      if (buildValidation?.status === 'passed') {
        console.log(chalk.green('✅ Production build successful'));
      } else {
        console.log(chalk.red('❌ Build validation failed'));
        if (buildValidation?.errorMessage) {
          console.log(chalk.red(buildValidation.errorMessage));
        }
        process.exit(1);
      }
    } catch (error: any) {
      spinner.fail('Build validation failed');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// Deploy to staging command
program
  .command('deploy-staging')
  .description('Deploy to staging environment')
  .option('--skip-validations', 'Skip pre-deployment validations (use with caution)')
  .action(async (options) => {
    // Confirm deployment
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Deploy to staging environment?',
        default: false
      }
    ]);
    
    if (!confirm) {
      console.log(chalk.yellow('Deployment cancelled'));
      return;
    }
    
    const spinner = ora('Deploying to staging...').start();
    
    try {
      const result = await deploymentService.createDeployment({
        deploymentType: 'staging',
        skipValidations: options.skipValidations ? ['typescript', 'dependencies', 'env', 'build', 'tests'] : []
      });
      
      spinner.succeed('Staging deployment completed');
      
      console.log(chalk.green(`\n✅ Deployed to staging`));
      console.log(chalk.blue(`Deployment ID: ${result.deploymentId}`));
      console.log(chalk.blue(`Commit: ${result.commitHash}`));
      console.log(chalk.blue(`URL: ${result.deploymentUrl}`));
    } catch (error: any) {
      spinner.fail('Staging deployment failed');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// Deploy to production command
program
  .command('deploy-production')
  .description('Deploy to production environment')
  .option('--skip-validations', 'Skip pre-deployment validations (use with caution)')
  .option('--force', 'Skip confirmation prompt')
  .action(async (options) => {
    // Double confirm for production
    if (!options.force) {
      const { confirm1 } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm1',
          message: chalk.yellow('⚠️  Deploy to PRODUCTION environment?'),
          default: false
        }
      ]);
      
      if (!confirm1) {
        console.log(chalk.yellow('Deployment cancelled'));
        return;
      }
      
      const { confirm2 } = await inquirer.prompt([
        {
          type: 'input',
          name: 'confirm2',
          message: 'Type "DEPLOY TO PRODUCTION" to confirm:',
          validate: (input) => input === 'DEPLOY TO PRODUCTION' || 'Please type exactly: DEPLOY TO PRODUCTION'
        }
      ]);
    }
    
    const spinner = ora('Deploying to production...').start();
    
    try {
      const result = await deploymentService.createDeployment({
        deploymentType: 'production',
        skipValidations: options.skipValidations ? ['typescript', 'dependencies', 'env', 'build', 'tests'] : []
      });
      
      spinner.succeed('Production deployment completed');
      
      console.log(chalk.green(`\n✅ Deployed to production`));
      console.log(chalk.blue(`Deployment ID: ${result.deploymentId}`));
      console.log(chalk.blue(`Commit: ${result.commitHash}`));
      console.log(chalk.blue(`URL: ${result.deploymentUrl}`));
    } catch (error: any) {
      spinner.fail('Production deployment failed');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// Rollback command
program
  .command('rollback')
  .description('Rollback a deployment')
  .option('--deployment-id <id>', 'Deployment ID to rollback')
  .option('--to-commit <commit>', 'Specific commit to rollback to')
  .action(async (options) => {
    let deploymentId = options.deploymentId;
    
    // If no deployment ID provided, show recent deployments
    if (!deploymentId) {
      const history = await deploymentService.getDeploymentHistory(5);
      
      if (history.length === 0) {
        console.log(chalk.yellow('No deployments found'));
        return;
      }
      
      const { selected } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selected',
          message: 'Select deployment to rollback:',
          choices: history.map(d => ({
            name: `${d.deployment_id} - ${d.deployment_type} - ${d.status} - ${new Date(d.created_at).toLocaleString()}`,
            value: d.deployment_id
          }))
        }
      ]);
      
      deploymentId = selected;
    }
    
    // Confirm rollback
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: chalk.yellow(`⚠️  Rollback deployment ${deploymentId}?`),
        default: false
      }
    ]);
    
    if (!confirm) {
      console.log(chalk.yellow('Rollback cancelled'));
      return;
    }
    
    const spinner = ora('Rolling back deployment...').start();
    
    try {
      await deploymentService.rollback(deploymentId, options.toCommit);
      spinner.succeed('Rollback completed');
      console.log(chalk.green(`\n✅ Successfully rolled back ${deploymentId}`));
    } catch (error: any) {
      spinner.fail('Rollback failed');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Check deployment status')
  .option('--deployment-id <id>', 'Specific deployment ID')
  .action(async (options) => {
    try {
      if (options.deploymentId) {
        const status = await deploymentService.getDeploymentStatus(options.deploymentId);
        
        console.log(chalk.bold('\nDeployment Status:'));
        console.log(`ID: ${status.deployment_id}`);
        console.log(`Type: ${status.deployment_type}`);
        console.log(`Status: ${status.status}`);
        console.log(`Branch: ${status.branch_from} → ${status.branch_to}`);
        console.log(`Started: ${new Date(status.started_at).toLocaleString()}`);
        if (status.completed_at) {
          console.log(`Completed: ${new Date(status.completed_at).toLocaleString()}`);
          console.log(`Duration: ${status.duration_seconds}s`);
        }
        console.log(`\nValidations: ${status.validations_passed}/${status.validation_count} passed`);
        if (status.health_check_count > 0) {
          console.log(`Health Checks: ${status.health_checks_passed}/${status.health_check_count} passed`);
        }
        if (status.error_message) {
          console.log(chalk.red(`\nError: ${status.error_message}`));
        }
      } else {
        // Show latest deployment status
        const { data: latest } = await supabase
          .from('deploy_latest_view')
          .select('*');
        
        if (!latest || latest.length === 0) {
          console.log(chalk.yellow('No deployments found'));
          return;
        }
        
        console.log(chalk.bold('\nLatest Deployments:'));
        latest.forEach(deployment => {
          const icon = deployment.status === 'completed' ? '✅' : '❌';
          console.log(`\n${icon} ${deployment.deployment_type.toUpperCase()}`);
          console.log(`   ID: ${deployment.deployment_id}`);
          console.log(`   Deployed: ${new Date(deployment.created_at).toLocaleString()}`);
          console.log(`   Commit: ${deployment.commit_hash?.substring(0, 8) || 'N/A'}`);
        });
      }
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// History command
program
  .command('history')
  .description('View deployment history')
  .option('--limit <number>', 'Number of deployments to show', '10')
  .action(async (options) => {
    try {
      const history = await deploymentService.getDeploymentHistory(parseInt(options.limit));
      
      if (history.length === 0) {
        console.log(chalk.yellow('No deployments found'));
        return;
      }
      
      console.log(chalk.bold('\nDeployment History:'));
      history.forEach(deployment => {
        const icon = deployment.status === 'completed' ? '✅' : 
                     deployment.status === 'failed' ? '❌' : 
                     deployment.status === 'rolled_back' ? '↩️' : '⏳';
        
        console.log(`\n${icon} ${deployment.deployment_id}`);
        console.log(`   Type: ${deployment.deployment_type}`);
        console.log(`   Status: ${deployment.status}`);
        console.log(`   Date: ${new Date(deployment.created_at).toLocaleString()}`);
        if (deployment.commit_hash) {
          console.log(`   Commit: ${deployment.commit_hash.substring(0, 8)}`);
        }
        if (deployment.error_message) {
          console.log(chalk.red(`   Error: ${deployment.error_message}`));
        }
      });
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// Health check command
program
  .command('health-check')
  .description('Check production site health')
  .action(async () => {
    const spinner = ora('Checking production health...').start();
    
    try {
      // Get latest production deployment
      const { data: latestProd } = await supabase
        .from('deployment_runs')
        .select('*')
        .eq('deployment_type', 'production')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (!latestProd) {
        spinner.fail('No production deployment found');
        return;
      }
      
      // Get health checks for this deployment
      const { data: healthChecks } = await supabase
        .from('deployment_health_checks')
        .select('*')
        .eq('deployment_run_id', latestProd.id)
        .order('checked_at', { ascending: false });
      
      spinner.stop();
      
      console.log(chalk.bold('\nProduction Health Status:'));
      console.log(`Deployment: ${latestProd.deployment_id}`);
      console.log(`Deployed: ${new Date(latestProd.created_at).toLocaleString()}`);
      
      if (healthChecks && healthChecks.length > 0) {
        console.log('\nHealth Checks:');
        healthChecks.forEach(check => {
          const icon = check.status === 'healthy' ? '✅' : '❌';
          console.log(`${icon} ${check.check_type}: ${check.status}`);
          if (check.response_time_ms) {
            console.log(`   Response time: ${check.response_time_ms}ms`);
          }
          if (check.error_message) {
            console.log(chalk.red(`   Error: ${check.error_message}`));
          }
        });
      } else {
        console.log(chalk.yellow('\nNo health checks found'));
      }
    } catch (error: any) {
      spinner.fail('Health check failed');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program.parse(process.argv);