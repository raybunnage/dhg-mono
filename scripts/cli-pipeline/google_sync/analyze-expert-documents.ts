import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables properly
const envPaths = [
  path.resolve(process.cwd(), '.env.development'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'scripts/cli-pipeline/google_sync/.env')
];

// Try loading from each path
for (const envPath of envPaths) {
  dotenv.config({ path: envPath });
}

interface DocumentStat {
  processing_skip_reason: string | null;
  count: string;
}

async function analyzeExpertDocuments() {
  try {
    console.log("Initializing Supabase client...");
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // First test the connection
    const connectionTest = await supabase.from('expert_documents').select('id').limit(1);
    if (connectionTest.error) {
      throw new Error(`Supabase connection error: ${connectionTest.error.message}`);
    }
    console.log("Supabase connection successful");

    // Get count of expert_documents with sources_google relation
    const { data: totalCount, error: countError } = await supabase
      .from('expert_documents')
      .select('id', { count: 'exact', head: true })
      .not('google_file_id', 'is', null);
    
    if (countError) {
      throw new Error(`Error counting documents: ${countError.message}`);
    }
    
    console.log(`\nTotal expert documents with Google file IDs: ${totalCount}\n`);

    // Group by processing_skip_reason with direct SQL query since rpc isn't available
    const { data: skipReasonStats, error: statsError } = await supabase
      .from('expert_documents')
      .select(`
        processing_skip_reason,
        count(*)
      `)
      .not('google_file_id', 'is', null)
      .group('processing_skip_reason');
    
    if (statsError) {
      throw new Error(`Error getting skip reason stats: ${statsError.message}`);
    }

    console.log("Skip reason statistics:");
    console.log("=======================");
    
    if (skipReasonStats) {
      const sortedStats = [...skipReasonStats].sort((a: any, b: any) => {
        const countA = parseInt(a.count as string);
        const countB = parseInt(b.count as string);
        return countB - countA;
      });
      
      for (const stat of sortedStats) {
        console.log(`${stat.processing_skip_reason || 'No skip reason'}: ${stat.count}`);
      }
    }

    // Group by file extension and skip reason
    console.log("\nBreakdown by file extension and skip reason:");
    console.log("===========================================");
    
    const { data: extensionStats, error: extError } = await supabase
      .from('expert_documents')
      .select(`
        processing_skip_reason,
        sources_google!inner(file_extension),
        count(*)
      `)
      .not('google_file_id', 'is', null)
      .group('processing_skip_reason, sources_google.file_extension');
    
    if (extError) {
      throw new Error(`Error getting file extension stats: ${extError.message}`);
    }

    if (extensionStats) {
      // Group by extension first
      const extensionGroups: Record<string, any[]> = {};
      
      for (const stat of extensionStats) {
        const extension = stat.sources_google.file_extension || 'unknown';
        if (!extensionGroups[extension]) {
          extensionGroups[extension] = [];
        }
        extensionGroups[extension].push({
          skip_reason: stat.processing_skip_reason || 'No skip reason',
          count: stat.count
        });
      }
      
      // Print the grouped stats
      for (const [extension, stats] of Object.entries(extensionGroups)) {
        console.log(`\nFile extension: ${extension}`);
        console.log('-'.repeat(20));
        
        const sortedStats = [...stats].sort((a: any, b: any) => {
          const countA = parseInt(a.count as string);
          const countB = parseInt(b.count as string);
          return countB - countA;
        });
        
        for (const stat of sortedStats) {
          console.log(`${stat.skip_reason}: ${stat.count}`);
        }
      }
    }

    // Check the specific document mentioned in the issue
    console.log("\nChecking specific document with ID: 619a4fbf-20eb-42bf-930d-9a0d6e6e0ba8");
    console.log("======================================================================");
    
    const { data: specificDoc, error: docError } = await supabase
      .from('expert_documents')
      .select(`
        id,
        google_file_id,
        document_processing_status,
        processing_skip_reason,
        document_type_id,
        sources_google(
          file_id,
          file_name,
          file_extension,
          mime_type
        ),
        document_types(
          id,
          document_type,
          category
        )
      `)
      .eq('id', '619a4fbf-20eb-42bf-930d-9a0d6e6e0ba8')
      .single();
    
    if (docError) {
      throw new Error(`Error fetching specific document: ${docError.message}`);
    }
    
    console.log(JSON.stringify(specificDoc, null, 2));
    
    // Investigate classify-pdfs logic by examining the file
    console.log("\nAnalyzing documents that should be processed by classify-pdfs command:");
    console.log("===================================================================");
    
    // Let's analyze the logic in classify-pdfs-with-service.ts by checking the query
    const { data: eligibleDocs, error: eligibleError } = await supabase
      .from('expert_documents')
      .select(`
        id,
        google_file_id,
        document_processing_status,
        processing_skip_reason,
        sources_google!inner(
          file_id,
          file_name,
          file_extension,
          mime_type
        )
      `)
      .eq('document_processing_status', 'needs_reprocessing')
      .is('processing_skip_reason', null)
      .limit(10);
    
    if (eligibleError) {
      throw new Error(`Error fetching eligible documents: ${eligibleError.message}`);
    }
    
    console.log(`Found ${eligibleDocs?.length || 0} eligible documents for processing (sample of 10):`);
    
    if (eligibleDocs && eligibleDocs.length > 0) {
      for (const doc of eligibleDocs) {
        console.log(`- Doc ID: ${doc.id} | Google ID: ${doc.google_file_id} | File: ${doc.sources_google.file_name} | Extension: ${doc.sources_google.file_extension}`);
      }
    } else {
      console.log("No documents found that match the current criteria");
    }
    
    // Let's check what would happen if we ignore the processing_skip_reason filter
    console.log("\nDocuments that would be eligible if we ignored processing_skip_reason filter:");
    console.log("======================================================================");
    
    const { data: docsWithSkipReason, error: skipError } = await supabase
      .from('expert_documents')
      .select(`
        id,
        google_file_id,
        document_processing_status,
        processing_skip_reason,
        sources_google!inner(
          file_id,
          file_name,
          file_extension,
          mime_type
        )
      `)
      .eq('document_processing_status', 'needs_reprocessing')
      .not('processing_skip_reason', 'is', null)
      .limit(10);
    
    if (skipError) {
      throw new Error(`Error fetching docs with skip reason: ${skipError.message}`);
    }
    
    console.log(`Found ${docsWithSkipReason?.length || 0} documents with skip reasons that need reprocessing (sample of 10):`);
    
    if (docsWithSkipReason && docsWithSkipReason.length > 0) {
      for (const doc of docsWithSkipReason) {
        console.log(`- Doc ID: ${doc.id} | Skip reason: "${doc.processing_skip_reason}" | File: ${doc.sources_google.file_name}`);
      }
    } else {
      console.log("No documents found with skip reasons");
    }
    
    // Check our specific document that has "Unsupported document type - skip processing"
    if (specificDoc && specificDoc.processing_skip_reason) {
      console.log("\nReason why our example document is being skipped:");
      console.log("==================================================");
      console.log(`Document ID: ${specificDoc.id}`);
      console.log(`Skip reason: "${specificDoc.processing_skip_reason}"`);
      console.log(`Document type: ${specificDoc.document_types?.document_type || 'Unknown'}`);
      console.log(`File extension: ${specificDoc.sources_google?.file_extension || 'Unknown'}`);
      console.log(`MIME type: ${specificDoc.sources_google?.mime_type || 'Unknown'}`);
    }
    
    // Count documents by processing status
    console.log("\nDocument processing status statistics:");
    console.log("=====================================");
    
    const { data: statusStats, error: statusError } = await supabase
      .from('expert_documents')
      .select(`
        document_processing_status,
        count(*)
      `)
      .not('google_file_id', 'is', null)
      .group('document_processing_status');
    
    if (statusError) {
      console.log(`Error getting status stats: ${statusError.message}`);
    } else if (statusStats) {
      for (const stat of statusStats) {
        console.log(`${stat.document_processing_status || 'No status'}: ${stat.count}`);
      }
    }

  } catch (error) {
    console.error('Error analyzing expert documents:', error);
  }
}

// Run the analysis
analyzeExpertDocuments();