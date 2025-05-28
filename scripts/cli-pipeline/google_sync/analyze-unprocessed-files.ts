import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { format } from 'date-fns';

async function analyzeUnprocessedFiles() {
  const supabase = SupabaseClientService.getInstance().getClient();
  const rootDriveId = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';

  console.log('🔍 Analyzing unprocessed files in sources_google...\n');

  // 1. Get count by mime_type for files without expert_documents
  console.log('📊 Count of sources_google records WITHOUT expert_documents by mime_type:');
  console.log('=' .repeat(80));
  
  // First, let's get all sources_google records for the root drive
  const { data: allSources, error: sourcesError } = await supabase
    .from('google_sources')
    .select('id, drive_id, mime_type, name, path, path_depth, modified_at, size')
    .eq('root_drive_id', rootDriveId)
    .eq('is_deleted', false);

  if (sourcesError) {
    console.error('Error fetching sources:', sourcesError);
    return;
  }

  // Get all expert_documents source_ids
  const { data: expertDocs, error: expertError } = await supabase
    .from('google_expert_documents')
    .select('source_id');

  if (expertError) {
    console.error('Error fetching expert documents:', expertError);
    return;
  }

  // Create a set of source_ids that have expert_documents
  const processedSourceIds = new Set(expertDocs?.map(doc => doc.source_id) || []);

  // Filter sources that don't have expert_documents
  const unprocessedSources = allSources?.filter(source => 
    !processedSourceIds.has(source.id)
  ) || [];

  // Count by mime_type
  const mimeTypeCounts = unprocessedSources.reduce((acc: Record<string, number>, source) => {
    const type = source.mime_type || 'NULL';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  // Sort and display
  const sortedCounts = Object.entries(mimeTypeCounts)
    .sort(([, a], [, b]) => b - a);

  sortedCounts.forEach(([mimeType, count]) => {
    console.log(`${mimeType.padEnd(50)} ${count}`);
  });

  console.log(`\nTotal unprocessed files: ${unprocessedSources.length}`);

  // 2. Get examples of different file types
  console.log('\n📄 Examples of unprocessed files by type:');
  console.log('=' .repeat(80));

  const mimeTypes = [
    'application/vnd.google-apps.folder',
    'application/pdf',
    'video/mp4',
    'audio/mpeg',
    'application/vnd.google-apps.document',
    'application/vnd.google-apps.presentation',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png'
  ];

  for (const mimeType of mimeTypes) {
    console.log(`\n${mimeType}:`);
    console.log('-'.repeat(80));

    // Get up to 3 examples of this mime type without expert_documents
    const examples = unprocessedSources
      .filter(source => source.mime_type === mimeType)
      .slice(0, 3);

    if (examples.length === 0) {
      console.log('  No unprocessed files of this type');
      continue;
    }

    // Display each example
    for (const example of examples) {
      console.log(`  📁 ${example.name}`);
      console.log(`     Source ID: ${example.id}`);
      console.log(`     Drive ID: ${example.drive_id}`);
      console.log(`     Path: ${example.path || 'N/A'}`);
      console.log(`     Depth: ${example.path_depth}`);
      console.log(`     Modified: ${example.modified_at ? format(new Date(example.modified_at), 'yyyy-MM-dd HH:mm') : 'N/A'}`);
      if (example.size) {
        console.log(`     Size: ${(example.size / 1024 / 1024).toFixed(2)} MB`);
      }
    }
  }

  // 3. Summary statistics
  console.log('\n📈 Summary Statistics:');
  console.log('=' .repeat(80));

  // Total counts
  const { count: totalSourcesGoogle } = await supabase
    .from('google_sources')
    .select('*', { count: 'exact', head: true })
    .eq('root_drive_id', rootDriveId)
    .eq('is_deleted', false);

  const { count: totalExpertDocs } = await supabase
    .from('google_expert_documents')
    .select('*', { count: 'exact', head: true });

  console.log(`Total sources_google records (DHG root): ${totalSourcesGoogle || 0}`);
  console.log(`Total expert_documents records (all): ${totalExpertDocs || 0}`);
  console.log(`\nProcessed files (have expert_documents): ${processedSourceIds.size}`);
  console.log(`Unprocessed files (no expert_documents): ${unprocessedSources.length}`);
  console.log(`Processing rate: ${((processedSourceIds.size / (totalSourcesGoogle || 1)) * 100).toFixed(1)}%`);

  // 4. Breakdown by file type (not folders)
  console.log('\n📊 Unprocessed files by category:');
  console.log('=' .repeat(80));

  const categories = {
    'Documents': ['application/vnd.google-apps.document', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
    'Presentations': ['application/vnd.google-apps.presentation', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    'PDFs': ['application/pdf'],
    'Videos': ['video/mp4', 'video/quicktime', 'video/x-msvideo'],
    'Audio': ['audio/mpeg', 'audio/mp3', 'audio/wav'],
    'Images': ['image/jpeg', 'image/png', 'image/gif'],
    'Folders': ['application/vnd.google-apps.folder']
  };

  for (const [category, mimeTypes] of Object.entries(categories)) {
    const count = unprocessedSources.filter(source => 
      mimeTypes.includes(source.mime_type || '')
    ).length;
    
    if (count > 0) {
      console.log(`${category.padEnd(20)} ${count}`);
    }
  }

  // 5. Check if recursive search is finding nested files
  console.log('\n🔍 Checking folder depth distribution:');
  console.log('=' .repeat(80));
  
  const depthCounts: Record<number, number> = {};
  unprocessedSources.forEach(source => {
    const depth = source.path_depth ?? -1;
    depthCounts[depth] = (depthCounts[depth] || 0) + 1;
  });
  
  Object.entries(depthCounts)
    .sort(([a], [b]) => Number(a) - Number(b))
    .forEach(([depth, count]) => {
      console.log(`Depth ${depth}: ${count} files`);
    });
}

// Run the analysis
analyzeUnprocessedFiles().catch(console.error);