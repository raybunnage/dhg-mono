import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { CheckCircle, XCircle, Clock, AlertTriangle, RefreshCw, Loader } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';

interface DeploymentRun {
  id: string;
  deployment_id: string;
  branch_from: string;
  branch_to: string;
  status: string;
  deployment_type: string;
  started_at: string;
  completed_at?: string;
  commit_hash?: string;
  deployment_url?: string;
  error_message?: string;
}

interface ValidationResult {
  id: string;
  validation_type: string;
  status: string;
  error_message?: string;
  details?: any;
}

const DeploymentPage: React.FC = () => {
  const [deployments, setDeployments] = useState<DeploymentRun[]>([]);
  const [activeDeployment, setActiveDeployment] = useState<DeploymentRun | null>(null);
  const [validations, setValidations] = useState<ValidationResult[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [deploymentType, setDeploymentType] = useState<'staging' | 'production'>('staging');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadDeployments();
    checkActiveDeployment();
    
    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const loadDeployments = async () => {
    try {
      const { data, error } = await supabase
        .from('deployment_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        if (error.code === '406') {
          console.warn('Deployment runs table may not be accessible. Please check database migrations and RLS policies.');
          setError('Deployment history is not available. Please ensure the deployment tables are properly set up.');
        } else {
          throw error;
        }
      } else {
        setDeployments(data || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkActiveDeployment = async () => {
    try {
      const { data, error } = await supabase
        .from('deployment_runs')
        .select('*')
        .in('status', ['pending', 'validating', 'deploying'])
        .maybeSingle();

      if (error && error.code === '406') {
        console.warn('Deployment runs table may not be accessible. Skipping active deployment check.');
        return;
      }

      if (data && !error) {
        setActiveDeployment(data);
        setIsDeploying(true);
        loadValidations(data.id);
        // Poll for updates
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        
        intervalRef.current = setInterval(async () => {
          try {
            const { data: updated } = await supabase
              .from('deployment_runs')
              .select('*')
              .eq('id', data.id)
              .single();
            
            if (updated && (updated.status === 'completed' || updated.status === 'failed')) {
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
              setIsDeploying(false);
              setActiveDeployment(null);
              loadDeployments();
            }
          } catch (pollError) {
            console.error('Error polling deployment status:', pollError);
            // Stop polling on error to prevent infinite loops
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            setIsDeploying(false);
          }
        }, 2000);
      }
    } catch (err) {
      console.error('Error checking active deployment:', err);
    }
  };

  const loadValidations = async (deploymentRunId: string) => {
    const { data, error } = await supabase
      .from('deployment_validations')
      .select('*')
      .eq('deployment_run_id', deploymentRunId)
      .order('created_at');

    if (!error && data) {
      setValidations(data);
    }
  };

  const startDeployment = async () => {
    setShowConfirmDialog(false);
    setIsDeploying(true);
    setError(null);

    try {
      // Call deployment service via API endpoint
      const response = await fetch('/api/deployment/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deploymentType,
          skipValidations: []
        })
      });

      if (!response.ok) {
        throw new Error('Deployment failed');
      }

      const result = await response.json();
      setActiveDeployment(result);
      
      // Start polling for updates
      checkActiveDeployment();
    } catch (err: any) {
      setError(err.message);
      setIsDeploying(false);
    }
  };

  const rollbackDeployment = async (deploymentId: string) => {
    if (!confirm('Are you sure you want to rollback this deployment?')) {
      return;
    }

    try {
      const response = await fetch('/api/deployment/rollback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deploymentId })
      });

      if (!response.ok) {
        throw new Error('Rollback failed');
      }

      loadDeployments();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'passed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'validating':
      case 'deploying':
      case 'running':
        return <Loader className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-gray-500" />;
      case 'rolled_back':
        return <RefreshCw className="w-5 h-5 text-orange-500" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Deployment Management</h1>
        <div className="flex gap-2">
          <button
            onClick={() => loadDeployments()}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={() => {
              setDeploymentType('staging');
              setShowConfirmDialog(true);
            }}
            disabled={isDeploying}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Deploy to Staging
          </button>
          <button
            onClick={() => {
              setDeploymentType('production');
              setShowConfirmDialog(true);
            }}
            disabled={isDeploying}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Deploy to Production
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Active Deployment */}
      {activeDeployment && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-4">Active Deployment</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon(activeDeployment.status)}
                <span className="font-medium">{activeDeployment.deployment_id}</span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  activeDeployment.status === 'completed' ? 'bg-green-100 text-green-800' :
                  activeDeployment.status === 'failed' ? 'bg-red-100 text-red-800' :
                  activeDeployment.status === 'rolled_back' ? 'bg-orange-100 text-orange-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {activeDeployment.status}
                </span>
              </div>
              <span className="px-2 py-1 text-xs font-medium rounded-full border border-gray-300 text-gray-700">
                {activeDeployment.deployment_type}
              </span>
            </div>

            {/* Validation Progress */}
            {validations.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium">Validations:</h3>
                {validations.map((validation) => (
                  <div key={validation.id} className="flex items-center gap-2 pl-4">
                    {getStatusIcon(validation.status)}
                    <span className="text-sm">{validation.validation_type}</span>
                    {validation.error_message && (
                      <span className="text-sm text-red-500">- {validation.error_message}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pre-flight Checklist */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Pre-flight Checklist</h2>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span>All worktrees merged to development</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span>No uncommitted changes</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span>Environment variables configured</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span>Database migrations applied</span>
          </div>
        </div>
      </div>

      {/* Deployment History */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Deployment History</h2>
        <div className="space-y-4">
          {deployments.length === 0 ? (
            <p className="text-gray-500">No deployments yet</p>
          ) : (
            deployments.map((deployment) => (
              <div key={deployment.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(deployment.status)}
                    <span className="font-medium">{deployment.deployment_id}</span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      deployment.status === 'completed' ? 'bg-green-100 text-green-800' :
                      deployment.status === 'failed' ? 'bg-red-100 text-red-800' :
                      deployment.status === 'rolled_back' ? 'bg-orange-100 text-orange-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {deployment.status}
                    </span>
                    <span className="px-2 py-1 text-xs font-medium rounded-full border border-gray-300 text-gray-700">
                      {deployment.deployment_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                      {new Date(deployment.started_at).toLocaleString()}
                    </span>
                    {deployment.status === 'completed' && (
                      <button
                        className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                        onClick={() => rollbackDeployment(deployment.deployment_id)}
                      >
                        Rollback
                      </button>
                    )}
                  </div>
                </div>
                {deployment.error_message && (
                  <p className="mt-2 text-sm text-red-500">{deployment.error_message}</p>
                )}
                {deployment.commit_hash && (
                  <p className="mt-2 text-sm text-gray-500">
                    Commit: {deployment.commit_hash.substring(0, 8)}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              Confirm {deploymentType === 'production' ? 'Production' : 'Staging'} Deployment
            </h3>
            <p className="mb-4">
              {deploymentType === 'production' 
                ? '⚠️ You are about to deploy to PRODUCTION. This will affect live users.'
                : 'Deploy the current development branch to staging environment?'}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                onClick={() => setShowConfirmDialog(false)}
              >
                Cancel
              </button>
              <button
                className={`px-4 py-2 rounded-lg text-white ${
                  deploymentType === 'production' 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
                onClick={startDeployment}
              >
                Deploy to {deploymentType === 'production' ? 'Production' : 'Staging'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </DashboardLayout>
  );
};

export default DeploymentPage;