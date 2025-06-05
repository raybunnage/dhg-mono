/**
 * Compare Presentations Assets Command
 * 
 * Compares presentations against presentation_assets to identify presentations
 * that don't have at least one associated record in the presentation_assets table.
 */
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils/logger';

interface ComparePresentationsAssetsOptions {
  limit?: number;
  verbose?: boolean;
  idWidth?: number;
  nameWidth?: number;
}

/**
 * Compares presentations against presentation_assets to identify presentations
 * that don't have at least one associated record in the presentation_assets table.
 */
export async function comparePresentationsAssetsCommand(options: ComparePresentationsAssetsOptions): Promise<void> {
  const {
    limit = 0,
    verbose = false,
    idWidth = 40,
    nameWidth = 60
  } = options;

  try {
    Logger.info('Comparing presentations against presentation_assets...');
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // 1. Get all presentations
    Logger.info('Fetching all presentations...');
    const { data: presentations, error: presentationsError } = await supabase
      .from('presentations')
      .select('id, title, high_level_folder_source_id')
      .order('created_at', { ascending: false });
      
    if (presentationsError) {
      Logger.error(`Error fetching presentations: ${presentationsError.message}`);
      return;
    }
    
    if (!presentations || presentations.length === 0) {
      Logger.info('No presentations found.');
      return;
    }
    
    Logger.info(`Found ${presentations.length} presentations.`);
    
    // 2. Get all presentation_assets
    Logger.info('Fetching all presentation_assets...');
    const { data: assets, error: assetsError } = await supabase
      .from('presentation_assets')
      .select('presentation_id')
      .order('created_at', { ascending: false });
      
    if (assetsError) {
      Logger.error(`Error fetching presentation_assets: ${assetsError.message}`);
      return;
    }
    
    if (!assets || assets.length === 0) {
      Logger.info('No presentation_assets found.');
      // In this case, all presentations are missing assets
      displayMissingAssets(presentations, presentations, new Set<string>(), idWidth, nameWidth);
      return;
    }
    
    Logger.info(`Found ${assets.length} presentation_assets records.`);
    
    // 3. Get unique presentation IDs in the assets table
    const presentationIdsWithAssets = new Set(assets.map(asset => asset.presentation_id));
    Logger.info(`Found ${presentationIdsWithAssets.size} unique presentations with assets.`);
    
    // 4. Find presentations without assets
    const presentationsWithoutAssets = presentations.filter(
      presentation => !presentationIdsWithAssets.has(presentation.id)
    );
    
    Logger.info(`Found ${presentationsWithoutAssets.length} presentations without assets.`);
    
    // 5. Get sources_google data for high-level folders
    const highLevelFolderIds = presentationsWithoutAssets
      .map(p => p.high_level_folder_source_id)
      .filter(id => id !== null);
      
    let sourcesMap: Record<string, any> = {};
    
    if (highLevelFolderIds.length > 0) {
      Logger.info('Fetching high-level folder information...');
      
      // Process in batches to avoid query size limits
      const BATCH_SIZE = 20;
      
      for (let i = 0; i < highLevelFolderIds.length; i += BATCH_SIZE) {
        const batchIds = highLevelFolderIds.slice(i, i + BATCH_SIZE);
        Logger.info(`Fetching sources batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(highLevelFolderIds.length/BATCH_SIZE)}...`);
        
        const { data: sources, error: sourcesError } = await supabase
          .from('google_sources')
          .select('id, name')
          .in('id', batchIds);
          
        if (sourcesError) {
          Logger.error(`Error fetching sources batch ${Math.floor(i/BATCH_SIZE) + 1}: ${sourcesError.message}`);
          continue;
        }
        
        // Add to our sources map
        sources?.forEach(source => {
          sourcesMap[source.id] = source;
        });
      }
      
      Logger.info(`Fetched information for ${Object.keys(sourcesMap).length} high-level folders.`);
    }
    
    // 6. Display the results
    displayMissingAssets(
      presentations, 
      presentationsWithoutAssets,
      presentationIdsWithAssets,
      idWidth,
      nameWidth,
      sourcesMap,
      limit
    );
    
  } catch (error) {
    Logger.error(`Error in compare-presentations-assets command: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Display presentations without assets
 */
function displayMissingAssets(
  allPresentations: any[],
  presentationsWithoutAssets: any[],
  presentationIdsWithAssets: Set<string>,
  idWidth: number = 40,
  nameWidth: number = 60,
  sourcesMap: Record<string, any> = {},
  limit: number = 0
): void {
  const totalCount = allPresentations.length;
  const missingCount = presentationsWithoutAssets.length;
  const missingPercent = totalCount > 0 ? ((missingCount / totalCount) * 100).toFixed(2) : '0';
  
  console.log('\nPresentations Summary:');
  console.log('====================');
  console.log(`Total presentations: ${totalCount}`);
  console.log(`Presentations with assets: ${totalCount - missingCount} (${(100 - parseFloat(missingPercent)).toFixed(2)}%)`);
  console.log(`Presentations without assets: ${missingCount} (${missingPercent}%)`);
  
  if (missingCount === 0) {
    console.log('\n✅ All presentations have associated assets. Nothing to report.');
    return;
  }
  
  console.log('\nPresentations Without Assets:');
  console.log('===========================');
  console.log(`${'Source ID'.padEnd(idWidth)} | ${'Source Name'.padEnd(nameWidth)} | ${'Presentation Title'.padEnd(60)}`);
  console.log(`${'-'.repeat(idWidth)} | ${'-'.repeat(nameWidth)} | ${'-'.repeat(60)}`);
  
  // Apply limit if specified
  const displayList = limit > 0 && limit < presentationsWithoutAssets.length
    ? presentationsWithoutAssets.slice(0, limit)
    : presentationsWithoutAssets;
  
  for (const presentation of displayList) {
    const sourceId = presentation.high_level_folder_source_id || 'Unknown';
    const source = sourcesMap[sourceId];
    const sourceName = source ? source.name : 'Unknown Source';
    const title = presentation.title || 'No title';
    
    console.log(
      `${sourceId.substring(0, idWidth).padEnd(idWidth)} | ${
      sourceName.substring(0, nameWidth).padEnd(nameWidth)} | ${
      title.substring(0, 60).padEnd(60)}`
    );
  }
  
  if (limit > 0 && limit < presentationsWithoutAssets.length) {
    console.log(`\n... and ${presentationsWithoutAssets.length - limit} more (use --limit 0 to see all)`);
  }
  
  console.log('\nRecommendation:');
  console.log('- Use the presentations CLI to create assets for these presentations');
  console.log('- Example: presentations-cli create-missing-assets --presentation-id <id>');
}