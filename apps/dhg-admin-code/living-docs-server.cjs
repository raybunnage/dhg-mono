const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);
const app = express();
const PORT = process.env.LIVING_DOCS_PORT || 3008; // Port for living docs server

const PROJECT_ROOT = path.join(__dirname, '../..');
const DOCS_DIR = path.join(PROJECT_ROOT, 'docs');
const CONTINUOUSLY_UPDATED_DIR = path.join(DOCS_DIR, 'continuously-updated');
const TRACKING_FILE = path.join(CONTINUOUSLY_UPDATED_DIR, '.tracking.json');
const CLI_SCRIPT_PATH = path.join(PROJECT_ROOT, 'scripts/cli-pipeline/continuous_docs/continuous-docs-cli.sh');
const LIVING_DOCS_DIR = path.join(DOCS_DIR, 'living-docs');
const LIVING_DOCS_CLI_PATH = path.join(PROJECT_ROOT, 'scripts/cli-pipeline/living_docs/living-docs-cli.sh');

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
    service: 'living-docs-server',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Load tracking data
async function loadTrackingData() {
  try {
    const data = await fs.readFile(TRACKING_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.log('No tracking file found, returning empty data');
    return { documents: [] };
  }
}

// Save tracking data
async function saveTrackingData(data) {
  await fs.mkdir(CONTINUOUSLY_UPDATED_DIR, { recursive: true });
  await fs.writeFile(TRACKING_FILE, JSON.stringify(data, null, 2));
}

// Execute CLI command
async function executeCLICommand(command, docId) {
  try {
    let fullCommand = `cd ${PROJECT_ROOT} && ${CLI_SCRIPT_PATH}`;
    
    switch (command) {
      case 'check-updates':
        fullCommand += ' check-updates';
        break;
      case 'process-updates':
        fullCommand += ' process-updates';
        break;
      case 'list-monitored':
        fullCommand += ' list-monitored';
        break;
      case 'check-single':
        if (docId) {
          // For single document check, use path filter
          fullCommand += ` check-updates --path "${docId}"`;
        }
        break;
      case 'update-single':
        if (docId) {
          // For single document update
          fullCommand += ` process-updates --path "${docId}"`;
        }
        break;
      default:
        throw new Error(`Unknown command: ${command}`);
    }
    
    console.log(`Executing: ${fullCommand}`);
    const { stdout, stderr } = await execAsync(fullCommand);
    
    if (stderr && !stderr.includes('Tracking command:')) {
      console.error('Command stderr:', stderr);
    }
    
    return stdout || 'Command completed successfully';
  } catch (error) {
    console.error('Command execution error:', error);
    throw new Error(`Command failed: ${error.message}`);
  }
}

// Get all tracked documents
app.get('/api/continuous-docs', async (_req, res) => {
  try {
    const data = await loadTrackingData();
    res.json(data);
  } catch (error) {
    console.error('Failed to load continuous docs:', error);
    res.status(500).json({ 
      error: 'Failed to load continuous documents',
      details: error.message
    });
  }
});

// Update document frequency
app.patch('/api/continuous-docs/:path/frequency', async (req, res) => {
  try {
    const { path: docPath } = req.params;
    const { frequency } = req.body;
    
    const data = await loadTrackingData();
    const docIndex = data.documents.findIndex(doc => doc.originalPath === docPath);
    
    if (docIndex === -1) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    data.documents[docIndex].updateFrequency = frequency;
    await saveTrackingData(data);
    
    res.json({ success: true, document: data.documents[docIndex] });
  } catch (error) {
    console.error('Failed to update frequency:', error);
    res.status(500).json({ 
      error: 'Failed to update frequency',
      details: error.message
    });
  }
});

// Manually trigger update
app.post('/api/continuous-docs/:path/update', async (req, res) => {
  try {
    const { path: docPath } = req.params;
    
    const data = await loadTrackingData();
    const docIndex = data.documents.findIndex(doc => doc.originalPath === docPath);
    
    if (docIndex === -1) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Update the lastUpdated timestamp
    data.documents[docIndex].lastUpdated = new Date().toISOString();
    await saveTrackingData(data);
    
    // In a real implementation, this would also trigger the actual document update
    // For now, we just update the timestamp
    
    res.json({ success: true, document: data.documents[docIndex] });
  } catch (error) {
    console.error('Failed to update document:', error);
    res.status(500).json({ 
      error: 'Failed to update document',
      details: error.message
    });
  }
});

// Add new document to tracking
app.post('/api/continuous-docs', async (req, res) => {
  try {
    const { originalPath, category, frequency, description } = req.body;
    
    const data = await loadTrackingData();
    
    // Check if already tracked
    const exists = data.documents.some(doc => doc.originalPath === originalPath);
    if (exists) {
      return res.status(400).json({ error: 'Document already tracked' });
    }
    
    const newDoc = {
      originalPath,
      fileName: path.basename(originalPath),
      category: category || 'general',
      addedDate: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      updateFrequency: frequency || 'weekly',
      description
    };
    
    data.documents.push(newDoc);
    await saveTrackingData(data);
    
    res.json({ success: true, document: newDoc });
  } catch (error) {
    console.error('Failed to add document:', error);
    res.status(500).json({ 
      error: 'Failed to add document',
      details: error.message
    });
  }
});

// Execute CLI command endpoint
app.post('/api/cli-command', async (req, res) => {
  try {
    const { command, docId } = req.body;
    
    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }
    
    console.log(`Executing CLI command: ${command}${docId ? ` for doc ${docId}` : ''}`);
    const output = await executeCLICommand(command, docId);
    
    res.json({ 
      success: true, 
      command,
      docId,
      output 
    });
  } catch (error) {
    console.error('CLI command error:', error);
    res.status(500).json({ 
      error: 'Command execution failed',
      details: error.message
    });
  }
});

// Living docs prioritization endpoints
app.get('/api/living-docs/priority-dashboard', async (_req, res) => {
  try {
    console.log('Generating priority dashboard...');
    const { stdout, stderr } = await execAsync(`cd ${PROJECT_ROOT} && ${LIVING_DOCS_CLI_PATH} prioritize`);
    
    if (stderr && !stderr.includes('Tracking command:')) {
      console.error('Command stderr:', stderr);
    }
    
    // Read the generated dashboard
    const dashboardPath = path.join(LIVING_DOCS_DIR, 'PRIORITY-DASHBOARD.md');
    const dashboard = await fs.readFile(dashboardPath, 'utf-8');
    
    res.json({
      success: true,
      dashboard,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to generate priority dashboard:', error);
    res.status(500).json({
      error: 'Failed to generate priority dashboard',
      details: error.message
    });
  }
});

app.get('/api/living-docs/documents', async (_req, res) => {
  try {
    const files = await fs.readdir(LIVING_DOCS_DIR);
    const mdFiles = files.filter(f => f.endsWith('.md') && !f.includes('TEMPLATE'));
    
    const documents = [];
    for (const file of mdFiles) {
      const content = await fs.readFile(path.join(LIVING_DOCS_DIR, file), 'utf-8');
      const metadata = extractMetadata(content, file);
      documents.push(metadata);
    }
    
    res.json({ documents });
  } catch (error) {
    console.error('Failed to list living docs:', error);
    res.status(500).json({
      error: 'Failed to list living documents',
      details: error.message
    });
  }
});

// Helper function to extract metadata from markdown
function extractMetadata(content, filename) {
  const metadata = {
    filename,
    title: filename.replace('.md', '').replace(/-/g, ' '),
    lastUpdated: '',
    nextReview: '',
    status: 'Unknown',
    priority: 'Medium',
    category: 'Unknown'
  };
  
  // Extract title
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) metadata.title = titleMatch[1];
  
  // Extract metadata section
  const metadataMatch = content.match(/## Metadata([\s\S]*?)(?=##|$)/);
  if (metadataMatch) {
    const metadataText = metadataMatch[1];
    
    const lastUpdatedMatch = metadataText.match(/Last Updated\s*:\s*(.+)/i);
    if (lastUpdatedMatch) metadata.lastUpdated = lastUpdatedMatch[1].trim();
    
    const nextReviewMatch = metadataText.match(/Next Review\s*:\s*(.+)/i);
    if (nextReviewMatch) metadata.nextReview = nextReviewMatch[1].trim();
    
    const statusMatch = metadataText.match(/Status\s*:\s*(.+)/i);
    if (statusMatch) metadata.status = statusMatch[1].trim();
    
    const priorityMatch = metadataText.match(/Priority\s*:\s*(.+)/i);
    if (priorityMatch) metadata.priority = priorityMatch[1].trim();
    
    const categoryMatch = metadataText.match(/Category\s*:\s*(.+)/i);
    if (categoryMatch) metadata.category = categoryMatch[1].trim();
  }
  
  return metadata;
}

app.listen(PORT, () => {
  console.log(`Living docs server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET  /api/continuous-docs - Get all tracked documents');
  console.log('  PATCH /api/continuous-docs/:path/frequency - Update document frequency');
  console.log('  POST /api/continuous-docs/:path/update - Manually trigger update');
  console.log('  POST /api/continuous-docs - Add new document to tracking');
  console.log('  POST /api/cli-command - Execute CLI commands');
  console.log('  GET  /api/living-docs/priority-dashboard - Generate priority dashboard');
  console.log('  GET  /api/living-docs/documents - List all living documents');
});