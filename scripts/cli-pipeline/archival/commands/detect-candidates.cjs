#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');

class ArchivalDetector {
  constructor() {
    this.projectRoot = process.cwd();
    this.candidates = [];
    this.excludePatterns = [
      '**/node_modules/**',
      '**/.git/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/.archived/**',
      '**/coverage/**'
    ];
  }

  async detectPhaseA() {
    console.log('🔍 Detecting Phase A candidates (high confidence)...\n');
    
    // Phase A: High confidence targets
    await this.findFilesWithPattern('**/*.{old,backup,broken,tmp,temp}', 'Has obsolete extension', 'high');
    await this.findRefactoredPairs();
    await this.findDatedFiles();
    await this.findDeprecatedFiles();
    
    return this.candidates;
  }

  async findFilesWithPattern(pattern, reason, confidence) {
    try {
      const files = glob.sync(pattern, {
        cwd: this.projectRoot,
        ignore: this.excludePatterns,
        nodir: true
      });

      for (const file of files) {
      const fullPath = path.join(this.projectRoot, file);
      const stats = await fs.stat(fullPath);
      
      this.candidates.push({
        path: file,
        type: this.determineType(file),
        reason,
        confidence,
        lastModified: stats.mtime,
        size: stats.size
      });
    }
    } catch (error) {
      console.error(`Error processing pattern ${pattern}:`, error);
    }
  }

  async findRefactoredPairs() {
    // Find files that have both original and refactored versions
    const allFiles = glob.sync('**/*.{ts,js,tsx,jsx}', {
      cwd: this.projectRoot,
      ignore: this.excludePatterns,
      nodir: true
    });

    const fileMap = new Map();
    
    for (const file of allFiles) {
      const basename = path.basename(file, path.extname(file));
      const dir = path.dirname(file);
      const key = `${dir}/${basename}`;
      
      if (!fileMap.has(key)) {
        fileMap.set(key, []);
      }
      fileMap.get(key).push(file);
    }

    // Look for refactored patterns
    for (const [key, files] of fileMap) {
      if (files.length > 1) {
        // Check for patterns like: service.ts and service.refactored.ts
        for (const file of files) {
          if (file.includes('.refactored.') || file.includes('-refactored.')) {
            const stats = await fs.stat(path.join(this.projectRoot, file));
            const originalFile = files.find(f => !f.includes('refactored'));
            
            this.candidates.push({
              path: file,
              type: this.determineType(file),
              reason: 'Refactored version exists - original may be obsolete',
              confidence: 'high',
              lastModified: stats.mtime,
              size: stats.size,
              duplicateOf: originalFile
            });
          }
        }
      }
    }
  }

  async findDatedFiles() {
    // Find files with dates in their names (e.g., backup-2024-01-01.ts)
    const datePatterns = [
      '**/*[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*',
      '**/*[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]*',
      '**/*[0-9][0-9][0-9][0-9][0-9][0-9]*'
    ];

    for (const pattern of datePatterns) {
      const files = glob.sync(pattern, {
        cwd: this.projectRoot,
        ignore: this.excludePatterns,
        nodir: true
      });

      for (const file of files) {
        const stats = await fs.stat(path.join(this.projectRoot, file));
        
        // Check if the date is old (> 30 days)
        const daysSinceModified = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceModified > 30) {
          this.candidates.push({
            path: file,
            type: this.determineType(file),
            reason: `Dated file (${Math.floor(daysSinceModified)} days old)`,
            confidence: 'high',
            lastModified: stats.mtime,
            size: stats.size
          });
        }
      }
    }
  }

  async findDeprecatedFiles() {
    // Find files with deprecated/obsolete markers
    const deprecatedPatterns = [
      '**/*deprecated*',
      '**/*obsolete*',
      '**/*legacy*',
      '**/*DO_NOT_USE*'
    ];

    for (const pattern of deprecatedPatterns) {
      await this.findFilesWithPattern(pattern, 'Filename indicates deprecated/obsolete', 'high');
    }
  }

  determineType(filePath) {
    if (filePath.includes('/services/') || filePath.endsWith('Service.ts')) return 'service';
    if (filePath.includes('/scripts/') || filePath.includes('/cli-pipeline/')) return 'script';
    if (filePath.endsWith('-cli.sh') || filePath.endsWith('-cli.ts')) return 'pipeline';
    if (filePath.includes('/packages/')) return 'package';
    return 'other';
  }

  formatOutput(candidates) {
    if (candidates.length === 0) {
      console.log('✅ No archival candidates found for Phase A\n');
      return;
    }

    console.log(`\n📊 Found ${candidates.length} archival candidates:\n`);

    // Group by type
    const byType = candidates.reduce((acc, c) => {
      if (!acc[c.type]) acc[c.type] = [];
      acc[c.type].push(c);
      return acc;
    }, {});

    for (const [type, items] of Object.entries(byType)) {
      console.log(`\n${type.toUpperCase()} (${items.length}):`);
      console.log('─'.repeat(80));
      
      for (const item of items) {
        const sizeKB = (item.size / 1024).toFixed(1);
        const days = Math.floor((Date.now() - item.lastModified.getTime()) / (1000 * 60 * 60 * 24));
        
        console.log(`📄 ${item.path}`);
        console.log(`   Reason: ${item.reason}`);
        console.log(`   Confidence: ${item.confidence}`);
        console.log(`   Size: ${sizeKB} KB | Last modified: ${days} days ago`);
        if (item.duplicateOf) {
          console.log(`   Duplicate of: ${item.duplicateOf}`);
        }
        console.log('');
      }
    }

    // Summary statistics
    const totalSize = candidates.reduce((sum, c) => sum + c.size, 0);
    console.log('\n📈 Summary:');
    console.log(`   Total files: ${candidates.length}`);
    console.log(`   Total size: ${(totalSize / 1048576).toFixed(2)} MB`);
    console.log(`   High confidence: ${candidates.filter(c => c.confidence === 'high').length}`);
    console.log(`   Types: ${Object.keys(byType).join(', ')}`);
  }

  async saveResults(candidates, outputPath) {
    const output = {
      timestamp: new Date().toISOString(),
      phase: 'A',
      totalCandidates: candidates.length,
      totalSizeBytes: candidates.reduce((sum, c) => sum + c.size, 0),
      candidates: candidates.sort((a, b) => b.size - a.size)
    };

    await fs.writeJson(outputPath, output, { spaces: 2 });
    console.log(`\n💾 Results saved to: ${outputPath}`);
  }
}

// CLI setup
const program = new Command();

program
  .name('detect-candidates')
  .description('Detect files for archival')
  .requiredOption('--phase <phase>', 'Archival phase (a, b, or c)')
  .option('--confidence <level>', 'Minimum confidence level', 'high')
  .option('--output <path>', 'Output JSON file path')
  .option('--dry-run', 'Show what would be detected without saving')
  .action(async (options) => {
    const detector = new ArchivalDetector();
    
    let candidates = [];
    
    switch (options.phase.toLowerCase()) {
      case 'a':
        candidates = await detector.detectPhaseA();
        break;
      case 'b':
      case 'c':
        console.log(`Phase ${options.phase.toUpperCase()} not yet implemented`);
        process.exit(0);
        break;
      default:
        console.error('Invalid phase. Use a, b, or c');
        process.exit(1);
    }

    // Filter by confidence if needed
    if (options.confidence !== 'high') {
      const confidenceLevels = ['low', 'medium', 'high'];
      const minLevel = confidenceLevels.indexOf(options.confidence);
      candidates = candidates.filter(c => 
        confidenceLevels.indexOf(c.confidence) >= minLevel
      );
    }

    detector.formatOutput(candidates);

    if (!options.dryRun && options.output) {
      await detector.saveResults(candidates, options.output);
    }
  });

program.parse(process.argv);