// DeploymentService Types

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

export interface HealthCheckResult {
  type: string;
  endpoint: string;
  status: 'healthy' | 'unhealthy' | 'timeout';
  responseTime?: number;
  errorMessage?: string;
}

export interface DeploymentRun {
  id: string;
  deployment_id: string;
  branch_from: string;
  branch_to: string;
  status: string;
  deployment_type: string;
  commit_hash?: string;
  deployment_url?: string;
  created_at: string;
  completed_at?: string;
  error_message?: string;
  metadata?: any;
}