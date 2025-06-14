#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import { existsSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

// Interface removed - not needed since we parse args directly

class ViteEnvFixer {
  private rootDir: string;
  private appDir: string;

  constructor(appName: string) {
    this.rootDir = process.cwd();
    this.appDir = join(this.rootDir, 'apps', appName);
    
    if (!existsSync(this.appDir)) {
      throw new Error(`App directory not found: ${this.appDir}`);
    }
  }

  private runCommand(cmd: string, cwd: string = this.appDir): void {
    console.log(chalk.gray(`  Running: ${cmd}`));
    try {
      execSync(cmd, { cwd, stdio: 'inherit' });
    } catch (error) {
      console.error(chalk.red(`  Command failed: ${cmd}`));
      throw error;
    }
  }

  private deleteIfExists(path: string, description: string): boolean {
    if (existsSync(path)) {
      console.log(chalk.yellow(`  Deleting ${description}: ${path}`));
      rmSync(path, { recursive: true, force: true });
      return true;
    }
    return false;
  }

  private checkEnvFiles(): boolean {
    console.log(chalk.blue('\n1️⃣  Checking environment files...'));
    
    const envPaths = [
      { path: join(this.rootDir, '.env'), label: 'root .env' },
      { path: join(this.rootDir, '.env.development'), label: 'root .env.development' },
      { path: join(this.appDir, '.env'), label: 'app .env' },
      { path: join(this.appDir, '.env.development'), label: 'app .env.development' },
    ];

    let hasValidEnv = false;
    
    for (const { path, label } of envPaths) {
      if (existsSync(path)) {
        const content = readFileSync(path, 'utf-8');
        const hasUrl = content.includes('VITE_SUPABASE_URL');
        const hasKey = content.includes('VITE_SUPABASE_ANON_KEY');
        
        if (hasUrl && hasKey) {
          console.log(chalk.green(`  ✅ ${label} contains required variables`));
          hasValidEnv = true;
        } else {
          console.log(chalk.red(`  ❌ ${label} missing required variables`));
        }
      }
    }

    return hasValidEnv;
  }

  private clearViteCache(): void {
    console.log(chalk.blue('\n2️⃣  Clearing Vite cache...'));
    
    const cachePaths = [
      { path: join(this.appDir, 'node_modules', '.vite'), desc: 'app node_modules/.vite' },
      { path: join(this.appDir, '.vite'), desc: 'app .vite' },
      { path: join(this.appDir, 'dist'), desc: 'app dist' },
      { path: join(this.rootDir, 'node_modules', '.vite'), desc: 'root node_modules/.vite' },
    ];

    let cleared = false;
    for (const { path, desc } of cachePaths) {
      if (this.deleteIfExists(path, desc)) {
        cleared = true;
      }
    }

    if (!cleared) {
      console.log(chalk.gray('  No Vite cache found to clear'));
    }
  }

  private killViteProcess(): void {
    console.log(chalk.blue('\n3️⃣  Killing any running Vite processes...'));
    
    try {
      // Find and kill Vite processes
      const processes = execSync("ps aux | grep 'vite' | grep -v grep || true", { encoding: 'utf-8' });
      if (processes.trim()) {
        console.log(chalk.yellow('  Found running Vite processes, killing...'));
        execSync("pkill -f vite || true", { stdio: 'ignore' });
        // Wait a moment for processes to die
        execSync('sleep 1');
      } else {
        console.log(chalk.gray('  No Vite processes running'));
      }
    } catch {
      // Ignore errors from grep/pkill
    }
  }

  private reinstallDependencies(): void {
    console.log(chalk.blue('\n4️⃣  Reinstalling dependencies...'));
    
    // Delete node_modules
    this.deleteIfExists(join(this.appDir, 'node_modules'), 'app node_modules');
    
    // Reinstall
    console.log(chalk.yellow('  Running pnpm install...'));
    this.runCommand('pnpm install', this.rootDir);
  }

  public fix(nuclear: boolean = false): void {
    console.log(chalk.bold.cyan(`\n🔧 Fixing Vite environment variables for: ${this.appDir.split('/').pop()}\n`));

    // Always check env files first
    if (!this.checkEnvFiles()) {
      console.log(chalk.red('\n❌ No valid environment files found with required variables!'));
      console.log(chalk.yellow('\nPlease ensure .env.development exists with:'));
      console.log(chalk.gray('  VITE_SUPABASE_URL=your_url'));
      console.log(chalk.gray('  VITE_SUPABASE_ANON_KEY=your_key'));
      return;
    }

    // Kill Vite processes
    this.killViteProcess();

    // Clear cache
    this.clearViteCache();

    if (nuclear) {
      console.log(chalk.yellow('\n🔥 Nuclear option: Full reinstall...'));
      this.reinstallDependencies();
    }

    console.log(chalk.green('\n✅ Fix complete! To start the app:'));
    console.log(chalk.cyan(`  cd ${this.appDir}`));
    console.log(chalk.cyan('  pnpm dev'));
    console.log(chalk.gray('\nIf issues persist, try the nuclear option: --nuclear'));
  }
}

// CLI
const args = process.argv.slice(2);
const appName = args[0] || 'dhg-service-test';
const nuclear = args.includes('--nuclear');

if (args.includes('--help')) {
  console.log(`
Usage: ts-node fix-vite-env.ts [app-name] [options]

Options:
  --nuclear    Full reinstall of dependencies
  --help       Show this help

Examples:
  ts-node fix-vite-env.ts dhg-service-test
  ts-node fix-vite-env.ts dhg-hub --nuclear
  `);
  process.exit(0);
}

try {
  const fixer = new ViteEnvFixer(appName);
  fixer.fix(nuclear);
} catch (error) {
  console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : String(error));
  process.exit(1);
}