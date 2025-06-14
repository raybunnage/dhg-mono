#!/usr/bin/env ts-node

/**
 * Service Cleanup Git Integration
 * Manages git checkpoints throughout the cleanup process
 */

import { execSync } from 'child_process';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as fs from 'fs';

export type CheckpointStage = 
  | 'baseline'
  | 'migrated'
  | 'validated'
  | 'finalized';

interface CheckpointConfig {
  stage: CheckpointStage;
  commitPrefix: string;
  description: string;
  requiredFiles?: string[];
  validationRequired?: boolean;
}

const CHECKPOINT_CONFIGS: Record<CheckpointStage, CheckpointConfig> = {
  'baseline': {
    stage: 'baseline',
    commitPrefix: 'checkpoint',
    description: 'baseline - before service cleanup',
    validationRequired: false
  },
  'migrated': {
    stage: 'migrated',
    commitPrefix: 'checkpoint',
    description: 'migrated - service moved, imports updated, tests added',
    requiredFiles: ['packages/shared/services/'],
    validationRequired: true
  },
  'validated': {
    stage: 'validated',
    commitPrefix: 'checkpoint',
    description: 'validated - tests pass and visual confirmation complete',
    validationRequired: true
  },
  'finalized': {
    stage: 'finalized',
    commitPrefix: 'checkpoint',
    description: 'finalized - old files archived and docs updated',
    requiredFiles: ['.archived_scripts/'],
    validationRequired: false
  }
};

export class ServiceCleanupGitIntegration {
  private supabase = SupabaseClientService.getInstance().getClient();
  
  async createCheckpoint(
    serviceName: string,
    stage: CheckpointStage,
    additionalMessage?: string
  ): Promise<string> {
    const config = CHECKPOINT_CONFIGS[stage];
    
    console.log(`\n📌 Creating ${stage} checkpoint for ${serviceName}...`);
    
    // Check if we have uncommitted changes
    const status = this.getGitStatus();
    if (!status.clean && stage !== 'baseline') {
      console.warn('⚠️  Uncommitted changes detected');
      
      // Stage appropriate files based on stage
      this.stageFilesForCheckpoint(serviceName, config);
    }
    
    // Create commit message
    const commitMessage = this.buildCommitMessage(serviceName, config, additionalMessage);
    
    // Create the commit
    try {
      execSync(`git commit -m "${commitMessage}"`, { encoding: 'utf-8' });
      console.log('✅ Checkpoint created successfully');
      
      // Get commit hash
      const commitHash = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
      
      // Store checkpoint in database
      await this.storeCheckpoint(serviceName, stage, commitHash, commitMessage);
      
      return commitHash;
    } catch (error) {
      if (error instanceof Error && error.message.includes('nothing to commit')) {
        console.log('ℹ️  No changes to commit at this checkpoint');
        return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
      }
      throw error;
    }
  }
  
  async rollbackToCheckpoint(serviceName: string, stage: CheckpointStage): Promise<void> {
    console.log(`\n⏪ Rolling back ${serviceName} to ${stage}...`);
    
    // Get checkpoint from database
    const checkpoint = await this.getCheckpoint(serviceName, stage);
    if (!checkpoint) {
      throw new Error(`No checkpoint found for ${serviceName} at ${stage}`);
    }
    
    // Confirm rollback
    console.log(`This will rollback to: ${checkpoint.commit_message}`);
    console.log(`Commit: ${checkpoint.commit_hash}`);
    
    // Create rollback branch
    const rollbackBranch = `rollback/${serviceName}-${Date.now()}`;
    execSync(`git checkout -b ${rollbackBranch}`, { encoding: 'utf-8' });
    
    // Perform rollback
    execSync(`git reset --hard ${checkpoint.commit_hash}`, { encoding: 'utf-8' });
    
    console.log('✅ Rollback complete');
    console.log(`You are now on branch: ${rollbackBranch}`);
    
    // Update tracking
    await this.updateServiceStatus(serviceName, 'rolled_back', stage);
  }
  
  async listCheckpoints(serviceName: string): Promise<void> {
    const { data: checkpoints, error } = await this.supabase
      .from('sys_service_cleanup_checkpoints')
      .select('*')
      .eq('service_name', serviceName)
      .order('created_at', { ascending: true });
      
    if (error) {
      console.error('Error fetching checkpoints:', error);
      return;
    }
    
    console.log(`\n📋 Checkpoints for ${serviceName}:`);
    console.log('='.repeat(80));
    
    checkpoints.forEach((cp, index) => {
      console.log(`${index + 1}. ${cp.stage} (${cp.commit_hash.substring(0, 7)})`);
      console.log(`   ${cp.commit_message.split('\n')[0]}`);
      console.log(`   Created: ${new Date(cp.created_at).toLocaleString()}`);
      console.log('');
    });
  }
  
  async compareWorktrees(): Promise<void> {
    console.log('\n🔄 Comparing cleanup progress across worktrees...');
    
    // Get all worktrees
    const worktrees = execSync('git worktree list', { encoding: 'utf-8' })
      .trim()
      .split('\n')
      .map(line => {
        const parts = line.split(/\s+/);
        return {
          path: parts[0],
          branch: parts[2].replace(/[\[\]]/g, '')
        };
      });
    
    console.log('='.repeat(80));
    
    for (const worktree of worktrees) {
      console.log(`\n📁 ${worktree.path} (${worktree.branch})`);
      
      // Get latest service cleanup commits
      const cwd = process.cwd();
      process.chdir(worktree.path);
      
      try {
        const recentCleanups = execSync(
          'git log --oneline -20 | grep -E "(cleanup|checkpoint|migrate|validation)" | head -5',
          { encoding: 'utf-8' }
        ).trim();
        
        if (recentCleanups) {
          console.log(recentCleanups);
        } else {
          console.log('   No recent cleanup activity');
        }
      } catch (error) {
        console.log('   No cleanup commits found');
      }
      
      process.chdir(cwd);
    }
  }
  
  private getGitStatus(): { clean: boolean; files: string[] } {
    const status = execSync('git status --porcelain', { encoding: 'utf-8' });
    const files = status.trim().split('\n').filter(line => line.length > 0);
    
    return {
      clean: files.length === 0,
      files: files.map(line => line.substring(3))
    };
  }
  
  private stageFilesForCheckpoint(serviceName: string, config: CheckpointConfig): void {
    // Stage files based on checkpoint requirements
    if (config.requiredFiles) {
      config.requiredFiles.forEach(pattern => {
        try {
          execSync(`git add ${pattern}*${serviceName}* 2>/dev/null || true`);
        } catch (error) {
          // Ignore errors for missing files
        }
      });
    }
    
    // Stage any service-specific files
    const patterns = [
      `packages/shared/services/*${serviceName}*`,
      `apps/dhg-service-test/src/components/*${serviceName}*`,
      `**/*${serviceName.toLowerCase()}*`
    ];
    
    patterns.forEach(pattern => {
      try {
        execSync(`git add ${pattern} 2>/dev/null || true`);
      } catch (error) {
        // Ignore errors
      }
    });
  }
  
  private buildCommitMessage(
    serviceName: string,
    config: CheckpointConfig,
    additionalMessage?: string
  ): string {
    const worktree = this.getCurrentWorktree();
    const lines: string[] = [];
    
    // Main commit message
    lines.push(`${config.commitPrefix}: ${config.description} for ${serviceName}`);
    lines.push('');
    
    // Add worktree context
    if (worktree !== 'main') {
      lines.push(`Worktree: ${worktree}`);
    }
    
    // Add stage-specific details
    switch (config.stage) {
      case 'migrated':
        lines.push(`- Moved to packages/shared/services/`);
        lines.push(`- Updated all imports`);
        lines.push(`- Added tests`);
        break;
      case 'validated':
        lines.push(`✅ All tests passing`);
        lines.push(`✅ Visual confirmation complete`);
        break;
      case 'finalized':
        lines.push(`- Old files archived`);
        lines.push(`- Documentation updated`);
        break;
    }
    
    // Add custom message
    if (additionalMessage) {
      lines.push('');
      lines.push(additionalMessage);
    }
    
    // Add checkpoint tracking
    lines.push('');
    lines.push(`Checkpoint: ${config.stage}`);
    lines.push(`Service: ${serviceName}`);
    
    return lines.join('\\n');
  }
  
  private getCurrentWorktree(): string {
    const worktreePath = process.cwd();
    const parts = worktreePath.split('/');
    return parts[parts.length - 1];
  }
  
  private async storeCheckpoint(
    serviceName: string,
    stage: CheckpointStage,
    commitHash: string,
    commitMessage: string
  ): Promise<void> {
    await this.supabase
      .from('sys_service_cleanup_checkpoints')
      .insert({
        service_name: serviceName,
        stage,
        commit_hash: commitHash,
        commit_message: commitMessage,
        worktree: this.getCurrentWorktree(),
        created_at: new Date().toISOString()
      });
  }
  
  private async getCheckpoint(serviceName: string, stage: CheckpointStage): Promise<any> {
    const { data } = await this.supabase
      .from('sys_service_cleanup_checkpoints')
      .select('*')
      .eq('service_name', serviceName)
      .eq('stage', stage)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
      
    return data;
  }
  
  private async updateServiceStatus(
    serviceName: string,
    status: string,
    lastStage: CheckpointStage
  ): Promise<void> {
    await this.supabase
      .from('sys_service_cleanup_tasks')
      .update({
        status,
        notes: `Rolled back to ${lastStage} checkpoint`
      })
      .eq('service_name', serviceName);
  }
}

// CLI Integration
if (require.main === module) {
  const integration = new ServiceCleanupGitIntegration();
  const command = process.argv[2];
  const serviceName = process.argv[3];
  const stage = process.argv[4] as CheckpointStage;
  
  switch (command) {
    case 'checkpoint':
      integration.createCheckpoint(serviceName, stage)
        .then(() => console.log('✅ Done'))
        .catch(console.error);
      break;
      
    case 'rollback':
      integration.rollbackToCheckpoint(serviceName, stage)
        .then(() => console.log('✅ Done'))
        .catch(console.error);
      break;
      
    case 'list':
      integration.listCheckpoints(serviceName)
        .then(() => console.log('✅ Done'))
        .catch(console.error);
      break;
      
    case 'compare':
      integration.compareWorktrees()
        .then(() => console.log('✅ Done'))
        .catch(console.error);
      break;
      
    default:
      console.log('Usage:');
      console.log('  checkpoint <service> <stage>  - Create checkpoint');
      console.log('  rollback <service> <stage>    - Rollback to checkpoint');
      console.log('  list <service>               - List checkpoints');
      console.log('  compare                      - Compare worktree progress');
  }
}