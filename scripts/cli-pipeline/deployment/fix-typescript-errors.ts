#!/usr/bin/env ts-node

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import chalk from 'chalk';

// Common TypeScript fixes for deployment
async function fixTypeScriptErrors() {
  console.log(chalk.blue('🔧 Applying common TypeScript fixes for deployment...\n'));

  // Fix 1: Add missing type imports
  await fixMissingTypeImports();
  
  // Fix 2: Fix any types in function parameters
  await fixImplicitAnyTypes();
  
  // Fix 3: Fix import.meta.env in shared packages
  await fixImportMetaEnv();
  
  // Fix 4: Add missing return types
  await fixMissingReturnTypes();

  console.log(chalk.green('\n✅ TypeScript fixes applied!'));
}

async function fixMissingTypeImports() {
  console.log(chalk.yellow('Fixing missing type imports...'));
  
  const files = await glob('packages/shared/**/*.ts', { ignore: ['**/node_modules/**'] });
  
  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');
    let modified = content;
    
    // Add React import for JSX files
    if (file.endsWith('.tsx') && !content.includes("import React") && !content.includes("import * as React")) {
      modified = `import React from 'react';\n${modified}`;
    }
    
    // Add common type imports
    const typeImports = [
      { pattern: /\bPromise</, import: "// Promise is built-in" },
      { pattern: /\bRecord</, import: "// Record is built-in" },
      { pattern: /\bPartial</, import: "// Partial is built-in" }
    ];
    
    if (modified !== content) {
      await fs.writeFile(file, modified);
      console.log(chalk.green(`  ✓ Fixed imports in ${path.relative(process.cwd(), file)}`));
    }
  }
}

async function fixImplicitAnyTypes() {
  console.log(chalk.yellow('\nFixing implicit any types...'));
  
  const files = await glob('packages/shared/**/*.ts', { ignore: ['**/node_modules/**'] });
  
  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');
    let modified = content;
    
    // Fix function parameters without types
    modified = modified.replace(
      /(\w+)\s*\(\s*(\w+)\s*\)/g,
      (match, funcName, param) => {
        // Skip if it's already typed or is a known pattern
        if (match.includes(':') || funcName === 'catch' || funcName === 'then') {
          return match;
        }
        return `${funcName}(${param}: any)`;
      }
    );
    
    // Fix arrow functions without parameter types
    modified = modified.replace(
      /\(\s*(\w+)\s*\)\s*=>/g,
      (match, param) => {
        if (match.includes(':')) {
          return match;
        }
        return `(${param}: any) =>`;
      }
    );
    
    if (modified !== content) {
      await fs.writeFile(file, modified);
      console.log(chalk.green(`  ✓ Fixed any types in ${path.relative(process.cwd(), file)}`));
    }
  }
}

async function fixImportMetaEnv() {
  console.log(chalk.yellow('\nFixing import.meta.env usage...'));
  
  const files = await glob('packages/shared/**/*.ts', { ignore: ['**/node_modules/**'] });
  
  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');
    let modified = content;
    
    // Replace import.meta.env with process.env in shared packages
    if (modified.includes('import.meta.env')) {
      modified = modified.replace(/import\.meta\.env\.VITE_/g, 'process.env.');
      modified = modified.replace(/import\.meta\.env/g, 'process.env');
      
      await fs.writeFile(file, modified);
      console.log(chalk.green(`  ✓ Fixed import.meta.env in ${path.relative(process.cwd(), file)}`));
    }
  }
}

async function fixMissingReturnTypes() {
  console.log(chalk.yellow('\nAdding missing return types...'));
  
  const files = await glob('packages/shared/**/*.ts', { ignore: ['**/node_modules/**'] });
  
  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');
    let modified = content;
    
    // Add void return type to functions without return type
    modified = modified.replace(
      /^(\s*)(async\s+)?(\w+)\s*\([^)]*\)\s*{/gm,
      (match, indent, async, funcName) => {
        // Skip if already has return type
        if (match.includes(':')) {
          return match;
        }
        // Skip constructors
        if (funcName === 'constructor') {
          return match;
        }
        const asyncKeyword = async || '';
        const returnType = asyncKeyword ? ': Promise<void>' : ': void';
        return match.replace('{', `${returnType} {`);
      }
    );
    
    if (modified !== content) {
      await fs.writeFile(file, modified);
      console.log(chalk.green(`  ✓ Added return types in ${path.relative(process.cwd(), file)}`));
    }
  }
}

// Run the fixes
fixTypeScriptErrors().catch(error => {
  console.error(chalk.red('Error fixing TypeScript issues:'), error);
  process.exit(1);
});