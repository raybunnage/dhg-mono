#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');

class ArchivalReviewer {
  constructor() {
    this.projectRoot = process.cwd();
    this.candidates = [];
    this.decisions = [];
  }

  async loadCandidates(inputPath) {
    if (inputPath) {
      // Load from file
      const data = await fs.readJson(inputPath);
      this.candidates = data.candidates || [];
      console.log(`📄 Loaded ${this.candidates.length} candidates from ${inputPath}\n`);
    } else {
      // Run detection inline
      console.log('🔍 Running detection to find candidates...\n');
      const { ArchivalDetector } = require('./detect-candidates-lib.cjs');
      const detector = new ArchivalDetector();
      this.candidates = await detector.detectPhaseA();
    }
  }

  async reviewInteractive() {
    console.log('📋 ARCHIVAL REVIEW SESSION');
    console.log('=' .repeat(80));
    console.log('Review each candidate and decide: [a]rchive, [s]kip, [q]uit\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

    for (let i = 0; i < this.candidates.length; i++) {
      const candidate = this.candidates[i];
      console.clear();
      console.log(`\n📄 CANDIDATE ${i + 1}/${this.candidates.length}`);
      console.log('─'.repeat(80));
      await this.displayCandidate(candidate);
      
      const answer = await question('\nDecision ([a]rchive/[s]kip/[q]uit/[v]iew file): ');
      
      switch (answer.toLowerCase()) {
        case 'a':
          this.decisions.push({ ...candidate, decision: 'archive' });
          console.log('✅ Marked for archival');
          break;
        case 's':
          this.decisions.push({ ...candidate, decision: 'skip' });
          console.log('⏭️  Skipped');
          break;
        case 'v':
          await this.viewFile(candidate.path);
          i--; // Re-show the same candidate
          break;
        case 'q':
          console.log('\n👋 Review session ended');
          rl.close();
          return;
        default:
          console.log('❓ Invalid choice, skipping...');
          this.decisions.push({ ...candidate, decision: 'skip' });
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    rl.close();
    console.log('\n✅ Review completed!');
  }

  async displayCandidate(candidate) {
    const fullPath = path.join(this.projectRoot, candidate.path);
    const exists = await fs.pathExists(fullPath);
    const sizeKB = (candidate.size / 1024).toFixed(1);
    const days = Math.floor((Date.now() - new Date(candidate.lastModified).getTime()) / (1000 * 60 * 60 * 24));

    console.log(`Path: ${candidate.path}`);
    console.log(`Type: ${candidate.type}`);
    console.log(`Reason: ${candidate.reason}`);
    console.log(`Confidence: ${candidate.confidence}`);
    console.log(`Size: ${sizeKB} KB`);
    console.log(`Last modified: ${days} days ago`);
    console.log(`File exists: ${exists ? '✅' : '❌'}`);
    
    if (candidate.duplicateOf) {
      console.log(`Duplicate of: ${candidate.duplicateOf}`);
    }

    // Show file preview if small enough
    if (exists && candidate.size < 5000) {
      try {
        const content = await fs.readFile(fullPath, 'utf8');
        const lines = content.split('\n').slice(0, 10);
        console.log('\n📝 Preview (first 10 lines):');
        console.log('─'.repeat(40));
        lines.forEach((line, idx) => {
          console.log(`${(idx + 1).toString().padStart(3)} | ${line.substring(0, 70)}`);
        });
        if (content.split('\n').length > 10) {
          console.log('    | ... (file continues)');
        }
      } catch (err) {
        console.log('\n⚠️  Could not read file preview');
      }
    }
  }

  async viewFile(filePath) {
    const fullPath = path.join(this.projectRoot, filePath);
    try {
      const content = await fs.readFile(fullPath, 'utf8');
      console.log('\n📄 FULL FILE CONTENT:');
      console.log('─'.repeat(80));
      console.log(content);
      console.log('─'.repeat(80));
      console.log('\nPress Enter to continue...');
      await new Promise(resolve => process.stdin.once('data', resolve));
    } catch (err) {
      console.log(`\n❌ Error reading file: ${err.message}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  reviewBatch() {
    // Non-interactive batch review - mark all high confidence for archival
    console.log('🤖 Batch review mode - auto-approving high confidence candidates\n');
    
    for (const candidate of this.candidates) {
      if (candidate.confidence === 'high') {
        this.decisions.push({ ...candidate, decision: 'archive' });
        console.log(`✅ Auto-approved: ${candidate.path}`);
      } else {
        this.decisions.push({ ...candidate, decision: 'skip' });
        console.log(`⏭️  Auto-skipped: ${candidate.path} (confidence: ${candidate.confidence})`);
      }
    }
  }

  async saveManifest(outputPath) {
    const toArchive = this.decisions.filter(d => d.decision === 'archive');
    const skipped = this.decisions.filter(d => d.decision === 'skip');
    
    const manifest = {
      timestamp: new Date().toISOString(),
      phase: 'A',
      reviewedBy: process.env.USER || 'unknown',
      stats: {
        totalReviewed: this.decisions.length,
        toArchive: toArchive.length,
        skipped: skipped.length,
        totalSize: toArchive.reduce((sum, c) => sum + c.size, 0)
      },
      archiveDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      archivePath: `.archived/${new Date().toISOString().split('T')[0]}_phase_a_cleanup`,
      toArchive: toArchive,
      skipped: skipped
    };

    await fs.writeJson(outputPath, manifest, { spaces: 2 });
    console.log(`\n💾 Manifest saved to: ${outputPath}`);
    
    // Display summary
    console.log('\n📊 Review Summary:');
    console.log(`   Total reviewed: ${manifest.stats.totalReviewed}`);
    console.log(`   Marked for archival: ${manifest.stats.toArchive}`);
    console.log(`   Skipped: ${manifest.stats.skipped}`);
    console.log(`   Total size to archive: ${(manifest.stats.totalSize / 1048576).toFixed(2)} MB`);
    console.log(`   Archive path: ${manifest.archivePath}`);
  }
}

// Create library version for reuse
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
    const glob = require('glob');
    
    // Phase A: High confidence targets
    await this.findFilesWithPattern('**/*.{old,backup,broken,tmp,temp}', 'Has obsolete extension', 'high');
    await this.findFilesWithPattern('**/*deprecated*', 'Filename indicates deprecated/obsolete', 'high');
    await this.findFilesWithPattern('**/*obsolete*', 'Filename indicates deprecated/obsolete', 'high');
    await this.findFilesWithPattern('**/*legacy*', 'Filename indicates deprecated/obsolete', 'high');
    
    return this.candidates;
  }

  async findFilesWithPattern(pattern, reason, confidence) {
    const glob = require('glob');
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

  determineType(filePath) {
    if (filePath.includes('/services/') || filePath.endsWith('Service.ts')) return 'service';
    if (filePath.includes('/scripts/') || filePath.includes('/cli-pipeline/')) return 'script';
    if (filePath.endsWith('-cli.sh') || filePath.endsWith('-cli.ts')) return 'pipeline';
    if (filePath.includes('/packages/')) return 'package';
    return 'other';
  }
}

// Export for use by other commands
module.exports = { ArchivalDetector };

// CLI setup
const program = new Command();

program
  .name('review-candidates')
  .description('Review archival candidates and create manifest')
  .option('--input <path>', 'Input JSON file from detect command')
  .option('--output <path>', 'Output manifest JSON file', 'archival-manifest.json')
  .option('--interactive', 'Interactive review mode', true)
  .option('--batch', 'Batch mode - auto-approve high confidence')
  .action(async (options) => {
    const reviewer = new ArchivalReviewer();
    
    // Load candidates
    await reviewer.loadCandidates(options.input);
    
    if (reviewer.candidates.length === 0) {
      console.log('✅ No candidates to review');
      process.exit(0);
    }
    
    // Review based on mode
    if (options.batch) {
      reviewer.reviewBatch();
    } else if (options.interactive !== false) {
      await reviewer.reviewInteractive();
    }
    
    // Save manifest
    if (reviewer.decisions.length > 0) {
      await reviewer.saveManifest(options.output);
    }
  });

program.parse(process.argv);