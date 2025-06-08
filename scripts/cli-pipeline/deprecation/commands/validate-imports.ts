#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
const glob = require('glob');

interface BrokenImport {
  file_path: string;
  line_number: number;
  import_statement: string;
  archived_script: string;
  archive_info?: {
    archive_id: string;
    archive_date: Date;
    archive_reason: string;
  };
}

class ImportValidator {
  private supabase = SupabaseClientService.getInstance().getClient();
  private projectRoot = path.join(__dirname, '../../../../');
  private brokenImports: BrokenImport[] = [];
  private archivedScripts: Map<string, any> = new Map();

  async validate() {
    console.log('🔍 Validating imports for archived scripts...\n');
    
    // Step 1: Load all archived scripts from database
    await this.loadArchivedScripts();
    
    // Step 2: Find all source files
    const sourceFiles = await this.findSourceFiles();
    
    // Step 3: Check each file for imports of archived scripts
    await this.checkImports(sourceFiles);
    
    // Step 4: Generate report
    this.generateReport();
  }

  private async loadArchivedScripts() {
    console.log('📚 Loading archived scripts from database...');
    
    const { data, error } = await this.supabase
      .from('sys_archived_scripts_files')
      .select('*')
      .eq('restored', false);
      
    if (error) {
      console.error('Error loading archived scripts:', error);
      return;
    }
    
    // Create a map for quick lookup
    data?.forEach(script => {
      // Store by original path variations
      this.archivedScripts.set(script.original_path, script);
      this.archivedScripts.set('./' + script.original_path, script);
      this.archivedScripts.set('../' + script.original_path, script);
      this.archivedScripts.set('../../' + script.original_path, script);
      this.archivedScripts.set('../../../' + script.original_path, script);
      
      // Also store by file name for partial matches
      const fileName = path.basename(script.original_path);
      if (!this.archivedScripts.has(fileName)) {
        this.archivedScripts.set(fileName, script);
      }
    });
    
    console.log(`  Loaded ${data?.length || 0} archived scripts\n`);
  }

  private async findSourceFiles(): Promise<string[]> {
    console.log('📂 Finding source files to check...');
    
    const patterns = [
      'apps/**/*.{ts,tsx,js,jsx}',
      'packages/**/*.{ts,tsx,js,jsx}',
      'scripts/**/*.{ts,sh,js}',
      '!**/node_modules/**',
      '!**/.archived_scripts/**',
      '!**/dist/**',
      '!**/build/**'
    ];
    
    const files = await new Promise<string[]>((resolve, reject) => {
      glob(patterns[0], {
        cwd: this.projectRoot,
        ignore: patterns.slice(1).map(p => p.substring(1))
      }, (err: any, files: string[]) => {
        if (err) reject(err);
        else resolve(files);
      });
    });
    
    // Also find shell scripts that might source other scripts
    const shellPatterns = [
      'scripts/**/*.sh',
      'apps/**/*.sh',
      '!**/node_modules/**',
      '!**/.archived_scripts/**'
    ];
    
    const shellFiles = await new Promise<string[]>((resolve, reject) => {
      glob(shellPatterns[0], {
        cwd: this.projectRoot,
        ignore: shellPatterns.slice(1).map(p => p.substring(1))
      }, (err: any, files: string[]) => {
        if (err) reject(err);
        else resolve(files);
      });
    });
    
    const allFiles = [...new Set([...files, ...shellFiles])];
    console.log(`  Found ${allFiles.length} source files to check\n`);
    
    return allFiles;
  }

  private async checkImports(files: string[]) {
    console.log('🔎 Checking imports in source files...');
    
    let checkedCount = 0;
    const progressInterval = Math.max(1, Math.floor(files.length / 10));
    
    for (const file of files) {
      checkedCount++;
      if (checkedCount % progressInterval === 0) {
        console.log(`  Progress: ${checkedCount}/${files.length} files checked`);
      }
      
      const filePath = path.join(this.projectRoot, file);
      
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        
        // Check based on file type
        if (file.endsWith('.sh')) {
          this.checkShellScriptImports(file, lines);
        } else {
          this.checkJavaScriptImports(file, lines);
        }
      } catch (error) {
        // File might have been deleted or moved
      }
    }
    
    console.log(`\n  Checked ${checkedCount} files`);
    console.log(`  Found ${this.brokenImports.length} broken imports\n`);
  }

  private checkJavaScriptImports(filePath: string, lines: string[]) {
    const importPatterns = [
      // ES6 imports
      /import\s+.*\s+from\s+['"](.*)['"]/,
      /import\s+['"](.*)['"]/,
      // CommonJS requires
      /require\s*\(\s*['"](.*)['"]\s*\)/,
      // Dynamic imports
      /import\s*\(\s*['"](.*)['"]\s*\)/
    ];
    
    lines.forEach((line, index) => {
      for (const pattern of importPatterns) {
        const match = line.match(pattern);
        if (match) {
          const importPath = match[1];
          this.checkIfArchived(filePath, index + 1, line, importPath);
        }
      }
    });
  }

  private checkShellScriptImports(filePath: string, lines: string[]) {
    const sourcePatterns = [
      // Source commands
      /source\s+['""]?([^'"";\s]+)/,
      /\.\s+['""]?([^'"";\s]+)/,
      // Direct script execution
      /^\s*([\.\/][^;\s|&]+\.sh)/,
      // Script references in commands
      /node\s+([^;\s|&]+\.js)/,
      /ts-node\s+([^;\s|&]+\.ts)/,
      /bash\s+([^;\s|&]+\.sh)/,
      /sh\s+([^;\s|&]+\.sh)/
    ];
    
    lines.forEach((line, index) => {
      // Skip comments
      if (line.trim().startsWith('#')) return;
      
      for (const pattern of sourcePatterns) {
        const match = line.match(pattern);
        if (match) {
          const scriptPath = match[1];
          this.checkIfArchived(filePath, index + 1, line, scriptPath);
        }
      }
    });
  }

  private checkIfArchived(filePath: string, lineNumber: number, line: string, importPath: string) {
    // Check various forms of the import path
    const pathsToCheck = [
      importPath,
      path.basename(importPath),
      importPath.replace(/^\.\//, ''),
      importPath.replace(/^\.\.\//, ''),
      importPath.replace(/^\.\.\/\.\.\//, '')
    ];
    
    for (const checkPath of pathsToCheck) {
      const archivedScript = this.archivedScripts.get(checkPath);
      
      if (archivedScript) {
        this.brokenImports.push({
          file_path: filePath,
          line_number: lineNumber,
          import_statement: line.trim(),
          archived_script: archivedScript.original_path,
          archive_info: {
            archive_id: archivedScript.archive_id,
            archive_date: new Date(archivedScript.archive_date),
            archive_reason: archivedScript.archive_reason
          }
        });
        break;
      }
    }
  }

  private generateReport() {
    console.log('📝 Import Validation Report');
    console.log('=' .repeat(80));
    
    if (this.brokenImports.length === 0) {
      console.log('\n✅ SUCCESS: No broken imports found!');
      console.log('\nAll imports are valid. The archived scripts are not referenced by any active code.\n');
      return;
    }
    
    console.log(`\n⚠️  WARNING: Found ${this.brokenImports.length} broken imports\n`);
    
    // Group by archived script
    const byScript = new Map<string, BrokenImport[]>();
    this.brokenImports.forEach(bi => {
      const existing = byScript.get(bi.archived_script) || [];
      existing.push(bi);
      byScript.set(bi.archived_script, existing);
    });
    
    // Display grouped results
    byScript.forEach((imports, scriptPath) => {
      const firstImport = imports[0];
      console.log(`\n📄 Archived Script: ${scriptPath}`);
      console.log(`   Archive ID: ${firstImport.archive_info?.archive_id}`);
      console.log(`   Archive Date: ${firstImport.archive_info?.archive_date.toLocaleDateString()}`);
      console.log(`   Reason: ${firstImport.archive_info?.archive_reason}`);
      console.log(`   Referenced in ${imports.length} file(s):\n`);
      
      imports.forEach(imp => {
        console.log(`     ${imp.file_path}:${imp.line_number}`);
        console.log(`     > ${imp.import_statement}`);
        console.log('');
      });
    });
    
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('1. Review each broken import to determine if:');
    console.log('   - The import can be safely removed (dead code)');
    console.log('   - The archived script needs to be restored');
    console.log('   - The import should be updated to a different script');
    console.log('\n2. To restore a specific script:');
    console.log('   ./scripts/cli-pipeline/deprecation/deprecation-cli.sh restore-script --path <original-path>');
    console.log('\n3. To restore all scripts from an archive:');
    console.log('   ./scripts/cli-pipeline/deprecation/deprecation-cli.sh restore-batch --archive-id <archive-id>\n');
    
    // Save detailed report
    const reportPath = path.join(
      this.projectRoot,
      'docs/script-reports',
      `import-validation-${new Date().toISOString().split('T')[0]}.json`
    );
    
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify({
      validation_date: new Date().toISOString(),
      total_files_checked: this.brokenImports.length > 0 ? 'multiple' : 'all',
      broken_imports_count: this.brokenImports.length,
      broken_imports: this.brokenImports,
      grouped_by_script: Object.fromEntries(byScript)
    }, null, 2));
    
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }
}

// Run the validator
if (require.main === module) {
  const validator = new ImportValidator();
  validator.validate().catch(console.error);
}