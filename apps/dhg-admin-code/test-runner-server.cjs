const express = require('express');
const { exec } = require('child_process');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.TEST_RUNNER_PORT || 3012;

// Enable CORS for the admin app
app.use(cors({
  origin: ['http://localhost:5177', 'http://localhost:4177'],
  credentials: true
}));

app.use(express.json());

// Root directory for running commands
const ROOT_DIR = path.resolve(__dirname, '../..');

// Test execution endpoint
app.post('/api/run-test', async (req, res) => {
  const { command, suiteId } = req.body;

  if (!command || !suiteId) {
    return res.status(400).json({ error: 'Missing command or suiteId' });
  }

  console.log(`Running test suite: ${suiteId}`);
  console.log(`Command: ${command}`);

  // Execute the command
  exec(command, { cwd: ROOT_DIR, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
    if (error) {
      console.error(`Test failed: ${error.message}`);
      return res.json({
        success: false,
        output: stdout || '',
        error: stderr || error.message
      });
    }

    console.log(`Test completed successfully`);
    res.json({
      success: true,
      output: stdout,
      error: stderr || null
    });
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', service: 'test-runner' });
});

// Get available test suites
app.get('/api/test-suites', (req, res) => {
  res.json({
    suites: [
      {
        id: 'shared-services',
        name: 'Shared Services Tests',
        description: 'Unit tests for shared services in packages/shared',
        command: 'pnpm --filter @dhg/shared test',
        category: 'unit'
      },
      {
        id: 'health-check-all',
        name: 'CLI Pipeline Health Check',
        description: 'Comprehensive health check of all CLI pipelines',
        command: './scripts/cli-pipeline/maintenance-cli.sh health-check',
        category: 'health'
      }
    ]
  });
});

app.listen(PORT, () => {
  console.log(`Test runner server listening on port ${PORT}`);
  console.log(`Root directory: ${ROOT_DIR}`);
});