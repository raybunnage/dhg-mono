import { processNextDocumentationQueueItem } from '@/api/markdown-report';

export async function POST() {
  try {
    const result = await processNextDocumentationQueueItem();
    
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error processing documentation queue item:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Error processing documentation queue item'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}