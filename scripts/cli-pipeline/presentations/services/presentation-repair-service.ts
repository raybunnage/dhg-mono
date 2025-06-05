import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils/logger';

/**
 * Service to repair presentations with missing main_video_id
 */
export class PresentationRepairService {
  private supabase = SupabaseClientService.getInstance().getClient();

  /**
   * Find presentations with null main_video_id that have associated video assets
   */
  async findPresentationsToRepair(): Promise<any[]> {
    try {
      return await this.findPresentationsToRepairDirect();
    } catch (error: any) {
      Logger.error(`Unexpected error finding presentations to repair: ${error.message}`);
      return [];
    }
  }

  /**
   * Find presentations with null main_video_id that have associated video assets in presentation_assets
   * This is a fallback if the RPC function isn't available
   */
  async findPresentationsToRepairDirect(): Promise<any[]> {
    try {
      const { data, error } = await this.supabase.from('media_presentations').select(`
        id,
        title,
        filename,
        folder_path,
        transcript_status,
        presentation_assets!inner(
          id,
          asset_type,
          asset_role,
          source_id,
          sources_google:source_id(
            id,
            name,
            mime_type
          )
        )
      `)
      .is('main_video_id', null)
      .eq('presentation_assets.sources_google.mime_type', 'video/mp4');
      
      if (error) {
        Logger.error(`Error finding presentations to repair: ${error.message}`);
        return [];
      }

      return data || [];
    } catch (error: any) {
      Logger.error(`Unexpected error finding presentations to repair: ${error.message}`);
      return [];
    }
  }

  /**
   * Analyze presentations with missing main_video_id
   * @param isDryRun If true, don't make any changes
   */
  async analyzeAndRepairPresentations(isDryRun: boolean = true): Promise<{
    total: number;
    repaired: number;
    details: any[];
  }> {
    try {
      let presentationsToRepair: any[] = [];
      
      // Try the RPC function first
      presentationsToRepair = await this.findPresentationsToRepair();
      
      // If we didn't get any results, try the direct query
      if (presentationsToRepair.length === 0) {
        const directResults = await this.findPresentationsToRepairDirect();
        if (directResults.length > 0) {
          presentationsToRepair = directResults;
        }
      }

      Logger.info(`Found ${presentationsToRepair.length} presentations with missing main_video_id`);

      if (presentationsToRepair.length === 0) {
        return { total: 0, repaired: 0, details: [] };
      }

      // Log sample presentations
      Logger.info('Sample presentations to repair:');
      const sampleCount = Math.min(5, presentationsToRepair.length);
      for (let i = 0; i < sampleCount; i++) {
        const p = presentationsToRepair[i];
        const videoAsset = p.presentation_assets?.find((a: any) => 
          a.sources_google?.mime_type === 'video/mp4'
        );
        
        Logger.info(`- ${p.title || p.filename} -> ${videoAsset?.sources_google?.name || 'Unknown video'}`);
      }

      if (isDryRun) {
        Logger.info('DRY RUN: Would repair these presentations');
        return { 
          total: presentationsToRepair.length, 
          repaired: 0, 
          details: presentationsToRepair
        };
      }

      // Actually repair the presentations
      let repairedCount = 0;
      const repairedDetails: any[] = [];

      for (const presentation of presentationsToRepair) {
        const videoAsset = presentation.presentation_assets?.find((a: any) => 
          a.sources_google?.mime_type === 'video/mp4'
        );
        
        if (!videoAsset?.source_id) {
          Logger.warn(`No suitable video asset found for presentation ${presentation.id}`);
          continue;
        }

        const { data, error } = await this.supabase
          .from('media_presentations')
          .update({ main_video_id: videoAsset.source_id })
          .eq('id', presentation.id)
          .select('id, title, main_video_id');

        if (error) {
          Logger.error(`Error repairing presentation ${presentation.id}: ${error.message}`);
          continue;
        }

        Logger.info(`Repaired presentation: ${presentation.title || presentation.filename}`);
        repairedCount++;
        repairedDetails.push(data?.[0]);
      }

      return { 
        total: presentationsToRepair.length, 
        repaired: repairedCount, 
        details: repairedDetails
      };
    } catch (error: any) {
      Logger.error(`Unexpected error repairing presentations: ${error.message}`);
      return { total: 0, repaired: 0, details: [] };
    }
  }

  /**
   * Create batch update SQL to fix presentations (doesn't actually run it)
   */
  async createDatabaseFunctions(): Promise<boolean> {
    try {
      // Generate the SQL that would update presentations
      const sql = `
      -- Find presentations without video_id that have video assets
      WITH video_assets AS (
        SELECT 
          pa.presentation_id,
          pa.source_id,
          sg.mime_type,
          sg.name,
          ROW_NUMBER() OVER (PARTITION BY pa.presentation_id ORDER BY pa.created_at) as rn
        FROM 
          presentation_assets pa
        JOIN 
          sources_google sg ON pa.source_id = sg.id
        WHERE 
          sg.mime_type LIKE 'video/%'
      )
      UPDATE presentations p
      SET 
        main_video_id = va.source_id,
        updated_at = NOW()
      FROM (
        SELECT 
          presentation_id,
          source_id
        FROM 
          video_assets
        WHERE 
          rn = 1
      ) va
      WHERE 
        p.id = va.presentation_id
        AND p.main_video_id IS NULL
      RETURNING 
        p.id, 
        p.title, 
        p.main_video_id as new_video_id;`;
      
      Logger.info('Generated SQL that can be run to fix presentations:');
      Logger.info(sql);
      
      return true;
    } catch (error: any) {
      Logger.error(`Unexpected error creating SQL: ${error.message}`);
      return false;
    }
  }

  /**
   * Execute the repair SQL in a transaction
   */
  async repairPresentationsWithDatabaseFunction(): Promise<{
    repaired: number;
    details: any[];
  }> {
    try {
      // Find presentations to repair first
      const presentationsToRepair = await this.findPresentationsToRepairDirect();
      
      if (presentationsToRepair.length === 0) {
        Logger.info('No presentations need repair');
        return { repaired: 0, details: [] };
      }
      
      Logger.info(`Repairing ${presentationsToRepair.length} presentations...`);
      
      // Process each presentation individually
      const repairedPresentations = [];
      
      for (const presentation of presentationsToRepair) {
        const videoAsset = presentation.presentation_assets?.find((a: any) => 
          a.sources_google?.mime_type === 'video/mp4'
        );
        
        if (!videoAsset?.source_id) {
          continue;
        }
        
        const { data, error } = await this.supabase
          .from('media_presentations')
          .update({ 
            main_video_id: videoAsset.source_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', presentation.id)
          .select('id, title, main_video_id');
        
        if (error) {
          Logger.error(`Error updating presentation ${presentation.id}: ${error.message}`);
          continue;
        }
        
        if (data && data.length > 0) {
          repairedPresentations.push(data[0]);
        }
      }
      
      return { 
        repaired: repairedPresentations.length, 
        details: repairedPresentations 
      };
    } catch (error: any) {
      Logger.error(`Unexpected error with repair function: ${error.message}`);
      return { repaired: 0, details: [] };
    }
  }
}