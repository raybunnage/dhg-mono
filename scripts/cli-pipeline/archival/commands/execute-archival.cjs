#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

class ArchivalExecutor {
  constructor() {
    this.projectRoot = process.cwd();
    this.manifest = null;
    this.archivePath = '';
    this.manifestPath = '';
    this.errors = [];
    this.successes = [];
  }

  async loadManifest(manifestPath) {
    try {
      this.manifest = await fs.readJson(manifestPath);
      this.manifestPath = path.join(this.archivePath, 'ARCHIVE_MANIFEST.json');
      console.log(`📋 Loaded manifest with ${this.manifest.toArchive.length} items to archive\n`);
    } catch (err) {
      throw new Error(`Failed to load manifest: ${err.message}`);
    }
  }

  async prepareArchiveDirectory() {
    this.archivePath = path.join(this.projectRoot, this.manifest.archivePath);
    
    // Create archive directory structure
    await fs.ensureDir(this.archivePath);
    await fs.ensureDir(path.join(this.archivePath, 'services'));
    await fs.ensureDir(path.join(this.archivePath, 'scripts'));
    await fs.ensureDir(path.join(this.archivePath, 'packages'));
    await fs.ensureDir(path.join(this.archivePath, 'apps'));
    await fs.ensureDir(path.join(this.archivePath, 'other'));
    
    console.log(`📁 Created archive directory: ${this.archivePath}\n`);
  }

  async createArchiveManifest() {
    const archiveManifest = {
      ...this.manifest,
      executedAt: new Date().toISOString(),
      executedBy: process.env.USER || 'unknown',
      gitCommit: this.getGitCommit(),
      recoveryInstructions: `
# Recovery Instructions

To restore any archived file:

1. Navigate to the archive directory:
   cd ${this.archivePath}

2. Find the file you want to restore

3. Copy it back to its original location:
   cp <archived-file> <original-location>

4. If the file was part of a refactoring, ensure you're using the correct version

5. Update any imports or references as needed

## Full Archive Restoration

To restore the entire archive:
   cp -r ${this.archivePath}/* .

Note: Be careful not to overwrite newer versions of files.
`,
      archivedItems: []
    };

    // Save initial manifest
    await fs.writeJson(this.manifestPath, archiveManifest, { spaces: 2 });
    return archiveManifest;
  }

  getGitCommit() {
    try {
      return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  async archiveFile(item, dryRun = false) {
    const sourcePath = path.join(this.projectRoot, item.path);
    const archiveSubDir = this.getArchiveSubDir(item);
    const destDir = path.join(this.archivePath, archiveSubDir, path.dirname(item.path));
    const destPath = path.join(destDir, path.basename(item.path));

    try {
      // Check if source exists
      const exists = await fs.pathExists(sourcePath);
      if (!exists) {
        throw new Error('Source file does not exist');
      }

      if (dryRun) {
        console.log(`[DRY RUN] Would archive: ${item.path} → ${destPath.replace(this.projectRoot + '/', '')}`);
        return { success: true, dryRun: true };
      }

      // Create destination directory
      await fs.ensureDir(destDir);

      // Move the file
      await fs.move(sourcePath, destPath, { overwrite: false });
      
      console.log(`✅ Archived: ${item.path}`);
      this.successes.push(item.path);

      return {
        success: true,
        originalPath: item.path,
        archivedPath: destPath.replace(this.projectRoot + '/', ''),
        timestamp: new Date().toISOString()
      };

    } catch (err) {
      console.error(`❌ Failed to archive ${item.path}: ${err.message}`);
      this.errors.push({ path: item.path, error: err.message });
      return {
        success: false,
        originalPath: item.path,
        error: err.message
      };
    }
  }

  getArchiveSubDir(item) {
    // Organize by type and maintain some directory structure
    if (item.type === 'service') return 'services';
    if (item.type === 'script') return 'scripts';
    if (item.type === 'package') return 'packages';
    if (item.path.startsWith('apps/')) return 'apps';
    return 'other';
  }

  async executeArchival(dryRun = false) {
    console.log(`🚀 ${dryRun ? 'DRY RUN - ' : ''}Starting archival process...\n`);

    if (!dryRun) {
      await this.prepareArchiveDirectory();
      await this.createArchiveManifest();
    }

    // Archive each file
    const results = [];
    for (const item of this.manifest.toArchive) {
      const result = await this.archiveFile(item, dryRun);
      results.push(result);
    }

    // Update manifest with results
    if (!dryRun && this.manifestPath) {
      const finalManifest = await fs.readJson(this.manifestPath);
      finalManifest.archivedItems = results;
      finalManifest.summary = {
        totalAttempted: this.manifest.toArchive.length,
        successful: this.successes.length,
        failed: this.errors.length
      };
      await fs.writeJson(this.manifestPath, finalManifest, { spaces: 2 });
    }

    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log(`📊 ARCHIVAL ${dryRun ? 'DRY RUN ' : ''}SUMMARY`);
    console.log('='.repeat(80));
    console.log(`Total items processed: ${this.manifest.toArchive.length}`);
    
    if (!dryRun) {
      console.log(`Successfully archived: ${this.successes.length}`);
      console.log(`Failed: ${this.errors.length}`);
      console.log(`Archive location: ${this.archivePath}`);
      console.log(`Manifest: ${this.manifestPath}`);
      
      if (this.errors.length > 0) {
        console.log('\n❌ Errors:');
        this.errors.forEach(e => console.log(`   ${e.path}: ${e.error}`));
      }
    }

    // Create a summary file
    if (!dryRun && this.successes.length > 0) {
      const summaryPath = path.join(this.archivePath, 'ARCHIVE_SUMMARY.txt');
      const summary = `Archive Summary
===============
Date: ${new Date().toISOString()}
Phase: ${this.manifest.phase}
Total Files: ${this.successes.length}
Total Size: ${(this.manifest.stats.totalSize / 1048576).toFixed(2)} MB

Files Archived:
${this.successes.map(f => `- ${f}`).join('\n')}

To restore files, see ARCHIVE_MANIFEST.json for instructions.
`;
      await fs.writeFile(summaryPath, summary);
    }

    return {
      success: this.errors.length === 0,
      archived: this.successes.length,
      failed: this.errors.length
    };
  }

  async verifyArchival() {
    console.log('\n🔍 Verifying archival...\n');

    let allGood = true;

    for (const item of this.manifest.toArchive) {
      const originalPath = path.join(this.projectRoot, item.path);
      const archiveSubDir = this.getArchiveSubDir(item);
      const archivedPath = path.join(
        this.archivePath,
        archiveSubDir,
        item.path
      );

      const originalExists = await fs.pathExists(originalPath);
      const archivedExists = await fs.pathExists(archivedPath);

      if (originalExists) {
        console.log(`⚠️  Original still exists: ${item.path}`);
        allGood = false;
      }
      if (!archivedExists) {
        console.log(`❌ Not found in archive: ${item.path}`);
        allGood = false;
      }
      if (!originalExists && archivedExists) {
        console.log(`✅ Verified: ${item.path}`);
      }
    }

    if (allGood) {
      console.log('\n✅ All files successfully archived!');
    } else {
      console.log('\n⚠️  Some issues found - please review above');
    }

    return allGood;
  }
}

// CLI setup
const program = new Command();

program
  .name('execute-archival')
  .description('Execute archival based on manifest')
  .requiredOption('--manifest <path>', 'Archival manifest JSON file')
  .option('--dry-run', 'Show what would be done without archiving')
  .option('--verify', 'Verify archival after execution')
  .action(async (options) => {
    const executor = new ArchivalExecutor();
    
    try {
      // Load manifest
      await executor.loadManifest(options.manifest);
      
      // Execute archival
      const result = await executor.executeArchival(options.dryRun);
      
      // Verify if requested
      if (!options.dryRun && options.verify) {
        await executor.verifyArchival();
      }
      
      process.exit(result.success ? 0 : 1);
    } catch (err) {
      console.error(`\n❌ Error: ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);