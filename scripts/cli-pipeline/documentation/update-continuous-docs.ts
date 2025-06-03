#!/usr/bin/env ts-node
import { promises as fs } from 'fs';
import path from 'path';
import { differenceInDays, differenceInHours } from 'date-fns';
import { TrackingData, TrackedDocument } from './add-continuous-tracking';

const PROJECT_ROOT = path.join(__dirname, '../../..');
const DOCS_DIR = path.join(PROJECT_ROOT, 'docs');
const CONTINUOUSLY_UPDATED_DIR = path.join(DOCS_DIR, 'continuously-updated');
const TRACKING_FILE = path.join(CONTINUOUSLY_UPDATED_DIR, '.tracking.json');

async function loadTrackingData(): Promise<TrackingData> {
  try {
    const data = await fs.readFile(TRACKING_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { documents: [] };
  }
}

async function saveTrackingData(data: TrackingData): Promise<void> {
  await fs.writeFile(TRACKING_FILE, JSON.stringify(data, null, 2));
}

async function shouldUpdate(doc: TrackedDocument): Promise<boolean> {
  const lastUpdated = new Date(doc.lastUpdated);
  const now = new Date();
  
  switch (doc.updateFrequency) {
    case 'daily':
      return differenceInHours(now, lastUpdated) >= 24;
    case 'weekly':
      return differenceInDays(now, lastUpdated) >= 7;
    case 'on-change':
      // Check if source file has been modified
      try {
        const sourcePath = path.join(PROJECT_ROOT, doc.originalPath);
        const stats = await fs.stat(sourcePath);
        return stats.mtime > lastUpdated;
      } catch {
        return false;
      }
    default:
      return differenceInDays(now, lastUpdated) >= 7;
  }
}

async function updateContinuousDocs(options: { force?: boolean } = {}): Promise<void> {
  const { force = false } = options;
  
  console.log('Updating continuously tracked documents...');
  
  const trackingData = await loadTrackingData();
  if (trackingData.documents.length === 0) {
    console.log('No documents are currently being tracked.');
    return;
  }
  
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  
  for (const doc of trackingData.documents) {
    const sourcePath = path.join(PROJECT_ROOT, doc.originalPath);
    const destPath = path.join(CONTINUOUSLY_UPDATED_DIR, doc.category, doc.fileName);
    
    try {
      // Check if update is needed
      if (!force && !(await shouldUpdate(doc))) {
        console.log(`Skipping ${doc.fileName} - not due for update`);
        skippedCount++;
        continue;
      }
      
      // Check if source file exists
      await fs.access(sourcePath);
      
      // Copy the updated file
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.copyFile(sourcePath, destPath);
      
      // Update tracking data
      doc.lastUpdated = new Date().toISOString();
      
      console.log(`✓ Updated: ${doc.fileName} (${doc.category})`);
      updatedCount++;
      
    } catch (error) {
      console.error(`✗ Error updating ${doc.fileName}:`, error.message);
      errorCount++;
    }
  }
  
  // Save updated tracking data
  await saveTrackingData(trackingData);
  
  // Generate update report
  const reportPath = path.join(CONTINUOUSLY_UPDATED_DIR, 'UPDATE_LOG.md');
  const reportContent = `# Continuous Update Log\n\n` +
    `Last update: ${new Date().toISOString()}\n\n` +
    `## Summary\n` +
    `- Documents updated: ${updatedCount}\n` +
    `- Documents skipped: ${skippedCount}\n` +
    `- Errors encountered: ${errorCount}\n\n` +
    `## Tracked Documents\n\n` +
    trackingData.documents.map(doc => 
      `### ${doc.fileName}\n` +
      `- Category: ${doc.category}\n` +
      `- Update Frequency: ${doc.updateFrequency || 'weekly'}\n` +
      `- Last Updated: ${doc.lastUpdated}\n` +
      `- Original Path: ${doc.originalPath}\n` +
      (doc.description ? `- Description: ${doc.description}\n` : '') +
      '\n'
    ).join('');
  
  await fs.writeFile(reportPath, reportContent);
  
  console.log(`\nUpdate complete: ${updatedCount} updated, ${skippedCount} skipped, ${errorCount} errors`);
  console.log(`Update log written to: ${path.relative(PROJECT_ROOT, reportPath)}`);
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const options: { force?: boolean } = {};
  
  if (args.includes('--force')) {
    options.force = true;
  }
  
  updateContinuousDocs(options).catch(console.error);
}

export { updateContinuousDocs };