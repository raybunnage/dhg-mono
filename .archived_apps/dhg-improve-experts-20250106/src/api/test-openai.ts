import { openai } from '@/lib/openai';

export async function testOpenAI(req: Request) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: "This is a test message. Please respond with 'OpenAI connection working.'"
        }
      ],
      max_tokens: 10
    });

    return new Response(JSON.stringify({ 
      success: true,
      message: completion.choices[0].message.content 
    }));

  } catch (error) {
    console.error('OpenAI test failed:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), { status: 500 });
  }
} 