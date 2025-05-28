"use strict";
/**
 * Classification Rollup Report
 *
 * Generates reports of subject classifications applied to different types of content:
 * 1. All expert documents in table_classifications
 * 2. Video files specifically from presentations (MP4 files with video_source_id)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateClassificationRollup = generateClassificationRollup;
const supabase_client_1 = require("../../../packages/shared/services/supabase-client");
const fs = __importStar(require("fs"));
const chalk_1 = __importDefault(require("chalk"));
/**
 * Generate a rollup report of subject classifications
 */
async function generateClassificationRollup(options) {
    const { outputPath, minCount = 1, format = 'markdown', includeSubjectInfo = true } = options;
    console.log(chalk_1.default.blue('Generating subject classification rollup report...'));
    const supabase = supabase_client_1.SupabaseClientService.getInstance().getClient();
    try {
        // First get a rollup of all expert_documents classifications
        console.log(chalk_1.default.blue('Fetching classification counts for all expert documents...'));
        // First get the list of subject classifications to have proper names available
        const { data: subjectsList, error: subjectsError } = await supabase
            .from('subject_classifications')
            .select('id, subject, subject_character');
        if (subjectsError) {
            console.error(chalk_1.default.red('Error fetching subject classifications:'), subjectsError.message);
            return;
        }
        // Create a lookup map for subject classifications
        const subjectsMap = {};
        subjectsList === null || subjectsList === void 0 ? void 0 : subjectsList.forEach(subject => {
            subjectsMap[subject.id] = subject;
        });
        // Get counts by subject_classification_id
        const { data: countData, error: countError } = await supabase.rpc('execute_sql', {
            sql: `
          SELECT 
            subject_classification_id, 
            COUNT(*) as count
          FROM table_classifications
          WHERE entity_type = 'google_expert_documents'
          GROUP BY subject_classification_id
          ORDER BY COUNT(*) DESC
        `
        });
        const allClassificationCounts = countData || [];
        if (countError) {
            console.error(chalk_1.default.red('Error fetching expert document classification counts:'), countError.message);
            return;
        }
        console.log(chalk_1.default.green(`Found ${(allClassificationCounts === null || allClassificationCounts === void 0 ? void 0 : allClassificationCounts.length) || 0} unique subject classifications for expert documents`));
        // Next, get a rollup of MP4 files from presentations
        console.log(chalk_1.default.blue('Fetching classification counts for presentation video files...'));
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
            console.error(chalk_1.default.red('Error fetching presentations with videos:'), presError.message);
            return;
        }
        console.log(chalk_1.default.green(`Found ${(presentationsWithVideo === null || presentationsWithVideo === void 0 ? void 0 : presentationsWithVideo.length) || 0} presentations with video sources`));
        // Extract the video source IDs
        const videoSourceIds = (presentationsWithVideo === null || presentationsWithVideo === void 0 ? void 0 : presentationsWithVideo.map(p => p.video_source_id)) || [];
        if (videoSourceIds.length === 0) {
            console.warn(chalk_1.default.yellow('No video sources found in presentations.'));
        }
        else {
            console.log(chalk_1.default.blue(`Fetching classifications for ${videoSourceIds.length} video sources...`));
            // Find classifications for these video source IDs using a SQL query
            const sourceIdsString = videoSourceIds.map(id => `'${id}'`).join(',');
            const { data: videoData, error: videoClassError } = await supabase.rpc('execute_sql', {
                sql: `
            SELECT 
              subject_classification_id, 
              COUNT(*) as count
            FROM table_classifications
            WHERE entity_type = 'google_sources'
            AND entity_id IN (${sourceIdsString})
            GROUP BY subject_classification_id
            ORDER BY COUNT(*) DESC
          `
            });
            const videoClassifications = videoData || [];
            if (videoClassError) {
                console.error(chalk_1.default.red('Error fetching video classification counts:'), videoClassError.message);
                return;
            }
            console.log(chalk_1.default.green(`Found ${(videoClassifications === null || videoClassifications === void 0 ? void 0 : videoClassifications.length) || 0} unique subject classifications for presentation videos`));
            // Process the results
            const allDocsClassifications = (allClassificationCounts === null || allClassificationCounts === void 0 ? void 0 : allClassificationCounts.filter((c) => c.count >= minCount).map((c) => {
                const subjectInfo = subjectsMap[c.subject_classification_id];
                return {
                    subject_id: c.subject_classification_id,
                    subject: (subjectInfo === null || subjectInfo === void 0 ? void 0 : subjectInfo.subject) || 'Unknown',
                    subject_character: (subjectInfo === null || subjectInfo === void 0 ? void 0 : subjectInfo.subject_character) || null,
                    count: parseInt(c.count)
                };
            })) || [];
            const videoOnlyClassifications = (videoClassifications === null || videoClassifications === void 0 ? void 0 : videoClassifications.filter((c) => c.count >= minCount).map((c) => {
                const subjectInfo = subjectsMap[c.subject_classification_id];
                return {
                    subject_id: c.subject_classification_id,
                    subject: (subjectInfo === null || subjectInfo === void 0 ? void 0 : subjectInfo.subject) || 'Unknown',
                    subject_character: (subjectInfo === null || subjectInfo === void 0 ? void 0 : subjectInfo.subject_character) || null,
                    count: parseInt(c.count),
                    video_count: parseInt(c.count)
                };
            })) || [];
            // Generate the report in the requested format
            if (format === 'json') {
                const reportData = {
                    allDocumentsClassifications: allDocsClassifications,
                    presentationVideoClassifications: videoOnlyClassifications,
                    generatedAt: new Date().toISOString()
                };
                if (outputPath) {
                    fs.writeFileSync(outputPath, JSON.stringify(reportData, null, 2));
                    console.log(chalk_1.default.green(`JSON report written to ${outputPath}`));
                }
                else {
                    console.log(chalk_1.default.green('Classification Rollup Report (JSON):'));
                    console.log(JSON.stringify(reportData, null, 2));
                }
            }
            else {
                // Generate markdown report
                let markdownReport = `# Subject Classification Rollup Report\n\n`;
                markdownReport += `Generated on: ${new Date().toLocaleString()}\n\n`;
                // All documents section
                markdownReport += `## All Expert Documents Classifications\n\n`;
                markdownReport += `Total unique classifications: ${allDocsClassifications.length}\n\n`;
                markdownReport += `| Subject | Character | Count |\n`;
                markdownReport += `|---------|-----------|-------|\n`;
                allDocsClassifications.forEach((c) => {
                    markdownReport += `| ${c.subject} | ${c.subject_character || ''} | ${c.count} |\n`;
                });
                // Video section
                markdownReport += `\n## Presentation Video Classifications\n\n`;
                markdownReport += `Total unique classifications for presentation videos: ${videoOnlyClassifications.length}\n\n`;
                markdownReport += `| Subject | Character | Count |\n`;
                markdownReport += `|---------|-----------|-------|\n`;
                videoOnlyClassifications.forEach((c) => {
                    markdownReport += `| ${c.subject} | ${c.subject_character || ''} | ${c.count} |\n`;
                });
                // Add a section with additional subject information if requested
                if (includeSubjectInfo) {
                    markdownReport += `\n## Complete Subject Information\n\n`;
                    // Get all the subject information
                    const { data: subjectInfo, error: subjectError } = await supabase
                        .from('subject_classifications')
                        .select('*')
                        .order('subject');
                    if (subjectError) {
                        console.error(chalk_1.default.red('Error fetching subject information:'), subjectError.message);
                    }
                    else if (subjectInfo) {
                        markdownReport += `Total subjects: ${subjectInfo.length}\n\n`;
                        markdownReport += `| Subject | Character | Associated Concepts |\n`;
                        markdownReport += `|---------|-----------|---------------------|\n`;
                        subjectInfo.forEach((s) => {
                            markdownReport += `| ${s.subject} | ${s.subject_character || ''} | ${s.associated_concepts || ''} |\n`;
                        });
                    }
                }
                if (outputPath) {
                    fs.writeFileSync(outputPath, markdownReport);
                    console.log(chalk_1.default.green(`Markdown report written to ${outputPath}`));
                }
                else {
                    console.log(chalk_1.default.green('Classification Rollup Report (Markdown):'));
                    console.log(markdownReport);
                }
            }
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('Error generating classification rollup:'), error instanceof Error ? error.message : String(error));
    }
}
