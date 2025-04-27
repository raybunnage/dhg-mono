#!/usr/bin/env ts-node
import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';

const supabaseService = SupabaseClientService.getInstance();
const supabaseClient = supabaseService.getClient();

/**
 * Displays a list of unsupported document types in the system
 * This is a simplified version of the logic in update-media-document-types.ts
 * that only displays information without making any changes
 */
async function listUnsupportedDocumentTypes(options: { format?: string, debug?: boolean }) {
  const debug = options.debug || false;
  const format = options.format || 'console';

  // Track the command
  let trackingId: string;
  try {
    trackingId = await commandTrackingService.startTracking('google_sync', 'list-unsupported-document-types');
  } catch (error) {
    console.warn(`Warning: Unable to initialize command tracking: ${error instanceof Error ? error.message : String(error)}`);
    trackingId = 'tracking-unavailable';
  }

  try {
    // Test Supabase connection first
    console.log('Testing Supabase connection...');
    const connectionTest = await supabaseService.testConnection();
    
    if (!connectionTest.success) {
      throw new Error(`Supabase connection test failed: ${connectionTest.error}`);
    }
    
    console.log('✅ Supabase connection test successful');

    // For these specific IDs, we consider them unsupported
    const unsupportedDocumentTypeIds = [
      // Specifically requested IDs
      '6ece37e7-840d-4a0c-864d-9f1f971b1d7e', // m4a audio
      'e9d3e473-5315-4837-9f5f-61f150cbd137', // Code Documentation Markdown
      
      // Category: Audio
      '4edfb133-ffeb-4b9c-bfd4-79ee9a9d73af', // mp3 audio
      'd2206940-e4f3-476e-9245-0e1eb12fd195', // aac audio
      '8ce8fbbc-b397-4061-a80f-81402515503b', // m3u file
      'fe697fc5-933c-41c9-9b11-85e0defa86ed', // wav audio
      
      // Category: Image
      'db6518ad-765c-4a02-a684-9c2e49d77cf5', // png image
      '68b95822-2746-4ce1-ad35-34e5b0297177', // jpg image
      
      // Category: Video (except mp4 video)
      '3e7c880c-d821-4d01-8cc5-3547bdd2e347', // video mpeg
      'd70a258e-262b-4bb3-95e3-f826ee9b918b', // video quicktime
      '91fa92a3-d606-493b-832d-9ba1fa83dc9f', // video microsoft avi
      '28ab55b9-b408-486f-b1c3-8f0f0a174ad4', // m4v
      '2c1d3bdc-b429-4194-bec2-7e4bbb165dbf', // conf file (in video category)
      // Not included: 'ba1d7662-0168-4756-a2ea-6d964fd02ba8' (mp4 video) as requested
      
      // Category: Operations
      '53f42e7d-78bd-4bde-8106-dc12a4835695', // Document Processing Script
      '4fdbd8be-fe5a-4341-934d-2b6bd43be7be', // CI CD Pipeline Script
      'a1dddf8e-1264-4ec0-a5af-52eafb536ee3', // Deployment Script
      '561a86b0-7064-4c20-a40e-2ec6905c4a42', // Database Management Script
      'f7e83857-8bb8-4b18-9d8f-16d5cb783650', // Environment Setup Script
      
      // Category: Spreadsheet
      'b26a68ed-a0d1-415d-8271-cba875bfe3ce', // xlsx document
      '920893fc-f0be-4211-85b4-fc29882ade97', // google sheet
      
      // Other existing types
      'e29b5194-7ba0-4a3c-a7db-92b0d8adca6a', // Unknown Document Type
      '9dbe32ff-5e82-4586-be63-1445e5bcc548'  // Password Protected Document
    ];

    // Unsupported MIME types
    const unsupportedMimeTypes = [
      'application/vnd.google-apps.audio',
      'application/vnd.google-apps.video',
      'application/vnd.google-apps.drawing',
      'application/vnd.google-apps.form',
      'application/vnd.google-apps.map',
      'application/vnd.google-apps.presentation', // Google Slides
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/ogg',
      // 'video/mp4' - Removed as requested, this is now supported
      'video/mpeg',
      'video/quicktime',
      'video/x-msvideo',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/svg+xml'
    ];

    // Get document type information for display
    const { data: documentTypes, error: documentTypesError } = await supabaseClient
      .from('document_types')
      .select('id, document_type')
      .in('id', unsupportedDocumentTypeIds);

    if (documentTypesError) {
      console.error('Error fetching document types:', documentTypesError.message);
      throw new Error(`Failed to fetch document types: ${documentTypesError.message}`);
    }

    const documentTypeMap = new Map();
    if (documentTypes) {
      documentTypes.forEach(dt => {
        documentTypeMap.set(dt.id, dt.document_type);
      });
    }

    // First try by document type ID
    const { data: unsupportedSources, error: unsupportedError } = await supabaseClient
      .from('sources_google')
      .select('id, document_type_id, name, mime_type')
      .in('document_type_id', unsupportedDocumentTypeIds);
      
    // Then try by MIME type
    const { data: unsupportedMimeSources, error: unsupportedMimeError } = await supabaseClient
      .from('sources_google')
      .select('id, document_type_id, name, mime_type')
      .in('mime_type', unsupportedMimeTypes);

    // Combine the results from both queries
    let allUnsupportedSources: any[] = [];
    
    if (unsupportedError) {
      console.error('Error fetching unsupported document type sources:', unsupportedError.message);
    } else if (unsupportedSources && unsupportedSources.length > 0) {
      allUnsupportedSources = [...unsupportedSources];
    }
    
    if (unsupportedMimeError) {
      console.error('Error fetching unsupported MIME type sources:', unsupportedMimeError.message);
    } else if (unsupportedMimeSources && unsupportedMimeSources.length > 0) {
      // Append to the combined list, avoiding duplicates
      for (const source of unsupportedMimeSources) {
        if (!allUnsupportedSources.some(s => s.id === source.id)) {
          allUnsupportedSources.push(source);
        }
      }
    }

    // Output the results
    if (format === 'json') {
      // Output as JSON
      const formattedSources = allUnsupportedSources.map(s => ({
        id: s.id,
        name: s.name,
        document_type_id: s.document_type_id,
        document_type: documentTypeMap.get(s.document_type_id) || 'Unknown Type',
        mime_type: s.mime_type,
        reason: unsupportedDocumentTypeIds.includes(s.document_type_id) ? 
          'Unsupported document type' : 
          'Unsupported MIME type'
      }));
      
      console.log(JSON.stringify(formattedSources, null, 2));
    } else {
      // Output as console table
      console.log(`\nFound ${allUnsupportedSources.length} sources with unsupported types (by ID or MIME type):\n`);
      
      // Group by reason type for nicer display
      const byDocType = allUnsupportedSources.filter(s => unsupportedDocumentTypeIds.includes(s.document_type_id));
      const byMimeType = allUnsupportedSources.filter(s => unsupportedMimeTypes.includes(s.mime_type));
      
      if (byDocType.length > 0) {
        console.log(`\n=== Unsupported by Document Type (${byDocType.length}) ===`);
        console.log('ID                                   | Document Type                     | File Name');
        console.log('--------------------------------------|-----------------------------------|------------------------');
        
        byDocType.forEach(s => {
          const id = s.id.padEnd(36);
          const docType = (documentTypeMap.get(s.document_type_id) || 'Unknown Type').padEnd(35);
          const name = s.name.substring(0, 50);
          console.log(`${id} | ${docType} | ${name}`);
        });
      }
      
      if (byMimeType.length > 0) {
        console.log(`\n=== Unsupported by MIME Type (${byMimeType.length}) ===`);
        console.log('ID                                   | MIME Type                         | File Name');
        console.log('--------------------------------------|-----------------------------------|------------------------');
        
        byMimeType.forEach(s => {
          const id = s.id.padEnd(36);
          const mimeType = (s.mime_type || 'Unknown MIME').padEnd(35);
          const name = s.name.substring(0, 50);
          console.log(`${id} | ${mimeType} | ${name}`);
        });
      }
      
      console.log('\n=== Unsupported Document Type IDs ===');
      unsupportedDocumentTypeIds.forEach(id => {
        console.log(`${id} | ${documentTypeMap.get(id) || 'Unknown Type'}`);
      });
      
      console.log('\n=== Unsupported MIME Types ===');
      unsupportedMimeTypes.forEach(mime => {
        console.log(mime);
      });
    }

    // Complete tracking
    if (trackingId !== 'tracking-unavailable') {
      try {
        await commandTrackingService.completeTracking(trackingId, {
          recordsAffected: allUnsupportedSources.length,
          summary: `Listed ${allUnsupportedSources.length} unsupported document types`
        });
      } catch (error) {
        console.warn(`Warning: Unable to complete command tracking: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log(`\nUnsupported document types listing completed successfully`);
  } catch (error) {
    console.error(`Error listing unsupported document types: ${error instanceof Error ? error.message : String(error)}`);
    
    if (trackingId !== 'tracking-unavailable') {
      try {
        await commandTrackingService.failTracking(trackingId, `Command failed: ${error instanceof Error ? error.message : String(error)}`);
      } catch (trackingError) {
        console.warn(`Warning: Unable to record command failure: ${trackingError instanceof Error ? trackingError.message : String(trackingError)}`);
      }
    }
  }
}

// Set up CLI
const program = new Command();

program
  .name('list-unsupported-document-types')
  .description('List all unsupported document types in the system')
  .option('--format <format>', 'Output format (console or json)', 'console')
  .option('--debug', 'Show debug information')
  .action((options) => {
    listUnsupportedDocumentTypes({
      format: options.format,
      debug: options.debug
    });
  });

program.parse(process.argv);