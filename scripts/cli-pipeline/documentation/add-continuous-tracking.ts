#!/usr/bin/env ts-node
import { promises as fs } from 'fs';
import path from 'path';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const PROJECT_ROOT = path.join(__dirname, '../../..');
const DOCS_DIR = path.join(PROJECT_ROOT, 'docs');
const CONTINUOUSLY_UPDATED_DIR = path.join(DOCS_DIR, 'continuously-updated');
const TRACKING_FILE = path.join(CONTINUOUSLY_UPDATED_DIR, '.tracking.json');

interface TrackedDocument {
  originalPath: string;
  fileName: string;
  category: string;
  addedDate: string;
  lastUpdated: string;
  updateFrequency?: 'daily' | 'weekly' | 'on-change';
  description?: string;
}

interface TrackingData {
  documents: TrackedDocument[];
}

async function loadTrackingData(): Promise<TrackingData> {
  try {
    const data = await fs.readFile(TRACKING_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { documents: [] };
  }
}

async function saveTrackingData(data: TrackingData): Promise<void> {
  await fs.mkdir(CONTINUOUSLY_UPDATED_DIR, { recursive: true });
  await fs.writeFile(TRACKING_FILE, JSON.stringify(data, null, 2));
}

async function addDocumentToTracking(docPath: string, options: {
  category?: string;
  frequency?: 'daily' | 'weekly' | 'on-change';
  description?: string;
} = {}): Promise<void> {
  // Resolve the document path
  const absolutePath = path.isAbsolute(docPath) ? docPath : path.join(PROJECT_ROOT, docPath);
  
  // Check if file exists
  try {
    await fs.access(absolutePath);
  } catch {
    console.error(`Error: File not found: ${absolutePath}`);
    process.exit(1);
  }
  
  // Get relative path from project root
  const relativePath = path.relative(PROJECT_ROOT, absolutePath);
  const fileName = path.basename(absolutePath);
  
  // Determine category from path if not provided
  const category = options.category || determineCategory(relativePath);
  
  // Load existing tracking data
  const trackingData = await loadTrackingData();
  
  // Check if already tracked
  const existingIndex = trackingData.documents.findIndex(doc => doc.originalPath === relativePath);
  if (existingIndex >= 0) {
    console.log(`Document already tracked: ${relativePath}`);
    console.log('Updating tracking information...');
    trackingData.documents[existingIndex] = {
      ...trackingData.documents[existingIndex],
      category,
      lastUpdated: new Date().toISOString(),
      updateFrequency: options.frequency || trackingData.documents[existingIndex].updateFrequency,
      description: options.description || trackingData.documents[existingIndex].description
    };
  } else {
    // Add new document to tracking
    const trackedDoc: TrackedDocument = {
      originalPath: relativePath,
      fileName,
      category,
      addedDate: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      updateFrequency: options.frequency || 'weekly',
      description: options.description
    };
    
    trackingData.documents.push(trackedDoc);
    console.log(`Added to continuous tracking: ${relativePath}`);
  }
  
  // Copy the file to continuously-updated folder
  const categoryDir = path.join(CONTINUOUSLY_UPDATED_DIR, category);
  await fs.mkdir(categoryDir, { recursive: true });
  
  const destPath = path.join(categoryDir, fileName);
  await fs.copyFile(absolutePath, destPath);
  console.log(`Copied to: ${path.relative(PROJECT_ROOT, destPath)}`);
  
  // Save tracking data
  await saveTrackingData(trackingData);
  
  // Also track in database if available
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    await supabase.from('doc_continuous_tracking').upsert({
      file_path: relativePath,
      file_name: fileName,
      category,
      update_frequency: options.frequency || 'weekly',
      description: options.description,
      last_updated: new Date().toISOString()
    }, {
      onConflict: 'file_path'
    });
  } catch (error) {
    console.warn('Warning: Could not update database tracking:', error);
  }
}

function determineCategory(filePath: string): string {
  if (filePath.includes('technical-specs')) return 'technical-specs';
  if (filePath.includes('solution-guides')) return 'solution-guides';
  if (filePath.includes('script-reports')) return 'script-reports';
  if (filePath.includes('code-documentation')) return 'code-documentation';
  if (filePath.includes('cli-pipeline')) return 'cli-pipeline';
  if (filePath.includes('deployment')) return 'deployment';
  if (filePath.includes('CLAUDE.md')) return 'project-instructions';
  return 'general';
}

// CLI execution
if (require.main === module) {
  const [docPath, category, frequency, description] = process.argv.slice(2);
  
  if (!docPath) {
    console.error('Usage: add-continuous-tracking.ts <document-path> [category] [frequency] [description]');
    console.error('Frequency options: daily, weekly, on-change');
    process.exit(1);
  }
  
  addDocumentToTracking(docPath, {
    category,
    frequency: frequency as any,
    description
  }).catch(console.error);
}

export { addDocumentToTracking, TrackedDocument, TrackingData };