import { execSync } from 'child_process';
import chalk from 'chalk';

interface HealthCheckOptions {
  verbose?: boolean;
}

interface HealthCheckResult {
  status: 'success' | 'failure' | 'warning';
  message: string;
}

/**
 * Performs health checks on the git workflow pipeline infrastructure
 */
export async function healthCheckCommand(options: HealthCheckOptions = {}): Promise<void> {
  try {
    const results: Record<string, HealthCheckResult> = {
      gitInstallation: { status: 'failure', message: '' },
      gitRepository: { status: 'failure', message: '' },
      nodeModules: { status: 'failure', message: '' },
      worktreeSetup: { status: 'failure', message: '' },
    };
    
    console.log('🏥 Running git workflow pipeline health checks...');
    
    // Check git installation
    console.log('\n🔍 Checking git installation...');
    try {
      const gitVersion = execSync('git --version', { encoding: 'utf-8' }).trim();
      results.gitInstallation = { 
        status: 'success', 
        message: gitVersion 
      };
      console.log(`✅ Git installed: ${gitVersion}`);
    } catch (error) {
      results.gitInstallation = { 
        status: 'failure', 
        message: 'Git is not installed or not in PATH' 
      };
      console.error('❌ Git installation check failed');
    }
    
    // Check if we're in a git repository
    console.log('\n🔍 Checking git repository...');
    try {
      const isRepo = execSync('git rev-parse --is-inside-work-tree 2>/dev/null', { encoding: 'utf-8' }).trim();
      if (isRepo === 'true') {
        const branch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
        const remote = execSync('git remote get-url origin 2>/dev/null || echo "No remote"', { encoding: 'utf-8' }).trim();
        results.gitRepository = { 
          status: 'success', 
          message: `Branch: ${branch}, Remote: ${remote}` 
        };
        console.log(`✅ Git repository detected`);
        console.log(`   Branch: ${branch}`);
        console.log(`   Remote: ${remote}`);
      }
    } catch (error) {
      results.gitRepository = { 
        status: 'failure', 
        message: 'Not in a git repository' 
      };
      console.error('❌ Not in a git repository');
    }
    
    // Check node modules installation
    console.log('\n🔍 Checking pipeline dependencies...');
    try {
      const fs = require('fs');
      const path = require('path');
      const packageJsonPath = path.join(__dirname, 'package.json');
      const nodeModulesPath = path.join(__dirname, 'node_modules');
      
      if (fs.existsSync(packageJsonPath) && fs.existsSync(nodeModulesPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const requiredDeps = Object.keys(packageJson.dependencies || {});
        
        // Check if key dependencies are installed
        const missingDeps = requiredDeps.filter(dep => 
          !fs.existsSync(path.join(nodeModulesPath, dep))
        );
        
        if (missingDeps.length === 0) {
          results.nodeModules = { 
            status: 'success', 
            message: `All ${requiredDeps.length} dependencies installed` 
          };
          console.log(`✅ All dependencies installed`);
        } else {
          results.nodeModules = { 
            status: 'warning', 
            message: `Missing dependencies: ${missingDeps.join(', ')}` 
          };
          console.warn(`⚠️  Missing dependencies: ${missingDeps.join(', ')}`);
        }
      } else {
        results.nodeModules = { 
          status: 'warning', 
          message: 'Dependencies not installed. Run: npm install' 
        };
        console.warn('⚠️  Dependencies not installed');
      }
    } catch (error) {
      results.nodeModules = { 
        status: 'failure', 
        message: `Failed to check dependencies: ${error}` 
      };
      console.error('❌ Failed to check dependencies');
    }
    
    // Check worktree setup
    console.log('\n🔍 Checking git worktree setup...');
    try {
      const worktreeList = execSync('git worktree list', { encoding: 'utf-8' });
      const worktreeCount = worktreeList.split('\n').filter(line => line.trim()).length;
      results.worktreeSetup = { 
        status: worktreeCount > 1 ? 'success' : 'warning', 
        message: `${worktreeCount} worktree(s) configured` 
      };
      
      if (worktreeCount > 1) {
        console.log(`✅ Multiple worktrees configured (${worktreeCount} total)`);
      } else {
        console.log(`⚠️  Only one worktree configured (typical setup has multiple)`);
      }
      
      if (options.verbose) {
        console.log('   Worktree list:');
        worktreeList.split('\n').filter(line => line.trim()).forEach(line => {
          console.log(`   - ${line}`);
        });
      }
    } catch (error) {
      results.worktreeSetup = { 
        status: 'failure', 
        message: 'Failed to check worktree setup' 
      };
      console.error('❌ Failed to check worktree setup');
    }
    
    // Summary
    console.log('\n📊 Health Check Summary:');
    console.log('====================');
    console.log(`Git Installation: ${formatStatus(results.gitInstallation.status)}`);
    console.log(`Git Repository: ${formatStatus(results.gitRepository.status)}`);
    console.log(`Dependencies: ${formatStatus(results.nodeModules.status)}`);
    console.log(`Worktree Setup: ${formatStatus(results.worktreeSetup.status)}`);
    
    // Overall status
    const statuses = Object.values(results).map(r => r.status);
    const hasFailure = statuses.includes('failure');
    const hasWarning = statuses.includes('warning');
    
    console.log('\n📋 Overall Status:');
    if (hasFailure) {
      console.log('❌ One or more critical systems are failing');
      process.exit(1);
    } else if (hasWarning) {
      console.log('⚠️  Some systems need attention but pipeline is functional');
    } else {
      console.log('✅ All systems healthy');
    }
    
  } catch (error) {
    console.error(`Error performing health check: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

function formatStatus(status: string): string {
  switch (status) {
    case 'success':
      return chalk.green('✅ Healthy');
    case 'warning':
      return chalk.yellow('⚠️  Warning');
    case 'failure':
      return chalk.red('❌ Unhealthy');
    default:
      return '❓ Unknown';
  }
}

// Run if executed directly
if (require.main === module) {
  const options: HealthCheckOptions = {
    verbose: process.argv.includes('--verbose') || process.argv.includes('-v')
  };
  
  healthCheckCommand(options);
}