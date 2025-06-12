import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DeploymentPage from '../DeploymentPage';

// Mock supabase client
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => ({
            data: [
              {
                id: '1',
                deployment_id: 'deploy-123',
                branch_from: 'development',
                branch_to: 'main',
                status: 'completed',
                deployment_type: 'production',
                started_at: '2024-01-01T10:00:00Z',
                completed_at: '2024-01-01T10:05:00Z',
                commit_hash: 'abc123',
                deployment_url: 'https://example.com'
              }
            ],
            error: null
          }))
        }))
      })),
      insert: vi.fn(() => ({ data: { id: 'new-deployment' }, error: null })),
      update: vi.fn(() => ({ data: {}, error: null }))
    })),
    rpc: vi.fn(() => ({ data: { canDeploy: true }, error: null }))
  }
}));

// Mock deployment service
vi.mock('../../../../packages/shared/services/deployment-service', () => ({
  DeploymentService: {
    getInstance: () => ({
      validateTypeScript: vi.fn(() => Promise.resolve({ type: 'typescript', status: 'passed' })),
      validateDependencies: vi.fn(() => Promise.resolve({ type: 'dependencies', status: 'passed' })),
      validateEnvironment: vi.fn(() => Promise.resolve({ type: 'environment', status: 'passed' })),
      verifyBuild: vi.fn(() => Promise.resolve({ type: 'build', status: 'passed' })),
      createDeployment: vi.fn(() => Promise.resolve({
        deploymentId: 'new-deployment',
        status: 'completed',
        validations: []
      }))
    })
  }
}));

describe('DeploymentPage', () => {
  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <DeploymentPage />
      </BrowserRouter>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render deployment page with correct title', () => {
    renderComponent();
    expect(screen.getByText('Deployment Management')).toBeInTheDocument();
  });

  it('should load and display deployment history', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('deploy-123')).toBeInTheDocument();
      expect(screen.getByText('development → main')).toBeInTheDocument();
      expect(screen.getByText('completed')).toBeInTheDocument();
    });
  });

  it('should show deployment type selector', () => {
    renderComponent();
    
    expect(screen.getByText('Deploy to Staging')).toBeInTheDocument();
    expect(screen.getByText('Deploy to Production')).toBeInTheDocument();
  });

  it('should run pre-flight checks when clicking validate button', async () => {
    renderComponent();
    
    const validateButton = screen.getByText('Run Pre-Flight Checks');
    fireEvent.click(validateButton);

    await waitFor(() => {
      expect(screen.getByText('TypeScript Validation')).toBeInTheDocument();
      expect(screen.getByText('Dependency Check')).toBeInTheDocument();
      expect(screen.getByText('Environment Check')).toBeInTheDocument();
    });
  });

  it('should show confirmation dialog for production deployment', async () => {
    renderComponent();
    
    // Select production
    const productionButton = screen.getByText('Deploy to Production');
    fireEvent.click(productionButton);

    // Click deploy
    const deployButton = screen.getByText('Deploy to production');
    fireEvent.click(deployButton);

    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to deploy to production/)).toBeInTheDocument();
    });
  });

  it('should handle deployment errors gracefully', async () => {
    // Mock error response
    const mockSupabase = vi.mocked(supabase);
    mockSupabase.from.mockImplementationOnce(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => ({
            data: null,
            error: { message: 'Failed to load deployments' }
          }))
        }))
      }))
    } as any));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Failed to load deployments/)).toBeInTheDocument();
    });
  });

  it('should refresh deployment status', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('deploy-123')).toBeInTheDocument();
    });

    // Find and click refresh button
    const refreshButton = screen.getByLabelText('Refresh');
    fireEvent.click(refreshButton);

    // Should reload deployments
    await waitFor(() => {
      expect(vi.mocked(supabase).from).toHaveBeenCalledWith('deployment_runs');
    });
  });

  it('should display deployment duration correctly', async () => {
    renderComponent();

    await waitFor(() => {
      // 5 minutes = 300 seconds
      expect(screen.getByText(/5m 0s/)).toBeInTheDocument();
    });
  });
});