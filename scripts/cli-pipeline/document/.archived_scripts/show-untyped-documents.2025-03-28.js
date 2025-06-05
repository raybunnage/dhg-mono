/**
 * Show Untyped Documents
 * 
 * Displays documents that don't have a document type assigned
 */

const { getUntypedDocuments } = require('../shared/document-service-adapter');

// Get environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Get optional limit
const limit = parseInt(process.env.LIMIT || '20', 10);

/**
 * Show untyped documents
 */
async function showUntypedFiles() {
  try {
    console.log(`Fetching up to ${limit} untyped document files...`);
    
    // Get untyped documents
    const documents = await getUntypedDocuments(supabaseUrl, supabaseKey, limit);
    
    if (!documents || documents.length === 0) {
      console.log('No untyped files found.');
      return { success: true, count: 0 };
    }
    
    console.log(`Found ${documents.length} untyped document files:`);
    console.log('----------------------------------------------');
    
    // Format the data as a table
    console.log('ID         | Title                    | Path                                    | Updated At');
    console.log('-----------|--------------------------|----------------------------------------|------------------');
    
    documents.forEach((file, index) => {
      const id = file.id ? file.id.substring(0, 8) + '...' : 'No ID'; // Show only first 8 chars of UUID
      const title = (file.title || 'No title').padEnd(24).substring(0, 24);
      const path = (file.file_path || 'No path').padEnd(39).substring(0, 39);
      const updated = file.updated_at ? new Date(file.updated_at).toISOString().split('T')[0] : 'No date';
      
      console.log(`${id} | ${title} | ${path} | ${updated}`);
    });
    
    console.log('----------------------------------------------');
    console.log(`Total: ${documents.length} untyped documents`);
    
    return { success: true, count: documents.length };
  } catch (error) {
    console.error('Error in show untyped files process:', error);
    return { success: false, count: 0 };
  }
}

// Run the show untyped files process
showUntypedFiles()
  .then(({ success, count }) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error in show untyped files process:', error);
    process.exit(1);
  });