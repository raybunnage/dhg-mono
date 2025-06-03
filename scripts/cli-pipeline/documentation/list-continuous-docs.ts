#!/usr/bin/env ts-node
import { promises as fs } from 'fs';
import path from 'path';
import { format, formatDistanceToNow } from 'date-fns';
import { TrackingData } from './add-continuous-tracking';

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

async function listContinuousDocs(): Promise<void> {
  const trackingData = await loadTrackingData();
  
  if (trackingData.documents.length === 0) {
    console.log('No documents are currently being tracked for continuous updates.');
    console.log('\nTo add a document to tracking, use:');
    console.log('  ./scripts/cli-pipeline/documentation/documentation-cli.sh add-continuous <file-path>');
    return;
  }
  
  console.log('Continuously Tracked Documents');
  console.log('==============================\n');
  
  // Group by category
  const byCategory = trackingData.documents.reduce((acc, doc) => {
    if (!acc[doc.category]) {
      acc[doc.category] = [];
    }
    acc[doc.category].push(doc);
    return acc;
  }, {} as Record<string, typeof trackingData.documents>);
  
  // Display by category
  for (const [category, docs] of Object.entries(byCategory)) {
    console.log(`\n## ${category.toUpperCase()}`);
    console.log('-'.repeat(50));
    
    for (const doc of docs) {
      const lastUpdatedDate = new Date(doc.lastUpdated);
      const addedDate = new Date(doc.addedDate);
      
      console.log(`\n📄 ${doc.fileName}`);
      console.log(`   Path: ${doc.originalPath}`);
      console.log(`   Update Frequency: ${doc.updateFrequency || 'weekly'}`);
      console.log(`   Last Updated: ${formatDistanceToNow(lastUpdatedDate)} ago`);
      console.log(`   Added: ${format(addedDate, 'yyyy-MM-dd')}`);
      
      if (doc.description) {
        console.log(`   Description: ${doc.description}`);
      }
      
      // Check if source file still exists
      try {
        const sourcePath = path.join(PROJECT_ROOT, doc.originalPath);
        await fs.access(sourcePath);
      } catch {
        console.log(`   ⚠️  WARNING: Source file no longer exists!`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`Total tracked documents: ${trackingData.documents.length}`);
  
  // Show next update times
  console.log('\nNext Update Schedule:');
  const now = new Date();
  
  for (const doc of trackingData.documents) {
    const lastUpdated = new Date(doc.lastUpdated);
    let nextUpdate: Date;
    
    switch (doc.updateFrequency) {
      case 'daily':
        nextUpdate = new Date(lastUpdated.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
      default:
        nextUpdate = new Date(lastUpdated.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'on-change':
        continue; // Skip on-change documents
    }
    
    if (nextUpdate <= now) {
      console.log(`  ⏰ ${doc.fileName} - Update due NOW`);
    } else {
      console.log(`  📅 ${doc.fileName} - Due ${formatDistanceToNow(nextUpdate, { addSuffix: true })}`);
    }
  }
  
  console.log('\nUseful Commands:');
  console.log('  Update all due documents: ./scripts/cli-pipeline/documentation/documentation-cli.sh update-continuous');
  console.log('  Force update all: ./scripts/cli-pipeline/documentation/documentation-cli.sh update-continuous --force');
  console.log('  Add new document: ./scripts/cli-pipeline/documentation/documentation-cli.sh add-continuous <path>');
}

// CLI execution
if (require.main === module) {
  listContinuousDocs().catch(console.error);
}

export { listContinuousDocs };