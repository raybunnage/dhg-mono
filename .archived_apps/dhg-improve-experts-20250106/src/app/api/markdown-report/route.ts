import { generateMarkdownReport } from '@/api/markdown-report';

export async function POST() {
  try {
    const result = await generateMarkdownReport();
    
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error generating markdown report:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Error generating markdown report'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}