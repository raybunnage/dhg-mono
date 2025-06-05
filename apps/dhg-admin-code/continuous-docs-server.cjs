const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.CONTINUOUS_DOCS_PORT || 3008; // New port for this server

const PROJECT_ROOT = path.join(__dirname, '../..');
const DOCS_DIR = path.join(PROJECT_ROOT, 'docs');
const CONTINUOUSLY_UPDATED_DIR = path.join(DOCS_DIR, 'continuously-updated');
const TRACKING_FILE = path.join(CONTINUOUSLY_UPDATED_DIR, '.tracking.json');

// Enable CORS for the Vite dev server
app.use(cors({
  origin: ['http://localhost:5177', 'http://localhost:5173'],
  credentials: true
}));

app.use(express.json());

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

// Get all tracked documents
app.get('/api/continuous-docs', async (req, res) => {
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

app.listen(PORT, () => {
  console.log(`Continuous docs server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET  /api/continuous-docs - Get all tracked documents');
  console.log('  PATCH /api/continuous-docs/:path/frequency - Update document frequency');
  console.log('  POST /api/continuous-docs/:path/update - Manually trigger update');
  console.log('  POST /api/continuous-docs - Add new document to tracking');
});