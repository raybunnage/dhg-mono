import { syncDocumentationToDatabase } from '@/api/markdown-report';

export async function POST() {
  try {
    console.log('Starting documentation sync from API route...');
    const result = await syncDocumentationToDatabase();
    console.log('Documentation sync completed with result:', result);
    
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error syncing documentation to database:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: `Error syncing documentation to database: ${error.message || 'Unknown error'}`
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}