import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';

const app = express();
const PORT = 9890; // New port for CLI test runner

app.use(cors());
app.use(express.json());

interface TestStatus {
  group: string;
  complete: boolean;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    running: number;
    pending: number;
  };
  pipelines: Array<{
    pipeline: string;
    status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
    message?: string;
    duration?: number;
  }>;
  logs: string[];
}

// Store test status for each group
const testStatus: Record<string, TestStatus> = {
  alpha: {
    group: 'ALPHA',
    complete: false,
    summary: { total: 0, passed: 0, failed: 0, skipped: 0, running: 0, pending: 0 },
    pipelines: [],
    logs: []
  },
  beta: {
    group: 'BETA',
    complete: false,
    summary: { total: 0, passed: 0, failed: 0, skipped: 0, running: 0, pending: 0 },
    pipelines: [],
    logs: []
  },
  gamma: {
    group: 'GAMMA',
    complete: false,
    summary: { total: 0, passed: 0, failed: 0, skipped: 0, running: 0, pending: 0 },
    pipelines: [],
    logs: []
  }
};

// Helper to reset test status
function resetTestStatus(group: string) {
  const pipelines = getPipelinesForGroup(group.toUpperCase());
  testStatus[group] = {
    group: group.toUpperCase(),
    complete: false,
    summary: {
      total: pipelines.length,
      passed: 0,
      failed: 0,
      skipped: 0,
      running: 0,
      pending: pipelines.length
    },
    pipelines: pipelines.map(p => ({ pipeline: p, status: 'pending' as const })),
    logs: []
  };
}

function getPipelinesForGroup(group: string): string[] {
  switch (group) {
    case 'ALPHA':
      return [
        'testing', 'utilities', 'system', 'registry', 'tracking', 'maintenance',
        'continuous', 'proxy', 'servers', 'monitoring', 'shared-services',
        'service_dependencies', 'refactor_tracking', 'deprecation', 'all_pipelines',
        'database', 'deployment'
      ];
    case 'BETA':
      return [
        'ai', 'analysis', 'archive', 'auth', 'classify', 'continuous_docs',
        'dev_tasks', 'docs', 'document', 'document_archiving', 'document_types',
        'drive_filter', 'element_criteria', 'email', 'experts', 'git',
        'git_workflow', 'gmail', 'google_sync', 'living_docs'
      ];
    case 'GAMMA':
      return [
        'media-analytics', 'media-processing', 'mime_types', 'presentations',
        'prompt_service', 'scripts', 'work_summaries'
      ];
    default:
      return [];
  }
}

// Run tests for a specific group
app.post('/cli-tests/run-:group', (req, res) => {
  const group = req.params.group.toLowerCase();
  
  if (!['alpha', 'beta', 'gamma'].includes(group)) {
    return res.status(400).json({ error: 'Invalid group' });
  }

  // Reset status
  resetTestStatus(group);
  
  // Get the test script path
  const scriptPath = path.join(
    __dirname, 
    '../../../../scripts/cli-pipeline/testing',
    `run-${group}-direct-tests.sh`
  );

  testStatus[group].logs.push(`Starting ${group.toUpperCase()} pipeline tests...`);
  testStatus[group].logs.push(`Running script: ${scriptPath}`);

  // Spawn the test process
  const testProcess = spawn('bash', [scriptPath], {
    cwd: path.join(__dirname, '../../../..'),
    env: { ...process.env }
  });

  // Parse output to update status
  testProcess.stdout.on('data', (data) => {
    const output = data.toString();
    const lines = output.split('\n').filter(line => line.trim());
    
    lines.forEach(line => {
      testStatus[group].logs.push(line);
      
      // Parse test results
      if (line.includes('Testing') && line.includes('pipeline...')) {
        const pipelineName = line.match(/Testing (\S+) pipeline/)?.[1];
        if (pipelineName) {
          updatePipelineStatus(group, pipelineName, 'running');
        }
      } else if (line.includes('Command') && (line.includes('✓') || line.includes('⚠'))) {
        // Extract pipeline name from previous "Testing X pipeline..." line
        const recentPipeline = findRecentPipeline(testStatus[group].logs);
        if (recentPipeline) {
          updatePipelineStatus(group, recentPipeline, 'passed');
        }
      } else if (line.includes('Command') && line.includes('✗')) {
        const recentPipeline = findRecentPipeline(testStatus[group].logs);
        if (recentPipeline) {
          updatePipelineStatus(group, recentPipeline, 'failed');
        }
      } else if (line.includes('File exists:') && line.includes('✗')) {
        const recentPipeline = findRecentPipeline(testStatus[group].logs);
        if (recentPipeline) {
          updatePipelineStatus(group, recentPipeline, 'failed');
        }
      } else if (line.includes('Test Summary')) {
        // Parse summary
        testStatus[group].summary.running = 0;
      } else if (line.includes('Total tests run:')) {
        const total = parseInt(line.match(/Total tests run:\s*(\d+)/)?.[1] || '0');
        testStatus[group].summary.total = total;
      } else if (line.includes('Passed:')) {
        const passed = parseInt(line.match(/Passed:\s*(\d+)/)?.[1] || '0');
        testStatus[group].summary.passed = passed;
      } else if (line.includes('Failed:')) {
        const failed = parseInt(line.match(/Failed:\s*(\d+)/)?.[1] || '0');
        testStatus[group].summary.failed = failed;
      }
    });
  });

  testProcess.stderr.on('data', (data) => {
    testStatus[group].logs.push(`ERROR: ${data.toString()}`);
  });

  testProcess.on('close', (code) => {
    testStatus[group].complete = true;
    testStatus[group].logs.push(`Tests completed with exit code ${code}`);
    
    // Update pending count
    testStatus[group].summary.pending = 0;
    testStatus[group].summary.running = 0;
  });

  res.json({ message: 'Tests started', group: group.toUpperCase() });
});

// Get test status
app.get('/cli-tests/status-:group', (req, res) => {
  const group = req.params.group.toLowerCase();
  
  if (!['alpha', 'beta', 'gamma'].includes(group)) {
    return res.status(400).json({ error: 'Invalid group' });
  }

  res.json(testStatus[group]);
});

// Helper to find recent pipeline name from logs
function findRecentPipeline(logs: string[]): string | null {
  for (let i = logs.length - 1; i >= 0; i--) {
    const match = logs[i].match(/Testing (\S+) pipeline/);
    if (match) {
      return match[1];
    }
  }
  return null;
}

// Helper to update pipeline status
function updatePipelineStatus(
  group: string, 
  pipelineName: string, 
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped'
) {
  const pipeline = testStatus[group].pipelines.find(p => 
    p.pipeline === pipelineName || p.pipeline.includes(pipelineName)
  );
  
  if (pipeline) {
    const oldStatus = pipeline.status;
    pipeline.status = status;
    
    // Update summary counts
    if (oldStatus !== status) {
      if (oldStatus !== 'pending' && oldStatus !== 'running') {
        testStatus[group].summary[oldStatus]--;
      }
      if (status !== 'pending' && status !== 'running') {
        testStatus[group].summary[status]++;
      }
      
      if (oldStatus === 'pending') testStatus[group].summary.pending--;
      if (oldStatus === 'running') testStatus[group].summary.running--;
      if (status === 'running') testStatus[group].summary.running++;
    }
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'CLI Test Runner Proxy',
    port: PORT
  });
});

app.listen(PORT, () => {
  console.log(`CLI Test Runner Proxy running on http://localhost:${PORT}`);
});