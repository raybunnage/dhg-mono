#!/usr/bin/env ts-node

import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

console.log('🔍 Vite Environment Variable Diagnostic Tool\n');

// Get the app directory
const appName = process.argv[2] || 'dhg-service-test';
const rootDir = process.cwd();
const appDir = join(rootDir, 'apps', appName);

if (!existsSync(appDir)) {
  console.error(`❌ App directory not found: ${appDir}`);
  process.exit(1);
}

console.log(`📁 Checking app: ${appName}`);
console.log(`📍 App directory: ${appDir}\n`);

// 1. Check .env files
console.log('1️⃣ Environment Files Check:');
console.log('==========================');

const envFiles = [
  { path: join(rootDir, '.env'), name: '.env (root)' },
  { path: join(rootDir, '.env.development'), name: '.env.development (root)' },
  { path: join(rootDir, '.env.local'), name: '.env.local (root)' },
  { path: join(appDir, '.env'), name: '.env (app)' },
  { path: join(appDir, '.env.development'), name: '.env.development (app)' },
  { path: join(appDir, '.env.local'), name: '.env.local (app)' }
];

const foundEnvFiles: string[] = [];

for (const { path, name } of envFiles) {
  if (existsSync(path)) {
    const stats = statSync(path);
    const isSymlink = stats.isSymbolicLink();
    console.log(`✅ ${name}: Found (${isSymlink ? 'symlink' : 'file'}, ${stats.size} bytes)`);
    foundEnvFiles.push(path);
    
    // Check if it's a symlink and where it points
    if (isSymlink) {
      try {
        const target = execSync(`readlink ${path}`, { encoding: 'utf-8' }).trim();
        console.log(`   └─> Points to: ${target}`);
      } catch (e) {
        // Ignore
      }
    }
  } else {
    console.log(`❌ ${name}: Not found`);
  }
}

// 2. Check Vite variables in .env files
console.log('\n2️⃣ Vite Environment Variables:');
console.log('==============================');

const requiredVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_SERVICE_ROLE_KEY'
];

for (const envFile of foundEnvFiles) {
  if (envFile.includes('.local')) continue; // Skip .local files for security
  
  console.log(`\n📄 ${envFile}:`);
  const content = readFileSync(envFile, 'utf-8');
  
  for (const varName of requiredVars) {
    const regex = new RegExp(`^${varName}=(.*)$`, 'm');
    const match = content.match(regex);
    
    if (match) {
      const value = match[1];
      const displayValue = value.length > 20 ? value.substring(0, 20) + '...' : value;
      console.log(`  ✅ ${varName} = "${displayValue}"`);
    } else {
      console.log(`  ❌ ${varName} = NOT FOUND`);
    }
  }
}

// 3. Check Vite cache
console.log('\n3️⃣ Vite Cache Check:');
console.log('===================');

const viteCacheDirs = [
  join(appDir, 'node_modules', '.vite'),
  join(rootDir, 'node_modules', '.vite'),
  join(appDir, '.vite'),
  join(appDir, 'dist')
];

for (const cacheDir of viteCacheDirs) {
  if (existsSync(cacheDir)) {
    const stats = statSync(cacheDir);
    console.log(`⚠️  Cache found: ${cacheDir} (modified: ${stats.mtime.toLocaleString()})`);
  } else {
    console.log(`✅ No cache at: ${cacheDir}`);
  }
}

// 4. Check package.json scripts
console.log('\n4️⃣ Package.json Scripts:');
console.log('=======================');

const packageJsonPath = join(appDir, 'package.json');
if (existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  const scripts = packageJson.scripts || {};
  
  if (scripts.dev) {
    console.log(`✅ dev script: ${scripts.dev}`);
  }
  if (scripts.build) {
    console.log(`✅ build script: ${scripts.build}`);
  }
}

// 5. Check TypeScript config
console.log('\n5️⃣ TypeScript Configuration:');
console.log('==========================');

const tsConfigPath = join(appDir, 'tsconfig.json');
if (existsSync(tsConfigPath)) {
  console.log('✅ tsconfig.json found');
  const tsConfig = JSON.parse(readFileSync(tsConfigPath, 'utf-8'));
  
  // Check for env.d.ts reference
  if (tsConfig.include && tsConfig.include.some((p: string) => p.includes('vite-env.d.ts'))) {
    console.log('✅ vite-env.d.ts is included');
  }
}

// 6. Check vite.config.ts
console.log('\n6️⃣ Vite Configuration:');
console.log('=====================');

const viteConfigPath = join(appDir, 'vite.config.ts');
if (existsSync(viteConfigPath)) {
  console.log('✅ vite.config.ts found');
  const viteConfig = readFileSync(viteConfigPath, 'utf-8');
  
  // Check for common issues
  if (viteConfig.includes('envDir')) {
    console.log('⚠️  Custom envDir detected - this might affect .env loading');
  }
  if (viteConfig.includes('envPrefix')) {
    console.log('⚠️  Custom envPrefix detected - check if it includes "VITE_"');
  }
}

// 7. Recommendations
console.log('\n7️⃣ Recommendations:');
console.log('==================');

const hasCache = viteCacheDirs.some(dir => existsSync(dir));
if (hasCache) {
  console.log('🔧 Clear Vite cache:');
  console.log(`   cd ${appDir} && rm -rf node_modules/.vite .vite dist`);
}

const hasSymlink = foundEnvFiles.some(file => {
  if (existsSync(file)) {
    return statSync(file).isSymbolicLink();
  }
  return false;
});

if (hasSymlink) {
  console.log('\n🔧 Symlinks detected. Make sure they point to valid files.');
}

console.log('\n🔧 Nuclear fix (full reinstall):');
console.log(`   cd ${appDir}`);
console.log('   rm -rf node_modules .vite dist');
console.log('   cd ../.. && pnpm install');
console.log('   cd apps/' + appName);
console.log('   pnpm dev');

console.log('\n🔧 Test environment loading:');
console.log(`   cd ${appDir}`);
console.log('   node -e "console.log(process.env.VITE_SUPABASE_URL)"');

console.log('\n✨ Diagnostic complete!');