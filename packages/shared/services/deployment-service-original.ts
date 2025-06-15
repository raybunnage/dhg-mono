import { SupabaseClientService } from './supabase-client';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export interface DeploymentConfig {
  deploymentType: 'staging' | 'production';
  skipValidations?: string[];
  dryRun?: boolean;
}

export interface ValidationResult {
  type: string;
  status: 'passed' | 'failed' | 'skipped';
  details: any;
  errorMessage?: string;
}

export interface DeploymentResult {
  deploymentId: string;
  status: 'completed' | 'failed' | 'rolled_back';
  commitHash?: string;
  deploymentUrl?: string;
  validations: ValidationResult[];
  errorMessage?: string;
}

export class DeploymentService {
  private static instance: DeploymentService;
  private supabase = SupabaseClientService.getInstance().getClient();
  private isDeploying = false;

  private constructor() {}

  static getInstance(): DeploymentService {
    if (!DeploymentService.instance) {
      DeploymentService.instance = new DeploymentService();
    }
    return DeploymentService.instance;
  }

  async createDeployment(config: DeploymentConfig): Promise<DeploymentResult> {
    if (this.isDeploying) {
      throw new Error('Another deployment is already in progress');
    }

    this.isDeploying = true;
    const deploymentId = `deploy-${Date.now()}-${config.deploymentType}`;
    
    try {
      // Create deployment run record
      const { data: deploymentRun, error: runError } = await this.supabase
        .from('deployment_runs')
        .insert({
          deployment_id: deploymentId,
          branch_from: 'development',
          branch_to: config.deploymentType === 'production' ? 'main' : 'staging',
          status: 'validating',
          deployment_type: config.deploymentType
        })
        .select()
        .single();

      if (runError) throw runError;

      // Run validations
      const validations = await this.runValidations(deploymentRun.id, config);
      
      // Check if all required validations passed
      const failedValidations = validations.filter(v => v.status === 'failed' && !config.skipValidations?.includes(v.type));
      if (failedValidations.length > 0) {
        await this.updateDeploymentStatus(deploymentRun.id, 'failed', 'Validation failed');
        throw new Error(`Validation failed: ${failedValidations.map(v => v.type).join(', ')}`);
      }

      // Proceed with deployment if not dry run
      if (!config.dryRun) {
        await this.updateDeploymentStatus(deploymentRun.id, 'deploying');
        const deployResult = await this.performDeployment(deploymentRun.id, config);
        
        // Run post-deployment health checks
        await this.runHealthChecks(deploymentRun.id, config);
        
        await this.updateDeploymentStatus(deploymentRun.id, 'completed', null, deployResult);
        
        return {
          deploymentId,
          status: 'completed',
          commitHash: deployResult.commitHash,
          deploymentUrl: deployResult.deploymentUrl,
          validations
        };
      } else {
        await this.updateDeploymentStatus(deploymentRun.id, 'completed', 'Dry run completed');
        return {
          deploymentId,
          status: 'completed',
          validations,
          errorMessage: 'Dry run - no actual deployment performed'
        };
      }
    } catch (error: any) {
      await this.updateDeploymentStatus(deploymentId, 'failed', error.message);
      return {
        deploymentId,
        status: 'failed',
        validations: [],
        errorMessage: error.message
      };
    } finally {
      this.isDeploying = false;
    }
  }

  private async runValidations(deploymentRunId: string, config: DeploymentConfig): Promise<ValidationResult[]> {
    const validations: ValidationResult[] = [];
    
    // TypeScript validation
    if (!config.skipValidations?.includes('typescript')) {
      validations.push(await this.validateTypeScript(deploymentRunId));
    }
    
    // Dependencies validation
    if (!config.skipValidations?.includes('dependencies')) {
      validations.push(await this.validateDependencies(deploymentRunId));
    }
    
    // Environment validation
    if (!config.skipValidations?.includes('env')) {
      validations.push(await this.validateEnvironment(deploymentRunId));
    }
    
    // Build validation
    if (!config.skipValidations?.includes('build')) {
      validations.push(await this.validateBuild(deploymentRunId));
    }
    
    // Test validation
    if (!config.skipValidations?.includes('tests')) {
      validations.push(await this.validateTests(deploymentRunId));
    }
    
    return validations;
  }

  private async validateTypeScript(deploymentRunId: string): Promise<ValidationResult> {
    const validationType = 'typescript';
    await this.createValidationRecord(deploymentRunId, validationType, 'running');
    
    try {
      // Run TypeScript check
      const { stdout, stderr } = await execAsync('pnpm tsc --noEmit');
      
      // Check for errors
      if (stderr && stderr.includes('error')) {
        await this.updateValidationStatus(deploymentRunId, validationType, 'failed', { stderr });
        return {
          type: validationType,
          status: 'failed',
          details: { stderr },
          errorMessage: 'TypeScript compilation errors found'
        };
      }
      
      await this.updateValidationStatus(deploymentRunId, validationType, 'passed', { stdout });
      return {
        type: validationType,
        status: 'passed',
        details: { stdout }
      };
    } catch (error: any) {
      await this.updateValidationStatus(deploymentRunId, validationType, 'failed', { error: error.message });
      return {
        type: validationType,
        status: 'failed',
        details: { error: error.message },
        errorMessage: error.message
      };
    }
  }

  private async validateDependencies(deploymentRunId: string): Promise<ValidationResult> {
    const validationType = 'dependencies';
    await this.createValidationRecord(deploymentRunId, validationType, 'running');
    
    try {
      // Check if pnpm-lock.yaml is in sync
      const { stdout, stderr } = await execAsync('pnpm install --frozen-lockfile --dry-run');
      
      if (stderr && stderr.includes('ERR_PNPM')) {
        await this.updateValidationStatus(deploymentRunId, validationType, 'failed', { stderr });
        return {
          type: validationType,
          status: 'failed',
          details: { stderr },
          errorMessage: 'Dependencies are out of sync with lockfile'
        };
      }
      
      await this.updateValidationStatus(deploymentRunId, validationType, 'passed', { stdout });
      return {
        type: validationType,
        status: 'passed',
        details: { stdout }
      };
    } catch (error: any) {
      await this.updateValidationStatus(deploymentRunId, validationType, 'failed', { error: error.message });
      return {
        type: validationType,
        status: 'failed',
        details: { error: error.message },
        errorMessage: error.message
      };
    }
  }

  private async validateEnvironment(deploymentRunId: string): Promise<ValidationResult> {
    const validationType = 'env';
    await this.createValidationRecord(deploymentRunId, validationType, 'running');
    
    try {
      // Check for required environment variables
      const requiredVars = [
        'VITE_SUPABASE_URL',
        'VITE_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'CLAUDE_API_KEY'
      ];
      
      const missingVars = requiredVars.filter(varName => !process.env[varName]);
      
      if (missingVars.length > 0) {
        await this.updateValidationStatus(deploymentRunId, validationType, 'failed', { missingVars });
        return {
          type: validationType,
          status: 'failed',
          details: { missingVars },
          errorMessage: `Missing environment variables: ${missingVars.join(', ')}`
        };
      }
      
      await this.updateValidationStatus(deploymentRunId, validationType, 'passed', { checkedVars: requiredVars });
      return {
        type: validationType,
        status: 'passed',
        details: { checkedVars: requiredVars }
      };
    } catch (error: any) {
      await this.updateValidationStatus(deploymentRunId, validationType, 'failed', { error: error.message });
      return {
        type: validationType,
        status: 'failed',
        details: { error: error.message },
        errorMessage: error.message
      };
    }
  }

  private async validateBuild(deploymentRunId: string): Promise<ValidationResult> {
    const validationType = 'build';
    await this.createValidationRecord(deploymentRunId, validationType, 'running');
    
    try {
      // Test production build for dhg-hub
      const { stdout, stderr } = await execAsync('cd apps/dhg-hub && pnpm build');
      
      if (stderr && stderr.includes('error')) {
        await this.updateValidationStatus(deploymentRunId, validationType, 'failed', { stderr });
        return {
          type: validationType,
          status: 'failed',
          details: { stderr },
          errorMessage: 'Build failed'
        };
      }
      
      // Check if dist folder was created
      const distPath = path.join(process.cwd(), 'apps/dhg-hub/dist');
      try {
        await fs.access(distPath);
      } catch {
        await this.updateValidationStatus(deploymentRunId, validationType, 'failed', { error: 'dist folder not created' });
        return {
          type: validationType,
          status: 'failed',
          details: { error: 'dist folder not created' },
          errorMessage: 'Build output not found'
        };
      }
      
      await this.updateValidationStatus(deploymentRunId, validationType, 'passed', { stdout });
      return {
        type: validationType,
        status: 'passed',
        details: { stdout }
      };
    } catch (error: any) {
      await this.updateValidationStatus(deploymentRunId, validationType, 'failed', { error: error.message });
      return {
        type: validationType,
        status: 'failed',
        details: { error: error.message },
        errorMessage: error.message
      };
    }
  }

  private async validateTests(deploymentRunId: string): Promise<ValidationResult> {
    const validationType = 'tests';
    await this.createValidationRecord(deploymentRunId, validationType, 'running');
    
    try {
      // For now, we'll just check if test command exists
      // In the future, this would run actual tests
      await this.updateValidationStatus(deploymentRunId, validationType, 'skipped', { reason: 'Tests not yet implemented' });
      return {
        type: validationType,
        status: 'skipped',
        details: { reason: 'Tests not yet implemented' }
      };
    } catch (error: any) {
      await this.updateValidationStatus(deploymentRunId, validationType, 'failed', { error: error.message });
      return {
        type: validationType,
        status: 'failed',
        details: { error: error.message },
        errorMessage: error.message
      };
    }
  }

  private async performDeployment(deploymentRunId: string, config: DeploymentConfig): Promise<any> {
    try {
      // Get current commit hash
      const { stdout: commitHash } = await execAsync('git rev-parse HEAD');
      const cleanCommitHash = commitHash.trim();
      
      // Push to target branch
      const targetBranch = config.deploymentType === 'production' ? 'main' : 'staging';
      await execAsync(`git push origin development:${targetBranch}`);
      
      // Update deployment record
      await this.supabase
        .from('deployment_runs')
        .update({
          commit_hash: cleanCommitHash,
          deployment_url: config.deploymentType === 'production' 
            ? 'https://dhg-hub.netlify.app' 
            : 'https://staging--dhg-hub.netlify.app'
        })
        .eq('id', deploymentRunId);
      
      return {
        commitHash: cleanCommitHash,
        deploymentUrl: config.deploymentType === 'production' 
          ? 'https://dhg-hub.netlify.app' 
          : 'https://staging--dhg-hub.netlify.app'
      };
    } catch (error: any) {
      throw new Error(`Deployment failed: ${error.message}`);
    }
  }

  private async runHealthChecks(deploymentRunId: string, config: DeploymentConfig): Promise<void> {
    const baseUrl = config.deploymentType === 'production' 
      ? 'https://dhg-hub.netlify.app' 
      : 'https://staging--dhg-hub.netlify.app';
    
    const endpoints = [
      { type: 'homepage', endpoint: '/' },
      { type: 'api_health', endpoint: '/api/health' }
    ];
    
    for (const check of endpoints) {
      try {
        const start = Date.now();
        const response = await fetch(`${baseUrl}${check.endpoint}`);
        const responseTime = Date.now() - start;
        
        await this.supabase
          .from('deployment_health_checks')
          .insert({
            deployment_run_id: deploymentRunId,
            check_type: check.type,
            endpoint: check.endpoint,
            status: response.ok ? 'healthy' : 'unhealthy',
            response_time_ms: responseTime
          });
      } catch (error: any) {
        await this.supabase
          .from('deployment_health_checks')
          .insert({
            deployment_run_id: deploymentRunId,
            check_type: check.type,
            endpoint: check.endpoint,
            status: 'timeout',
            error_message: error.message
          });
      }
    }
  }

  async rollback(deploymentId: string, toCommit?: string): Promise<void> {
    try {
      // Get deployment info
      const { data: deployment, error } = await this.supabase
        .from('deployment_runs')
        .select('*')
        .eq('deployment_id', deploymentId)
        .single();
      
      if (error || !deployment) throw new Error('Deployment not found');
      
      // Create rollback record
      const { data: rollback, error: rollbackError } = await this.supabase
        .from('deployment_rollbacks')
        .insert({
          deployment_run_id: deployment.id,
          rollback_from_commit: deployment.commit_hash,
          rollback_to_commit: toCommit || 'previous',
          status: 'initiated'
        })
        .select()
        .single();
      
      if (rollbackError) throw rollbackError;
      
      // Perform rollback
      if (toCommit) {
        await execAsync(`git push --force origin ${toCommit}:${deployment.branch_to}`);
      } else {
        // Rollback to previous commit
        await execAsync(`git push --force origin ${deployment.branch_to}~1:${deployment.branch_to}`);
      }
      
      // Update rollback status
      await this.supabase
        .from('deployment_rollbacks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', rollback.id);
      
      // Update deployment status
      await this.updateDeploymentStatus(deployment.id, 'rolled_back');
    } catch (error: any) {
      throw new Error(`Rollback failed: ${error.message}`);
    }
  }

  async getDeploymentStatus(deploymentId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('deployment_status_view')
      .select('*')
      .eq('deployment_id', deploymentId)
      .single();
    
    if (error) throw error;
    return data;
  }

  async getDeploymentHistory(limit: number = 10): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('deployment_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data;
  }

  private async createValidationRecord(deploymentRunId: string, validationType: string, status: string): Promise<void> {
    await this.supabase
      .from('deployment_validations')
      .insert({
        deployment_run_id: deploymentRunId,
        validation_type: validationType,
        status
      });
  }

  private async updateValidationStatus(deploymentRunId: string, validationType: string, status: string, details?: any, errorMessage?: string): Promise<void> {
    await this.supabase
      .from('deployment_validations')
      .update({
        status,
        details,
        error_message: errorMessage,
        completed_at: new Date().toISOString()
      })
      .eq('deployment_run_id', deploymentRunId)
      .eq('validation_type', validationType);
  }

  private async updateDeploymentStatus(deploymentRunId: string, status: string, errorMessage?: string | null, metadata?: any): Promise<void> {
    const updateData: any = { status };
    
    if (errorMessage !== undefined) updateData.error_message = errorMessage;
    if (metadata) updateData.metadata = metadata;
    if (status === 'completed' || status === 'failed' || status === 'rolled_back') {
      updateData.completed_at = new Date().toISOString();
    }
    
    await this.supabase
      .from('deployment_runs')
      .update(updateData)
      .eq('id', deploymentRunId);
  }
}

// Export singleton instance
export const deploymentService = DeploymentService.getInstance();