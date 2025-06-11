const express = require('express');
const cors = require('cors');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);
const app = express();
const PORT = process.env.DEPLOYMENT_SERVER_PORT || 3015;

const PROJECT_ROOT = path.join(__dirname, '../..');
const DEPLOYMENT_CLI_PATH = path.join(PROJECT_ROOT, 'scripts/cli-pipeline/deployment/deployment-cli.sh');

// Enable CORS for the Vite dev server
app.use(cors({
  origin: ['http://localhost:5177', 'http://localhost:5173'],
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'deployment-server',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Deploy endpoint
app.post('/api/deployment/deploy', async (req, res) => {
  try {
    const { deploymentType, skipValidations = [] } = req.body;
    
    if (!deploymentType || !['staging', 'production'].includes(deploymentType)) {
      return res.status(400).json({ error: 'Invalid deployment type' });
    }
    
    console.log(`Starting ${deploymentType} deployment...`);
    
    // Execute deployment CLI command
    const skipArgs = skipValidations.length > 0 ? `--skip ${skipValidations.join(' ')}` : '';
    const command = `cd ${PROJECT_ROOT} && ${DEPLOYMENT_CLI_PATH} deploy-${deploymentType} ${skipArgs}`;
    
    console.log(`Executing: ${command}`);
    
    // For now, we'll execute the validation only (dry run)
    const validateCommand = `cd ${PROJECT_ROOT} && ${DEPLOYMENT_CLI_PATH} validate-all`;
    const { stdout, stderr } = await execAsync(validateCommand);
    
    if (stderr) {
      console.error('Deployment error:', stderr);
      return res.status(500).json({ error: stderr });
    }
    
    // Return deployment info
    res.json({
      deployment_id: `deploy-${Date.now()}-${deploymentType}`,
      status: 'validating',
      deployment_type: deploymentType,
      message: 'Deployment initiated. Validation in progress...'
    });
    
  } catch (error) {
    console.error('Deployment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rollback endpoint
app.post('/api/deployment/rollback', async (req, res) => {
  try {
    const { deploymentId } = req.body;
    
    if (!deploymentId) {
      return res.status(400).json({ error: 'Deployment ID required' });
    }
    
    console.log(`Rolling back deployment ${deploymentId}...`);
    
    // Execute rollback CLI command
    const command = `cd ${PROJECT_ROOT} && ${DEPLOYMENT_CLI_PATH} rollback --deployment-id ${deploymentId}`;
    
    console.log(`Executing: ${command}`);
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr) {
      console.error('Rollback error:', stderr);
      return res.status(500).json({ error: stderr });
    }
    
    res.json({
      success: true,
      message: `Rollback of ${deploymentId} completed successfully`
    });
    
  } catch (error) {
    console.error('Rollback error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get deployment status endpoint
app.get('/api/deployment/status/:deploymentId?', async (req, res) => {
  try {
    const { deploymentId } = req.params;
    
    let command = `cd ${PROJECT_ROOT} && ${DEPLOYMENT_CLI_PATH} status`;
    if (deploymentId) {
      command += ` --deployment-id ${deploymentId}`;
    }
    
    console.log(`Executing: ${command}`);
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr) {
      console.error('Status error:', stderr);
      return res.status(500).json({ error: stderr });
    }
    
    // Parse the CLI output (this is simplified, actual parsing would be more complex)
    res.json({
      status: 'completed',
      output: stdout
    });
    
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get deployment history endpoint
app.get('/api/deployment/history', async (_req, res) => {
  try {
    const command = `cd ${PROJECT_ROOT} && ${DEPLOYMENT_CLI_PATH} history --limit 20`;
    
    console.log(`Executing: ${command}`);
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr) {
      console.error('History error:', stderr);
      return res.status(500).json({ error: stderr });
    }
    
    // Return the raw output for now
    res.json({
      history: stdout
    });
    
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Deployment server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});