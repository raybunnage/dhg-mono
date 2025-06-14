import { execSync } from 'child_process';
import { existsSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';

export interface FixResult {
  success: boolean;
  message: string;
  diagnostics?: any;
  error?: string;
}

export class ViteFixService {
  private rootDir: string;

  constructor() {
    this.rootDir = process.cwd();
  }

  async diagnoseApp(appName: string): Promise<FixResult> {
    try {
      const output = execSync(
        `ts-node scripts/cli-pipeline/utilities/diagnose-vite-env.ts ${appName}`,
        { encoding: 'utf-8', cwd: this.rootDir }
      );
      
      return {
        success: true,
        message: 'Diagnosis complete',
        diagnostics: output
      };
    } catch (error) {
      return {
        success: false,
        message: 'Diagnosis failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async fixApp(appName: string, nuclear: boolean): Promise<FixResult> {
    try {
      const appDir = join(this.rootDir, 'apps', appName);
      
      if (!existsSync(appDir)) {
        return {
          success: false,
          message: `App directory not found: ${appName}`,
          error: 'Invalid app name'
        };
      }

      // Step 1: Kill any running Vite processes
      try {
        execSync('pkill -f vite || true', { stdio: 'ignore' });
      } catch {
        // Ignore errors from pkill
      }

      // Step 2: Clear Vite cache
      const viteCachePaths = [
        join(appDir, 'node_modules', '.vite'),
        join(appDir, '.vite'),
        join(appDir, 'dist'),
        join(this.rootDir, 'node_modules', '.vite'),
      ];

      let cacheCleared = false;
      for (const cachePath of viteCachePaths) {
        if (existsSync(cachePath)) {
          rmSync(cachePath, { recursive: true, force: true });
          cacheCleared = true;
        }
      }

      // Step 3: Nuclear option - reinstall dependencies
      if (nuclear) {
        const nodeModulesPath = join(appDir, 'node_modules');
        if (existsSync(nodeModulesPath)) {
          rmSync(nodeModulesPath, { recursive: true, force: true });
        }
        
        execSync('pnpm install', { cwd: this.rootDir, stdio: 'inherit' });
      }

      return {
        success: true,
        message: nuclear ? 'Nuclear fix applied successfully' : 'Quick fix applied successfully',
        diagnostics: {
          cacheCleared,
          nuclear,
          appName
        }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Fix failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async checkEnvFiles(appName: string): Promise<FixResult> {
    const rootEnvDev = join(this.rootDir, '.env.development');
    const appEnvDev = join(this.rootDir, 'apps', appName, '.env.development');
    
    const files: any = {};
    
    // Check root .env.development
    if (existsSync(rootEnvDev)) {
      const content = readFileSync(rootEnvDev, 'utf-8');
      files.rootEnvDev = {
        exists: true,
        hasSupabaseUrl: content.includes('VITE_SUPABASE_URL'),
        hasSupabaseKey: content.includes('VITE_SUPABASE_ANON_KEY')
      };
    } else {
      files.rootEnvDev = { exists: false };
    }
    
    // Check app .env.development
    if (existsSync(appEnvDev)) {
      const content = readFileSync(appEnvDev, 'utf-8');
      files.appEnvDev = {
        exists: true,
        hasSupabaseUrl: content.includes('VITE_SUPABASE_URL'),
        hasSupabaseKey: content.includes('VITE_SUPABASE_ANON_KEY')
      };
    } else {
      files.appEnvDev = { exists: false };
    }
    
    const hasValidEnv = (files.rootEnvDev.exists && files.rootEnvDev.hasSupabaseUrl && files.rootEnvDev.hasSupabaseKey) ||
                        (files.appEnvDev.exists && files.appEnvDev.hasSupabaseUrl && files.appEnvDev.hasSupabaseKey);
    
    return {
      success: hasValidEnv,
      message: hasValidEnv ? 'Environment files are valid' : 'Environment files missing or incomplete',
      diagnostics: files
    };
  }

  async listApps(): Promise<string[]> {
    try {
      const appsDir = join(this.rootDir, 'apps');
      const apps = execSync(`ls -d ${appsDir}/*/`, { encoding: 'utf-8' })
        .split('\n')
        .filter(Boolean)
        .map(path => path.split('/').slice(-2)[0]);
      
      return apps;
    } catch (error) {
      throw new Error('Failed to list apps');
    }
  }
}