import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore
import { glob } from 'glob';

const execAsync = promisify(exec);

interface ClearCacheOptions {
  verbose?: boolean;
  skipBrowser?: boolean;
  nuclear?: boolean;
}

export async function clearAllCaches(options: ClearCacheOptions = {}) {
  const { verbose = false, skipBrowser = false, nuclear = false } = options;
  
  console.log('🧹 Starting complete cache cleanup...\n');
  
  try {
    // Step 1: Kill all running processes
    console.log('⏹️  Killing all Node.js processes...');
    const processesToKill = ['node', 'vite', 'tsx', 'ts-node'];
    for (const process of processesToKill) {
      try {
        await execAsync(`pkill -f "${process}"`);
      } catch (e) {
        // Ignore errors (process might not exist)
      }
    }
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for processes to die
    
    // Step 2: Clear various caches
    const cacheTargets = [
      { name: 'Vite caches', pattern: '**/.vite', exclude: '**/node_modules/**' },
      { name: 'dist folders', pattern: '**/dist', exclude: '**/node_modules/**' },
      { name: 'build folders', pattern: '**/build', exclude: '**/node_modules/**' },
      { name: '.cache folders', pattern: '**/.cache' },
      { name: 'parcel cache', pattern: '**/.parcel-cache' },
      { name: 'turbo cache', pattern: '**/.turbo' },
      { name: 'Next.js cache', pattern: '**/.next' },
      { name: 'rollup cache', pattern: '**/.rollup.cache' },
      { name: 'temp folders', pattern: '**/temp', exclude: '**/node_modules/**' },
      { name: 'tmp folders', pattern: '**/tmp', exclude: '**/node_modules/**' }
    ];
    
    for (const target of cacheTargets) {
      console.log(`🗑️  Clearing ${target.name}...`);
      try {
        const files = await glob(target.pattern, { 
          ignore: target.exclude ? [target.exclude] : undefined,
          dot: true 
        });
        
        for (const file of files) {
          if (verbose) console.log(`   Removing: ${file}`);
          await fs.promises.rm(file, { recursive: true, force: true });
        }
        
        if (verbose && files.length > 0) {
          console.log(`   ✓ Removed ${files.length} items`);
        }
      } catch (e) {
        if (verbose) console.error(`   Error: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    
    // Step 3: Clear TypeScript build info
    console.log('📘 Clearing TypeScript build info...');
    try {
      const tsbuildFiles = await glob('**/*.tsbuildinfo');
      for (const file of tsbuildFiles) {
        await fs.promises.unlink(file);
      }
      if (verbose) console.log(`   ✓ Removed ${tsbuildFiles.length} .tsbuildinfo files`);
    } catch (e) {
      if (verbose) console.error(`   Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    
    // Step 4: Clear pnpm store
    console.log('📦 Clearing pnpm store...');
    try {
      const { stdout } = await execAsync('pnpm store prune');
      if (verbose) console.log(stdout);
    } catch (e) {
      if (verbose) console.error(`   Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    
    // Step 5: Nuclear option - remove all node_modules
    if (nuclear) {
      console.log('\n🔥 NUCLEAR OPTION: Removing all node_modules...');
      const nodeModulesDirs = await glob('**/node_modules', { 
        ignore: ['**/node_modules/**/node_modules'],
        dot: true 
      });
      
      console.log(`   Found ${nodeModulesDirs.length} node_modules directories`);
      console.log('   This will require a full reinstall with pnpm install');
      
      for (const dir of nodeModulesDirs) {
        if (verbose) console.log(`   Removing: ${dir}`);
        await fs.promises.rm(dir, { recursive: true, force: true });
      }
    }
    
    console.log('\n✅ Cache cleanup complete!\n');
    
    // Browser cache instructions
    if (!skipBrowser) {
      console.log('🌐 Browser Cache Clearing:');
      console.log('   1. Open Chrome DevTools (F12)');
      console.log('   2. Right-click the Refresh button');
      console.log('   3. Select "Empty Cache and Hard Reload"');
      console.log('   OR');
      console.log('   - Mac: Cmd+Shift+R');
      console.log('   - Windows/Linux: Ctrl+Shift+R');
      console.log('');
      console.log('   Alternative: Use Incognito/Private mode\n');
    }
    
    // Next steps
    console.log('📝 Next steps:');
    if (nuclear) {
      console.log('   1. Run: pnpm install (REQUIRED - all node_modules were removed)');
    } else {
      console.log('   1. Run: pnpm install (recommended)');
    }
    console.log('   2. Start your dev server');
    console.log('   3. Clear browser cache (see above)\n');
    
    return true;
  } catch (error) {
    console.error('❌ Error during cache cleanup:', error);
    return false;
  }
}

// Quick restart helper
export async function quickRestart(appName?: string) {
  console.log('🔄 Quick restart helper\n');
  
  // Kill running processes
  console.log('⏹️  Stopping running processes...');
  try {
    await execAsync('pkill -f "vite"');
  } catch (e) {
    // Ignore
  }
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Clear Vite cache only
  console.log('🗑️  Clearing Vite cache...');
  const viteDirs = await glob('**/.vite', { dot: true });
  for (const dir of viteDirs) {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
  
  console.log('✅ Quick cleanup complete!');
  console.log('');
  console.log('📝 Next: Start your dev server');
  if (appName) {
    console.log(`   cd apps/${appName} && pnpm dev`);
  }
}