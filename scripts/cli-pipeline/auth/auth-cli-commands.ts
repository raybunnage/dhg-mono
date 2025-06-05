/**
 * Authentication CLI Commands
 * 
 * TypeScript implementation of authentication CLI commands
 */

import { Command } from 'commander';
import * as chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Import the auth service using proper paths
import { authService } from '../../../packages/shared/services/auth-service';

const program = new Command();

// Helper function to format dates
function formatDate(dateString: string | null): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  return date.toLocaleString();
}

// Helper function to save CLI config
function saveCLIConfig(data: any): void {
  const configDir = path.join(os.homedir(), '.dhg');
  const configPath = path.join(configDir, 'config.json');
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
  fs.chmodSync(configPath, 0o600);
}

// Helper function to load CLI config
function loadCLIConfig(): any {
  const configPath = path.join(os.homedir(), '.dhg', 'config.json');
  
  if (!fs.existsSync(configPath)) {
    return {};
  }
  
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    return {};
  }
}

// Login command
program
  .command('login')
  .description('Login with email and password')
  .option('-e, --email <email>', 'Email address')
  .option('-p, --password <password>', 'Password')
  .action(async (options) => {
    try {
      const email = options.email || process.env.EMAIL;
      const password = options.password || process.env.PASSWORD;
      
      if (!email || !password) {
        console.error(chalk.red('Error: Email and password are required'));
        process.exit(1);
      }
      
      console.log(chalk.blue('Authenticating...'));
      
      const { session, error } = await authService.signIn(email, password);
      
      if (error) {
        console.error(chalk.red(`Authentication failed: ${error.message}`));
        process.exit(1);
      }
      
      // Save successful login
      const config = loadCLIConfig();
      config.lastLogin = new Date().toISOString();
      config.email = email;
      saveCLIConfig(config);
      
      console.log(chalk.green('✓ Successfully logged in'));
      console.log(chalk.gray(`Logged in as: ${session?.user?.email}`));
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// Logout command
program
  .command('logout')
  .description('Logout current session')
  .action(async () => {
    try {
      console.log(chalk.blue('Logging out...'));
      
      await authService.signOut();
      
      // Clear saved config
      const config = loadCLIConfig();
      delete config.lastLogin;
      delete config.email;
      saveCLIConfig(config);
      
      console.log(chalk.green('✓ Successfully logged out'));
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// Whoami command
program
  .command('whoami')
  .description('Show current authenticated user')
  .option('--api-key <key>', 'API key for authentication')
  .action(async (options) => {
    try {
      let user;
      
      if (options.apiKey) {
        const session = await authService.authenticateCLI(options.apiKey);
        user = session?.user;
      } else {
        user = await authService.getCurrentUser();
      }
      
      if (!user) {
        console.log(chalk.yellow('Not authenticated'));
        console.log(chalk.gray('Run "auth-cli login" to authenticate'));
        return;
      }
      
      console.log(chalk.green('Current User:'));
      console.log(chalk.gray('─────────────'));
      console.log(`Email: ${chalk.white(user.email)}`);
      console.log(`ID: ${chalk.gray(user.id)}`);
      
      if (user.profile) {
        console.log(`Name: ${chalk.white(user.profile.full_name || 'Not set')}`);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// Create token command
program
  .command('token-create <name>')
  .description('Create a new CLI authentication token')
  .option('-d, --days <days>', 'Expiration in days (default: 90)', '90')
  .action(async (name, options) => {
    try {
      console.log(chalk.blue(`Creating token "${name}"...`));
      
      const token = await authService.createCLIToken(name, parseInt(options.days));
      
      console.log(chalk.green('✓ Token created successfully'));
      console.log('');
      console.log(chalk.yellow('⚠️  Save this token securely - it will not be shown again:'));
      console.log('');
      console.log(chalk.bgGray.white(` ${token} `));
      console.log('');
      console.log(chalk.gray('Use this token with:'));
      console.log(chalk.gray(`  export DHG_CLI_API_KEY="${token}"`));
      console.log(chalk.gray('  dhg-cli [command]'));
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// List tokens command
program
  .command('token-list')
  .description('List all CLI tokens')
  .action(async () => {
    try {
      const tokens = await authService.listCLITokens();
      
      if (tokens.length === 0) {
        console.log(chalk.yellow('No tokens found'));
        return;
      }
      
      console.log(chalk.green(`Found ${tokens.length} token(s):`));
      console.log('');
      
      tokens.forEach(token => {
        console.log(chalk.white(`${token.name}`));
        console.log(chalk.gray(`  ID: ${token.id}`));
        console.log(chalk.gray(`  Created: ${formatDate(token.created_at)}`));
        console.log(chalk.gray(`  Last used: ${formatDate(token.last_used)}`));
        if (token.expires_at) {
          const isExpired = new Date(token.expires_at) < new Date();
          const expiryText = `Expires: ${formatDate(token.expires_at)}`;
          console.log(isExpired ? chalk.red(`  ${expiryText} (EXPIRED)`) : chalk.gray(`  ${expiryText}`));
        }
        console.log('');
      });
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// Revoke token command
program
  .command('token-revoke <id>')
  .description('Revoke a CLI token')
  .action(async (id) => {
    try {
      console.log(chalk.blue(`Revoking token ${id}...`));
      
      await authService.revokeCLIToken(id);
      
      console.log(chalk.green('✓ Token revoked successfully'));
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// Profile command
program
  .command('profile')
  .description('Show user profile')
  .action(async () => {
    try {
      const user = await authService.getCurrentUser();
      
      if (!user) {
        console.log(chalk.yellow('Not authenticated'));
        return;
      }
      
      console.log(chalk.green('User Profile:'));
      console.log(chalk.gray('─────────────'));
      console.log(`Email: ${chalk.white(user.email)}`);
      console.log(`ID: ${chalk.gray(user.id)}`);
      
      if (user.profile) {
        console.log(`Name: ${chalk.white(user.profile.full_name || 'Not set')}`);
        console.log(`Created: ${chalk.gray(formatDate(user.profile.created_at))}`);
        console.log(`Updated: ${chalk.gray(formatDate(user.profile.updated_at))}`);
        
        if (user.profile.preferences && Object.keys(user.profile.preferences).length > 0) {
          console.log('');
          console.log(chalk.green('Preferences:'));
          Object.entries(user.profile.preferences).forEach(([key, value]) => {
            console.log(`  ${key}: ${chalk.white(JSON.stringify(value))}`);
          });
        }
      }
      
      if (user.roles && user.roles.length > 0) {
        console.log('');
        console.log(chalk.green('Roles:'));
        user.roles.forEach(role => {
          console.log(`  • ${chalk.white(role)}`);
        });
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// Profile update command
program
  .command('profile-update')
  .description('Update user profile')
  .option('-n, --name <name>', 'Full name')
  .option('-p, --preference <key=value>', 'Set preference (can be used multiple times)', (val, prev) => {
    prev = prev || {};
    const [key, value] = val.split('=');
    prev[key] = value;
    return prev;
  }, {})
  .action(async (options) => {
    try {
      const updates: any = {};
      
      if (options.name) {
        updates.full_name = options.name;
      }
      
      if (Object.keys(options.preference).length > 0) {
        updates.preferences = options.preference;
      }
      
      if (Object.keys(updates).length === 0) {
        console.log(chalk.yellow('No updates specified'));
        return;
      }
      
      console.log(chalk.blue('Updating profile...'));
      
      const user = await authService.updateUserProfile(updates);
      
      console.log(chalk.green('✓ Profile updated successfully'));
      
      if (updates.full_name) {
        console.log(`Name: ${chalk.white(user.profile?.full_name)}`);
      }
      
      if (updates.preferences) {
        console.log('Preferences updated');
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// Test command
program
  .command('test')
  .description('Test authentication service')
  .action(async () => {
    console.log(chalk.blue('Testing authentication service...'));
    console.log('');
    
    const tests = [
      {
        name: 'Check current session',
        test: async () => {
          const user = await authService.getCurrentUser();
          return user ? 'Authenticated' : 'Not authenticated';
        }
      },
      {
        name: 'Validate CLI token',
        test: async () => {
          const apiKey = process.env.DHG_CLI_API_KEY;
          if (!apiKey) return 'No CLI token set';
          const session = await authService.authenticateCLI(apiKey);
          return session ? 'Valid' : 'Invalid';
        }
      },
      {
        name: 'Check token storage',
        test: async () => {
          const tokenPath = path.join(os.homedir(), '.dhg', 'auth.json');
          return fs.existsSync(tokenPath) ? 'Found' : 'Not found';
        }
      },
      {
        name: 'Check config storage',
        test: async () => {
          const configPath = path.join(os.homedir(), '.dhg', 'config.json');
          return fs.existsSync(configPath) ? 'Found' : 'Not found';
        }
      }
    ];
    
    for (const { name, test } of tests) {
      try {
        const result = await test();
        console.log(`${chalk.green('✓')} ${name}: ${chalk.white(result)}`);
      } catch (error) {
        console.log(`${chalk.red('✗')} ${name}: ${chalk.red('Failed')}`);
        console.log(chalk.gray(`  ${error}`));
      }
    }
    
    console.log('');
    console.log(chalk.green('Test complete'));
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}