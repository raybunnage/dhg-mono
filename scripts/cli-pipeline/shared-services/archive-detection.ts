#!/usr/bin/env ts-node

/**
 * Archive Detection Tool - Identify old/unused code for archival
 * Implements the strategy outlined in CODE_ARCHIVAL_STRATEGY.md
 */

import * as fs from 'fs';
import * as path from 'path';

interface ArchivalCandidate {
  path: string;
  type: 'file' | 'directory';
  reason: string;
  confidence: number;
  lastModified: Date;
  usageCount: number;
  isDuplicate: boolean;
  category: 'immediate' | 'review' | 'keep';
}

class ArchivalDetector {
  private projectRoot: string;
  private candidates: ArchivalCandidate[] = [];
  
  constructor() {
    this.projectRoot = path.resolve(__dirname, '../../..');
  }
  
  async detect(): Promise<void> {
    console.log('🔍 Archive Detection Tool - Identifying old/unused code\n');
    console.log('📋 Based on strategy from CODE_ARCHIVAL_STRATEGY.md\n');
    
    // Scan different areas of the codebase
    await this.scanScripts();
    await this.scanServices();
    await this.scanDocumentation();
    await this.scanApps();
    
    // Categorize candidates
    this.categorizeCandidates();
    
    // Generate report
    this.generateReport();
  }
  
  private async scanScripts(): Promise<void> {
    console.log('📁 Scanning scripts directory...');
    
    const scriptsDir = path.join(this.projectRoot, 'scripts');
    if (!fs.existsSync(scriptsDir)) return;
    
    const this_ = this;
    
    function scanDirectory(dir: string, depth: number = 0): void {
      if (depth > 3) return; // Prevent deep recursion
      
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      entries.forEach(entry => {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(this_.projectRoot, fullPath);
        
        if (entry.isDirectory()) {
          // Check for directories with archival indicators
          if (this_.isArchivalDirectory(entry.name)) {
            this_.addCandidate({
              path: relativePath,
              type: 'directory',
              reason: 'Directory name indicates old/backup code',
              confidence: 90,
              lastModified: fs.statSync(fullPath).mtime,
              usageCount: 0,
              isDuplicate: false,
              category: 'immediate'
            });
          } else {
            scanDirectory(fullPath, depth + 1);
          }
        } else if (entry.isFile() && entry.name.endsWith('.ts')) {
          this_.analyzeScriptFile(fullPath, relativePath);
        }
      });
    }
    
    scanDirectory(scriptsDir);
  }
  
  private async scanServices(): Promise<void> {
    console.log('🔧 Scanning services directory...');
    
    const servicesDir = path.join(this.projectRoot, 'packages/shared/services');
    if (!fs.existsSync(servicesDir)) return;
    
    const entries = fs.readdirSync(servicesDir, { withFileTypes: true });
    
    entries.forEach(entry => {
      if (entry.isDirectory()) {
        const servicePath = path.join(servicesDir, entry.name);
        const relativePath = path.relative(this.projectRoot, servicePath);
        this.analyzeServiceDirectory(servicePath, relativePath, entry.name);
      }
    });
  }
  
  private async scanDocumentation(): Promise<void> {
    console.log('📚 Scanning documentation...');
    
    const docsDir = path.join(this.projectRoot, 'docs');
    if (!fs.existsSync(docsDir)) return;
    
    const this_ = this;
    
    function scanDocs(dir: string): void {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      entries.forEach(entry => {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(this_.projectRoot, fullPath);
        
        if (entry.isDirectory()) {
          if (entry.name.startsWith('.archive') || entry.name.includes('old')) {
            this_.addCandidate({
              path: relativePath,
              type: 'directory',
              reason: 'Archive directory or old documentation',
              confidence: 85,
              lastModified: fs.statSync(fullPath).mtime,
              usageCount: 0,
              isDuplicate: false,
              category: 'immediate'
            });
          } else {
            scanDocs(fullPath);
          }
        } else if (entry.name.endsWith('.md')) {
          this_.analyzeDocumentationFile(fullPath, relativePath);
        }
      });
    }
    
    scanDocs(docsDir);
  }
  
  private async scanApps(): Promise<void> {
    console.log('📱 Scanning apps directory...');
    
    const appsDir = path.join(this.projectRoot, 'apps');
    if (!fs.existsSync(appsDir)) return;
    
    const entries = fs.readdirSync(appsDir, { withFileTypes: true });
    
    entries.forEach(entry => {
      if (entry.isDirectory()) {
        const appPath = path.join(appsDir, entry.name);
        const relativePath = path.relative(this.projectRoot, appPath);
        this.analyzeAppDirectory(appPath, relativePath, entry.name);
      }
    });
  }
  
  private analyzeScriptFile(fullPath: string, relativePath: string): void {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const stats = fs.statSync(fullPath);
    const fileName = path.basename(fullPath);
    
    let confidence = 0;
    const reasons: string[] = [];
    
    // Check file name indicators
    if (this.hasArchivalFileIndicators(fileName)) {
      confidence += 40;
      reasons.push('File name indicates old/backup code');
    }
    
    // Check content indicators
    if (content.includes('// TODO: Remove') || content.includes('// DEPRECATED')) {
      confidence += 30;
      reasons.push('Marked for removal or deprecated');
    }
    
    if (content.includes('PLACEHOLDER') || content.includes('// OLD:')) {
      confidence += 25;
      reasons.push('Contains placeholder or old code markers');
    }
    
    // Check for very old files with no recent activity
    const daysSinceModified = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceModified > 90) {
      confidence += 20;
      reasons.push(`Not modified for ${Math.floor(daysSinceModified)} days`);
    }
    
    // Check file size (very small files might be stubs)
    if (stats.size < 200) {
      confidence += 15;
      reasons.push('Very small file (likely stub)');
    }
    
    // Check for duplicate functionality
    if (this.isDuplicateScript(content, fileName)) {
      confidence += 30;
      reasons.push('Appears to be duplicate of existing functionality');
    }
    
    if (confidence >= 50) {
      this.addCandidate({
        path: relativePath,
        type: 'file',
        reason: reasons.join(', '),
        confidence,
        lastModified: stats.mtime,
        usageCount: this.estimateUsage(content),
        isDuplicate: this.isDuplicateScript(content, fileName),
        category: confidence >= 80 ? 'immediate' : 'review'
      });
    }
  }
  
  private analyzeServiceDirectory(fullPath: string, relativePath: string, serviceName: string): void {
    const indexPath = path.join(fullPath, 'index.ts');
    const hasIndex = fs.existsSync(indexPath);
    
    let confidence = 0;
    const reasons: string[] = [];
    
    // Check if service appears unused
    if (!hasIndex) {
      confidence += 20;
      reasons.push('No index.ts file');
    }
    
    // Check for test/mock services
    if (serviceName.includes('test') || serviceName.includes('mock') || serviceName.includes('example')) {
      confidence += 40;
      reasons.push('Test/mock/example service');
    }
    
    // Check if it's a known duplicate pattern
    const duplicatePatterns = [
      'GoogleDriveService', 'GoogleDriveBrowser', 'GoogleSync',
      'SupabaseClient', 'SupabaseService', 'SupabaseAdapter',
      'AuthService', 'LightAuth', 'BrowserAuth'
    ];
    
    if (duplicatePatterns.some(pattern => serviceName.includes(pattern))) {
      confidence += 25;
      reasons.push('Known duplicate service pattern');
    }
    
    if (confidence >= 40) {
      const stats = fs.statSync(fullPath);
      this.addCandidate({
        path: relativePath,
        type: 'directory',
        reason: reasons.join(', '),
        confidence,
        lastModified: stats.mtime,
        usageCount: 0,
        isDuplicate: confidence >= 60,
        category: confidence >= 70 ? 'immediate' : 'review'
      });
    }
  }
  
  private analyzeDocumentationFile(fullPath: string, relativePath: string): void {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const stats = fs.statSync(fullPath);
    const fileName = path.basename(fullPath);
    
    let confidence = 0;
    const reasons: string[] = [];
    
    // Check for obvious archive indicators
    if (fileName.includes('old') || fileName.includes('backup') || fileName.includes('temp')) {
      confidence += 50;
      reasons.push('File name indicates old documentation');
    }
    
    // Check content for deprecation markers
    if (content.includes('DEPRECATED') || content.includes('NO LONGER USED')) {
      confidence += 40;
      reasons.push('Marked as deprecated');
    }
    
    // Check for very old documentation
    const daysSinceModified = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceModified > 180) {
      confidence += 30;
      reasons.push(`Not updated for ${Math.floor(daysSinceModified)} days`);
    }
    
    if (confidence >= 60) {
      this.addCandidate({
        path: relativePath,
        type: 'file',
        reason: reasons.join(', '),
        confidence,
        lastModified: stats.mtime,
        usageCount: 0,
        isDuplicate: false,
        category: confidence >= 80 ? 'immediate' : 'review'
      });
    }
  }
  
  private analyzeAppDirectory(fullPath: string, relativePath: string, appName: string): void {
    // Check if app appears to be a prototype or experiment
    let confidence = 0;
    const reasons: string[] = [];
    
    if (appName.includes('test') || appName.includes('experiment') || appName.includes('proto')) {
      confidence += 60;
      reasons.push('App name suggests prototype/test application');
    }
    
    // Check if package.json exists
    const packageJsonPath = path.join(fullPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      confidence += 30;
      reasons.push('No package.json found');
    } else {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        if (packageJson.name && packageJson.name.includes('template')) {
          confidence += 40;
          reasons.push('Appears to be a template app');
        }
      } catch (e) {
        confidence += 20;
        reasons.push('Invalid package.json');
      }
    }
    
    if (confidence >= 50) {
      const stats = fs.statSync(fullPath);
      this.addCandidate({
        path: relativePath,
        type: 'directory',
        reason: reasons.join(', '),
        confidence,
        lastModified: stats.mtime,
        usageCount: 0,
        isDuplicate: false,
        category: confidence >= 70 ? 'immediate' : 'review'
      });
    }
  }
  
  private isArchivalDirectory(name: string): boolean {
    const archivalIndicators = [
      'old', 'backup', 'temp', 'deprecated', 'unused', 'archive',
      '.archived', 'legacy', 'prototype', 'experimental'
    ];
    
    return archivalIndicators.some(indicator => 
      name.toLowerCase().includes(indicator)
    );
  }
  
  private hasArchivalFileIndicators(fileName: string): boolean {
    const indicators = [
      'old', 'backup', 'temp', 'copy', 'bak', 'deprecated',
      'unused', 'legacy', 'test-', '-test', 'example'
    ];
    
    return indicators.some(indicator => 
      fileName.toLowerCase().includes(indicator)
    );
  }
  
  private isDuplicateScript(content: string, fileName: string): boolean {
    // Simple heuristic: check if it's doing similar things to other scripts
    const functionalityIndicators = [
      'google-drive', 'supabase', 'auth', 'document', 'classification'
    ];
    
    return functionalityIndicators.some(indicator => 
      fileName.toLowerCase().includes(indicator) && 
      content.includes('export') &&
      content.length < 1000 // Small files more likely to be duplicates
    );
  }
  
  private estimateUsage(content: string): number {
    // Very simple usage estimation
    const exportCount = (content.match(/export/g) || []).length;
    const importCount = (content.match(/import.*from/g) || []).length;
    
    return exportCount + importCount;
  }
  
  private addCandidate(candidate: ArchivalCandidate): void {
    this.candidates.push(candidate);
  }
  
  private categorizeCandidates(): void {
    // Re-categorize based on confidence scores
    this.candidates.forEach(candidate => {
      if (candidate.confidence >= 80) {
        candidate.category = 'immediate';
      } else if (candidate.confidence >= 50) {
        candidate.category = 'review';
      } else {
        candidate.category = 'keep';
      }
    });
  }
  
  private generateReport(): void {
    console.log('\n📊 Archive Detection Results\n');
    
    const immediate = this.candidates.filter(c => c.category === 'immediate');
    const review = this.candidates.filter(c => c.category === 'review');
    const total = this.candidates.length;
    
    console.log(`🎯 Summary:`);
    console.log(`  Total candidates: ${total}`);
    console.log(`  Immediate archive: ${immediate.length}`);
    console.log(`  Review required: ${review.length}`);
    console.log('');
    
    if (immediate.length > 0) {
      console.log('🗑️  IMMEDIATE ARCHIVE (High Confidence >= 80%):');
      immediate.forEach(candidate => {
        const age = Math.floor((Date.now() - candidate.lastModified.getTime()) / (1000 * 60 * 60 * 24));
        console.log(`  📁 ${candidate.path}`);
        console.log(`     Reason: ${candidate.reason}`);
        console.log(`     Confidence: ${candidate.confidence}% | Age: ${age} days | Type: ${candidate.type}`);
        console.log('');
      });
    }
    
    if (review.length > 0) {
      console.log('🔍 REVIEW REQUIRED (Medium Confidence 50-79%):');
      review.forEach(candidate => {
        const age = Math.floor((Date.now() - candidate.lastModified.getTime()) / (1000 * 60 * 60 * 24));
        console.log(`  📁 ${candidate.path}`);
        console.log(`     Reason: ${candidate.reason}`);
        console.log(`     Confidence: ${candidate.confidence}% | Age: ${age} days | Type: ${candidate.type}`);
        console.log('');
      });
    }
    
    console.log('💡 Next Steps:');
    console.log('  1. Review immediate archive candidates');
    console.log('  2. Execute archival: ./continuous-cli.sh archive-execute');
    console.log('  3. Run continuous improvement on clean codebase');
    console.log('  4. Set up regular archival before improvement cycles');
  }
}

// Run archive detection
const detector = new ArchivalDetector();
detector.detect().catch(console.error);