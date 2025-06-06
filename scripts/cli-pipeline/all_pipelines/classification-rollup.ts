/**
 * Classification Rollup Report
 * 
 * Generates reports of subject classifications applied to different types of content:
 * 1. All expert documents in learn_document_classifications
 * 2. Video files specifically from presentations (MP4 files with video_source_id)
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';

interface ClassificationRollupOptions {
  outputPath?: string;
  minCount?: number;
  format?: 'markdown' | 'json';
  includeSubjectInfo?: boolean;
}

interface SubjectClassificationCount {
  subject_id: string;
  subject: string;
  subject_character?: string | null;
  count: number;
}

interface PresentationVideoClassification extends SubjectClassificationCount {
  video_count: number;
}

/**
 * Generate a rollup report of subject classifications
 */
export async function generateClassificationRollup(options: ClassificationRollupOptions): Promise<void> {
  const {
    outputPath,
    minCount = 1,
    format = 'markdown',
    includeSubjectInfo = true
  } = options;

  console.log(chalk.blue('Generating subject classification rollup report...'));
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // First get a rollup of all expert_documents classifications
    console.log(chalk.blue('Fetching classification counts for all expert documents...'));
    
    // First get the list of subject classifications to have proper names available
    const { data: subjectsList, error: subjectsError } = await supabase
      .from('learn_subject_classifications')
      .select('id, subject, subject_character');
      
    if (subjectsError) {
      console.error(chalk.red('Error fetching subject classifications:'), subjectsError.message);
      return;
    }
    
    // Create a lookup map for subject classifications
    const subjectsMap: Record<string, any> = {};
    subjectsList?.forEach(subject => {
      subjectsMap[subject.id] = subject;
    });
    
    // Get counts by subject_classification_id
    const { data: countData, error: countError } = await supabase.rpc(
      'execute_sql',
      {
        sql: `
          SELECT 
            subject_classification_id, 
            COUNT(*) as count
          FROM learn_document_classifications
          WHERE entity_type = 'google_expert_documents'
          GROUP BY subject_classification_id
          ORDER BY COUNT(*) DESC
        `
      }
    );
    
    const allClassificationCounts = countData || [];
    
    if (countError) {
      console.error(chalk.red('Error fetching expert document classification counts:'), countError.message);
      return;
    }
    
    console.log(chalk.green(`Found ${allClassificationCounts?.length || 0} unique subject classifications for expert documents`));
    
    // Next, get a rollup of MP4 files from presentations
    console.log(chalk.blue('Fetching classification counts for presentation video files...'));
    
    // We need to:
    // 1. Find presentations with video_source_id
    // 2. Get those source IDs
    // 3. Find classifications for those sources
    
    // First get all presentations with video source IDs
    const { data: presentationsWithVideo, error: presError } = await supabase
      .from('presentations')
      .select('id, video_source_id, title')
      .not('video_source_id', 'is', null);
      
    if (presError) {
      console.error(chalk.red('Error fetching presentations with videos:'), presError.message);
      return;
    }
    
    console.log(chalk.green(`Found ${presentationsWithVideo?.length || 0} presentations with video sources`));
    
    // Extract the video source IDs
    const videoSourceIds = presentationsWithVideo?.map(p => p.video_source_id) || [];
    
    if (videoSourceIds.length === 0) {
      console.warn(chalk.yellow('No video sources found in presentations.'));
    } else {
      console.log(chalk.blue(`Fetching classifications for ${videoSourceIds.length} video sources...`));
      
      // Find classifications for these video source IDs using a SQL query
      const sourceIdsString = videoSourceIds.map(id => `'${id}'`).join(',');
      const { data: videoData, error: videoClassError } = await supabase.rpc(
        'execute_sql', 
        {
          sql: `
            SELECT 
              subject_classification_id, 
              COUNT(*) as count
            FROM learn_document_classifications
            WHERE entity_type = 'google_sources'
            AND entity_id IN (${sourceIdsString})
            GROUP BY subject_classification_id
            ORDER BY COUNT(*) DESC
          `
        }
      );
      
      const videoClassifications = videoData || [];
      
      if (videoClassError) {
        console.error(chalk.red('Error fetching video classification counts:'), videoClassError.message);
        return;
      }
      
      console.log(chalk.green(`Found ${videoClassifications?.length || 0} unique subject classifications for presentation videos`));
      
      // Process the results
      const allDocsClassifications = allClassificationCounts?.filter(
        (c: any) => c.count >= minCount
      ).map((c: any) => {
        const subjectInfo = subjectsMap[c.subject_classification_id];
        return {
          subject_id: c.subject_classification_id,
          subject: subjectInfo?.subject || 'Unknown',
          subject_character: subjectInfo?.subject_character || null,
          count: parseInt(c.count)
        };
      }) || [];
      
      const videoOnlyClassifications = videoClassifications?.filter(
        (c: any) => c.count >= minCount
      ).map((c: any) => {
        const subjectInfo = subjectsMap[c.subject_classification_id];
        return {
          subject_id: c.subject_classification_id,
          subject: subjectInfo?.subject || 'Unknown',
          subject_character: subjectInfo?.subject_character || null,
          count: parseInt(c.count),
          video_count: parseInt(c.count)
        };
      }) || [];
      
      // Generate the report in the requested format
      if (format === 'json') {
        const reportData = {
          allDocumentsClassifications: allDocsClassifications,
          presentationVideoClassifications: videoOnlyClassifications,
          generatedAt: new Date().toISOString()
        };
        
        if (outputPath) {
          fs.writeFileSync(outputPath, JSON.stringify(reportData, null, 2));
          console.log(chalk.green(`JSON report written to ${outputPath}`));
        } else {
          console.log(chalk.green('Classification Rollup Report (JSON):'));
          console.log(JSON.stringify(reportData, null, 2));
        }
      } else {
        // Generate markdown report
        let markdownReport = `# Subject Classification Rollup Report\n\n`;
        markdownReport += `Generated on: ${new Date().toLocaleString()}\n\n`;
        
        // All documents section
        markdownReport += `## All Expert Documents Classifications\n\n`;
        markdownReport += `Total unique classifications: ${allDocsClassifications.length}\n\n`;
        markdownReport += `| Subject | Character | Count |\n`;
        markdownReport += `|---------|-----------|-------|\n`;
        
        allDocsClassifications.forEach((c: SubjectClassificationCount) => {
          markdownReport += `| ${c.subject} | ${c.subject_character || ''} | ${c.count} |\n`;
        });
        
        // Video section
        markdownReport += `\n## Presentation Video Classifications\n\n`;
        markdownReport += `Total unique classifications for presentation videos: ${videoOnlyClassifications.length}\n\n`;
        markdownReport += `| Subject | Character | Count |\n`;
        markdownReport += `|---------|-----------|-------|\n`;
        
        videoOnlyClassifications.forEach((c: PresentationVideoClassification) => {
          markdownReport += `| ${c.subject} | ${c.subject_character || ''} | ${c.count} |\n`;
        });
        
        // Add a section with additional subject information if requested
        if (includeSubjectInfo) {
          markdownReport += `\n## Complete Subject Information\n\n`;
          
          // Get all the subject information
          const { data: subjectInfo, error: subjectError } = await supabase
            .from('learn_subject_classifications')
            .select('*')
            .order('subject');
            
          if (subjectError) {
            console.error(chalk.red('Error fetching subject information:'), subjectError.message);
          } else if (subjectInfo) {
            markdownReport += `Total subjects: ${subjectInfo.length}\n\n`;
            markdownReport += `| Subject | Character | Associated Concepts |\n`;
            markdownReport += `|---------|-----------|---------------------|\n`;
            
            subjectInfo.forEach((s: any) => {
              markdownReport += `| ${s.subject} | ${s.subject_character || ''} | ${s.associated_concepts || ''} |\n`;
            });
          }
        }
        
        if (outputPath) {
          fs.writeFileSync(outputPath, markdownReport);
          console.log(chalk.green(`Markdown report written to ${outputPath}`));
        } else {
          console.log(chalk.green('Classification Rollup Report (Markdown):'));
          console.log(markdownReport);
        }
      }
    }
  } catch (error) {
    console.error(chalk.red('Error generating classification rollup:'), error instanceof Error ? error.message : String(error));
  }
}